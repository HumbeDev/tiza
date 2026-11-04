pub mod archive;
pub mod assets;
pub mod commands;
pub mod document;
pub mod error;
pub mod gpu;
pub mod mcp;
pub mod media;
pub mod present;
pub mod settings;
pub mod sim;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    settings::apply_webkit_workarounds();
    settings::apply_gpu_preference();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(sim::SimPages::default())
        .manage(assets::AssetStore::for_session())
        .register_uri_scheme_protocol("tizaasset", |ctx, request| {
            ctx.app_handle()
                .state::<assets::AssetStore>()
                .respond(&request)
        })
        .manage(present::PresentState::default())
        .manage(media::MediaServer::default())
        .manage(mcp::McpServer::default())
        .setup(|app| {
            mcp::start_if_enabled(app.handle());
            media::start(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing either presentation window (or the editor) ends the presentation.
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                present::end(app, &app.state::<present::PresentState>());
            }
        })
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
            commands::system_gpus,
            commands::import_image,
            commands::put_asset,
            commands::read_asset,
            commands::read_import_file,
            commands::read_text_file,
            commands::get_gpu_preference,
            commands::set_gpu_preference,
            commands::confirm_gpu_launch,
            commands::restart_app,
            present::start_presentation,
            present::list_screens,
            media::media_base,
            commands::write_export,
            present::presentation_snapshot,
            present::present_nav,
            present::end_presentation,
            mcp::mcp_status,
            mcp::mcp_set_enabled,
            mcp::mcp_configure,
            mcp::mcp_respond,
            mcp::mcp_clients,
            mcp::mcp_install_client,
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
