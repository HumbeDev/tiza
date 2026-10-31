//! Reading and writing `.tiza` files: a ZIP with `manifest.json` and `presentation.json`
//! (PROYECTO.md §6.2). The web version writes the same layout with fflate
//! (`src/files/format.ts`); the fixtures in `tests/fixtures/` (one written by each side)
//! check that both agree.

use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Seek, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::document::migrate::migrate;
use crate::document::{Presentation, SCHEMA_VERSION};
use crate::error::{AppError, AppResult};

pub const MANIFEST: &str = "manifest.json";
pub const PRESENTATION: &str = "presentation.json";
pub const FORMAT: &str = "tiza";

/// Largest `presentation.json` we accept (assets are stored separately).
const MAX_DOCUMENT_BYTES: u64 = 64 * 1024 * 1024;
const MAX_ENTRIES: usize = 10_000;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub format: String,
    pub schema_version: u32,
    pub app_version: String,
}

pub fn write<W: Write + Seek>(writer: W, doc: &Presentation) -> AppResult<W> {
    let mut zip = ZipWriter::new(writer);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let manifest = Manifest {
        format: FORMAT.into(),
        schema_version: SCHEMA_VERSION,
        app_version: env!("CARGO_PKG_VERSION").into(),
    };
    zip.start_file(MANIFEST, options)?;
    serde_json::to_writer_pretty(&mut zip, &manifest).map_err(std::io::Error::from)?;
    zip.start_file(PRESENTATION, options)?;
    serde_json::to_writer_pretty(&mut zip, doc).map_err(std::io::Error::from)?;
    Ok(zip.finish()?)
}

pub fn read<R: Read + Seek>(reader: R) -> AppResult<Presentation> {
    let mut zip = ZipArchive::new(reader)?;
    if zip.len() > MAX_ENTRIES {
        return Err(AppError::TooLarge);
    }
    for i in 0..zip.len() {
        let entry = zip.by_index_raw(i)?;
        if entry.enclosed_name().is_none() {
            let name = String::from_utf8_lossy(entry.name_raw()).into_owned();
            return Err(AppError::UnsafePath(name));
        }
    }

    let manifest: Manifest = read_json(&mut zip, MANIFEST)?;
    if manifest.format != FORMAT {
        return Err(AppError::NotTiza);
    }
    if manifest.schema_version > SCHEMA_VERSION {
        return Err(AppError::TooNew(manifest.schema_version));
    }
    migrate(read_json(&mut zip, PRESENTATION)?)
}

fn read_json<R: Read + Seek, T: for<'de> Deserialize<'de>>(
    zip: &mut ZipArchive<R>,
    name: &str,
) -> AppResult<T> {
    let entry = zip.by_name(name).map_err(|_| AppError::NotTiza)?;
    if entry.size() > MAX_DOCUMENT_BYTES {
        return Err(AppError::TooLarge);
    }
    serde_json::from_reader(BufReader::new(entry.take(MAX_DOCUMENT_BYTES)))
        .map_err(|e| AppError::InvalidDocument(format!("{name}: {e}")))
}

pub fn has_tiza_extension(path: &Path) -> bool {
    path.extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case(FORMAT))
}

/// Saves without ever leaving a half-written file: write a temporary file next to the
/// target, flush it to disk, then rename it over the target.
pub fn save(path: &Path, doc: &Presentation) -> AppResult<()> {
    let tmp = temp_path(path);
    let result = (|| {
        let file = write(BufWriter::new(File::create(&tmp)?), doc)?;
        let file = file.into_inner().map_err(|e| e.into_error())?;
        file.sync_all()?;
        fs::rename(&tmp, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

pub fn load(path: &Path) -> AppResult<Presentation> {
    read(BufReader::new(File::open(path)?))
}

fn temp_path(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    path.with_file_name(format!(".{name}.{}.tmp", std::process::id()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::document::{Aspect, LatexSettings, Meta, Page, Slide};
    use std::io::Cursor;

    fn doc() -> Presentation {
        Presentation {
            schema_version: SCHEMA_VERSION,
            meta: Meta {
                title: "Charla".into(),
                author: None,
                created: "2026-10-30T12:00:00Z".into(),
                modified: "2026-10-30T12:00:00Z".into(),
                lang: "es".into(),
            },
            page: Page {
                aspect: Aspect::Wide,
                width: 1920.0,
                height: 1080.0,
            },
            latex: LatexSettings::default(),
            slides: vec![Slide {
                id: "s1".into(),
                background: None,
                elements: vec![],
                notes: String::new(),
                hidden: false,
            }],
        }
    }

    fn zip_with(entries: &[(&str, &str)]) -> Vec<u8> {
        let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
        for (name, body) in entries {
            zip.start_file(*name, SimpleFileOptions::default()).unwrap();
            zip.write_all(body.as_bytes()).unwrap();
        }
        zip.finish().unwrap().into_inner()
    }

    #[test]
    fn round_trip_in_memory() {
        let bytes = write(Cursor::new(Vec::new()), &doc()).unwrap().into_inner();
        assert_eq!(read(Cursor::new(bytes)).unwrap(), doc());
    }

    #[test]
    fn save_and_load_from_disk_atomically() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("charla.tiza");
        save(&path, &doc()).unwrap();
        let mut second = doc();
        second.meta.title = "Otra".into();
        save(&path, &second).unwrap();
        assert_eq!(load(&path).unwrap().meta.title, "Otra");
        let leftovers: Vec<_> = fs::read_dir(dir.path()).unwrap().collect();
        assert_eq!(leftovers.len(), 1, "temporary file was not cleaned up");
    }

    #[test]
    fn reads_the_shared_fixture() {
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/hello.tiza");
        let doc = load(&fixture).unwrap();
        assert_eq!(doc.meta.title, "Hola Tiza");
        assert_eq!(doc.slides.len(), 2);
    }

    #[test]
    fn reads_a_file_saved_by_the_web_version() {
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/from-web.tiza");
        let doc = load(&fixture).unwrap();
        let kinds: Vec<_> = doc.slides[0]
            .elements
            .iter()
            .map(|e| match e.content {
                crate::document::ElementContent::Shape(_) => "shape",
                crate::document::ElementContent::Text(_) => "text",
                crate::document::ElementContent::Math(_) => "math",
            })
            .collect();
        assert_eq!(kinds, ["shape", "math"]);
    }

    #[test]
    fn rejects_files_that_are_not_tiza() {
        assert!(matches!(
            read(Cursor::new(b"not a zip".to_vec())),
            Err(AppError::NotTiza)
        ));
        let other = zip_with(&[(
            MANIFEST,
            r#"{"format":"x","schemaVersion":1,"appVersion":"1"}"#,
        )]);
        assert!(matches!(read(Cursor::new(other)), Err(AppError::NotTiza)));
        let no_doc = zip_with(&[(
            MANIFEST,
            r#"{"format":"tiza","schemaVersion":1,"appVersion":"1"}"#,
        )]);
        assert!(matches!(read(Cursor::new(no_doc)), Err(AppError::NotTiza)));
    }

    #[test]
    fn rejects_newer_formats_and_unsafe_paths() {
        let newer = zip_with(&[(
            MANIFEST,
            r#"{"format":"tiza","schemaVersion":99,"appVersion":"9"}"#,
        )]);
        assert!(matches!(
            read(Cursor::new(newer)),
            Err(AppError::TooNew(99))
        ));
        let slip = zip_with(&[("../evil.txt", "x")]);
        assert!(matches!(
            read(Cursor::new(slip)),
            Err(AppError::UnsafePath(_))
        ));
    }

    #[test]
    fn checks_the_extension() {
        assert!(has_tiza_extension(Path::new("/a/b.TIZA")));
        assert!(!has_tiza_extension(Path::new("/a/b.zip")));
        assert!(!has_tiza_extension(Path::new("/a/tiza")));
    }

    /// Regenerates `tests/fixtures/hello.tiza`:
    /// `cargo test generate_fixture -- --ignored`
    #[test]
    #[ignore]
    fn generate_fixture() {
        let value = serde_json::json!({
            "schemaVersion": 1,
            "meta": { "title": "Hola Tiza", "created": "2026-10-30T12:00:00Z",
                      "modified": "2026-10-30T12:00:00Z", "lang": "es" },
            "page": { "aspect": "16:9", "width": 1920.0, "height": 1080.0 },
            "latex": { "preamble": "\\newcommand{\\R}{\\mathbb{R}}" },
            "slides": [
                { "id": "s1", "background": "#ffffff", "elements": [
                    { "id": "t1", "x": 160, "y": 120, "w": 1600, "h": 160, "rotation": 0,
                      "opacity": 1, "kind": "text", "fontSize": 96, "color": "#1d1d1b",
                      "align": "center", "doc": { "type": "doc", "content": [
                        { "type": "paragraph", "content": [
                          { "type": "text", "text": "Hola " },
                          { "type": "text", "text": "Tiza", "marks": [{ "type": "bold" }] },
                          { "type": "text", "text": " con " },
                          { "type": "inlineMath", "attrs": { "latex": "x \\in \\R" } }
                        ] } ] } },
                    { "id": "m1", "x": 660, "y": 480, "w": 600, "h": 160, "rotation": 0,
                      "opacity": 1, "kind": "math", "latex": "e^{i\\pi} + 1 = 0",
                      "fontSize": 96, "color": "#2f6f4f", "align": "center" }
                ] },
                { "id": "s2", "elements": [
                    { "id": "r1", "x": 200, "y": 200, "w": 400, "h": 300, "rotation": 15,
                      "opacity": 1, "kind": "shape", "shape": "rect", "fill": "#4f8a6b",
                      "radius": 12 }
                ] }
            ]
        });
        let doc = migrate(value).unwrap();
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/hello.tiza");
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        save(&path, &doc).unwrap();
    }
}
