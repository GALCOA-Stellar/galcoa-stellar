# Especificación del comprobante `galcoa.stellar.comprobante.v2`

Es el formato que se emite desde el 06/11/2026. Los comprobantes v1 ya emitidos se siguen verificando (ver `ESPECIFICACION-COMPROBANTE-V1.md`). La codificación se inspira en una especificación de compromisos de código abierto (licencia MIT): orden de campos fijo, marcas de tipo, texto normalizado y prefijo de dominio.

## Qué cambió respecto de v1 y por qué
| | v1 | v2 |
|---|---|---|
| Qué se hashea | JSON con claves ordenadas | Bytes con orden de campos **fijo** y marca de tipo por valor |
| Texto | Tal cual | Normalizado a **NFC** (dos textos que se ven iguales dan los mismos bytes) |
| "Ausente" vs "vacío" | Se confundían según el caso | Marcas distintas: no colisionan |
| Campos de más | Alteraban la huella | Se **rechazan**: no se puede agregar datos sin romper la verificación |
| Prefijo de dominio | No tenía | `galcoa:manifiesto:v2` y `galcoa:lote:v2`: una huella no se confunde con otra |
| Memo del lote | SHA-256 de un JSON | SHA-256(dominio ‖ versión ‖ cantidad ‖ raíz) |
| Pruebas | Tests propios | Vectores generados por una implementación independiente en Python |

El árbol de Merkle no cambió (hojas con prefijo `0x00`, nodos con `0x01`).

## Codificación
Cada valor lleva una marca de un byte:
- `0x00` ausente (solo campos opcionales)
- `0x01` texto: longitud (4 bytes, big-endian) + UTF-8 en NFC
- `0x02` entero sin signo: 8 bytes big-endian (solo enteros seguros, sin decimales)
- `0x03` bytes: longitud (4 bytes) + bytes (se usa para huellas de 32 bytes)
- `0x04` lista de textos: cantidad (4 bytes) + cada texto

Orden fijo de los campos del documento (`galcoa.entrega.v2`): `remito`, `producto`, `unidad`, `cantidadPedida`, `cantidadRecibida`, `fechaEntrega`, `fechaRegistro`, `cargadoPor`, `confirmadoPor`, `evidenciaHash` (opcional, huella de 64 caracteres hexadecimales en minúscula), `observacion` (opcional).

Manifiesto = `reglasVersion` (texto), `reglasIds` (lista), `veredicto` (texto), y los campos del documento en el orden de arriba.

```
manifestHash = SHA-256( "galcoa:manifiesto:v2" ‖ 0x02 ‖ bytes_del_manifiesto )
hoja         = SHA-256( 0x00 ‖ manifestHash )          nodo = SHA-256( 0x01 ‖ izq ‖ der )
memo         = SHA-256( "galcoa:lote:v2" ‖ 0x02 ‖ cantidadHojas (4 bytes) ‖ raíz (32 bytes) )
```

Límites: 65.536 bytes por campo, 256 elementos por lista.

## Cómo verificar sin nuestro servidor
1. Codificar el manifiesto con las reglas de arriba y comprobar que da `manifestHash`.
2. Subir por `camino` hasta la raíz y compararla con `raiz`.
3. Calcular el memo con `raiz` y `cantidadHojas`.
4. Buscar `txHash` en la red y comprobar que el memo (hash) es ese valor.
5. Opcional: consultar el contrato de registro con el memo (vigente o revocado).

Implementaciones: la app (`src/lib/codificacion.ts`) y el paquete `galcoa-comprobante` (JavaScript, sin dependencias). Vectores de prueba: `docs/vectores/comprobante-v2.json`, generados con `scripts/generar-vectores-v2.py` (Python, escrito aparte). Cualquier implementación nueva debe dar esos mismos resultados.

## Límites conocidos
- Los vectores prueban lo que contienen: seis manifiestos y un lote. Si se agregan campos, hay que agregar vectores.
- Prueba que el contenido existía tal cual y no cambió; no prueba que sea verdad.
- El comprobante no incluye el ID del contrato de registro (está en el `stellar.toml`). Candidato a una versión futura.
- Cambiar cualquier regla de codificación obliga a una versión nueva (v3): nunca se modifica v2.
