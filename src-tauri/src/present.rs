//! Presentation mode: an audience window (fullscreen, external screen by default) and a
//! presenter window (notes, next slide, timer) on the other screen. Rust owns the shared
//! state (current slide, blank screen) and broadcasts it as the `present:status` event.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use ts_rs::TS;

use crate::document::Presentation;
use crate::error::{AppError, AppResult};

pub const AUDIENCE: &str = "audience";
pub const PRESENTER: &str = "presenter";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Blank {
    #[default]
    None,
    Black,
    White,
}

#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct PresentStatus {
    /// Index among the visible (not hidden) slides.
    pub index: usize,
    pub count: usize,
    pub blank: Blank,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export)]
pub enum NavAction {
    Next,
    Prev,
    First,
    Last,
    Goto { index: usize },
    Black,
    White,
}

impl PresentStatus {
    pub fn apply(&mut self, action: NavAction) {
        let last = self.count.saturating_sub(1);
        // Any move clears a blank screen; pressing B/W again toggles it.
        match action {
            NavAction::Black | NavAction::White => {
                let target = if action == NavAction::Black {
                    Blank::Black
                } else {
                    Blank::White
                };
                self.blank = if self.blank == target {
                    Blank::None
                } else {
                    target
                };
                return;
            }
            NavAction::Next => self.index = (self.index + 1).min(last),
            NavAction::Prev => self.index = self.index.saturating_sub(1),
            NavAction::First => self.index = 0,
            NavAction::Last => self.index = last,
            NavAction::Goto { index } => self.index = index.min(last),
        }
        self.blank = Blank::None;
    }
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct PresentSnapshot {
    pub doc: Presentation,
    pub status: PresentStatus,
}

#[derive(Default)]
pub struct PresentState(Mutex<Option<PresentSnapshot>>);

impl PresentState {
    fn lock(&self) -> std::sync::MutexGuard<'_, Option<PresentSnapshot>> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

// ---------------------------------------------------------------- screen layout

#[derive(Debug, Clone, PartialEq)]
pub struct Screen {
    pub name: String,
    /// Logical position and size.
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub primary: bool,
}

/// Built-in laptop panels: the presenter view goes there, the audience elsewhere.
fn is_internal(name: &str) -> bool {
    ["eDP", "LVDS", "DSI"].iter().any(|p| name.starts_with(p))
}

#[derive(Debug, PartialEq)]
pub struct Layout {
    pub audience: Option<usize>,
    pub presenter: Option<usize>,
}

/// Audience on an external screen and presenter on the main one. With a single screen the
/// audience gets it (no presenter view); `rehearse` uses plain windows on the current screen.
pub fn choose_layout(screens: &[Screen], rehearse: bool) -> Layout {
    if rehearse || screens.is_empty() {
        return Layout {
            audience: None,
            presenter: None,
        };
    }
    if screens.len() == 1 {
        return Layout {
            audience: Some(0),
            presenter: None,
        };
    }
    let main = screens
        .iter()
        .position(|s| is_internal(&s.name))
        .or_else(|| screens.iter().position(|s| s.primary))
        .unwrap_or(0);
    let audience = (0..screens.len()).find(|&i| i != main);
    Layout {
        audience,
        presenter: Some(main),
    }
}

fn hyprland() -> bool {
    std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_some()
}

/// Hyprland's monitors. On Wayland apps can't place windows, so we focus a monitor and let
/// the next window open there.
fn hyprland_screens() -> Vec<Screen> {
    let output = std::process::Command::new("hyprctl")
        .args(["-j", "monitors"])
        .output();
    let Ok(output) = output else {
        return Vec::new();
    };
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap_or_default();
    value
        .as_array()
        .map(|monitors| {
            monitors
                .iter()
                .map(|m| Screen {
                    name: m["name"].as_str().unwrap_or_default().into(),
                    x: m["x"].as_f64().unwrap_or_default(),
                    y: m["y"].as_f64().unwrap_or_default(),
                    width: m["width"].as_f64().unwrap_or_default(),
                    height: m["height"].as_f64().unwrap_or_default(),
                    primary: m["focused"].as_bool().unwrap_or(false),
                })
                .collect()
        })
        .unwrap_or_default()
}

fn hyprland_focus(name: &str) {
    let _ = std::process::Command::new("hyprctl")
        .args(["dispatch", "focusmonitor", name])
        .output();
}

fn tauri_screens(app: &AppHandle) -> Vec<Screen> {
    let primary = app.primary_monitor().ok().flatten();
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|m| {
            let scale = m.scale_factor();
            let pos = m.position().to_logical::<f64>(scale);
            let size = m.size().to_logical::<f64>(scale);
            Screen {
                name: m.name().cloned().unwrap_or_default(),
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
                primary: primary
                    .as_ref()
                    .is_some_and(|p| p.position() == m.position()),
            }
        })
        .collect()
}

fn open_window(
    app: &AppHandle,
    label: &str,
    title: &str,
    screen: Option<&Screen>,
    fullscreen: bool,
    hypr: bool,
) -> AppResult<()> {
    let url = WebviewUrl::App(format!("index.html#{label}").into());
    let mut builder = WebviewWindowBuilder::new(app, label, url).title(title);
    match screen {
        Some(s) if hypr => {
            hyprland_focus(&s.name);
            builder = builder.fullscreen(fullscreen).maximized(!fullscreen);
        }
        Some(s) => {
            builder = builder
                .position(s.x, s.y)
                .inner_size(s.width, s.height)
                .fullscreen(fullscreen)
                .maximized(!fullscreen);
        }
        None => builder = builder.inner_size(1280.0, 760.0),
    }
    builder
        .build()
        .map(|_| ())
        .map_err(|e| AppError::Io(std::io::Error::other(e.to_string())))
}

fn close_windows(app: &AppHandle) {
    for label in [AUDIENCE, PRESENTER] {
        if let Some(w) = app.get_webview_window(label) {
            let _ = w.destroy();
        }
    }
}

// ---------------------------------------------------------------- commands

#[tauri::command]
pub fn start_presentation(
    app: AppHandle,
    state: tauri::State<'_, PresentState>,
    doc: Presentation,
    start: usize,
    rehearse: bool,
) -> AppResult<()> {
    let count = doc.slides.iter().filter(|s| !s.hidden).count();
    if count == 0 {
        return Err(AppError::InvalidDocument("no visible slides".into()));
    }
    *state.lock() = None;
    close_windows(&app);
    *state.lock() = Some(PresentSnapshot {
        doc,
        status: PresentStatus {
            index: start.min(count - 1),
            count,
            blank: Blank::None,
        },
    });

    let hypr = hyprland() && !rehearse;
    let screens = if hypr {
        hyprland_screens()
    } else {
        tauri_screens(&app)
    };
    let layout = choose_layout(&screens, rehearse);
    let audience = layout.audience.map(|i| &screens[i]);
    let presenter = layout.presenter.map(|i| &screens[i]);

    if rehearse {
        open_window(&app, PRESENTER, "Tiza — Presentador", None, false, false)?;
        open_window(&app, AUDIENCE, "Tiza — Público", None, false, false)?;
    } else {
        // Presenter first, so with Hyprland the audience is the last (focused) fullscreen.
        if let Some(screen) = presenter {
            open_window(
                &app,
                PRESENTER,
                "Tiza — Presentador",
                Some(screen),
                false,
                hypr,
            )?;
        }
        open_window(&app, AUDIENCE, "Tiza — Público", audience, true, hypr)?;
        // Keep keyboard focus (and the clicker) on the presenter view when there is one.
        if let Some(screen) = presenter {
            if hypr {
                hyprland_focus(&screen.name);
            }
            if let Some(w) = app.get_webview_window(PRESENTER) {
                let _ = w.set_focus();
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn presentation_snapshot(state: tauri::State<'_, PresentState>) -> Option<PresentSnapshot> {
    state.lock().clone()
}

#[tauri::command]
pub fn present_nav(
    app: AppHandle,
    state: tauri::State<'_, PresentState>,
    action: NavAction,
) -> Option<PresentStatus> {
    let status = {
        let mut guard = state.lock();
        let snapshot = guard.as_mut()?;
        snapshot.status.apply(action);
        snapshot.status.clone()
    };
    let _ = app.emit("present:status", &status);
    Some(status)
}

#[tauri::command]
pub fn end_presentation(app: AppHandle, state: tauri::State<'_, PresentState>) {
    end(&app, &state);
}

/// Closes both windows and tells the editor which slide was showing.
pub fn end(app: &AppHandle, state: &PresentState) {
    let Some(snapshot) = state.lock().take() else {
        return;
    };
    close_windows(app);
    let _ = app.emit("present:ended", snapshot.status.index);
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn screen(name: &str, primary: bool) -> Screen {
        Screen {
            name: name.into(),
            x: 0.0,
            y: 0.0,
            width: 1920.0,
            height: 1080.0,
            primary,
        }
    }

    #[test]
    fn audience_goes_to_the_external_screen() {
        let laptop_plus_projector = [screen("HDMI-A-1", true), screen("eDP-1", false)];
        assert_eq!(
            choose_layout(&laptop_plus_projector, false),
            Layout {
                audience: Some(0),
                presenter: Some(1)
            }
        );
        let two_desktop_monitors = [screen("DP-1", false), screen("DP-2", true)];
        assert_eq!(
            choose_layout(&two_desktop_monitors, false),
            Layout {
                audience: Some(0),
                presenter: Some(1)
            }
        );
    }

    #[test]
    fn single_screen_and_rehearsal() {
        assert_eq!(
            choose_layout(&[screen("eDP-1", true)], false),
            Layout {
                audience: Some(0),
                presenter: None
            }
        );
        assert_eq!(
            choose_layout(&[screen("eDP-1", true), screen("HDMI-A-1", false)], true),
            Layout {
                audience: None,
                presenter: None
            }
        );
    }

    #[test]
    fn navigation_stays_in_range_and_toggles_blank() {
        let mut s = PresentStatus {
            index: 0,
            count: 3,
            blank: Blank::None,
        };
        s.apply(NavAction::Prev);
        assert_eq!(s.index, 0);
        s.apply(NavAction::Last);
        s.apply(NavAction::Next);
        assert_eq!(s.index, 2);
        s.apply(NavAction::Goto { index: 99 });
        assert_eq!(s.index, 2);
        s.apply(NavAction::Black);
        assert_eq!(s.blank, Blank::Black);
        s.apply(NavAction::Black);
        assert_eq!(s.blank, Blank::None);
        s.apply(NavAction::White);
        s.apply(NavAction::First);
        assert_eq!((s.index, s.blank), (0, Blank::None));
    }

    #[test]
    fn nav_actions_parse_from_json() {
        let a: NavAction = serde_json::from_str(r#"{"kind":"goto","index":4}"#).unwrap();
        assert_eq!(a, NavAction::Goto { index: 4 });
        let a: NavAction = serde_json::from_str(r#"{"kind":"next"}"#).unwrap();
        assert_eq!(a, NavAction::Next);
    }
}
