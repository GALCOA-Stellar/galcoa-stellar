# Requisitos de dato: qué hace falta para que un dato sea verificado

Actualizado 05/11/2026. Este documento define **qué tiene que cumplir cada dato para que tenga valor**, con la lógica de **ALCOA+** y un diseño pensado **para poder validarse bajo GAMP 5** (enfoque basado en riesgo: requisitos de usuario → controles → pruebas → trazabilidad). No afirma que el sistema esté validado ni que cumpla una norma: eso lo determina un proceso de validación con personas calificadas.

## 1. Atributo por atributo
| Atributo ALCOA+ | Qué significa para un dato de entrega | Regla (ID) | Si falla | Quién lo aporta |
|---|---|---|---|---|
| **A**tribuible | Se sabe quién lo cargó y quién lo confirmó, y son personas distintas (cuatro ojos) | ALC-ATR-01 | Rojo | Sistema + personas |
| **L**egible | Tipos y formatos válidos (fechas reales, cantidades enteras, identificadores internos) | ALC-LEG-01 | Rojo | Sistema |
| **C**ontemporáneo | Se registró cerca del hecho (hasta 3 días) | ALC-CTE-01 | Amarillo (carga tardía) | Sistema |
| **O**riginal | Hay huella SHA-256 del documento original (remito, foto) | ALC-ORI-01 | Amarillo (declarado sin evidencia) | Persona |
| **E**xacto | Lo recibido coincide con lo pedido; si difiere, hay observación | ALC-EXA-01 | Amarillo con observación; rojo sin ella | Persona + sistema |
| **+ C**ompleto | Están todos los campos obligatorios | ALC-COM-01 | Rojo ("no se pudo leer") | Sistema |
| **+ C**onsistente | Los datos no se contradicen (el registro no es anterior a la entrega) | ALC-COH-01 | Rojo | Sistema |
| **+ P**erdurable | Queda una prueba que no se puede borrar | Anclaje en Stellar | n/a | Sistema |
| **+ D**isponible | Se puede consultar y verificar después | Comprobante + verificador | n/a | Sistema |
| **+ T**razable | Cada veredicto guarda el ID de cada regla y la versión de reglas | `reglasIds`, `reglasVersion` | n/a | Sistema |

## 2. Cómo se combinan los resultados
Verde = todas las reglas se cumplen. Amarillo = no hay fallas críticas pero sí advertencias (se ancla marcado como declarado). Rojo = alguna falla crítica (**no se ancla jamás**; va a una persona). La IA no decide el veredicto.

## 3. Enfoque GAMP 5 (diseño para validar)
- **Requisitos de usuario:** `docs/SRS.md` (cada requisito tiene ID).
- **Basado en riesgo:** el mayor riesgo es anclar un dato malo como si fuera bueno; por eso la regla crítica manda y lo rojo no llega a la red.
- **Pruebas:** `tests/nucleo.test.ts` cubre cada regla, lo determinista, el rojo que nunca llama a la red y la alteración del comprobante.
- **Trazabilidad** requisito → regla → prueba: ver la matriz de `docs/SRS.md`.
- **Control de cambios:** versión de reglas (`reglas-demo-0.2`); cualquier cambio de reglas cambia la versión.
- **Pendiente:** categoría de software, evaluación de proveedores (por ejemplo, la red), plan de validación y revisión de personas calificadas. No están hechos.

## 4. Lo que falta en este prototipo
Fuente externa que confirme el dato (hoy se acepta lo declarado), identidad real de quien carga y confirma (hoy son identificadores de texto), firma electrónica con motivo, almacenamiento de evidencias y piso de auditoría append-only. Son parte del GALCOA completo, no de esta demo.

## 5. Datos personales
A la red solo va una huella de 32 bytes. Los comprobantes contienen el documento y viven fuera de la red, bajo control de quien los tenga. Usar identificadores internos (no nombres) en `cargadoPor` y `confirmadoPor`.
