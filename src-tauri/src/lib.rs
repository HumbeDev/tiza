pub mod archive;
pub mod commands;
pub mod document;
pub mod error;
pub mod sim;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(sim::SimPages::default())
        .register_uri_scheme_protocol("tizasim", |ctx, request| {
            ctx.app_handle()
                .state::<sim::SimPages>()
                .respond(request.uri().path())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_version,
            commands::open_presentation,
            commands::save_presentation,
            commands::startup_file,
            commands::write_recovery,
            commands::read_recovery,
            commands::clear_recovery,
            commands::register_sim,
            commands::read_html_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::commands::app_version;

    #[test]
    fn app_version_matches_cargo_manifest() {
        assert_eq!(app_version(), env!("CARGO_PKG_VERSION"));
    }
}
