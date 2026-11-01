//! Media files (images now, video later) referenced by the document as
//! `sha256-<hex>.<ext>`. While editing they live in a per-session folder and are served to
//! the UI under `tizaasset://`; saving copies the referenced ones into the `.tiza` file.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::http::{Request, Response, StatusCode, header};
use ts_rs::TS;

use crate::error::{AppError, AppResult};

/// Largest single asset accepted (videos will need more; revisit then).
pub const MAX_ASSET_BYTES: u64 = 512 * 1024 * 1024;

const EXTENSIONS: &[(&str, &str)] = &[
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("gif", "image/gif"),
    ("webp", "image/webp"),
    ("svg", "image/svg+xml"),
    ("bmp", "image/bmp"),
    ("avif", "image/avif"),
    ("mp4", "video/mp4"),
    ("m4v", "video/mp4"),
    ("webm", "video/webm"),
    ("ogv", "video/ogg"),
    ("mov", "video/quicktime"),
];

pub fn mime(ext: &str) -> Option<&'static str> {
    EXTENSIONS.iter().find(|(e, _)| *e == ext).map(|(_, m)| *m)
}

/// `sha256-<64 hex>.<known ext>`: the only names accepted from files and the UI.
pub fn is_valid_name(name: &str) -> bool {
    let Some((stem, ext)) = name.split_once('.') else {
        return false;
    };
    let Some(hex) = stem.strip_prefix("sha256-") else {
        return false;
    };
    hex.len() == 64
        && hex
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
        && mime(ext).is_some()
}

pub fn name_for(bytes: &[u8], ext: &str) -> String {
    let hex: String = Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    format!("sha256-{hex}.{ext}")
}

/// Compressed formats are stored as-is in the zip; deflating them again is wasted time.
pub fn is_video(name: &str) -> bool {
    mime(name.rsplit('.').next().unwrap_or_default()).is_some_and(|m| m.starts_with("video/"))
}

pub fn is_compressed(name: &str) -> bool {
    !(name.ends_with(".svg") || name.ends_with(".bmp"))
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ImportedAsset {
    pub name: String,
    /// Pixel size, when it can be read from the file header.
    #[ts(optional)]
    pub width: Option<u32>,
    #[ts(optional)]
    pub height: Option<u32>,
}

pub struct AssetStore {
    dir: PathBuf,
}

impl AssetStore {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    /// A store in a fresh folder under the OS temp dir (one per app process).
    pub fn for_session() -> Self {
        let dir = std::env::temp_dir().join(format!("tiza-assets-{}", std::process::id()));
        Self::new(dir)
    }

    pub fn path(&self, name: &str) -> Option<PathBuf> {
        is_valid_name(name).then(|| self.dir.join(name))
    }

    pub fn contains(&self, name: &str) -> bool {
        self.path(name).is_some_and(|p| p.is_file())
    }

    /// Stores bytes under their content hash and returns the asset name.
    pub fn put(&self, bytes: &[u8], ext: &str) -> AppResult<String> {
        let ext = ext.to_ascii_lowercase();
        if mime(&ext).is_none() {
            return Err(AppError::BadExtension);
        }
        if bytes.len() as u64 > MAX_ASSET_BYTES {
            return Err(AppError::TooLarge);
        }
        let name = name_for(bytes, &ext);
        let path = self.dir.join(&name);
        if !path.exists() {
            fs::create_dir_all(&self.dir)?;
            let tmp = self.dir.join(format!(".{name}.tmp"));
            fs::write(&tmp, bytes)?;
            fs::rename(&tmp, &path)?;
        }
        Ok(name)
    }

    /// Stores a stream (e.g. a big video) without holding it in memory: it is hashed while
    /// being copied to a temporary file, then renamed to its content name.
    pub fn put_reader(&self, mut reader: impl Read, ext: &str) -> AppResult<String> {
        let ext = ext.to_ascii_lowercase();
        if mime(&ext).is_none() {
            return Err(AppError::BadExtension);
        }
        fs::create_dir_all(&self.dir)?;
        let tmp = self
            .dir
            .join(format!(".incoming-{}-{}", std::process::id(), unique()));
        let result = (|| {
            let mut file = fs::File::create(&tmp)?;
            let mut hasher = Sha256::new();
            let mut buffer = vec![0; 1 << 20];
            let mut total = 0u64;
            loop {
                let n = reader.read(&mut buffer)?;
                if n == 0 {
                    break;
                }
                total += n as u64;
                if total > MAX_ASSET_BYTES {
                    return Err(AppError::TooLarge);
                }
                hasher.update(&buffer[..n]);
                std::io::Write::write_all(&mut file, &buffer[..n])?;
            }
            file.sync_all()?;
            let hex: String = hasher
                .finalize()
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect();
            let name = format!("sha256-{hex}.{ext}");
            let path = self.dir.join(&name);
            if path.exists() {
                fs::remove_file(&tmp)?;
            } else {
                fs::rename(&tmp, &path)?;
            }
            Ok(name)
        })();
        if result.is_err() {
            let _ = fs::remove_file(&tmp);
        }
        result
    }

    /// Copies a file chosen by the user into the store.
    pub fn import_file(&self, source: &Path) -> AppResult<ImportedAsset> {
        let ext = source
            .extension()
            .map(|e| e.to_string_lossy().to_ascii_lowercase())
            .ok_or(AppError::BadExtension)?;
        let ext = if ext == "jpeg" {
            "jpg".to_string()
        } else {
            ext
        };
        if fs::metadata(source)?.len() > MAX_ASSET_BYTES {
            return Err(AppError::TooLarge);
        }
        let name = self.put_reader(fs::File::open(source)?, &ext)?;
        let size = if is_video(&name) {
            None
        } else {
            imagesize::size(self.dir.join(&name)).ok()
        };
        Ok(ImportedAsset {
            name,
            width: size.map(|s| s.width as u32),
            height: size.map(|s| s.height as u32),
        })
    }

    /// Opens an asset for streaming it into a .tiza file.
    pub fn open(&self, name: &str) -> AppResult<fs::File> {
        let path = self.path(name).ok_or(AppError::UnsafePath(name.into()))?;
        Ok(fs::File::open(path)?)
    }

    pub fn read(&self, name: &str) -> AppResult<Vec<u8>> {
        let path = self.path(name).ok_or(AppError::UnsafePath(name.into()))?;
        Ok(fs::read(path)?)
    }

    /// Serves `tizaasset://localhost/<name>`, honouring `Range` so video can seek.
    pub fn respond(&self, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
        let name = request.uri().path().trim_start_matches('/');
        let not_found = || {
            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Vec::new())
                .unwrap_or_default()
        };
        let (Some(path), Some(ext)) = (self.path(name), name.rsplit('.').next()) else {
            return not_found();
        };
        let Ok(mut file) = fs::File::open(&path) else {
            return not_found();
        };
        let len = file.metadata().map(|m| m.len()).unwrap_or(0);
        let builder = Response::builder()
            .header(
                header::CONTENT_TYPE,
                mime(ext).unwrap_or("application/octet-stream"),
            )
            .header(header::ACCEPT_RANGES, "bytes")
            .header(header::CACHE_CONTROL, "max-age=31536000, immutable")
            .header("X-Content-Type-Options", "nosniff");

        let range = request
            .headers()
            .get(header::RANGE)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| parse_range(v, len));
        match range {
            Some((start, end)) => {
                use std::io::{Seek, SeekFrom};
                let mut body = vec![0; (end - start + 1) as usize];
                if file
                    .seek(SeekFrom::Start(start))
                    .and_then(|_| file.read_exact(&mut body))
                    .is_err()
                {
                    return not_found();
                }
                builder
                    .status(StatusCode::PARTIAL_CONTENT)
                    .header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{len}"))
                    .body(body)
                    .unwrap_or_default()
            }
            None => {
                let mut body = Vec::with_capacity(len as usize);
                if file.read_to_end(&mut body).is_err() {
                    return not_found();
                }
                builder.body(body).unwrap_or_default()
            }
        }
    }
}

fn unique() -> u64 {
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    NEXT.fetch_add(1, Ordering::Relaxed)
}

/// `bytes=start-end` (end optional, or `-suffix`), clamped to the file. Chunks are capped
/// so a video request doesn't load the whole file into memory.
pub fn parse_range(value: &str, len: u64) -> Option<(u64, u64)> {
    const MAX_CHUNK: u64 = 8 * 1024 * 1024;
    if len == 0 {
        return None;
    }
    let spec = value.strip_prefix("bytes=")?.split(',').next()?.trim();
    let (a, b) = spec.split_once('-')?;
    let (start, end) = if a.is_empty() {
        let suffix: u64 = b.parse().ok()?;
        (len.saturating_sub(suffix), len - 1)
    } else {
        let start: u64 = a.parse().ok()?;
        let end = if b.is_empty() {
            len - 1
        } else {
            b.parse::<u64>().ok()?.min(len - 1)
        };
        (start, end)
    };
    if start > end || start >= len {
        return None;
    }
    Some((start, end.min(start + MAX_CHUNK - 1)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_content_hashes_and_validated() {
        let name = name_for(b"hello", "png");
        assert!(is_valid_name(&name));
        assert!(!is_valid_name("../etc/passwd"));
        assert!(!is_valid_name(&name.replace(".png", ".exe")));
        assert!(!is_valid_name(&name.to_uppercase()));
        assert!(!is_valid_name("sha256-abc.png"));
    }

    #[test]
    fn put_deduplicates_and_imports_files() {
        let dir = tempfile::tempdir().unwrap();
        let store = AssetStore::new(dir.path().join("a"));
        let a = store.put(b"same", "png").unwrap();
        let b = store.put(b"same", "PNG").unwrap();
        assert_eq!(a, b);
        assert!(store.contains(&a));
        assert!(store.put(b"x", "exe").is_err());

        // 1×1 transparent PNG.
        let png = [
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52,
            0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89,
        ];
        let src = dir.path().join("pixel.PNG");
        fs::write(&src, png).unwrap();
        let imported = store.import_file(&src).unwrap();
        assert_eq!((imported.width, imported.height), (Some(1), Some(1)));
        assert!(imported.name.ends_with(".png"));
    }

    #[test]
    fn streams_are_hashed_like_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let store = AssetStore::new(dir.path().to_path_buf());
        let data = vec![7u8; 3 * 1024 * 1024 + 5];
        let streamed = store
            .put_reader(std::io::Cursor::new(&data), "mp4")
            .unwrap();
        assert_eq!(streamed, name_for(&data, "mp4"));
        assert_eq!(
            store
                .put_reader(std::io::Cursor::new(&data), "mp4")
                .unwrap(),
            streamed
        );
        let leftovers = fs::read_dir(dir.path()).unwrap().count();
        assert_eq!(leftovers, 1, "temporary files must be cleaned up");
        assert!(is_video(&streamed));
    }

    #[test]
    fn ranges() {
        assert_eq!(parse_range("bytes=0-99", 1000), Some((0, 99)));
        assert_eq!(parse_range("bytes=900-", 1000), Some((900, 999)));
        assert_eq!(parse_range("bytes=-100", 1000), Some((900, 999)));
        assert_eq!(parse_range("bytes=990-5000", 1000), Some((990, 999)));
        assert_eq!(parse_range("bytes=2000-", 1000), None);
        assert_eq!(parse_range("items=0-1", 1000), None);
    }
}
