//! The MCP tools. Arguments are validated here (JSON Schema from the structs), then the
//! call is forwarded to the editor, which performs it as one undoable step.

use rmcp::handler::server::{router::tool::ToolRouter, wrapper::Parameters};
use rmcp::model::{CallToolResult, ContentBlock, Implementation, ServerCapabilities, ServerConfig};
use rmcp::{ErrorData, ServerHandler, tool, tool_handler, tool_router};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::Manager;

use super::bridge::Bridge;
use crate::assets::AssetStore;

const INSTRUCTIONS: &str = "Tiza is a presentation editor; these tools edit the presentation \
that is open in the app, live, while the user watches. Start with get_presentation. \
Coordinates and sizes are logical units of the slide: (0,0) is the top-left corner and a \
16:9 slide is 1920×1080 (get_presentation gives the exact page size). Font sizes use the \
same units: ~64 for body text, ~96 for titles. Slides are referenced by number (1 = first) \
or by id. Text accepts $...$ for inline LaTeX, lines starting with '- ' become bullets and \
'1. ' numbered items. Every tool call is one undo step for the user; call undo to revert \
your last change. Equations use LaTeX (MathJax: amsmath, physics, mhchem...). HTML \
simulations must be a single self-contained HTML file.";

/// A slide: its number (1 = first slide) or its id.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(untagged)]
pub enum SlideRef {
    Number(u32),
    Id(String),
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct SlideArg {
    /// Slide number (1 = first) or id.
    pub slide: SlideRef,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct AddSlideArgs {
    /// Insert after this slide (default: after the last one).
    pub after: Option<SlideRef>,
    /// Start from the file's template slide if there is one (default true).
    pub use_template: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct MoveSlideArgs {
    pub slide: SlideRef,
    /// New position, 1 = first.
    pub to: u32,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct SetSlideArgs {
    pub slide: SlideRef,
    /// CSS color, e.g. "#ffffff".
    pub background: Option<String>,
    /// Speaker notes (shown only in the presenter view).
    pub notes: Option<String>,
    /// Skip this slide when presenting.
    pub hidden: Option<bool>,
    /// "none", "fade", "slide", "zoom" or "rise". "none" opts out of the presentation's
    /// default transition; "default" uses it again.
    pub transition: Option<String>,
    /// Transition duration in milliseconds (default 500).
    pub duration_ms: Option<u32>,
}

/// Position and size; omitted values get sensible defaults (centered).
#[derive(Debug, Default, Serialize, Deserialize, JsonSchema)]
pub struct Frame {
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub w: Option<f64>,
    pub h: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct AddTextArgs {
    pub slide: SlideRef,
    /// Text. Use $...$ for inline math, "- " for bullets, "1. " for numbered items,
    /// and new lines for paragraphs.
    pub text: String,
    #[serde(flatten)]
    pub frame: Frame,
    pub font_size: Option<f64>,
    /// CSS color.
    pub color: Option<String>,
    /// "left", "center" or "right".
    pub align: Option<String>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct AddEquationArgs {
    pub slide: SlideRef,
    /// LaTeX without $ delimiters, e.g. "\\int_0^1 x^2\\,dx".
    pub latex: String,
    /// Center of the equation (default: slide center).
    pub cx: Option<f64>,
    pub cy: Option<f64>,
    /// Size of 1em in slide units (default 80).
    pub font_size: Option<f64>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct AddShapeArgs {
    pub slide: SlideRef,
    /// "rect", "ellipse", "line" or "arrow".
    pub shape: String,
    #[serde(flatten)]
    pub frame: Frame,
    /// Fill color (rect/ellipse); "none" for no fill.
    pub fill: Option<String>,
    pub stroke_color: Option<String>,
    pub stroke_width: Option<f64>,
    /// Corner radius for rectangles.
    pub radius: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct AddTableArgs {
    pub slide: SlideRef,
    /// Cell texts, row by row. The first row is the header unless header_row is false.
    pub rows: Vec<Vec<String>>,
    #[serde(flatten)]
    pub frame: Frame,
    pub header_row: Option<bool>,
    pub striped: Option<bool>,
    /// "green", "blue", "gray", "orange" or "purple".
    pub theme: Option<String>,
    pub font_size: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct AddHtmlArgs {
    pub slide: SlideRef,
    /// A complete, self-contained HTML document (scripts and styles inline).
    pub html: String,
    pub title: Option<String>,
    #[serde(flatten)]
    pub frame: Frame,
    /// Size the page is laid out at, in CSS pixels (default 1120×630).
    pub view_width: Option<f64>,
    pub view_height: Option<f64>,
    /// Let the page load resources from the internet (off by default).
    pub allow_network: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct AddEmbedArgs {
    pub slide: SlideRef,
    /// Link to a YouTube video (youtube.com/watch?v=…, youtu.be/…, /shorts/…) or an X
    /// (Twitter) post (x.com/<user>/status/<id>), or the embed code either site gives.
    pub url: String,
    /// YouTube only: start playing at this second (a `t=` in the link also works).
    pub start: Option<f64>,
    #[serde(flatten)]
    pub frame: Frame,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct AddImageArgs {
    pub slide: SlideRef,
    /// Absolute path of a local image file (png, jpg, gif, webp, svg, bmp, avif).
    pub path: String,
    #[serde(flatten)]
    pub frame: Frame,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct UpdateElementArgs {
    pub element_id: String,
    /// Fields to change. Common: x, y, w, h, rotation, opacity, locked. Text: text (same
    /// syntax as add_text), font_size, color, align. Equation: latex, font_size, color.
    /// Shape: fill, stroke_color, stroke_width. Table: rows, header_row, theme, font_size.
    /// HTML: html, title, view_width, view_height. YouTube/X embed: url, start.
    pub changes: serde_json::Map<String, Value>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct ElementIdsArg {
    pub element_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct AnimationArgs {
    pub element_ids: Vec<String>,
    /// Click on which they appear when presenting (1 = first click). Null or 0 removes
    /// the animation. Use "next" ordering by giving increasing numbers.
    pub step: Option<u32>,
    /// "appear" (default), "fade", "rise", "fromLeft", "fromRight", "zoom" or "wipe".
    pub effect: Option<String>,
    /// True to set how they leave (exit animation) instead of how they appear.
    pub exit: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct PresentationTransitionArgs {
    /// "none", "fade", "slide", "zoom" or "rise".
    pub transition: String,
    /// Duration in milliseconds (default 500).
    pub duration_ms: Option<u32>,
    /// Also remove each slide's own transition so all slides use this one.
    pub apply_to_all: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct ArrangeArgs {
    pub element_ids: Vec<String>,
    /// "front", "back", "forward" or "backward".
    pub action: String,
}

#[derive(Debug, Serialize, Deserialize, JsonSchema)]
pub struct PreambleArgs {
    /// LaTeX \\newcommand definitions applied to every equation.
    pub preamble: String,
}

#[derive(Clone)]
pub struct TizaMcp {
    bridge: Bridge,
    tool_router: ToolRouter<Self>,
}

fn reply(result: Result<Value, String>) -> Result<CallToolResult, ErrorData> {
    Ok(match result {
        Ok(value) => CallToolResult::success(vec![ContentBlock::text(
            serde_json::to_string_pretty(&value).unwrap_or_default(),
        )]),
        Err(message) => CallToolResult::error(vec![ContentBlock::text(message)]),
    })
}

impl TizaMcp {
    pub fn new(bridge: Bridge) -> Self {
        Self {
            bridge,
            tool_router: Self::tool_router(),
        }
    }

    async fn forward<T: Serialize>(
        &self,
        tool: &str,
        args: T,
    ) -> Result<CallToolResult, ErrorData> {
        let args = serde_json::to_value(args)
            .map_err(|e| ErrorData::invalid_params(e.to_string(), None))?;
        reply(self.bridge.call(tool, args).await)
    }
}

#[tool_router(router = tool_router)]
impl TizaMcp {
    #[tool(
        description = "Overview of the open presentation: page size, file, current slide and every slide with its elements (ids, kinds, positions, text summaries). Call this first."
    )]
    async fn get_presentation(&self) -> Result<CallToolResult, ErrorData> {
        self.forward("get_presentation", json!({})).await
    }

    #[tool(description = "Full JSON of one slide (all element properties).")]
    async fn get_slide(
        &self,
        Parameters(args): Parameters<SlideArg>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("get_slide", args).await
    }

    #[tool(
        description = "Add a slide (a copy of the file's template slide if it has one). Returns its id and number."
    )]
    async fn add_slide(
        &self,
        Parameters(args): Parameters<AddSlideArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("add_slide", args).await
    }

    #[tool(description = "Duplicate a slide (placed right after it).")]
    async fn duplicate_slide(
        &self,
        Parameters(args): Parameters<SlideArg>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("duplicate_slide", args).await
    }

    #[tool(description = "Delete a slide.")]
    async fn delete_slide(
        &self,
        Parameters(args): Parameters<SlideArg>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("delete_slide", args).await
    }

    #[tool(description = "Move a slide to another position.")]
    async fn move_slide(
        &self,
        Parameters(args): Parameters<MoveSlideArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("move_slide", args).await
    }

    #[tool(description = "Show a slide in the editor.")]
    async fn go_to_slide(
        &self,
        Parameters(args): Parameters<SlideArg>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("go_to_slide", args).await
    }

    #[tool(
        description = "Change slide properties: background color, speaker notes, hidden, transition."
    )]
    async fn set_slide(
        &self,
        Parameters(args): Parameters<SetSlideArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("set_slide", args).await
    }

    #[tool(
        description = "Add a text box. Supports $...$ inline LaTeX and '- ' bullets. Returns the element id."
    )]
    async fn add_text(
        &self,
        Parameters(args): Parameters<AddTextArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("add_text", args).await
    }

    #[tool(
        description = "Add a display equation (LaTeX). It is sized automatically from font_size. Returns the element id."
    )]
    async fn add_equation(
        &self,
        Parameters(args): Parameters<AddEquationArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("add_equation", args).await
    }

    #[tool(description = "Add a rectangle, ellipse, line or arrow. Returns the element id.")]
    async fn add_shape(
        &self,
        Parameters(args): Parameters<AddShapeArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("add_shape", args).await
    }

    #[tool(
        description = "Add a spreadsheet-like table (header row, alternate shading; scrolls when large). Returns the element id."
    )]
    async fn add_table(
        &self,
        Parameters(args): Parameters<AddTableArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("add_table", args).await
    }

    #[tool(
        description = "Add an interactive HTML page (simulation, applet) that runs sandboxed in the slide. Returns the element id."
    )]
    async fn add_html(
        &self,
        Parameters(args): Parameters<AddHtmlArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("add_html", args).await
    }

    #[tool(
        description = "Embed a YouTube video or an X (Twitter) post, played with the service's own player (needs internet when presenting). Returns the element id."
    )]
    async fn add_embed(
        &self,
        Parameters(args): Parameters<AddEmbedArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("add_embed", args).await
    }

    #[tool(description = "Add a picture from a local image file. Returns the element id.")]
    async fn add_image(
        &self,
        Parameters(args): Parameters<AddImageArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let app = match self.bridge.app() {
            Ok(app) => app,
            Err(e) => return reply(Err(e)),
        };
        let path = std::path::PathBuf::from(&args.path);
        let imported = tauri::async_runtime::spawn_blocking(move || {
            app.state::<AssetStore>()
                .import_file(&path)
                .map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        let asset = match imported {
            Ok(asset) => asset,
            Err(e) => return reply(Err(format!("could not read the image: {e}"))),
        };
        self.forward(
            "add_image",
            json!({ "slide": args.slide, "frame": args.frame, "asset": asset }),
        )
        .await
    }

    #[tool(
        description = "Change properties of an element (position, size, text, LaTeX, colors, table rows...)."
    )]
    async fn update_element(
        &self,
        Parameters(args): Parameters<UpdateElementArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("update_element", args).await
    }

    #[tool(description = "Delete elements.")]
    async fn delete_elements(
        &self,
        Parameters(args): Parameters<ElementIdsArg>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("delete_elements", args).await
    }

    #[tool(
        description = "Make elements appear (or, with exit=true, disappear) on a given click when presenting, like Beamer's \\pause. Effects: appear, fade, rise, fromLeft, fromRight, zoom, wipe. step null or 0 removes it."
    )]
    async fn set_animation(
        &self,
        Parameters(args): Parameters<AnimationArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("set_animation", args).await
    }

    #[tool(
        description = "Set the presentation's default slide transition (used by slides without their own)."
    )]
    async fn set_presentation_transition(
        &self,
        Parameters(args): Parameters<PresentationTransitionArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("set_presentation_transition", args).await
    }

    #[tool(description = "Change the stacking order of elements.")]
    async fn arrange(
        &self,
        Parameters(args): Parameters<ArrangeArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("arrange", args).await
    }

    #[tool(description = "Set the LaTeX preamble (\\newcommand macros) used by every equation.")]
    async fn set_latex_preamble(
        &self,
        Parameters(args): Parameters<PreambleArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        self.forward("set_latex_preamble", args).await
    }

    #[tool(description = "Undo the last change (yours or the user's).")]
    async fn undo(&self) -> Result<CallToolResult, ErrorData> {
        self.forward("undo", json!({})).await
    }

    #[tool(
        description = "Save the presentation to its file. Fails if it was never saved: ask the user to save it once."
    )]
    async fn save(&self) -> Result<CallToolResult, ErrorData> {
        self.forward("save", json!({})).await
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for TizaMcp {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("tiza", env!("CARGO_PKG_VERSION")))
            .with_instructions(INSTRUCTIONS)
    }
}
