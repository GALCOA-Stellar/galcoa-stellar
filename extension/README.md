# Extensión de navegador de GALCOA+ — esqueleto en construcción

**Estado honesto:** esto es un **esqueleto**, no la extensión terminada. La extensión completa es lo que se propone construir en el sprint de 30 días. Hoy hace una sola cosa: en una página de `localhost` que tenga un formulario con campos de una entrega, marca cada campo en verde, amarillo o rojo usando el mismo motor de reglas de la app (`src/lib/dominio/rules.ts`, versión `reglas-demo-0.2`, de demostración).

## Qué hace y qué no
- Hace: lee los valores escritos en el formulario, los evalúa con las reglas en código y pinta el borde de cada campo; el motivo aparece al dejar el mouse encima.
- No hace (todavía): revisar fotos ni audios, calcular la huella, hablar con Stellar, firmar, ni funcionar fuera de `localhost`. Tampoco se publicó en ninguna tienda de extensiones.
- Privacidad: no hay pedidos de red en el código ni permisos en el manifest; el contenido no sale de la página. Una prueba lo controla (`tests/extension-campos.test.ts`).
- La IA no interviene: decide el código. Los límites de las reglas son los de la app.

## Probarla a mano (desarrollo)
```bash
npm run extension:construir   # genera extension/dist/contenido.js
npm run extension:demo        # sirve la página de ejemplo en http://localhost:4190
```
En Chrome: `chrome://extensions` → activar "Modo de desarrollador" → "Cargar descomprimida" → elegir la carpeta `extension/`. Abrir http://localhost:4190: los campos "Cargó/Confirmó" y las dos cantidades salen en rojo y el de la huella en amarillo; al corregirlos pasan a verde.

**Qué se probó y qué no:** la lógica de los estados tiene pruebas automáticas, y el archivo armado se probó inyectándolo en la página de demostración con Chrome (los campos cambian de rojo y amarillo a verde al corregir). **No se probó la instalación como extensión en Chrome**: las versiones actuales de Chrome no dejan cargarla por línea de comandos, así que hay que cargarla a mano como se explica arriba y confirmar que funciona.

## Decisiones pendientes del equipo
- Ampliar `matches` más allá de `localhost` (hoy está limitado a propósito).
- Cómo se define qué campos revisa cada proyecto (hoy están fijos los de una entrega).
