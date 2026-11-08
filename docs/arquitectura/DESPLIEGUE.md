# Despliegue canónico (Stellar Testnet)

Red: **Testnet** (activos de prueba). Nada de esto es producción.

| Pieza | Identificador |
|---|---|
| Contrato `registro-lotes` | `CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV` |
| Contrato `escrow-entrega` | `CDLP7XWLU6QU6JA6O4RCYPGKRA5UHQTHAAM7PYRGM5EWWJNLCK4T5GAX` (con tope de plazo; desplegado el 07/11/2026) |
| Contrato `escrow-entrega` anterior (sin tope de plazo; flujos de `docs/evidencia/`) | `CB4QPU6RRZH2QMJTV43GDPSVLJQTV4P6GERHW2KRWHGY6HLMZQEUMTPV` |
| Cuenta del servicio y administradora | `GCRTRAAGPQJSP444J5QSIBM5MILRUI4XKL36Z4UW7OEE43TAC6X3EI3Y` |

## Fuente de verdad
El estado y los eventos de estos contratos en la red. La web es una comodidad; cualquiera puede comprobar lo mismo en Stellar Lab (Contract Explorer y `getEvents`), ver [`docs/instawards/GUIA-DEMO-LAB.md`](../instawards/GUIA-DEMO-LAB.md).

## Dónde se configuran los identificadores
Los IDs viven solo en `src/lib/config/contratos.ts`. La variable de entorno `CONTRATO_REGISTRO_ID` activa las funciones que firman contra el registro; `ESCROW_ID` ya no se usa (una variable vieja pisaba a la constante y dejaba vacío el historial de `/custodia`: se borra del hosting si existe). Si se redespliega, actualizar también el README, la página `/spec` y la evidencia.

## Historial de despliegues
| Fecha | Qué pasó |
|---|---|
| 06/11/2026 (tarde) | **Custodia v4** por la auditoría de contratos: una huella respalda un solo trato (error 10) y no se deposita contra una entrega ya verificada (error 8). El registro no cambia. Custodia anterior `CASLCSQ3QYDJBPVLQS275HMMDDWJSNUQDS3Q7ES36ZPQWWADPRTID5G6`: **obsoleta**, queda como historial y como evidencia de las pruebas anteriores |
| 06/11/2026 | Redespliegue por corrección: la vida de la instancia no se renovaba en `revocar`, `renovar`, `liberar` y `reembolsar`. Lógica de negocio sin cambios. Vigentes los identificadores de arriba |
| Antes del 06/11/2026 | Registro `CCUYFPOZ…5OFF7F` y custodia `CDU2H6E3…YREDO`: **obsoletos**, quedan solo como historial de prueba |
