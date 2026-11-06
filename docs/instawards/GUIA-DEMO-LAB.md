# Guía para mostrar la prueba en Stellar Lab (Testnet, 06/11/2026)

Sirve de respaldo si la web falla y como segunda parte de la demo: lo que se ve en Lab sale directo de la red, no de nuestro servidor. Todo es Testnet, activos de prueba.

## Datos para tener copiados
- Registro: `CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV`
- Custodia: `CASLCSQ3QYDJBPVLQS275HMMDDWJSNUQDS3Q7ES36ZPQWWADPRTID5G6`
- Lote 1 (vigente, ya cobrado en la custodia): `ec5dedf0b5c18380f39a9d29b2021023e91a857e7849cda71b5d6739a6dc5b76`
- Lote 2 (revocado): `71c697025af9533323ed828e332de95aacf05a4f87fc51cf4fc499e9fc4039ba`
- Lote 3 (vigente, sin usar): `e3da3fa5956089e4655426419d846a65dd859e902f48c71bcfe44378e935b218`
- Transacciones y huellas completas: `docs/evidencia/EVIDENCIA-8435d44b.md`

## Qué se verificó el 06/11/2026 contra la red
- `existe(lote 1)` da `true`; `existe(lote 3)` da `true`.
- `existe(lote 2)` da `false` y `obtener(lote 2)` devuelve el estado `Revocado`, con quién revocó y el ledger de la revocación (5587833). Así se ve la diferencia entre "no vigente" y "nunca existió".

## Orden de pestañas
1. La web: `https://galcoa-stellar.vercel.app/` (portada con el estado en vivo).
2. Lab, Contract Explorer: `https://lab.stellar.org/smart-contracts/contract-explorer` (red Testnet).
3. Lab, `getEvents`: `https://lab.stellar.org/endpoints/rpc/get-events`.
4. `/custodia` de la web.
5. `docs/evidencia/EVIDENCIA-8435d44b.md` por si piden los hashes.

## Paso a paso (3 minutos)
1. **Contract Explorer:** elegir Testnet, pegar el contrato de registro y cargar. Aparecen las funciones (`registrar`, `revocar`, `existe`, `obtener`, `renovar`, `renovar_instancia`, `servicio`).
2. Invocar `existe` con el lote 1: responde `true`. Invocar `existe` con el lote 2: responde `false`. Son lecturas, no cuestan ni firman nada.
3. Invocar `obtener` con el lote 2: se ve `Revocado`, el revocador y el ledger. Decir: "el lote no se borró, quedó la historia".
4. **getEvents:** filtrar por el contrato de registro y empezar en un ledger reciente (desde 5587700 alcanza). Se ven `lote_registrado` y `lote_revocado`. Repetir con el contrato de custodia: `depositado`, `liberado`, `reembolsado`.
5. Volver a la web, `/custodia`: los mismos movimientos con link a cada transacción.

## Si algo falla
- "La web puede fallar; la fuente de verdad es el contrato" y seguir en Lab.
- Si `getEvents` devuelve vacío, el ledger de inicio quedó demasiado atrás o demasiado adelante: probar con 5587700. La testnet guarda unos 7 días de eventos.
- Si Lab no carga, `/spec` de la web tiene el comando `curl` equivalente.

## Frases que no hay que decir
- Que "cumple" o "está validado".
- Que la mercadería existe: lo que se detecta son cambios en el contenido.
- Que el reembolso tras revocar es inmediato: llega al vencer el plazo del trato.
- Que la verificación web no depende de nuestro servidor: la web sí pasa por él; lo independiente es el paquete más un nodo, o Lab.
