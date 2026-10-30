//! Presentation document model. This is the source of truth for the file format;
//! TypeScript types in `src/bindings/` are generated from it by `cargo test`.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const SCHEMA_VERSION: u32 = 1;

pub type Id = String;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Presentation {
    pub schema_version: u32,
    pub meta: Meta,
    pub page: Page,
    pub slides: Vec<Slide>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Meta {
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub author: Option<String>,
    /// ISO 8601 timestamps.
    pub created: String,
    pub modified: String,
    /// BCP 47 tag of the presentation content (not the UI language).
    pub lang: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum Aspect {
    #[serde(rename = "16:9")]
    Wide,
    #[serde(rename = "4:3")]
    Standard,
}

/// Slide size in logical units (1920×1080 for 16:9, 1440×1080 for 4:3).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Page {
    pub aspect: Aspect,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Slide {
    pub id: Id,
    /// CSS color. Gradients and images come later.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub background: Option<String>,
    /// Array order is z-order: the last element is drawn on top.
    pub elements: Vec<Element>,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub hidden: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Element {
    pub id: Id,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    /// Degrees, clockwise, around the element center.
    pub rotation: f64,
    /// 0..=1
    pub opacity: f64,
    #[serde(default)]
    pub locked: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub group_id: Option<Id>,
    #[serde(flatten)]
    pub content: ElementContent,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export)]
pub enum ElementContent {
    Shape(ShapeElement),
    Text(TextElement),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum ShapeKind {
    Rect,
    Ellipse,
    Line,
    Arrow,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ShapeElement {
    pub shape: ShapeKind,
    /// CSS color; `None` means no fill.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub fill: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub stroke: Option<Stroke>,
    /// Corner radius for rectangles, in logical units.
    #[serde(default)]
    pub radius: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Stroke {
    pub color: String,
    pub width: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum TextAlign {
    Left,
    Center,
    Right,
}

/// Plain text box. Rich text (TipTap) replaces `text` in phase 3 via a schema migration.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TextElement {
    pub text: String,
    pub font_size: f64,
    pub color: String,
    pub align: TextAlign,
    #[serde(default)]
    pub bold: bool,
    #[serde(default)]
    pub italic: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample() -> Presentation {
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
            slides: vec![Slide {
                id: "s1".into(),
                background: Some("#ffffff".into()),
                elements: vec![
                    Element {
                        id: "e1".into(),
                        x: 100.0,
                        y: 100.0,
                        w: 400.0,
                        h: 300.0,
                        rotation: 15.0,
                        opacity: 1.0,
                        locked: false,
                        group_id: None,
                        content: ElementContent::Shape(ShapeElement {
                            shape: ShapeKind::Rect,
                            fill: Some("#2f6f4f".into()),
                            stroke: Some(Stroke {
                                color: "#000".into(),
                                width: 2.0,
                            }),
                            radius: 8.0,
                        }),
                    },
                    Element {
                        id: "e2".into(),
                        x: 0.0,
                        y: 0.0,
                        w: 600.0,
                        h: 120.0,
                        rotation: 0.0,
                        opacity: 0.5,
                        locked: true,
                        group_id: None,
                        content: ElementContent::Text(TextElement {
                            text: "Hola".into(),
                            font_size: 48.0,
                            color: "#111".into(),
                            align: TextAlign::Center,
                            bold: true,
                            italic: false,
                        }),
                    },
                ],
                notes: String::new(),
                hidden: false,
            }],
        }
    }

    #[test]
    fn json_round_trip() {
        let doc = sample();
        let json = serde_json::to_string(&doc).unwrap();
        let back: Presentation = serde_json::from_str(&json).unwrap();
        assert_eq!(doc, back);
    }

    #[test]
    fn json_shape_matches_spec() {
        let value = serde_json::to_value(sample()).unwrap();
        assert_eq!(value["schemaVersion"], 1);
        assert_eq!(value["page"]["aspect"], "16:9");
        let shape = &value["slides"][0]["elements"][0];
        assert_eq!(shape["kind"], "shape");
        assert_eq!(shape["shape"], "rect");
        assert_eq!(shape["x"], 100.0);
        assert!(shape.get("groupId").is_none());
        let text = &value["slides"][0]["elements"][1];
        assert_eq!(text["kind"], "text");
        assert_eq!(text["fontSize"], 48.0);
        assert_eq!(text["align"], "center");
    }

    #[test]
    fn optional_fields_may_be_missing() {
        let value = json!({
            "schemaVersion": 1,
            "meta": { "title": "", "created": "", "modified": "", "lang": "en" },
            "page": { "aspect": "4:3", "width": 1440.0, "height": 1080.0 },
            "slides": [{
                "id": "s1",
                "elements": [{
                    "id": "e1", "x": 0, "y": 0, "w": 10, "h": 10, "rotation": 0, "opacity": 1,
                    "kind": "shape", "shape": "ellipse"
                }]
            }]
        });
        let doc: Presentation = serde_json::from_value(value).unwrap();
        let slide = &doc.slides[0];
        assert_eq!(slide.notes, "");
        assert!(!slide.hidden);
        assert!(!slide.elements[0].locked);
        assert!(matches!(
            slide.elements[0].content,
            ElementContent::Shape(ShapeElement {
                fill: None,
                stroke: None,
                ..
            })
        ));
    }

    #[test]
    fn unknown_element_kind_is_rejected() {
        let value = json!({
            "id": "e1", "x": 0, "y": 0, "w": 1, "h": 1, "rotation": 0, "opacity": 1,
            "kind": "hologram"
        });
        assert!(serde_json::from_value::<Element>(value).is_err());
    }
}
