//! App-wide preferences stored in the config directory. They are read before Tauri starts,
//! because some (the GPU) must be set as environment variables before the web engine loads.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::gpu;

const IDENTIFIER: &str = "dev.humbe.tiza";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum GpuPreference {
    /// Let the system decide (on laptops: the integrated, power-saving GPU).
    #[default]
    Default,
    /// Ask for the dedicated GPU.
    HighPerformance,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub gpu: GpuPreference,
}

/// Same folder Tauri uses for `app_config_dir()`.
pub fn config_dir() -> Option<PathBuf> {
    let base = if cfg!(target_os = "windows") {
        std::env::var_os("APPDATA").map(PathBuf::from)
    } else if cfg!(target_os = "macos") {
        std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library/Application Support"))
    } else {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))
    };
    base.map(|b| b.join(IDENTIFIER))
}

fn settings_path() -> Option<PathBuf> {
    config_dir().map(|d| d.join("settings.json"))
}

/// Exists while a launch with the dedicated GPU has not shown the UI yet.
fn pending_marker() -> Option<PathBuf> {
    config_dir().map(|d| d.join("gpu-launch-pending"))
}

pub fn load() -> Settings {
    settings_path()
        .and_then(|p| fs::read(p).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

pub fn save(settings: &Settings) -> std::io::Result<()> {
    let path = settings_path().ok_or_else(|| std::io::Error::other("no config directory"))?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::write(
        path,
        serde_json::to_vec_pretty(settings).map_err(std::io::Error::from)?,
    )
}

/// Environment variables that request the dedicated GPU on this platform.
pub fn high_performance_env(devices: &[gpu::GpuDevice]) -> Vec<(&'static str, &'static str)> {
    if cfg!(target_os = "windows") {
        return vec![(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--force_high_performance_gpu",
        )];
    }
    if !cfg!(target_os = "linux") {
        return Vec::new();
    }
    let nvidia = devices
        .iter()
        .any(|d| !d.primary && d.driver.as_deref() == Some("nvidia"));
    if nvidia {
        vec![
            ("__NV_PRIME_RENDER_OFFLOAD", "1"),
            ("__GLX_VENDOR_LIBRARY_NAME", "nvidia"),
            ("__VK_LAYER_NV_optimus", "NVIDIA_only"),
        ]
    } else if devices.len() > 1 {
        vec![("DRI_PRIME", "1")]
    } else {
        Vec::new()
    }
}

/// Linux: WebKitGTK's DMA-BUF renderer fails to paint iframes on some GPUs/compositors
/// (HTML simulations showed as an empty box on Intel + Hyprland). The shared-memory path
/// still uses the GPU for compositing. Users can override it by setting the variable.
pub fn apply_webkit_workarounds() {
    if cfg!(target_os = "linux") && std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        // SAFETY: runs at startup on the main thread before any other thread exists.
        unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
    }
}

/// Called first thing in `run()`, before any thread or the web engine exists.
pub fn apply_gpu_preference() {
    let mut settings = load();
    if settings.gpu != GpuPreference::HighPerformance {
        return;
    }
    let marker = pending_marker();
    if marker.as_ref().is_some_and(|m| m.exists()) {
        // The last launch with the dedicated GPU never showed the UI: fall back for good.
        settings.gpu = GpuPreference::Default;
        let _ = save(&settings);
        if let Some(m) = marker {
            let _ = fs::remove_file(m);
        }
        return;
    }
    if let Some(m) = &marker {
        let _ = fs::write(m, b"");
    }
    for (key, value) in high_performance_env(&gpu::report().devices) {
        if std::env::var_os(key).is_none() {
            // SAFETY: runs at startup on the main thread before any other thread exists.
            unsafe { std::env::set_var(key, value) };
        }
    }
}

/// The UI rendered fine: the chosen GPU works.
pub fn confirm_launch() {
    if let Some(m) = pending_marker() {
        let _ = fs::remove_file(m);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dev(driver: &str, primary: bool) -> gpu::GpuDevice {
        gpu::GpuDevice {
            name: "x".into(),
            vendor: "x".into(),
            driver: Some(driver.into()),
            primary,
        }
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn picks_prime_variables_on_linux() {
        let nvidia = high_performance_env(&[dev("i915", true), dev("nvidia", false)]);
        assert!(nvidia.contains(&("__NV_PRIME_RENDER_OFFLOAD", "1")));
        let amd = high_performance_env(&[dev("i915", true), dev("amdgpu", false)]);
        assert_eq!(amd, vec![("DRI_PRIME", "1")]);
        assert!(high_performance_env(&[dev("i915", true)]).is_empty());
    }

    #[test]
    fn settings_parse_with_missing_fields() {
        let s: Settings = serde_json::from_str("{}").unwrap();
        assert_eq!(s.gpu, GpuPreference::Default);
        let s: Settings = serde_json::from_str(r#"{"gpu":"highPerformance"}"#).unwrap();
        assert_eq!(s.gpu, GpuPreference::HighPerformance);
    }
}
