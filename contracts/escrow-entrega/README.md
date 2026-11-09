# escrow-entrega (contrato Soroban)

Custodia de prueba: retiene un depósito y lo libera o reembolsa según el estado del lote en `registro-lotes`. Solo testnet y activos de prueba; sin auditoría externa y sin ruta de actualización.

## Funciones
| Función | Quién | Qué hace |
|---|---|---|
| `depositar(id, pagador, beneficiario, token, monto, huella, vence_ledger)` | Pagador | Retiene el monto hasta el plazo del trato |
| `liberar(id, pagador)` | Cualquiera | Paga al beneficiario guardado, solo si el lote está vigente (`existe` en el registro) |
| `reembolsar(id, pagador)` | Cualquiera | Devuelve el depósito al pagador, solo vencido el plazo y con el lote no vigente |
| `obtener`, `historial`, `registro`, `tokens_permitidos`, `admin`, `pausado` | Cualquiera (lectura) | Estado del trato y datos del contrato |
| `transferir_administracion`, `aceptar_administracion` | Administración | Traspaso en dos pasos |
| `pausar`, `reanudar` | Administración | Pausa de emergencia |

Los fondos solo salen hacia el beneficiario o el pagador guardados; quien llame a `liberar` o `reembolsar` no elige el destino. Un trato se liquida una sola vez, y una huella (una entrega) respalda un solo trato: tras liberar queda consumida, tras un reembolso vuelve a estar libre. No se puede depositar contra una entrega que ya estaba verificada.

**Lista blanca de tokens (#56).** El constructor recibe `(registro, admin, tokens)`: `tokens` es la lista fija (1 a 10, sin repetir) de los únicos tokens que se pueden depositar, y nadie la cambia después. Un token fuera de la lista se rechaza con el error 12 (`TokenNoPermitido`) antes de llamar a ningún contrato de token; una lista vacía o con repetidos no deja crear el contrato (error 13). Así nadie deposita con un token propio que tenga un `transfer` malicioso, y ocupar una huella ajena (auditoría del 07/11) cuesta al menos una unidad de un token real de la lista. `scripts/desplegar-escrow.mjs` pone por defecto el token de prueba GALCOAT que emite la cuenta del servicio; `TOKENS_PERMITIDOS=C...,C...` suma otros.

## Eventos
`depositado`, `liberado`, `reembolsado`.

## Pruebas
`cargo test` desde esta carpeta (27 pruebas; sin Rust instalado: `bash scripts/contratos-docker.sh test escrow-entrega`). Solo enlazan en Linux: las corre el CI. Despliegue vigente: [`docs/arquitectura/DESPLIEGUE.md`](../../docs/arquitectura/DESPLIEGUE.md).
