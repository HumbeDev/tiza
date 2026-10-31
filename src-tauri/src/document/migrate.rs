//! Upgrades documents saved by older versions of Tiza to the current schema.

use serde_json::Value;

use super::{Presentation, SCHEMA_VERSION};
use crate::error::{AppError, AppResult};

/// `MIGRATIONS[i]` turns a version `i + 1` document into version `i + 2`.
/// Add one function here (and a test) every time `SCHEMA_VERSION` goes up.
const MIGRATIONS: &[fn(Value) -> Value] = &[];

const _: () = assert!(MIGRATIONS.len() as u32 + 1 == SCHEMA_VERSION);

pub fn migrate(mut value: Value) -> AppResult<Presentation> {
    let version = value
        .get("schemaVersion")
        .and_then(Value::as_u64)
        .ok_or_else(|| AppError::InvalidDocument("missing schemaVersion".into()))?;
    let version = u32::try_from(version).map_err(|_| AppError::TooNew(u32::MAX))?;
    if version == 0 {
        return Err(AppError::InvalidDocument("schemaVersion 0".into()));
    }
    if version > SCHEMA_VERSION {
        return Err(AppError::TooNew(version));
    }
    for step in &MIGRATIONS[(version - 1) as usize..] {
        value = step(value);
    }
    if let Some(obj) = value.as_object_mut() {
        obj.insert("schemaVersion".into(), SCHEMA_VERSION.into());
    }
    let doc: Presentation =
        serde_json::from_value(value).map_err(|e| AppError::InvalidDocument(e.to_string()))?;
    if doc.slides.is_empty() {
        return Err(AppError::InvalidDocument("no slides".into()));
    }
    Ok(doc)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn v1() -> Value {
        json!({
            "schemaVersion": 1,
            "meta": { "title": "", "created": "", "modified": "", "lang": "es" },
            "page": { "aspect": "16:9", "width": 1920.0, "height": 1080.0 },
            "slides": [{ "id": "s1", "elements": [] }]
        })
    }

    #[test]
    fn current_version_passes_through() {
        let doc = migrate(v1()).unwrap();
        assert_eq!(doc.schema_version, SCHEMA_VERSION);
        assert_eq!(doc.slides[0].id, "s1");
    }

    #[test]
    fn newer_versions_are_rejected() {
        let mut value = v1();
        value["schemaVersion"] = json!(SCHEMA_VERSION + 1);
        assert!(matches!(migrate(value), Err(AppError::TooNew(v)) if v == SCHEMA_VERSION + 1));
    }

    #[test]
    fn missing_or_zero_version_is_invalid() {
        let mut value = v1();
        value.as_object_mut().unwrap().remove("schemaVersion");
        assert!(matches!(migrate(value), Err(AppError::InvalidDocument(_))));
        let mut value = v1();
        value["schemaVersion"] = json!(0);
        assert!(matches!(migrate(value), Err(AppError::InvalidDocument(_))));
    }

    #[test]
    fn empty_presentations_are_invalid() {
        let mut value = v1();
        value["slides"] = json!([]);
        assert!(matches!(migrate(value), Err(AppError::InvalidDocument(_))));
    }
}
