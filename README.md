# Tiza

Editor de presentaciones **offline, libre y de código abierto** para ciencia y docencia:
la facilidad de PowerPoint, la potencia de LaTeX y la riqueza de la web
(video, páginas en vivo y simulaciones HTML/JS interactivas).

**Hecho para agentes de IA:** Tiza incluirá un servidor **MCP**, así que Claude Code, Claude Desktop
u otro agente podrá crear y editar tu presentación en vivo mientras la ves (y tú deshaces lo que no te guste).

> 🚧 En desarrollo temprano. Especificación y hoja de ruta: [PROYECTO.md](PROYECTO.md).

**Probar Tiza:** 🌐 [versión web](https://tiza.ingenieriafisica.online/) (sin instalar) ·
⬇️ [instaladores para Windows, macOS y Linux](https://github.com/HumbeDev/tiza/releases/latest)

**Stack:** Tauri 2 (Rust) + TypeScript + React · **Idiomas:** Español · Português (Brasil) · Français · English

## Estado

| Fase | Contenido                                                                     | Estado       |
| ---- | ----------------------------------------------------------------------------- | ------------ |
| 0–2  | Entorno, lienzo, texto enriquecido y ecuaciones LaTeX                         | ✅           |
| 3    | Archivos `.tiza`, instaladores y versión web                                  | ✅           |
| 4    | Simulaciones HTML (páginas web por URL: pendiente)                            | ✅           |
| 5    | **Modo presentación**, vista del presentador, notas, plantilla de diapositiva | 🧪 en prueba |
| 6    | Imágenes y video (sistema de assets)                                          | —            |
| 7    | **Importar PPTX, ODP, PDF y PPT** como diapositivas editables                 | —            |
| 8    | Servidor MCP para agentes de IA                                               | —            |
| 9    | LaTeX completo (TikZ) con Tectonic                                            | —            |
| 10   | Exportar a PDF / HTML / PNG                                                   | —            |
| 11   | Temas, pulido e instaladores firmados                                         | —            |

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

**Ecuaciones LaTeX** (100 % sin internet)

- Botón **Ecuación**: bloque de ecuación movible y escalable (arrastrar una esquina escala la fórmula).
- Editor con dos pestañas que editan lo mismo: **Código LaTeX** (resaltado, autocompletado al escribir `\`, cierre de llaves) y **Visual** (MathLive: fracciones, raíces, matrices sin escribir código).
- Vista previa en vivo en la diapositiva; si el LaTeX tiene un error se muestra el mensaje y se mantiene el último resultado válido.
- **Fórmulas dentro del texto**: escribe `$E=mc^2$` y se convierte en fórmula. Haz clic en ella para editar su LaTeX. (`$5 y $10` se quedan como texto.)
- **Macros del documento**: `\newcommand` globales para todas las ecuaciones (panel derecho, sin nada seleccionado).
- Paquetes incluidos: `amsmath`, `physics`, `mhchem` (química), `mathtools`, `braket`, `cancel`, `cases`, `color`, `boldsymbol`, `gensymb`, `enclose`.

**Texto enriquecido**

- Negrita, cursiva, subrayado, tachado, listas con viñetas y numeradas (mientras editas el texto).

**Propiedades**

- Posición, tamaño, rotación y opacidad exactas.
- Formas: tipo, relleno, contorno, grosor, radio de esquinas.
- Texto: tamaño, color, alineación.
- Ecuación: tamaño y color.

**HTML incrustado (simulaciones, applets)**

- Botón **HTML**: inserta una página HTML en un recuadro (trae un péndulo de ejemplo). **Cargar archivo…** importa tu `.html`, o pega el código en el editor.
- Tamaño: la **caja** se ajusta con las asas como cualquier elemento; aparte eliges el **tamaño de la página** (800×600, 1280×720, 1920×1080… o personalizado), que se escala a la caja **encajando** (mantiene proporción) o **estirando**. Botones «Igual a la caja» y «Caja a la proporción».
- **Doble clic** para usar la página (sliders, botones…); clic fuera para volver a editar. **Recargar** la reinicia.
- **Aislada y segura**: corre en un iframe sin acceso a Tiza ni a tus archivos, y **sin internet** salvo que marques «Permitir acceso a internet» (p. ej. si carga una librería de un CDN).
- La página debe ser un solo archivo (scripts y estilos dentro). Se guarda dentro del `.tiza`.

**Archivos `.tiza`**

- Nueva, Abrir, Guardar, Guardar como (Ctrl+N / Ctrl+O / Ctrl+S / Ctrl+Shift+S).
- Un solo archivo con toda la presentación; se abre igual en Windows, macOS, Linux y en la versión web.
- Doble clic sobre un `.tiza` abre Tiza (con la app instalada).
- Indicador de cambios sin guardar (● en el título y punto en el botón Guardar) y confirmación antes de perderlos.
- **Recuperación**: si Tiza se cierra de golpe, al volver a abrirla ofrece **Recuperar / Descartar / Más tarde** (autoguardado cada 15 s). Cerrar el aviso nunca borra los cambios recuperados.
- En la versión web, Guardar descarga el archivo (en Chrome/Edge guarda directamente en el archivo elegido).

**Modo presentación** (F5 desde el principio, Shift+F5 desde la diapositiva actual)

- Con dos pantallas: el **público** ve la presentación a pantalla completa en la **pantalla externa** y tú ves la **vista del presentador** en la otra: diapositiva actual, la siguiente, **notas**, cronómetro (pausar/reiniciar) y reloj.
- Con una sola pantalla: solo la vista del público. «Ensayar en ventanas» abre ambas vistas en ventanas normales para practicar.
- Teclado y **clicker**: →, ↓, Espacio, Av Pág, clic = siguiente · ←, ↑, Re Pág, clic derecho = anterior · Inicio/Fin · número + Enter = ir a esa diapositiva · **B** pantalla negra · **W** pantalla blanca · Esc = terminar.
- Las diapositivas **ocultas** se saltan. Las páginas HTML son **interactivas** durante la presentación (un clic sobre ellas no avanza).
- **Transiciones** por diapositiva: fundido o deslizar, con duración.
- Versión web: pantalla completa en la pestaña; botón «Vista del presentador» abre una ventana sincronizada (arrástrala a la otra pantalla).

**Notas del orador**: panel debajo del lienzo en cada diapositiva (se pliega).

**Plantilla de diapositiva del archivo**: clic derecho en una miniatura → «Guardar como plantilla de nuevas diapositivas». Se guarda **una copia en ese momento**: cada diapositiva nueva empieza así (logos, barras de un evento…) aunque después cambies la original. «Nueva diapositiva en blanco» la ignora; «Quitar la plantilla» la borra.

**Imágenes**: botón **Imagen** (PNG, JPG, GIF, WebP, SVG, BMP, AVIF). Se guardan **dentro del `.tiza`** (una sola copia aunque la repitas). Encuadre: imagen completa, rellenar y recortar, o estirar.

**Video**: botón **Video** (WebM, MP4, MOV, OGV). En el editor muestra un cuadro (doble clic para reproducirlo ahí); al presentar tiene controles y no cambia de diapositiva al hacer clic. Opciones: reproducir al aparecer la diapositiva, repetir, sin sonido, y reproducir solo un tramo (inicio/fin). Viaja dentro del `.tiza`.

**Tablas tipo Excel**: botón **Tabla** → tabla vacía o **desde un CSV** (detecta `,` `;` o tabulador; acentos de Excel en Windows incluidos). Encabezado fijo al desplazar, filas de colores alternos, números alineados a la derecha, 5 combinaciones de colores. Las tablas grandes **se desplazan dentro de su caja**, también al presentar. Doble clic para editar celdas (Enter baja, Tab avanza); agregar o quitar filas y columnas desde el panel.

**Animaciones paso a paso (como `\pause` de Beamer)**: clic derecho → _Aparecer en el siguiente clic_, o en el panel _Animación_: aparecer o fundido, y en qué clic. Al presentar, cada clic revela el siguiente paso antes de pasar de diapositiva; al retroceder se ve la diapositiva anterior completa. En el editor cada elemento animado muestra su número de clic.

**Importar PowerPoint (.pptx)**: _Archivo → Importar PowerPoint…_ crea una presentación nueva con todo **editable**: textos (negrita, cursiva, subrayado, tachado, tamaños, colores, alineación, viñetas), imágenes, formas y líneas con sus colores, fondos, diapositivas ocultas, **notas del orador** y los elementos de los patrones/diseños (logos, barras). Sin programas externos: funciona igual en la app y en la web. Las **tablas** de PowerPoint se importan como tablas y los **videos** incrustados como video. Aún no convierte gráficos, SmartArt ni ecuaciones de Office (avisa cuántos omitió).

**Importar PDF**: _Archivo → Importar PowerPoint o PDF…_. Cada página es una diapositiva: lo gráfico (figuras, fondos, gráficos) queda como imagen de fondo y **el texto encima, editable**, con su posición, tamaño, color, negrita y cursiva.

**Interfaz**

- Menú **Archivo** (Nueva, Abrir, Guardar, Guardar como, Ajustes) y grupo **Insertar** (Texto, Ecuación, HTML, Formas ▾).
- **Clic derecho** en elementos (cortar, copiar, pegar, duplicar, orden, bloquear, eliminar), en el lienzo vacío y en las miniaturas (duplicar, **ocultar en la presentación**, subir/bajar, eliminar).
- **Tema claro / oscuro / sistema** (botón en la barra o en Ajustes).
- **Ajustes** (Ctrl+, o menú Archivo): idioma, tema, **tarjeta gráfica** (automática o alto rendimiento; Tiza se reinicia sola y conserva tus cambios) y **diagnóstico** (las GPU reales del sistema, cuál usa Tiza, WebGL).
- Panel de propiedades con **secciones plegables** (recuerda cuáles cerraste) y posición/tamaño compactos.

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

### Publicar

```sh
scripts/release.sh 0.2.0   # sube versión, crea la etiqueta v0.2.0 y la sube a GitHub
                           # → GitHub Actions compila los instaladores y crea el release
scripts/deploy-web.sh      # compila la versión web y la sube a tiza.ingenieriafisica.online
scripts/publish.sh 0.2.0   # todo junto: tests, instaladores (release.sh) y web (deploy-web.sh)
```

### Traducciones

Los textos están en `src/i18n/locales/` (un JSON por idioma). Un test verifica que
los cuatro idiomas tengan las mismas claves. ¡Correcciones de hablantes nativos bienvenidas!

## Licencia

Doble licencia, a tu elección: [MIT](LICENSE-MIT) o [Apache 2.0](LICENSE-APACHE).
