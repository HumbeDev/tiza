# Tiza — Editor de presentaciones offline con LaTeX, multimedia y simulaciones

> **Nombre:** "Tiza" (decidido por el autor el 2026-10-30). Archivos con extensión `.tiza`.
>
> **Para quién es este documento:** para Claude Code, que trabajará en este repositorio junto al autor del proyecto. Es la especificación de referencia: visión, decisiones técnicas, modelo de datos y hoja de ruta por fases. Si algo de este documento entra en conflicto con lo que el autor pide en la conversación, **manda lo que pide el autor**, y se actualiza este documento.

---

## 0. Instrucciones para Claude Code (leer primero)

1. **Trabaja por fases (§11), en orden.** No adelantes funcionalidades de fases futuras. Cada fase tiene criterios de aceptación; una fase está terminada solo cuando se cumplen todos.
2. **Pasos pequeños y verificables.** Cada cambio debe compilar, pasar los tests y poder probarse a mano. Después de cada paso significativo: `git commit` con un mensaje claro.
3. **El autor está aprendiendo.** Al terminar cada paso, explica en pocas líneas y en español qué hiciste, qué archivos tocaste y cómo probarlo. Si tomaste una decisión de diseño no trivial, di por qué.
4. **Pregunta antes de:** agregar una dependencia pesada, cambiar el formato de archivo, cambiar el stack, o borrar código que funciona.
5. **Versiones:** no confíes en versiones memorizadas. Antes de instalar algo, verifica la versión estable actual (documentación oficial / crates.io / npm) y usa esa.
6. **Fase 0 incluye crear `CLAUDE.md`** en la raíz: un resumen corto (≤ 60 líneas) de convenciones y comandos, que apunte a este archivo para el detalle.
7. Mantén al día la sección **§14 Registro de progreso** al cerrar cada fase.

---

## 1. Visión

Una aplicación de escritorio **offline, gratuita y de código abierto** para crear presentaciones científicas y docentes, que combine:

- La **facilidad de PowerPoint/Keynote**: lienzo libre, arrastrar, soltar, mover, redimensionar, escribir directamente sobre la diapositiva.
- La **potencia de LaTeX/Beamer**: ecuaciones de calidad tipográfica, editables tanto **escribiendo código** como con un **editor visual**.
- La **riqueza de la web**: videos, imágenes, páginas web incrustadas en vivo y **simulaciones HTML/JS interactivas** dentro de la diapositiva.

El objetivo de largo plazo es que sea útil para la comunidad (profesores, estudiantes, investigadores), así que la facilidad de uso es tan importante como las funciones.

### Principios

1. **Offline primero.** Todo funciona sin internet, salvo lo que por naturaleza es online (páginas web en vivo). Nada de cuentas ni nubes obligatorias.
2. **Directo y visual.** Lo que ves es lo que se presenta. Cada elemento se puede tocar y mover.
3. **Código cuando quieras, UI cuando quieras.** LaTeX se puede escribir a mano o construir visualmente; ambos modos editan lo mismo.
4. **Archivos portables.** Una presentación es **un solo archivo** con todo adentro (imágenes, videos, simulaciones), que se abre igual en Windows, macOS y Linux.
5. **Abierto a agentes de IA.** Un agente (Claude Code, Claude Desktop u otro cliente MCP) puede crear y editar la presentación abierta, en vivo, mediante un servidor MCP integrado (§7.11). Todo lo que hace la UI lo puede hacer un agente.
6. **Rápido y liviano.** Arranque rápido, poco uso de memoria, fluido incluso con muchas diapositivas.

---

## 2. Usuarios y casos de uso

- **Docente de física/matemáticas:** clase con ecuaciones, una simulación interactiva de un péndulo o de una red cristalina, y un video de un experimento.
- **Estudiante:** presentación de seminario/tesis con muchas fórmulas y figuras, revelando ecuaciones paso a paso (como `\pause` de Beamer).
- **Investigador:** charla en congreso que muestra una herramienta web en vivo (un visor 3D, un notebook publicado, un dashboard).
- **Divulgador:** presentación visual con video y animaciones simples.

---

## 3. Funcionalidades

### 3.1 Núcleo (MVP)

- Crear, abrir, guardar presentaciones (`.tiza`).
- Panel de miniaturas de diapositivas: agregar, duplicar, borrar, reordenar arrastrando.
- Lienzo con elementos posicionables: **seleccionar, mover, redimensionar, rotar, alinear, traer adelante/atrás, agrupar**, guías de alineación (snapping), copiar/pegar, multi-selección.
- **Texto enriquecido** (negrita, cursiva, listas, tamaños, colores) con **ecuaciones inline** (`$...$`) dentro del texto.
- **Bloques de ecuación** (display) con LaTeX: edición por código con vista previa instantánea **y** editor visual de ecuaciones.
- **Imágenes** (PNG, JPG, SVG, GIF, WebP): insertar arrastrando desde el explorador de archivos o pegando del portapapeles.
- **Videos locales** (MP4/WebM): reproducir dentro de la diapositiva, con controles, autoplay opcional, inicio/fin recortado.
- **Simulaciones HTML**: insertar un archivo `.html` (o pegar código) que corre aislado dentro de un recuadro de la diapositiva.
- **Páginas web en vivo**: incrustar una URL que se ve e interactúa en tiempo real.
- **Modo presentación** a pantalla completa, con navegación por teclado/clicker.
- **Deshacer/rehacer** ilimitado en la sesión.
- **Autoguardado** y recuperación ante cierre inesperado.
- **Multilingüe desde el día uno:** español, portugués (Brasil), francés e inglés. Ningún texto de la UI va escrito directo en el código (ver §7.10).

### 3.2 Siguientes (post-MVP)

- **Vista del presentador** en segunda pantalla: notas, diapositiva siguiente, cronómetro, reloj.
- **Revelado paso a paso** (fragmentos/"builds"): elementos que aparecen en orden con cada clic.
- **Transiciones** simples entre diapositivas (fundido, deslizar) y animaciones de entrada.
- **Temas y diapositivas maestras**: fuentes, colores, fondo, numeración, pie de página.
- **Bloques LaTeX completos** (TikZ, `pgfplots`, `circuitikz`, tablas complejas) compilados a SVG con un motor TeX real.
- **Macros LaTeX globales** del documento (`\newcommand`) aplicadas a todas las ecuaciones.
- **Bloques de código** con resaltado de sintaxis.
- **Formas y flechas** (rectángulo, elipse, línea, flecha, llaves).
- **Exportar**: PDF, HTML autocontenido (presentación que se abre en cualquier navegador), imágenes PNG.
- **Vista de código de la diapositiva**: ver/editar la diapositiva como texto estructurado, sincronizado con el lienzo.

### 3.3 Más adelante / ideas

- Importar/exportar Beamer (`.tex`).
- Importar PPTX (solo contenido básico).
- Galería de simulaciones de ejemplo (física, matemáticas) lista para insertar.
- Capturas automáticas ("snapshot") de páginas web para cuando no hay internet.
- Plugins.

---

## 4. Decisiones técnicas

### 4.1 Por qué **Tauri 2** (Rust + webview) y no una GUI 100 % Rust

El autor se inspira en proyectos como ArtCraft, escritos en Rust nativo. Para *esta* aplicación, sin embargo, la mejor arquitectura es **Tauri**: núcleo en **Rust** + interfaz en **TypeScript** dibujada por el **webview del sistema operativo**. Razones:

- Tres de los requisitos centrales — **incrustar páginas web, correr simulaciones HTML/JS y reproducir video** — son exactamente lo que hace un motor web. Con una GUI pura en Rust (egui, iced, gpui, Slint) habría que incrustar un webview igual, y coordinarlo con el lienzo sería mucho más difícil.
- Ecuaciones (MathJax/MathLive), texto enriquecido y lienzo con arrastrar/redimensionar tienen bibliotecas web maduras y libres.
- Tauri usa el webview **del sistema** (no empaqueta un navegador como Electron): binarios pequeños, poco consumo de memoria, arranque rápido.
- Rust queda a cargo de lo que necesita rendimiento y acceso al sistema: archivos, compresión, assets, compilación LaTeX, exportación, caché.

**Regla de reparto:** *la UI y el renderizado de diapositivas viven en el frontend; el sistema de archivos, el procesamiento pesado y todo lo que toca el disco vive en Rust.*

### 4.2 Stack

| Capa | Elección | Notas |
|---|---|---|
| Shell de escritorio | **Tauri 2** | Windows (WebView2), macOS (WKWebView), Linux (WebKitGTK) |
| Backend | **Rust** (edición estable actual) | `serde`, `zip`, `sha2`, `thiserror`, `tokio` |
| Bindings Rust↔TS | **ts-rs** | Tipos TS generados desde Rust con `cargo test` → `src/bindings/` |
| Frontend | **TypeScript + React + Vite** | Ecosistema más amplio; Claude Code trabaja bien con él |
| Estado | **Zustand** + **Immer** (parches para deshacer/rehacer) | |
| Mover/redimensionar/rotar | **Implementación propia** (`src/canvas/`, `src/document/geometry.ts`) | Moveable está sin mantenimiento desde 2023 |
| Texto enriquecido | **TipTap** (ProseMirror) | Nodo personalizado para matemáticas inline |
| Ecuaciones (render) | **MathJax 4** (`@mathjax/src`) empaquetado localmente, salida **SVG** | Soporta `amsmath`, `physics`, `mhchem`, etc. Sin CDN |
| Ecuaciones (editor visual) | **MathLive** empaquetado localmente | Produce LaTeX; mismo dato que el modo código |
| Servidor MCP (fase 5) | **rmcp** (SDK oficial de MCP para Rust) + Streamable HTTP | Apache-2.0. Esquemas de herramientas con `schemars` |
| Editor de código | **CodeMirror 6** | Para LaTeX, HTML de simulaciones y vista de código |
| LaTeX completo (fase 8) | **Tectonic** (motor TeX en Rust) → PDF → SVG | Requiere paquete TeX cacheado para funcionar offline |
| Tests | `cargo test`, **Vitest**, luego **Playwright** para e2e | |
| Lint/formato | `rustfmt`, `clippy`, **ESLint**, **Prettier** | |

> Antes de fijar cualquier dependencia, verificar versión estable actual y licencia compatible con MIT/Apache-2.0.

### 4.3 Licencia del proyecto

Doble licencia **MIT OR Apache-2.0** (la convención del ecosistema Rust). Todas las dependencias deben ser compatibles.

---

## 5. Arquitectura

```
┌──────────────────────────── Ventana Tauri ────────────────────────────┐
│  Frontend (TypeScript/React)                                          │
│  ┌────────────┐  ┌────────────────────────────┐  ┌────────────────┐   │
│  │ Miniaturas │  │ Lienzo (1920×1080 lógicos, │  │ Panel de       │   │
│  │ de slides  │  │ escalado con CSS transform)│  │ propiedades    │   │
│  └────────────┘  │  ├ TextElement (TipTap)    │  └────────────────┘   │
│                  │  ├ MathElement (MathJax)   │                       │
│  Store (Zustand) │  ├ ImageElement            │  Editores:            │
│  · documento     │  ├ VideoElement            │  · LaTeX código       │
│  · selección     │  ├ WebElement (iframe /    │  · LaTeX visual       │
│  · historial     │  │   webview hijo)         │  · HTML simulación    │
│                  │  └ SimElement (iframe      │                       │
│                  │      sandbox, srcdoc)      │                       │
│                  └────────────────────────────┘                       │
│                         ▲  invoke() / eventos (tipados)               │
├─────────────────────────┼─────────────────────────────────────────────┤
│  Backend (Rust)         ▼                                             │
│  · document: abrir/guardar .tiza (zip), migraciones de versión       │
│  · assets: importar, deduplicar por hash, servir por protocolo propio │
│  · autosave + recuperación                                            │
│  · latex: compilar bloques con Tectonic, caché por hash               │
│  · export: PDF / HTML / PNG                                           │
│  · mcp: servidor MCP local → eventos al frontend (§7.11)              │
│  · settings, archivos recientes                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 5.1 Principios de arquitectura

- **El documento es datos puros** (JSON serializable). La UI es una función del documento. Nada de estado importante escondido en el DOM.
- **Toda mutación del documento pasa por el store** como una acción con nombre (`moveElements`, `updateMath`, ...), lo que da deshacer/rehacer gratis vía parches de Immer.
- **El mismo componente de renderizado** de diapositiva se usa en: lienzo de edición, miniaturas, modo presentación y exportación. Un solo `SlideRenderer` con un prop `mode: "edit" | "thumb" | "present" | "export"`.
- **Coordenadas lógicas fijas:** cada diapositiva mide 1920×1080 unidades (16:9) o 1440×1080 (4:3). El lienzo se escala con `transform: scale()`. Así la presentación se ve idéntica en cualquier pantalla.

---

## 6. Modelo de datos y formato de archivo

### 6.1 Tipos (fuente de verdad en Rust, exportados a TS)

```ts
type Id = string;            // UUID v4 / nanoid
interface Presentation {
  schemaVersion: number;     // empieza en 1; migraciones en Rust
  meta: { title: string; author?: string; created: string; modified: string; lang: string };
  page: { aspect: "16:9" | "4:3"; width: number; height: number };
  theme: Theme;
  latex: { preamble: string };          // \newcommand globales, paquetes de MathJax habilitados
  slides: Slide[];
}

interface Slide {
  id: Id;
  background?: Fill;                    // color, degradado o imagen
  elements: Element[];                  // orden del array = orden z (último arriba)
  notes: string;                        // notas del presentador (texto/markdown)
  transition?: { kind: "none" | "fade" | "slide"; durationMs: number };
  hidden?: boolean;
}

interface BaseElement {
  id: Id;
  x: number; y: number; w: number; h: number;   // unidades lógicas
  rotation: number;                              // grados
  opacity: number;                               // 0..1
  locked: boolean;
  groupId?: Id;
  build?: { step: number; effect: "appear" | "fade" };  // revelado paso a paso (fase 7)
}

type Element =
  | BaseElement & { kind: "text";  doc: TipTapJSON }               // admite nodos math inline
  | BaseElement & { kind: "math";  latex: string; color?: string; fontSize: number; align: "left"|"center"|"right" }
  | BaseElement & { kind: "latexBlock"; source: string; renderedSvg?: AssetRef }   // fase 8, Tectonic
  | BaseElement & { kind: "image"; asset: AssetRef; fit: "contain" | "cover" | "fill"; crop?: Rect }
  | BaseElement & { kind: "video"; asset: AssetRef; autoplay: boolean; loop: boolean; muted: boolean;
                    startS?: number; endS?: number; poster?: AssetRef }
  | BaseElement & { kind: "web";   url: string; zoom: number; snapshot?: AssetRef; interactive: boolean }
  | BaseElement & { kind: "sim";   asset: AssetRef; params?: Record<string, unknown>; poster?: AssetRef }
  | BaseElement & { kind: "shape"; shape: "rect" | "ellipse" | "line" | "arrow"; fill?: Fill; stroke?: Stroke }
  | BaseElement & { kind: "code";  language: string; source: string; theme: string };

type AssetRef = string;  // "sha256:<hash>.<ext>" — apunta a assets/ dentro del archivo
```

### 6.2 Formato `.tiza`

Un archivo **ZIP** con extensión `.tiza`:

```
mi-charla.tiza
├── manifest.json        # schemaVersion, versión de la app, lista de assets con tamaño y tipo MIME
├── presentation.json    # el documento (§6.1), legible por humanos
├── assets/
│   ├── sha256-ab12….png
│   ├── sha256-cd34….mp4
│   └── sha256-ef56….html  # simulaciones
└── cache/               # opcional y descartable: SVG de LaTeX, miniaturas
```

Reglas:

- Los assets se nombran por **hash de contenido** → deduplicación automática.
- Videos y otros assets grandes se guardan **sin comprimir** (`Stored`) dentro del zip; JSON y HTML con `Deflate`.
- Guardado **atómico**: escribir a archivo temporal en la misma carpeta → `fsync` → renombrar.
- Al abrir: descomprimir a una **carpeta de trabajo** en el directorio de caché de la app; el frontend accede a los assets mediante un **protocolo personalizado** de Tauri (p. ej. `tiza-asset://<hash>`), nunca con rutas absolutas del disco.
- `schemaVersion` + funciones de migración `v1 → v2 → …` en Rust, con tests.
- Autosave cada N segundos y tras cambios, a la carpeta de recuperación; al iniciar, ofrecer recuperar si existe una sesión no cerrada.

---

## 7. Subsistemas en detalle

### 7.1 Lienzo y edición directa

- Clic selecciona; Shift/Ctrl+clic multi-selección; arrastrar en vacío = selección por área.
- Moveable para mover, redimensionar (con Shift = mantener proporción), rotar; snapping a bordes/centros de otros elementos y de la diapositiva, con guías visibles.
- Doble clic entra a **edición del contenido** (texto, ecuación, simulación); Esc sale.
- Flechas mueven 1 unidad; Shift+flechas 10.
- Atajos: Ctrl+Z/Ctrl+Shift+Z, Ctrl+C/V/X/D, Supr, Ctrl+G (agrupar), Ctrl+]/[ (orden z).
- **Arrastrar archivos** desde el sistema al lienzo: detectar tipo y crear el elemento adecuado (imagen, video, `.html` → simulación). Pegar del portapapeles: imágenes, texto, URLs (URL → preguntar "¿incrustar página web?").
- Zoom del lienzo (Ctrl+rueda) y "ajustar a ventana".
- Barra de inserción clara: Texto · Ecuación · Imagen · Video · Web · Simulación · Forma.

### 7.2 Texto y LaTeX

**Tres niveles, de lo más simple a lo más potente:**

1. **Matemática inline en texto:** en un cuadro de texto, escribir `$E = mc^2$` convierte automáticamente a un nodo matemático renderizado. Clic sobre él → editar su LaTeX en un popover con vista previa.
2. **Elemento ecuación (`math`):** un bloque independiente, movible y escalable.
   - **Modo código:** CodeMirror con resaltado LaTeX, autocompletado de comandos comunes, vista previa en vivo (MathJax → SVG, debounce ~150 ms). Errores mostrados en línea, sin romper la diapositiva (se mantiene el último render válido).
   - **Modo visual:** MathLive (teclado virtual matemático, plantillas de fracciones, integrales, matrices).
   - Ambos modos editan el **mismo string LaTeX**; cambiar de pestaña no pierde nada.
   - Macros globales del documento (`latex.preamble`) se aplican a todas las ecuaciones.
3. **Bloque LaTeX completo (`latexBlock`, fase 8):** para TikZ, pgfplots, etc. Se compila con **Tectonic** en Rust en un hilo de fondo → PDF → SVG, se cachea por hash del código fuente. Mientras compila, se muestra el render anterior y un indicador.
   - Para funcionar **offline**, el paquete de TeX que usa Tectonic debe descargarse una vez y quedar cacheado (ofrecer botón "Preparar LaTeX sin conexión" en ajustes). Alternativa: si el usuario tiene TeX Live/MiKTeX instalado, permitir usar ese.

Todo el JS de MathJax, MathLive y fuentes matemáticas va **empaquetado con la app** (cero CDN).

### 7.3 Imágenes y video

- Imágenes: importar → hash → `assets/`. Recorte y ajuste (`contain`/`cover`/`fill`). SVG se sanitiza (sin scripts).
- Video: elemento `<video>` HTML5 servido por el protocolo de assets (con soporte de **range requests**, imprescindible para poder adelantar en videos grandes).
  - En edición: muestra el póster/primer frame; reproduce solo si el usuario lo pide.
  - En presentación: autoplay opcional al entrar a la diapositiva, pausa al salir.
  - **Atención a códecs por plataforma:** MP4/H.264 funciona en Windows y macOS; en Linux (WebKitGTK) depende de que estén instalados los plugins de GStreamer. Recomendar WebM/VP9 o AV1 como formato más portable y avisar al usuario si un video no se puede reproducir.

### 7.4 Páginas web en vivo (`web`)

- Primera implementación: `<iframe src=url>` dentro del elemento, con zoom ajustable.
- **Limitación conocida:** muchos sitios prohíben ser incrustados (`X-Frame-Options`, CSP `frame-ancestors`). Detectarlo y mostrar un mensaje claro en vez de un recuadro en blanco.
- Solución robusta (fase posterior): usar un **webview hijo** de Tauri (multiwebview) posicionado exactamente sobre el rectángulo del elemento. Esto no está sujeto a las restricciones de iframe. Requiere sincronizar posición/tamaño con el lienzo y ocultarlo cuando el elemento no es visible. Evaluar estado/estabilidad de esa API en Tauri antes de implementarlo.
- Modo "interactivo" on/off: en edición, por defecto un clic selecciona el elemento (no interactúa con la página); doble clic activa la interacción.
- Sin internet: mostrar la **captura (snapshot)** guardada, si existe, con un aviso discreto.

### 7.5 Simulaciones HTML (`sim`)

Para incrustar simulaciones HTML/JS autocontenidas (por ejemplo, generadas con un asistente de IA o escritas a mano).

- Por ahora el HTML se guarda **dentro del documento** (`SimElement.html`); pasará a asset `.html` cuando exista el sistema de assets (fase 6), con migración. En escritorio se sirve por el protocolo `tizasim://` (Rust, CSP propia por cabecera; un `srcdoc` heredaría la CSP de la app y bloquearía sus scripts); en la web, `srcdoc` + `<meta>` CSP. Siempre `<iframe sandbox="allow-scripts">`.
- Tamaño: caja en la diapositiva (unidades lógicas) + **resolución interna** `viewWidth × viewHeight` (px CSS de la página) + ajuste `contain`/`fill`.
  - **Nunca** `allow-same-origin` junto con `allow-scripts`: la simulación no debe poder acceder a la app, a los archivos ni a otros elementos.
  - CSP estricta dentro del iframe: sin red por defecto (opción explícita del usuario para permitirla, p. ej. si la simulación carga una librería de un CDN). Mejor: ofrecer "empaquetar dependencias" descargando las librerías una vez dentro del asset.
- Editor integrado (CodeMirror, HTML) con vista previa al lado, botón "recargar".
- Parámetros opcionales: la app puede enviar `params` vía `postMessage` y la simulación puede responder (API mínima, documentada, opcional).
- En presentación: la simulación corre solo en la diapositiva visible; al salir se desmonta o se pausa (ahorra CPU/batería).
- Póster: captura estática para miniaturas y exportación PDF.
- Fase posterior: galería de simulaciones de ejemplo (péndulo, ondas, campo eléctrico, red cristalina 3D, etc.).

### 7.6 Modo presentación

- Ventana a pantalla completa (en el monitor elegido). Fondo negro con la diapositiva escalada y centrada.
- Navegación: →, ↓, Espacio, PageDown, clic = siguiente paso; ←, ↑, PageUp = anterior; Home/End; número + Enter = ir a diapositiva; `B` = pantalla negra; Esc = salir.
- Los clickers de presentación envían PageUp/PageDown: deben funcionar sin configuración.
- **Vista del presentador** (fase 7): segunda ventana con diapositiva actual, siguiente, notas, cronómetro y reloj, sincronizada por eventos de Tauri.
- Las simulaciones y páginas web **son interactivas** durante la presentación (con el mouse), sin que el clic avance la diapositiva cuando el puntero está sobre ellas.

### 7.7 Exportación (fase 9)

- **HTML autocontenido:** una carpeta o archivo único con un visor ligero; mantiene video, ecuaciones y simulaciones. Es la exportación natural porque la app ya renderiza con tecnología web.
- **PDF:** cada diapositiva se renderiza con `SlideRenderer mode="export"`; los elementos interactivos se sustituyen por su póster/snapshot. Primera versión: rasterizar a PNG de alta resolución y componer el PDF en Rust. Mejora posterior: PDF vectorial (texto y ecuaciones como vectores) — investigar la mejor vía por plataforma.
- **PNG** por diapositiva.
- Opción de exportar cada paso de revelado como página separada (como Beamer).

### 7.8 Temas

- Tema = fuentes (título/cuerpo/código), paleta de colores, fondo por defecto, estilos de texto predefinidos (Título, Subtítulo, Cuerpo, Pie).
- Las fuentes se empaquetan con la app o se incrustan en el `.tiza` (nunca dependen de internet).
- Fase posterior: diapositivas maestras/diseños (título, título + contenido, dos columnas).

### 7.9 Deshacer/rehacer y autosave

- Historial basado en parches de Immer, agrupando cambios continuos (un arrastre completo = un paso de deshacer; escribir texto se agrupa por pausas).
- Autosave a carpeta de recuperación; el guardado "real" sigue siendo explícito (Ctrl+S), salvo que el usuario active autoguardado en el archivo en ajustes.
- Indicador de "cambios sin guardar" y confirmación al cerrar.

### 7.10 Idiomas (i18n)

Requisito central del autor: **español (`es`), portugués de Brasil (`pt-BR`), francés (`fr`) e inglés (`en`)** no pueden faltar, en todas las fases.

- Frontend: **i18next + react-i18next**. Un JSON por idioma en `src/i18n/locales/`; claves tipadas desde `en.json`.
- Toda funcionalidad nueva agrega sus textos **en los cuatro idiomas a la vez**. Un test (`locales.test.ts`) falla si falta una clave, hay una vacía o no coinciden los `{{placeholders}}`.
- Idioma inicial: el del sistema (cualquier variante de portugués → `pt-BR`; si no se soporta → inglés). El usuario puede cambiarlo en la app.
- Rust **no** devuelve textos para el usuario: devuelve errores con un **código** estable (p. ej. `archive.invalidZip`) y datos; el frontend los traduce.
- Fechas y números con `Intl` según el idioma activo.
- Agregar un idioma = agregar un JSON + una entrada en `SUPPORTED_LANGUAGES`.

### 7.11 Agentes de IA (servidor MCP)

Requisito central del autor: **Tiza se construye para agentes.** Un agente conectado por MCP puede hacer todo lo que hace un usuario con la UI, sobre la presentación abierta y en vivo.

**Arquitectura**

- Rust aloja un servidor MCP con **rmcp**, transporte **Streamable HTTP** en `127.0.0.1` (puerto configurable) y protegido con un token.
- El **store del frontend sigue siendo la única autoridad** del documento. Flujo de una herramienta: agente → Rust (valida los argumentos contra el esquema) → evento Tauri con `requestId` → el frontend ejecuta **la misma acción del store que usa la UI** → responde → Rust contesta al agente.
  - Así los cambios del agente se ven al instante, pasan por las mismas validaciones y son **deshacibles**: cada llamada a una herramienta es un paso de deshacer.
- Las herramientas trabajan sobre la presentación abierta; si la app está cerrada, no hay servidor.
- Más adelante (opcional): un puente stdio (`tiza --mcp-stdio`) para clientes que no hablan HTTP.

**Herramientas iniciales (fase 5)**

- Lectura: `get_presentation` (resumen con ids de diapositivas y elementos), `get_slide`, `get_selection`.
- Diapositivas: `add_slide`, `duplicate_slide`, `delete_slide`, `move_slide`, `set_slide_background`, `go_to_slide`.
- Elementos: `add_shape`, `add_text`, `update_elements`, `delete_elements`, `align_elements`, `reorder_elements`, `select_elements`.
- Lote: `apply_operations`: varias operaciones atómicas = un solo paso de deshacer.
- Vista: `render_slide` → imagen PNG de la diapositiva, para que el agente **vea** el resultado (investigar la mejor técnica: SVG `foreignObject` → canvas, o captura del webview).
- Archivo: `save`; `open`/`new` piden confirmación al usuario si hay cambios sin guardar.

**Reglas**

- **Cada fase siguiente agrega herramientas MCP para sus funcionalidades nuevas** (ecuaciones, imágenes desde ruta, video, simulaciones HTML, controlar el modo presentación, exportar). Igual que con los idiomas, una funcionalidad no está completa sin su herramienta.
- Las descripciones de las herramientas y los mensajes de error para el agente van en **inglés** (los agentes trabajan mejor así). Errores con código estable.
- Coordenadas en unidades lógicas (1920×1080 en 16:9), documentadas en la descripción de cada herramienta.
- Los esquemas de entrada se generan desde los tipos de Rust (`schemars`): una sola fuente de verdad con el modelo del documento.
- **Desactivado por defecto**; se activa en ajustes. Indicador visible de "agente conectado". En ajustes, botón "Copiar configuración" que genera el comando listo para el cliente, p. ej. `claude mcp add --transport http tiza http://127.0.0.1:<puerto>/mcp --header "Authorization: Bearer <token>"`.
- Seguridad: solo `127.0.0.1`, token aleatorio regenerable, se valida la cabecera `Origin` (contra DNS rebinding), límite de tamaño por solicitud. Ninguna herramienta da acceso genérico al sistema de archivos: leer un archivo del disco (p. ej. una imagen) solo con rutas que el usuario apruebe o dentro de carpetas permitidas.

---

## 8. Seguridad

La app ejecuta contenido potencialmente no confiable (HTML de terceros, páginas web, archivos `.tiza` recibidos de otras personas). Reglas:

- **Capabilities/permisos de Tauri mínimos:** el frontend solo puede invocar los comandos propios de la app; nada de acceso genérico al sistema de archivos ni a la shell desde JS.
- Simulaciones y páginas web en iframes **aislados** (§7.5); nunca reciben acceso a la API de Tauri.
- CSP estricta en la ventana principal.
- Al abrir un `.tiza`: validar el JSON contra el esquema, rechazar rutas con `..` dentro del zip (zip-slip), limitar tamaños.
- SVG importados: sanitizar.
- Servidor MCP: ver reglas en §7.11 (desactivado por defecto, localhost, token, `Origin`).
- Si una presentación contiene simulaciones o páginas web, mostrar un aviso la primera vez que se abre ("Este archivo contiene contenido interactivo") con opción de confiar.

---

## 9. Rendimiento

- Miniaturas: renderizado diferido y virtualizado (solo las visibles); simulaciones/videos/web se muestran como póster en miniaturas, nunca en vivo.
- En el lienzo, montar elementos pesados (web, sim, video) **solo en la diapositiva activa**.
- MathJax: caché de SVG por `(latex, preamble)`; renderizar en idle o en un worker si es posible.
- Assets grandes nunca pasan por IPC como bytes: se sirven por el protocolo de assets.
- Operaciones de disco y compilación LaTeX en hilos de fondo en Rust (`tokio::task::spawn_blocking`); la UI nunca se congela.
- Objetivo orientativo: presentación de 100 diapositivas con 20 ecuaciones cada una se abre en < 2 s y el arrastre de elementos se mantiene a 60 fps.

---

## 10. Estructura del repositorio

```
tiza/
├── CLAUDE.md                 # convenciones y comandos (lo crea Claude Code en la fase 0)
├── PROYECTO.md               # este documento
├── README.md
├── LICENSE-MIT / LICENSE-APACHE
├── package.json
├── src/                      # frontend (TypeScript/React)
│   ├── app/                  # layout principal, menús, atajos
│   ├── canvas/               # lienzo, selección, Moveable, guías
│   ├── elements/             # un componente por tipo de elemento
│   │   ├── text/  math/  image/  video/  web/  sim/  shape/  code/
│   ├── editors/              # editor LaTeX (código + visual), editor HTML
│   ├── present/              # modo presentación y vista del presentador
│   ├── render/               # SlideRenderer compartido
│   ├── store/                # Zustand, acciones, historial
│   ├── agent/                # recibe solicitudes MCP y las ejecuta como acciones del store
│   ├── bindings/             # tipos y comandos generados desde Rust (no editar a mano)
│   ├── i18n/
│   └── styles/
├── src-tauri/                # backend (Rust)
│   ├── src/
│   │   ├── main.rs / lib.rs
│   │   ├── commands/         # comandos expuestos al frontend
│   │   ├── document/         # modelo, (de)serialización, migraciones
│   │   ├── archive/          # lectura/escritura .tiza (zip, atómica)
│   │   ├── assets/           # importación, hash, protocolo tiza-asset://
│   │   ├── autosave/
│   │   ├── mcp/              # servidor MCP y puente con el frontend (fase 5)
│   │   ├── latex/            # Tectonic (fase 8)
│   │   └── export/
│   ├── capabilities/
│   └── tauri.conf.json
├── vendor/                   # MathJax, MathLive, fuentes (si no se instalan vía npm)
├── examples/                 # presentaciones de ejemplo y simulaciones de muestra
└── tests/                    # e2e (Playwright), fixtures .tiza
```

---

## 11. Hoja de ruta por fases

Cada fase termina con: código compilando en modo release, tests pasando, commit, y actualización de §14.

### Fase 0 — Preparación del entorno
- Verificar herramientas instaladas: Rust (rustup), Node LTS, Git, y prerequisitos de Tauri del sistema operativo del autor. Si falta algo, explicar cómo instalarlo y esperar.
- Crear proyecto Tauri 2 + React + TypeScript + Vite. Configurar ESLint, Prettier, rustfmt, clippy, Vitest.
- `git init`, `.gitignore`, licencias, README mínimo, `CLAUDE.md`.
- Infraestructura i18n con los cuatro idiomas (§7.10).
- **Aceptación:** `npm run tauri dev` abre una ventana con "Hola Tiza"; `cargo test` y `npm test` pasan.

### Fase 1 — Documento y lienzo básico
- Modelo de datos (§6.1) en Rust + bindings TS generados.
- Store con acciones y deshacer/rehacer.
- Layout: miniaturas a la izquierda, lienzo al centro, propiedades a la derecha.
- Elementos `shape` y `text` simple (sin TipTap aún): crear, seleccionar, mover, redimensionar, rotar, borrar, orden z, multi-selección, guías de alineación.
- Agregar/duplicar/borrar/reordenar diapositivas.
- **Aceptación:** puedo armar varias diapositivas con cuadros y textos, moverlos con precisión y deshacer todo.

### Fase 2 — Texto enriquecido y ecuaciones
- TipTap en elementos de texto con matemática inline `$…$`.
- Elemento `math` con modo código (CodeMirror + vista previa MathJax SVG) y modo visual (MathLive), sincronizados.
- Preámbulo/macros globales del documento.
- **Aceptación:** escribo una diapositiva con párrafos que mezclan texto y fórmulas, y una ecuación grande editada alternando código y modo visual; todo funciona sin internet.

### Fase 3 — Archivo `.tiza` y distribución
- Guardar/abrir/guardar como (zip, guardado atómico), archivos recientes, indicador de cambios sin guardar, autosave + recuperación, migraciones (aunque solo exista v1, dejar la infraestructura y un test).
- Distribución: instaladores para Windows/macOS/Linux compilados por GitHub Actions al subir un tag (`scripts/release.sh`), versión web publicada con `scripts/deploy-web.sh` en https://tiza.ingenieriafisica.online/ (guardar = descargar/File System Access API; abrir = elegir archivo).
- **Aceptación:** cierro la app sin guardar a la fuerza, la vuelvo a abrir y me ofrece recuperar; un archivo guardado en un SO se abre igual en otro.

### Fase 4 — Simulaciones HTML y páginas web
- Elemento `sim` (iframe sandbox, editor HTML con vista previa, póster).
- Elemento `web` con iframe, detección de bloqueo de incrustación con mensaje claro, modo interactivo on/off, snapshot.
- Incluir 2–3 simulaciones de ejemplo en `examples/`.
- **Aceptación:** inserto una simulación de un péndulo que corre aislada; incrusto una página que lo permita y la uso en vivo; una que lo bloquea muestra un aviso entendible.

### Fase 5 — Servidor MCP para agentes
- Servidor `rmcp` (Streamable HTTP, localhost, token) + puente Rust ↔ frontend por eventos con `requestId` y timeout.
- Herramientas iniciales de §7.11 sobre las acciones existentes del store, con esquemas generados desde Rust.
- `render_slide` (PNG) para que el agente vea el resultado.
- Ajustes: activar/desactivar, puerto, token, "copiar configuración"; indicador de agente conectado.
- Tests: cada herramienta en Rust (validación de argumentos) y en Vitest (ejecución sobre el store, un paso de deshacer por llamada); e2e conectando un cliente MCP real.
- **Aceptación:** conecto Claude Code a Tiza, le pido "arma 3 diapositivas sobre el péndulo simple con títulos y formas" y las veo aparecer en vivo; con Ctrl+Z deshago lo que hizo el agente; con el servidor desactivado, nada escucha en el puerto.

### Fase 6 — Imágenes y video
- Protocolo `tiza-asset://` con range requests. Importar por diálogo, arrastrar y pegar. Recorte/ajuste de imagen. Video con controles, recorte inicio/fin, autoplay, póster.
- **Aceptación:** inserto un video de 500 MB, puedo adelantarlo sin trabas, guardo, reabro y sigue ahí; el `.tiza` no duplica assets repetidos.

### Fase 7 — Modo presentación
- Pantalla completa en monitor elegido, navegación por teclado/clicker, pantalla negra, simulaciones/web interactivas.
- Revelado paso a paso (`build`), transiciones simples.
- Vista del presentador con notas, siguiente diapositiva y cronómetro.
- **Aceptación:** doy una charla completa con proyector usando solo un clicker.

### Fase 8 — LaTeX completo
- Bloques `latexBlock` con Tectonic, compilación en segundo plano, caché, errores legibles, modo offline preparado.
- **Aceptación:** una figura TikZ se compila, se ve nítida al escalarla y funciona sin internet tras la preparación inicial.

### Fase 9 — Exportación
- HTML autocontenido, PDF (con pósters para lo interactivo, opción de un paso por página), PNG.
- **Aceptación:** exporto a PDF y se ve fiel a la presentación; el HTML exportado se abre en un navegador sin la app.

### Fase 10 — Pulido y comunidad
- Temas y diapositivas maestras, formas/flechas avanzadas, bloques de código, revisión de traducciones por hablantes nativos, accesibilidad (navegación por teclado, contraste), instaladores para los tres sistemas, documentación de usuario, guía de contribución.

---

## 12. Convenciones

- **Idioma:** código, identificadores y comentarios en inglés (facilita contribuciones); textos de la UI vía i18n; documentación para el autor en español.
- **Rust:** sin `unwrap()` en código de producción; errores con `thiserror` y convertidos a mensajes legibles para el usuario. `clippy` sin advertencias.
- **TypeScript:** `strict: true`. Componentes pequeños. Ningún componente modifica el documento directamente: siempre vía acciones del store.
- **Tests mínimos por fase:** (de)serialización y migraciones en Rust; acciones del store y deshacer/rehacer en Vitest; luego e2e de flujos clave con Playwright.
- **Git:** commits pequeños con mensajes descriptivos (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`). Una rama por fase si el autor lo prefiere.
- **Dependencias:** justificar cada una nueva (qué resuelve, licencia, tamaño).

---

## 13. Riesgos conocidos y preguntas abiertas

- **Diferencias entre webviews** (WebView2 / WKWebView / WebKitGTK): probar en los tres; especial cuidado con video en Linux y APIs CSS recientes.
- **Incrustación web:** muchos sitios bloquean iframes; el webview hijo de Tauri es la salida, pero su API puede cambiar. Decidir cuando se llegue a la fase 4.
- **Tectonic offline:** tamaño del paquete TeX cacheado y primera descarga. Alternativa: usar TeX instalado en el sistema.
- **PDF vectorial:** no trivial desde un webview; la primera versión será rasterizada.
- **Nombre:** "Tiza"/`.tiza` (decidido). Revisar choques de nombre antes de publicar instaladores.
- **Sistema operativo principal del autor:** Arch Linux (Omarchy, Hyprland/Wayland, WebKitGTK 4.1). Se prioriza probar ahí; Windows y macOS después.

---

## 14. Registro de progreso

> Claude Code: añade una entrada al cerrar cada fase (fecha, qué se hizo, decisiones tomadas, pendientes).

### Fase 0 — 2026-10-30 ✅
- Repo público `HumbeDev/tiza`; rama por fase (`fase-N`) fusionada a `main` al cerrar.
- Nombre definitivo: **Tiza** (`.tiza`, `tiza-asset://`).
- Tauri 2.12 + React 19 + Vite 8 + TypeScript 6.0 (TS 7 aún no es compatible con typescript-eslint). Tauri 3 está en alfa: no se usa.
- Quitado el plugin `opener` de la plantilla (permisos mínimos, §8). CSP estricta en producción.
- i18n con es / pt-BR / fr / en y tests de consistencia (§7.10).
- ESLint, Prettier, rustfmt, clippy (`-D warnings`), Vitest, `cargo test`.
- Pendiente del autor: cambiar Rust del paquete de Arch a `rustup` (`sudo pacman -S rustup` → `rustup default stable`), e instalar `gst-plugins-base` para video en WebKitGTK.

### Fase 1 — 2026-10-30 ✅ (probada por el autor)
- Modelo de datos en Rust (`src-tauri/src/document/`) con tests de JSON; tipos TS generados con **ts-rs** (tauri-specta 2 sigue en RC).
- Store Zustand + Immer con parches: deshacer/rehacer ilimitado; los gestos continuos se agrupan con `mergeKey` y `seal()`.
- Mover/redimensionar/rotar y guías magnéticas **implementados a mano** en vez de Moveable (sin releases desde 2023, riesgo con React 19). La geometría es pura y tiene tests.
- Elementos `shape` (rect, elipse, línea, flecha) y `text` plano. `text` pasará a TipTap en la fase 2, antes de que exista el formato de archivo (sin migración).
- Reordenar diapositivas con eventos de puntero (no HTML5 drag&drop, que choca con el drag&drop de archivos de Tauri).
- Pendiente: agrupar (Ctrl+G) queda para después; portapapeles solo interno (no del sistema).
- Pendiente para la fase 5 (MCP): las acciones de elementos operan sobre la diapositiva actual; agregarles un `slideId` explícito.
- Orden de fases cambiado por el autor (2026-10-30): **2 Ecuaciones → 3 Archivo → 4 MCP**. TikZ/Tectonic sigue en la fase 8.

### Fase 2 — 2026-10-30 ✅ (probada por el autor)
- **MathJax 4** (`src/math/mathjax.ts`): sin CDN. Las fuentes que MathJax pide bajo demanda se resuelven con `import.meta.glob` → Vite las parte en chunks locales (10 MB en total, solo se cargan las que se usan). `linebreaks.inline = false` (MathJax 4 parte las fórmulas inline en varios SVG). Los errores TeX se lanzan (no se dibujan) para mostrarlos en el editor. `\href` se elimina del SVG.
- Tamaño de las fórmulas determinista: `viewBox` en milésimas de em × `fontSize`. Un elemento `math` siempre conserva la proporción; redimensionar escala `fontSize`.
- Texto enriquecido con **TipTap 3** (JSON en `TextElement.doc`, tipado en Rust como `RichNode`). Se renderiza con un renderizador estático propio (`RichText.tsx`); TipTap solo se carga al editar.
- Fórmula inline: nodo `inlineMath` con regla de entrada propia estilo Pandoc (no empieza ni termina con espacio).
- Editor de ecuaciones: CodeMirror 6 (modo `stex` + autocompletado) y MathLive (cargado bajo demanda; fuentes copiadas a `public/vendor/` por `postinstall`).
- Preámbulo global en `Presentation.latex.preamble`; el store lo sincroniza con MathJax (también tras deshacer).
- Las acciones de elementos ahora buscan por id en todas las diapositivas (preparando la fase MCP).
- Pendiente: color/tamaño por fragmento de texto; alineación por párrafo.
- Orden cambiado otra vez por el autor (2026-10-30): **3 Archivo + distribución → 4 Simulaciones HTML → 5 MCP → 6 Imágenes y video**.

### Fase 3 — 2026-10-30 🧪 (pendiente de prueba manual del autor)
- Formato `.tiza` en Rust (`src-tauri/src/archive/`, crate `zip` 9): guardado atómico (temporal + `fsync` + `rename`), validación (manifest, tamaño, zip-slip), migraciones con `const` assert que obliga a registrar cada versión nueva.
- Mismo formato en la web con **fflate** (`src/files/format.ts`). Dos fixtures (`tests/fixtures/hello.tiza` escrito por Rust, `from-web.tiza` escrito por la web) se leen desde ambos lados.
- `src/files/platform.ts` separa escritorio (diálogos nativos con `tauri-plugin-dialog`, comandos Rust) y web (input de archivo, File System Access API o descarga, `localStorage` para recuperación).
- Cambios sin guardar: `isDirty` compara la entrada actual del historial con la guardada (deshacer hasta lo guardado vuelve a "limpio"). Autoguardado de recuperación cada 15 s; al iniciar ofrece recuperar. Confirmación al cerrar/abrir/nuevo.
- Errores de archivo con códigos estables (`AppError` en Rust ↔ `FileError` en TS) traducidos en los 4 idiomas.
- Asociación de archivos `.tiza` (doble clic abre Tiza; el comando `startup_file` lee el argumento). macOS (evento `Opened`) pendiente.
- Ícono propio (`assets/icon.svg`). Workflows: `ci.yml` (tests en cada push) y `release.yml` (`tauri-action` v1, Windows/macOS Intel+ARM/Linux, release marcado como prerelease mientras sea 0.x).
- Pendiente: archivos recientes; firma de código (Windows/macOS muestran aviso); actualizaciones automáticas.
- `npm audit` reporta una vulnerabilidad moderada en `glob`/`rimraf` (dependencias del menú contextual de MathJax, que no usamos ni se empaqueta). Sin acción.

### Fase 4 — 2026-10-30 🧪 (pendiente de prueba manual del autor; páginas web por URL aún no)
- Elemento `sim` con HTML embebido, resolución interna y ajuste, red bloqueada por defecto (CSP en `src-tauri/src/sim.rs` y `src/elements/sim/csp.ts`, mantener iguales).
- Protocolo `tizasim://` con caché LRU de 64 páginas identificadas por hash SHA-256.
- Editor HTML (CodeMirror `lang-html`) con «Cargar archivo…» (comando `read_html_file`, solo `.html/.htm`, ≤ 20 MB) y «Recargar».
- Doble clic = modo interactivo (iframe recibe el puntero). Arreglado: el doble clic nunca llegaba a los elementos por la captura de puntero del lienzo (afectaba también a textos y ecuaciones).
- Miniaturas muestran un marcador, nunca la página en vivo.
- Ejemplo: `examples/pendulo.html` (RK4, sliders de L, g, θ₀).
- Pendiente: elemento `web` (URL en vivo), póster/captura para miniaturas y exportación, API `postMessage` de parámetros.

### Mejoras de UI — 2026-10-31 (rama `mejoras-ui`)
- Menú Archivo, grupo Insertar, menús contextuales, ocultar diapositivas, tema claro/oscuro/sistema, Ajustes, panel plegable.
- GPU: WebKit oculta la GPU real ("Apple GPU"); Rust la lee del sistema (`src-tauri/src/gpu.rs`: sysfs + pci.ids en Linux, CIM en Windows, system_profiler en macOS). Preferencia en `settings.json` del directorio de configuración, aplicada como variables de entorno **antes** de iniciar WebKit (PRIME offload + `WEBKIT_DISABLE_DMABUF_RENDERER` con NVIDIA; `--force_high_performance_gpu` en WebView2). Si el arranque con la GPU dedicada no llega a mostrar la UI, el siguiente arranque vuelve a la automática (marcador `gpu-launch-pending`). Reinicio con `restart_app` y restauración silenciosa de cambios (`RecoveryInfo.autoRestore`).
- CodeMirror con `classHighlighter` + colores por variables CSS (legible en oscuro).

### Fase 5 — Modo presentación — 2026-10-31 🧪 (pendiente de prueba con proyector)
- Rust (`src-tauri/src/present.rs`) crea las ventanas `audience` (pantalla completa) y `presenter`, guarda el estado (diapositiva visible actual, pantalla negra/blanca) y lo emite como evento `present:status`. Pantalla del público = externa; presentador = panel interno (`eDP`/`LVDS`/`DSI`) o la principal. En **Hyprland** (Wayland no deja posicionar ventanas) se usa `hyprctl dispatch focusmonitor` antes de abrir cada ventana.
- Ambas ventanas cargan el mismo bundle con `#audience` / `#presenter`. Web: pantalla completa en la pestaña + vista del presentador en otra ventana vía `BroadcastChannel`.
- Modelo: `Slide.transition` (fade/slide + duración) y `Presentation.templateSlideId` (plantilla por archivo), ambos opcionales y compatibles con archivos anteriores (sin cambio de `schemaVersion`).
- Notas del orador editables bajo el lienzo; tamaño de letra de las notas ajustable en la vista del presentador.
- Pendiente: revelado paso a paso (builds), elegir manualmente la pantalla del público, puntero láser.

- El reinicio automático tras cambiar de GPU no funciona en `tauri dev` (el servidor de Vite muere con el proceso original): en builds de desarrollo `restart_app` devuelve `false` y se pide reiniciar a mano.

### Plan acordado (2026-10-31)
- **Fase 6 — Imágenes y video**: sistema de assets (hash, `tiza-asset://`, range requests). Requisito para importar.
- **Fase 7 — Importar presentaciones** como objetos editables:
  - **PPTX** (Office Open XML): parser en Rust (`zip` + XML): diapositivas, cuadros de texto con formato, imágenes, formas básicas, notas, posiciones (EMU → unidades lógicas). Lo que no se pueda representar se importa como imagen.
  - **ODP** (OpenDocument): parser equivalente sobre `content.xml`.
  - **PPT** (binario antiguo de PowerPoint 97–2003): parser propio en Rust, **sin depender de LibreOffice ni de ningún programa instalado** (decisión del autor). El archivo es un contenedor OLE/CFB (crate `cfb`) con registros binarios [MS-PPT]: se extraen texto con formato básico, imágenes y posiciones; lo que no se pueda reconstruir se importa como imagen o se omite con aviso.
  - Regla general: **ninguna importación requiere software externo**; todo va dentro de Tiza.
  - **PDF**: cada página → texto editable con su posición/fuente (pdf.js `getTextContent`) + imágenes extraídas; los gráficos vectoriales que no se puedan reconstruir quedan como imagen de fondo de la página.
- Luego: MCP (8), LaTeX completo (9), exportación (10), pulido (11).
