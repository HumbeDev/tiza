//! Writes panics to `crash.log` in the settings folder. The installed app has no console
//! (on Windows it has none at all), so without this a crash leaves no trace.

use std::fs::OpenOptions;
use std::io::Write;
use std::panic::PanicHookInfo;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Keeps the log small: it is rewritten when it grows past this.
const MAX_LOG_BYTES: u64 = 256 * 1024;

pub fn log_path() -> Option<PathBuf> {
    crate::settings::config_dir().map(|d| d.join("crash.log"))
}

/// One log entry: time, version, thread, message and where it happened.
pub fn entry(info: &PanicHookInfo<'_>) -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default();
    let message = info
        .payload()
        .downcast_ref::<&str>()
        .map(|s| (*s).to_owned())
        .or_else(|| info.payload().downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "(no message)".into());
    let location = info
        .location()
        .map(|l| format!("{}:{}", l.file(), l.line()))
        .unwrap_or_default();
    let thread = std::thread::current();
    format!(
        "[unix {secs}] Tiza {} ({}) thread '{}' panicked at {location}: {message}\n",
        env!("CARGO_PKG_VERSION"),
        std::env::consts::OS,
        thread.name().unwrap_or("unnamed"),
    )
}

fn append(path: &Path, text: &str) {
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let too_big = std::fs::metadata(path).is_ok_and(|m| m.len() > MAX_LOG_BYTES);
    let file = OpenOptions::new()
        .create(true)
        .append(!too_big)
        .write(true)
        .truncate(too_big)
        .open(path);
    if let Ok(mut file) = file {
        let _ = file.write_all(text.as_bytes());
    }
}

/// Logs every panic to `path`, then runs the default hook (message on stderr).
pub fn install(path: PathBuf) {
    let default = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        append(&path, &entry(info));
        default(info);
    }));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn panics_are_written_to_the_log() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sub/crash.log");
        install(path.clone());
        let result = std::thread::Builder::new()
            .name("mcp-test".into())
            .spawn(|| panic!("boom {}", 42))
            .unwrap()
            .join();
        let _ = std::panic::take_hook();
        assert!(result.is_err());
        let log = std::fs::read_to_string(&path).unwrap();
        assert!(log.contains("thread 'mcp-test' panicked at"), "{log}");
        assert!(log.contains("crash.rs"), "{log}");
        assert!(log.contains("boom 42"), "{log}");
    }
}
