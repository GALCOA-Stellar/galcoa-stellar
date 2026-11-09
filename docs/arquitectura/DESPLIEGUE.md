# Despliegue canónico (Stellar Testnet)

Red: **Testnet** (activos de prueba). Nada de esto es producción.

| Pieza | Identificador |
|---|---|
| Contrato `registro-lotes` | `CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV` |
| Contrato `escrow-entrega` | `CAQREI2NEMXVINPMJUPEPHBBNLW6HX3B4EJVXZLDSLMSTGRK6OKRUKIJ` (con tope de plazo y lista de tokens permitidos: solo el XLM de prueba; desplegado el 09/11/2026) |
| Contrato `escrow-entrega` del 07/11 (sin lista de tokens; obsoleto) | `CDLP7XWLU6QU6JA6O4RCYPGKRA5UHQTHAAM7PYRGM5EWWJNLCK4T5GAX` |
| Contrato `escrow-entrega` anterior (sin tope de plazo; flujos de `docs/evidencia/`) | `CB4QPU6RRZH2QMJTV43GDPSVLJQTV4P6GERHW2KRWHGY6HLMZQEUMTPV` |
| Cuenta del servicio y administradora | `GCRTRAAGPQJSP444J5QSIBM5MILRUI4XKL36Z4UW7OEE43TAC6X3EI3Y` |

## Fuente de verdad
El estado y los eventos de estos contratos en la red. La web es una comodidad; cualquiera puede comprobar lo mismo en Stellar Lab (Contract Explorer y `getEvents`), ver [`docs/demo/GUIA-DEMO-LAB.md`](../demo/GUIA-DEMO-LAB.md).

## Dónde se configuran los identificadores
Los IDs viven solo en `src/lib/config/contratos.ts`. La variable de entorno `CONTRATO_REGISTRO_ID` activa las funciones que firman contra el registro; `ESCROW_ID` ya no se usa (una variable vieja pisaba a la constante y dejaba vacío el historial de `/custodia`: se borra del hosting si existe). Si se redespliega, actualizar también el README, la página `/spec` y la evidencia.

## Pendiente de redesplegar
- **Lista blanca de tokens (#56):** el código de `contracts/escrow-entrega` ya la tiene (el constructor recibe la lista fija de tokens), pero el contrato desplegado arriba todavía acepta cualquier token. Para redesplegar: `node scripts/desplegar-escrow.mjs` (por defecto permite solo el token de prueba GALCOAT emitido por la cuenta del servicio; `TOKENS_PERMITIDOS=C...,C...` suma otros), y después cambiar el ID en `src/lib/config/contratos.ts` y en este archivo. Las pruebas de punta a punta (`probar-escrow.mjs` y `criterios-de-exito.mjs`) ya usan ese token, así que funcionan con la custodia vieja y con la nueva.

## Historial de despliegues
| Fecha | Qué pasó |
|---|---|
| 09/11/2026 | **Custodia con lista de tokens** (`TokenNoPermitido`, error 12): solo acepta el contrato del XLM de prueba `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`. Se desplegó con el WASM compilado por la integración continua (huella `75ce4055…`) y se comprobó con `scripts/comprobar-wasm.mjs`. La custodia del 07/11 queda obsoleta. El registro no cambia |
| 06/11/2026 (tarde) | **Custodia v4** por la auditoría de contratos: una huella respalda un solo trato (error 10) y no se deposita contra una entrega ya verificada (error 8). El registro no cambia. Custodia anterior `CASLCSQ3QYDJBPVLQS275HMMDDWJSNUQDS3Q7ES36ZPQWWADPRTID5G6`: **obsoleta**, queda como historial y como evidencia de las pruebas anteriores |
| 06/11/2026 | Redespliegue por corrección: la vida de la instancia no se renovaba en `revocar`, `renovar`, `liberar` y `reembolsar`. Lógica de negocio sin cambios. Vigentes los identificadores de arriba |
| Antes del 06/11/2026 | Registro `CCUYFPOZ…5OFF7F` y custodia `CDU2H6E3…YREDO`: **obsoletos**, quedan solo como historial de prueba |
