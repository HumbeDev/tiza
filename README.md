# Tiza

Editor de presentaciones **offline, libre y de código abierto** para ciencia y docencia:
la facilidad de PowerPoint, la potencia de LaTeX y la riqueza de la web
(video, páginas en vivo y simulaciones HTML/JS interactivas).

> 🚧 En desarrollo temprano. Especificación y hoja de ruta: [PROYECTO.md](PROYECTO.md).

**Stack:** Tauri 2 (Rust) + TypeScript + React · **Idiomas:** Español · Português (Brasil) · Français · English

## Estado

| Fase | Contenido                                                  | Estado |
| ---- | ---------------------------------------------------------- | ------ |
| 0    | Entorno, esqueleto Tauri, idiomas                          | ✅     |
| 1    | Documento y lienzo básico (formas, texto, mover, deshacer) | ⏳     |
| 2    | Archivo `.tiza`, autosave y recuperación                   | —      |
| 3    | Texto enriquecido y ecuaciones LaTeX                       | —      |
| 4    | Imágenes y video                                           | —      |
| 5    | Simulaciones HTML y páginas web                            | —      |
| 6    | Modo presentación y vista del presentador                  | —      |
| 7    | LaTeX completo (TikZ) con Tectonic                         | —      |
| 8    | Exportar a PDF / HTML / PNG                                | —      |
| 9    | Temas, pulido e instaladores                               | —      |

## Funcionalidades disponibles

- Ventana de escritorio con núcleo en Rust.
- Interfaz en 4 idiomas; detecta el idioma del sistema y se puede cambiar desde la app.

## Desarrollo

Requisitos: Rust estable (recomendado vía `rustup`), Node.js LTS y los
[prerrequisitos de Tauri](https://tauri.app/start/prerequisites/) de tu sistema.
En Linux, para video: plugins de GStreamer (`gst-plugins-base`, `-good`, `-bad`, `gst-libav`).

```sh
npm install
npm run tauri dev   # abre la app
npm test            # tests del frontend
cd src-tauri && cargo test
```

### Traducciones

Los textos están en `src/i18n/locales/` (un JSON por idioma). Un test verifica que
los cuatro idiomas tengan las mismas claves. ¡Correcciones de hablantes nativos bienvenidas!

## Licencia

Doble licencia, a tu elección: [MIT](LICENSE-MIT) o [Apache 2.0](LICENSE-APACHE).
