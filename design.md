# design.md — identidad visual y de lenguaje de GALCOA+ en Stellar

Guía corta para quien toque la interfaz (persona o herramienta de IA). Los valores salen de `src/app/globals.css`; si cambian allí, se cambia acá.

**English summary.** Dark navy interface with a yellow primary action, square corners, Manrope for text and IBM Plex Mono for data. Three verdict colors (green / yellow / red) always come with a word, never color alone. Copy says "verificación de datos con fuente", never "certified" or "validated". An optional light theme and an ES/EN selector exist; both must keep the same meaning.

## Principios
1. **El estado real a la vista.** Es un prototipo en Testnet con reglas de demostración: la interfaz lo dice y no promete más de lo que hay.
2. **El veredicto lo muestra el código, no la IA.** Verde, amarillo y rojo salen de las reglas (`ALC-…`); la pantalla nunca suaviza un rojo.
3. **Una acción principal por pantalla**, en amarillo. Lo secundario va con borde (`button.sec`).
4. **Sin datos personales en pantalla ni en la red:** a Stellar solo va una huella de 32 bytes.

## Color (tema oscuro por defecto)
| Uso | Variable | Valor |
|---|---|---|
| Fondo | `--bg` | `#0c1a2e` |
| Tarjeta | `--card` | `#13263f` |
| Texto | `--ink` | `#f7f8f6` |
| Texto secundario | `--muted` | `#b5c3d6` |
| Línea / control | `--line` / `--ctl` | `#2b4566` / `#8fa3bd` |
| Acción principal | `--accent` (texto `--on-accent`) | `#ffda47` (`#1e3a5f`) |
| Verde de marca | `--brand-green` | `#176a57` |
| Verde / amarillo / rojo de veredicto | `--ok` / `--warn` / `--bad` | `#5fd0a8` / `#ffda47` / `#ffb3ad` |

El **tema claro** (`data-tema="claro"`) redefine las mismas variables; la franja de marca queda azul noche en ambos. Los contrastes de texto y de los tres estados se revisan con `docs/auditoria/`.

## Tipografía y forma
- **Manrope** para texto, **IBM Plex Mono** para huellas, remitos, IDs de regla y pasos (`var(--mono)`). Autoalojadas en `public/fonts` con su licencia OFL.
- **Esquinas rectas** en botones y tarjetas (`border-radius: 0` por defecto); solo las píldoras de estado son redondas.
- Tarjetas con borde superior amarillo de 3 px. Ancho máximo de contenido: 860 px, con 16 px de margen lateral en celular.

## Estados: nunca solo color
Verde, amarillo y rojo llevan siempre **una palabra** (`verificado`, `declarado`, `requiere revisión`) y el ID de la regla que lo explica. El rojo no tiene botón de sellar.

## Accesibilidad
- Foco visible de 3 px en amarillo en botones, enlaces y campos.
- Controles con nombre accesible (selector de idioma y de tema son grupos con etiqueta). Todo se puede usar con teclado.
- La interfaz funciona a 375 px de ancho sin scroll horizontal.

## Lenguaje
- Decir **"verificación de datos con fuente"**; nunca "cumple", "está validado" ni "certificado".
- Firma **electrónica**, no digital.
- No nombrar empresas ni casos reales, salvo los tres entrevistados de `docs/evidencia/ENTREVISTAS-RESUMEN.md`. No usar logos ni implicar aval de la Stellar Development Foundation.
- Español rioplatense en la versión en español (voseo); inglés simple en la versión en inglés. Los textos viven en `src/lib/i18n/textos.ts`: cada texto nuevo se escribe en los dos idiomas.

## Marca
Logo e ícono en `public/` y `src/app/` (`icon.png`, `apple-icon.png`, imágenes para compartir). Fuente de los diagramas y del logo: `docs/instawards/logo/`.
