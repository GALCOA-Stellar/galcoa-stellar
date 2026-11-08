# escrow-entrega (contrato Soroban)

Custodia de prueba: retiene un depósito y lo libera o reembolsa según el estado del lote en `registro-lotes`. Solo testnet y activos de prueba; sin auditoría externa y sin ruta de actualización.

## Funciones
| Función | Quién | Qué hace |
|---|---|---|
| `depositar(id, pagador, beneficiario, token, monto, huella, vence_ledger)` | Pagador | Retiene el monto hasta el plazo del trato |
| `liberar(id, pagador)` | Cualquiera | Paga al beneficiario guardado, solo si el lote está vigente (`existe` en el registro) |
| `reembolsar(id, pagador)` | Cualquiera | Devuelve el depósito al pagador, solo vencido el plazo y con el lote no vigente |
| `obtener`, `historial`, `registro`, `admin`, `pausado` | Cualquiera (lectura) | Estado del trato y datos del contrato |
| `transferir_administracion`, `aceptar_administracion` | Administración | Traspaso en dos pasos |
| `pausar`, `reanudar` | Administración | Pausa de emergencia |

Los fondos solo salen hacia el beneficiario o el pagador guardados; quien llame a `liberar` o `reembolsar` no elige el destino. Un trato se liquida una sola vez, y una huella (una entrega) respalda un solo trato: tras liberar queda consumida, tras un reembolso vuelve a estar libre. No se puede depositar contra una entrega que ya estaba verificada.

## Eventos
`depositado`, `liberado`, `reembolsado`.

## Pruebas
`cargo test` desde esta carpeta (22 pruebas). Solo enlazan en Linux: las corre el CI. Despliegue vigente: [`docs/arquitectura/DESPLIEGUE.md`](../../docs/arquitectura/DESPLIEGUE.md).
