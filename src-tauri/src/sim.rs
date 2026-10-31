//! Serves embedded HTML pages under the `tizasim://` scheme. A separate scheme gives each
//! page its own Content-Security-Policy (an `srcdoc` iframe would inherit the app's CSP,
//! which forbids inline scripts) while the iframe sandbox keeps it isolated from the app.

use std::collections::VecDeque;
use std::sync::Mutex;

use sha2::{Digest, Sha256};
use tauri::http::{Response, StatusCode, header};

/// Keep the latest pages only: editing HTML registers a new version on every pause.
const CAPACITY: usize = 64;

const OFFLINE_CSP: &str = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: data:; \
     style-src 'unsafe-inline' blob: data:; img-src blob: data:; font-src blob: data:; \
     media-src blob: data:; worker-src blob:; connect-src blob: data:";

const NETWORK_CSP: &str = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https: blob: data:; \
     style-src 'unsafe-inline' https: blob: data:; img-src https: blob: data:; \
     font-src https: blob: data:; media-src https: blob: data:; worker-src blob: https:; \
     connect-src https: wss: blob: data:";

/// Keep in sync with `simCsp` in src/elements/sim/csp.ts (used by the web version).
pub fn sim_csp(allow_network: bool) -> &'static str {
    if allow_network {
        NETWORK_CSP
    } else {
        OFFLINE_CSP
    }
}

struct Page {
    id: String,
    html: String,
    allow_network: bool,
}

#[derive(Default)]
pub struct SimPages(Mutex<VecDeque<Page>>);

impl SimPages {
    /// Stores a page and returns its id (a content hash, so identical pages share it).
    pub fn register(&self, html: String, allow_network: bool) -> String {
        let mut hasher = Sha256::new();
        hasher.update([u8::from(allow_network)]);
        hasher.update(html.as_bytes());
        let id: String = hasher.finalize()[..16]
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();

        let mut pages = self.0.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(pos) = pages.iter().position(|p| p.id == id) {
            if let Some(page) = pages.remove(pos) {
                pages.push_back(page);
            }
        } else {
            pages.push_back(Page {
                id: id.clone(),
                html,
                allow_network,
            });
            while pages.len() > CAPACITY {
                pages.pop_front();
            }
        }
        id
    }

    pub fn respond(&self, path: &str) -> Response<Vec<u8>> {
        let id = path.trim_start_matches('/');
        let pages = self.0.lock().unwrap_or_else(|e| e.into_inner());
        let Some(page) = pages.iter().find(|p| p.id == id) else {
            return Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Vec::new())
                .unwrap_or_default();
        };
        Response::builder()
            .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
            .header(header::CONTENT_SECURITY_POLICY, sim_csp(page.allow_network))
            .header(header::CACHE_CONTROL, "no-store")
            .header("X-Content-Type-Options", "nosniff")
            .body(page.html.clone().into_bytes())
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serves_registered_pages_with_their_csp() {
        let pages = SimPages::default();
        let id = pages.register("<p>hola</p>".into(), false);
        let res = pages.respond(&format!("/{id}"));
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(res.body(), b"<p>hola</p>");
        let csp = res.headers()[header::CONTENT_SECURITY_POLICY]
            .to_str()
            .unwrap();
        assert!(!csp.contains("https:"));
        assert_eq!(pages.respond("/unknown").status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn same_content_same_id_and_network_changes_it() {
        let pages = SimPages::default();
        let a = pages.register("x".into(), false);
        assert_eq!(a, pages.register("x".into(), false));
        assert_ne!(a, pages.register("x".into(), true));
    }

    #[test]
    fn keeps_only_the_latest_pages() {
        let pages = SimPages::default();
        let first = pages.register("page 0".into(), false);
        for i in 1..=CAPACITY {
            pages.register(format!("page {i}"), false);
        }
        assert_eq!(
            pages.respond(&format!("/{first}")).status(),
            StatusCode::NOT_FOUND
        );
    }
}
