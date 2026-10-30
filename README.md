# Tiza

Editor de presentaciones **offline, libre y de código abierto** para ciencia y docencia:
la facilidad de PowerPoint, la potencia de LaTeX y la riqueza de la web
(video, páginas en vivo y simulaciones HTML/JS interactivas).

**Hecho para agentes de IA:** Tiza incluirá un servidor **MCP**, así que Claude Code, Claude Desktop
u otro agente podrá crear y editar tu presentación en vivo mientras la ves (y tú deshaces lo que no te guste).

> 🚧 En desarrollo temprano. Especificación y hoja de ruta: [PROYECTO.md](PROYECTO.md).

**Stack:** Tauri 2 (Rust) + TypeScript + React · **Idiomas:** Español · Português (Brasil) · Français · English

## Estado

| Fase | Contenido                                                  | Estado       |
| ---- | ---------------------------------------------------------- | ------------ |
| 0    | Entorno, esqueleto Tauri, idiomas                          | ✅           |
| 1    | Documento y lienzo básico (formas, texto, mover, deshacer) | 🧪 en prueba |
| 2    | Archivo `.tiza`, autosave y recuperación                   | —            |
| 3    | **Servidor MCP para agentes de IA**                        | —            |
| 4    | Texto enriquecido y ecuaciones LaTeX                       | —            |
| 5    | Imágenes y video                                           | —            |
| 6    | Simulaciones HTML y páginas web                            | —            |
| 7    | Modo presentación y vista del presentador                  | —            |
| 8    | LaTeX completo (TikZ) con Tectonic                         | —            |
| 9    | Exportar a PDF / HTML / PNG                                | —            |
| 10   | Temas, pulido e instaladores                               | —            |

## Funcionalidades disponibles

**Diapositivas**

- Panel de miniaturas: agregar, duplicar, eliminar y **reordenar arrastrando**.
- Color de fondo por diapositiva.

**Lienzo**

- Insertar **texto**, **rectángulo**, **elipse**, **línea** y **flecha**.
- Seleccionar con clic; **multiselección** con Shift/Ctrl+clic o arrastrando un recuadro en un área vacía.
- **Mover**, **redimensionar** (8 asas; Shift mantiene la proporción) y **rotar** (asa circular; Shift = pasos de 15°).
- **Guías de alineación** magnéticas con los bordes y centros de la diapositiva y de otros elementos (Alt las desactiva).
- Alinear (izquierda, centro, derecha, arriba, medio, abajo) y orden de apilamiento (traer al frente, enviar al fondo…).
- Bloquear elementos para que no se muevan.
- Editar texto con doble clic o Enter.

**Propiedades**

- Posición, tamaño, rotación y opacidad exactas.
- Formas: tipo, relleno, contorno, grosor, radio de esquinas.
- Texto: tamaño, color, alineación, negrita, cursiva.

**General**

- **Deshacer/rehacer ilimitado** (un arrastre completo = un paso).
- Interfaz en 4 idiomas: detecta el idioma del sistema y se puede cambiar en vivo.

### Atajos de teclado

| Acción                             | Atajo                                             |
| ---------------------------------- | ------------------------------------------------- |
| Deshacer / Rehacer                 | Ctrl+Z / Ctrl+Shift+Z (o Ctrl+Y)                  |
| Copiar / Cortar / Pegar / Duplicar | Ctrl+C / Ctrl+X / Ctrl+V / Ctrl+D                 |
| Seleccionar todo                   | Ctrl+A                                            |
| Eliminar                           | Supr o Retroceso                                  |
| Mover 1 / 10 unidades              | Flechas / Shift+Flechas                           |
| Traer adelante / Enviar atrás      | Ctrl+] / Ctrl+[ (con Shift: al frente / al fondo) |
| Nueva diapositiva                  | Ctrl+M                                            |
| Editar texto                       | Doble clic o Enter · Esc para salir               |
| Quitar selección                   | Esc                                               |

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
