# registro-lotes (contrato Soroban)

Guarda la huella SHA-256 de un lote y su estado (vigente o revocado). Solo testnet; sin auditoría externa y sin ruta de actualización.

## Funciones
| Función | Quién | Qué hace |
|---|---|---|
| `registrar(huella, cargador, aprobador)` | Servicio + cargador + aprobador (tres firmas) | Registra el lote. Rechaza cargador = aprobador y huellas ya registradas |
| `revocar(huella, motivo_hash, revocador)` | Servicio + quien cargó o quien aprobó | Marca el lote como revocado y guarda el hash del motivo. No vuelve a vigente |
| `existe(huella)` | Cualquiera (lectura) | `true` solo si está registrado y vigente |
| `obtener(huella)` | Cualquiera (lectura) | Cargador, aprobador, estado y ledgers de cada paso |
| `renovar(huella)` | Cualquiera | Extiende la vida del dato; no cambia su contenido |
| `renovar_instancia()` | Cualquiera | Extiende la vida de la instancia (cuenta del servicio) |
| `servicio()` | Cualquiera (lectura) | Cuenta del servicio |

## Almacenamiento
- Persistente, por huella: `Registro` (cargador, aprobador, estado, ledgers, hash del motivo).
- Instancia: la cuenta del servicio. Su vida se renueva en todas las operaciones.

## Eventos
`lote_registrado` (huella, cargador, aprobador) y `lote_revocado` (huella, revocador, hash del motivo).

## Pruebas
`cargo test` desde esta carpeta (14 pruebas). Despliegue vigente: [`docs/arquitectura/DESPLIEGUE.md`](../../docs/arquitectura/DESPLIEGUE.md).
