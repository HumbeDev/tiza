//! Presentation document model. This is the source of truth for the file format;
//! TypeScript types in `src/bindings/` are generated from it by `cargo test`.

pub mod migrate;

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
    #[serde(default)]
    pub latex: LatexSettings,
    /// Slide whose content is copied into every new slide (a per-file template).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub template_slide_id: Option<Id>,
    pub slides: Vec<Slide>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LatexSettings {
    /// `\newcommand` definitions applied to every formula in the presentation.
    pub preamble: String,
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
    /// Speaker notes, shown in the presenter view.
    #[serde(default)]
    pub notes: String,
    /// Hidden slides are skipped when presenting.
    #[serde(default)]
    pub hidden: bool,
    /// How this slide appears when presenting.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub transition: Option<Transition>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum TransitionKind {
    None,
    Fade,
    Slide,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Transition {
    pub kind: TransitionKind,
    pub duration_ms: u32,
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
    Math(MathElement),
    Sim(SimElement),
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

/// Rich text box. `doc` is a TipTap (ProseMirror) JSON document.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TextElement {
    pub doc: RichNode,
    /// Base size and color; marks inside `doc` may override them.
    pub font_size: f64,
    pub color: String,
    pub align: TextAlign,
}

/// A node of a TipTap JSON document (`doc`, `paragraph`, `text`, `inlineMath`, …).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RichNode {
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub attrs: Option<serde_json::Map<String, serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub content: Option<Vec<RichNode>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub marks: Option<Vec<RichMark>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub text: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RichMark {
    #[serde(rename = "type")]
    pub mark_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "Record<string, unknown>")]
    pub attrs: Option<serde_json::Map<String, serde_json::Value>>,
}

impl RichNode {
    /// A document with one paragraph per line of `text`.
    pub fn plain(text: &str) -> Self {
        let paragraphs = text
            .split('\n')
            .map(|line| RichNode {
                node_type: "paragraph".into(),
                attrs: None,
                content: (!line.is_empty()).then(|| {
                    vec![RichNode {
                        node_type: "text".into(),
                        attrs: None,
                        content: None,
                        marks: None,
                        text: Some(line.into()),
                    }]
                }),
                marks: None,
                text: None,
            })
            .collect();
        RichNode {
            node_type: "doc".into(),
            attrs: None,
            content: Some(paragraphs),
            marks: None,
            text: None,
        }
    }
}

/// Display formula rendered with MathJax. The box keeps the formula's aspect ratio;
/// `font_size` is the size of 1em in logical units.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct MathElement {
    pub latex: String,
    pub font_size: f64,
    pub color: String,
    pub align: TextAlign,
}

/// How an embedded page is scaled into its box.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum SimFit {
    /// Uniform scale; letterboxed if the aspect ratios differ.
    Contain,
    /// Stretch to fill the box.
    Fill,
}

/// Self-contained HTML page (simulation, applet…) running in a sandboxed iframe.
/// The page lays out at `view_width × view_height` CSS pixels and is scaled into the box.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SimElement {
    pub html: String,
    pub title: String,
    pub view_width: f64,
    pub view_height: f64,
    pub fit: SimFit,
    /// Lets the page load resources from the internet (e.g. a library from a CDN).
    #[serde(default)]
    pub allow_network: bool,
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
            latex: LatexSettings {
                preamble: r"\newcommand{\R}{\mathbb{R}}".into(),
            },
            template_slide_id: Some("s1".into()),
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
                            doc: RichNode::plain("Hola\n\nmundo"),
                            font_size: 48.0,
                            color: "#111".into(),
                            align: TextAlign::Center,
                        }),
                    },
                    Element {
                        id: "e3".into(),
                        x: 10.0,
                        y: 10.0,
                        w: 300.0,
                        h: 80.0,
                        rotation: 0.0,
                        opacity: 1.0,
                        locked: false,
                        group_id: None,
                        content: ElementContent::Math(MathElement {
                            latex: r"\int_0^1 x^2\,dx".into(),
                            font_size: 72.0,
                            color: "#000000".into(),
                            align: TextAlign::Left,
                        }),
                    },
                ],
                notes: "Saludar".into(),
                hidden: false,
                transition: Some(Transition {
                    kind: TransitionKind::Fade,
                    duration_ms: 400,
                }),
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
        assert_eq!(text["doc"]["type"], "doc");
        assert_eq!(text["doc"]["content"][0]["content"][0]["text"], "Hola");
        assert!(text["doc"]["content"][1].get("content").is_none());
        let math = &value["slides"][0]["elements"][2];
        assert_eq!(math["kind"], "math");
        assert_eq!(math["latex"], r"\int_0^1 x^2\,dx");
        assert_eq!(value["latex"]["preamble"], r"\newcommand{\R}{\mathbb{R}}");
        assert_eq!(value["templateSlideId"], "s1");
        assert_eq!(value["slides"][0]["transition"]["kind"], "fade");
        assert_eq!(value["slides"][0]["transition"]["durationMs"], 400);
    }

    #[test]
    fn accepts_tiptap_json_with_marks_and_attrs() {
        let value = json!({
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [
                    { "type": "text", "text": "Energy ", "marks": [{ "type": "bold" }] },
                    { "type": "inlineMath", "attrs": { "latex": "E=mc^2" } }
                ]
            }]
        });
        let doc: RichNode = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(&doc).unwrap(), value);
    }

    #[test]
    fn optional_fields_may_be_missing() {
        // No `latex` settings: older documents get an empty preamble.
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
        assert_eq!(doc.latex.preamble, "");
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
    fn sim_elements_round_trip() {
        let value = json!({
            "id": "h1", "x": 0, "y": 0, "w": 800, "h": 600, "rotation": 0, "opacity": 1,
            "kind": "sim", "html": "<p>hi</p>", "title": "Demo",
            "viewWidth": 800, "viewHeight": 600, "fit": "contain"
        });
        let el: Element = serde_json::from_value(value).unwrap();
        let ElementContent::Sim(sim) = &el.content else {
            panic!("expected a sim element")
        };
        assert!(!sim.allow_network);
        assert_eq!(sim.fit, SimFit::Contain);
        let back = serde_json::to_value(&el).unwrap();
        assert_eq!(back["kind"], "sim");
        assert_eq!(back["viewWidth"], 800.0);
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
