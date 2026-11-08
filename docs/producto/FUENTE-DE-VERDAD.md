# Fuente de verdad — GALCOA+ en Stellar

Actualizado: 05/11/2026. **Si algo de otro documento contradice a este, gana este.** Etiquetas: **[probado]** ejecutado y visto en esta sesión; **[doc]** leído en documentación oficial de Stellar; **[comunidad]** dicho por la comunidad, sin confirmar; **[propuesta]** diseñado, todavía no construido.

## 0. Enfoque (decidido por el equipo el 07/11/2026)
**GALCOA es una capa de verificación de datos para quienes construyen en Stellar.** El centro del producto es la ingeniería de la información: reglas en código que deciden, agentes de IA con instrucciones (prompts) probadas que solo pueden proponer o frenar, defensa contra órdenes escondidas en el texto, chequeos cruzados en código, evaluación con casos de respuesta conocida y comprobantes que cualquiera verifica sin confiar en nosotros.
- **Cliente principal: desarrolladores y equipos que construyen o van a construir en Stellar** y necesitan que los datos que anclan o que disparan pagos hayan sido verificados antes. **[propuesta]** Todavía no hablamos con desarrolladores para confirmarlo: es una hipótesis a validar (ver el plan del sprint). No se afirma demanda.
- **Primer caso de uso y piloto: entregas de distribuidoras** (remitos). Es el ejemplo real sobre el que se probaron las reglas y las entrevistas hechas; no es el cliente principal.
- Lo que se entrega a un desarrollador: motor de reglas con identificadores (`ALC-…`), agentes con su harness (instrucciones y skills portables en Markdown), detector de inyección, evaluador de agentes, paquete público `galcoa-comprobante` y guía de integración.
- El resto de este documento describe el prototipo vigente; sigue siendo válido.

## 1. Qué es y para qué sirve
Un prototipo que **verifica los datos de entregas entre empresas antes de anclarlos** en Stellar. Solo lo verificado deja una prueba pública; lo que requiere revisión no se ancla nunca. La prueba que queda en la red es una **huella de 32 bytes por lote**, y cada documento tiene un comprobante que permite verificarlo solo.
- **Idea central:** no se "limpia" la red (Stellar es abierta y cualquiera puede escribir en un memo). Lo que se garantiza es la **procedencia**: lo que ancla GALCOA pasó reglas y confirmación; quien consulta confía en las cuentas publicadas de GALCOA, no en cualquier memo.
- **Qué NO es:** no guarda documentos en la red, no custodia dinero, no usa la red principal, no reemplaza al motor completo de reglas de GALCOA.

## 2. Estado real (qué existe hoy)
| Pieza | Estado |
|---|---|
| Sellado de una huella de 32 bytes en el memo de Stellar testnet | **[probado]** |
| Lote con árbol de Merkle: varios documentos en una sola transacción | **[probado]** |
| Rojo excluido del lote; documento alterado detectado | **[probado]** (pruebas automáticas y en testnet) |
| Verificación leyendo la transacción de la red | **[probado]** |
| Pantalla web (sellar y verificar) | **[probado]** en local |
| Verificación de comprobantes viejos: el RPC guarda ~7 días, se usa Horizon como respaldo | **[probado]** que el RPC pierde las transacciones viejas y que Horizon las conserva; el respaldo tiene prueba unitaria |
| Código de acceso para sellar, límites y CI | **[probado]** en pruebas |
| SRS, requisitos de dato, tablero, one-pager solo Stellar | **[hecho]** (`docs/`) |
| Despliegue en Vercel | **[propuesta]** |
| Motor de reglas completo de GALCOA | **[propuesta]** (hoy hay 3 reglas de demostración) |
| `stellar.toml` con las cuentas oficiales | **[propuesta]** |
| Pago por consulta (x402) | **[propuesta]**, opcional; demanda sin confirmar |
| Pagos condicionados, dinero real, mainnet | **[propuesta]** a largo plazo; consulta legal obligatoria antes |
**Evidencia pública en testnet** (se pierde en el reinicio del 16/12/2026; guardar capturas): lote de 7 documentos en una sola transacción, comisión cobrada **0,00001 XLM**, ledger 5566469 — https://stellar.expert/explorer/testnet/tx/0c30765b3228b9cf33b8ee467555dd4c1dd05fdd27ae452aeb8d084589bf8b65

## 3. Las reglas de demostración (por atributo ALCOA+)
Son reglas **en código, deterministas**: la misma entrada da siempre el mismo veredicto, sin IA. Detalle y lógica GAMP 5 en `docs/producto/REQUISITOS-DE-DATO.md`.
- **ALC-COM-01** Completo: campos obligatorios presentes → falla: **rojo** ("no se pudo leer").
- **ALC-LEG-01** Legible: tipos y formatos válidos → falla: **rojo**.
- **ALC-ATR-01** Atribuible: quien carga no confirma (cuatro ojos) → falla: **rojo**.
- **ALC-COH-01** Consistente: el registro no es anterior a la entrega → falla: **rojo**.
- **ALC-CTE-01** Contemporáneo: registrado dentro de 3 días → falla: **amarillo** (carga tardía).
- **ALC-ORI-01** Original: huella del documento original adjunta → falla: **amarillo** (declarado).
- **ALC-EXA-01** Exacto: recibido = pedido; si difiere, con observación **amarillo**, sin ella **rojo**.
Versión de reglas: `reglas-demo-0.2`; cada comprobante guarda los IDs y la versión. No son el motor completo de GALCOA: sirven para demostrar el principio (solo lo verificado llega a Stellar).

## 4. Cómo funciona (arquitectura)
1. `src/lib/dominio/rules.ts` evalúa cada documento → verde, amarillo o rojo.
2. `src/lib/aplicacion/lote.ts` (`sellarLote`) vuelve a evaluar todo, descarta lo rojo y arma el manifiesto de cada documento.
3. `src/lib/dominio/merkle.ts` arma el árbol: hoja = SHA-256(0x00 ‖ huella), nodo = SHA-256(0x01 ‖ izq ‖ der); el nivel impar sube sin duplicar.
4. El memo es SHA-256 del resumen canónico `{cantidadHojas, raiz, schemaVersion:"galcoa.batch.v1"}` (cabe justo en los 32 bytes de `MEMO_HASH`).
5. `src/lib/stellar/stellar.ts` envía **una** transacción (pago mínimo a sí misma + memo) por Stellar RPC y la confirma. Solo testnet.
6. El comprobante `galcoa.stellar.comprobante.v1` lleva manifiesto, huella, camino, raíz, red y hash de la transacción. `/api/verificar` recalcula todo y compara con el memo leído de la red.
7. Si no hay ningún documento elegible, **no se llama a la red** (test obligatorio).

## 5. Reglas del proyecto
Ver `README.md` y `SECURITY.md` (lenguaje, seguridad, solo testnet, secretos en variables de entorno).

## 7. Hoja de ruta (de menor a mayor esfuerzo)
1. Sello en el memo — hecho. 2. Lotes con comprobantes — hecho. 3. Verificador público dedicado. 4. Despliegue en Vercel. 5. Motor de reglas completo y selector de redes en el producto principal (sprint). 6. `stellar.toml` con las cuentas oficiales. 7. x402 (opcional). 8. Anclas y USDC para dinero local: en el sprint solo el flujo SEP-24/SEP-10 contra un anchor de pruebas (D6); dinero real después, con consulta legal (ver `HOJA-DE-RUTA-POST-CIERRE.md`). 9. Contrato Soroban como registro de lotes, solo si hace falta lógica en la red. 10. Pagos condicionados: solo tras consulta legal.

## 8. Datos de Stellar verificados
Comisión mínima 100 stroops = 0,00001 XLM por operación [doc, y medido en la transacción de prueba]. Reserva base 0,5 XLM [doc]. Bloque cada ~5 s [comunidad]. Memo hash = 32 bytes [probado]. Testnet se reinicia el 16/12/2026. Project Thruput es vista previa sin fecha de red principal [doc].

## 9. Riesgos y límites
- Testnet se reinicia: nada de datos de largo plazo; los comprobantes guardan la red.
- El número de secuencia de la cuenta selladora obliga a enviar de a una transacción por cuenta (hay un reintento; para más volumen habrá que serializar).
- Si GALCOA controlara una clave que libera fondos de terceros, podría encuadrar como proveedor de servicios de activos virtuales: consulta legal antes de cualquier uso con dinero real.
- Cobrar en USDC tiene implicancias impositivas.
- Las cifras de comisión pueden cambiar con la congestión.
