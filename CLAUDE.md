# Tiza — guía rápida para Claude Code

Editor de presentaciones offline (Tauri 2 + Rust + React/TS). **Especificación completa: [PROYECTO.md](PROYECTO.md)** — leerla antes de empezar una fase.

## Cómo trabajar

- Fases en orden (PROYECTO.md §11). Una rama por fase (`fase-N`); al cerrarla se fusiona a `main` y se actualiza §14.
- Commits pequeños: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`.
- El autor prefiere avanzar rápido: resumen breve al final, sin explicaciones paso a paso. Funcionalidades y estado van en README.md.
- Preguntar antes de: dependencia pesada, cambiar el formato `.tiza`, cambiar el stack, borrar código que funciona.
- Verificar versiones actuales (npm view / crates.io) antes de agregar dependencias. Fijar versiones exactas en npm.

## Comandos

```sh
npm install                 # dependencias JS
npm run tauri dev           # app en modo desarrollo
npm test                    # Vitest
npm run lint                # ESLint
npm run format              # Prettier
npm run build               # tsc + vite build
cd src-tauri && cargo test
cd src-tauri && cargo clippy --all-targets -- -D warnings
cd src-tauri && cargo fmt
```

Antes de cada commit: `npm run lint && npm test && npm run format:check` y en `src-tauri/`: `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`.

## Convenciones

- Código, identificadores y comentarios en **inglés**. Docs para el autor en **español**.
- **i18n obligatorio:** ningún texto visible escrito directo en componentes. Todo texto nuevo se agrega a los **cuatro** archivos de `src/i18n/locales/` (`es`, `pt-BR`, `fr`, `en`) en el mismo commit. `en.json` define las claves tipadas.
- **Build for agents (MCP, §7.11) obligatorio:** toda funcionalidad nueva expone su herramienta MCP. Las acciones del store deben poder llamarse sin la UI y con ids explícitos (no depender de la selección ni de la diapositiva actual), porque la capa MCP las invoca directamente. Descripciones de herramientas y errores para agentes en inglés.
- Rust no produce textos para el usuario: errores con código estable (`thiserror`), el frontend traduce.
- Rust: sin `unwrap()`/`expect()` en producción (salvo el arranque de Tauri). Clippy sin advertencias.
- TS: `strict`. El documento solo se modifica vía acciones del store (Zustand + Immer).
- Regla de reparto: UI y renderizado en el frontend; disco, procesamiento pesado y sistema en Rust.
- Permisos Tauri mínimos (`src-tauri/capabilities/`). Nada de plugins genéricos de fs/shell.

## Estructura

- `src/app/` layout · `src/i18n/` idiomas · `src/styles/` CSS · (próximas: `canvas/`, `elements/`, `store/`, `render/`…)
- `src-tauri/src/` backend Rust · `src-tauri/tauri.conf.json` config y CSP

## Entorno del autor

Arch Linux (Omarchy, Hyprland/Wayland). WebKitGTK 4.1. Las ventanas nuevas de Hyprland pueden abrirse en otro workspace.
