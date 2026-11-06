# ADR 0003: Las reglas deterministas deciden, la IA no

## Contexto
El veredicto decide qué se ancla de manera permanente y pública. Si lo decidiera un modelo de IA, la misma entrada podría dar resultados distintos, sería difícil de explicar y de validar, y no habría forma limpia de probar que "lo rojo no se sella".

## Decisión
El veredicto lo calcula `evaluar` (`src/lib/rules.ts`) con **reglas en código**, organizadas por atributo ALCOA+ y con ID (`ALC-COM-01`, `ALC-LEG-01`, `ALC-ATR-01`, `ALC-COH-01`, `ALC-CTE-01`, `ALC-ORI-01`, `ALC-EXA-01`). Cada regla es crítica (falla: rojo) o advertencia (falla: amarillo). Sin fallas es verde. La versión de reglas (`reglas-demo-0.2`) y los IDs aplicados quedan guardados en el manifiesto de cada documento. Una persona revisa lo rojo. La función no usa red, hora actual ni azar.

## Consecuencias
- Misma entrada, mismo veredicto: es verificable con pruebas automáticas (`tests/nucleo.test.ts`, incluida una prueba de determinismo).
- Cada decisión se explica con los IDs de las reglas y sus motivos.
- Cualquier cambio de reglas cambia `VERSION_REGLAS`; el comprobante dice con qué versión se evaluó.
- Las reglas actuales son **de demostración**, no el motor completo de GALCOA; no hay fuente externa que confirme el dato, se acepta lo declarado.
- La regla de cuatro ojos solo compara dos identificadores de texto; no hay identidad real ([límites](../ARQUITECTURA.md#7-límites-conocidos)).
- Este diseño busca poder validarse bajo GAMP 5; no implica que el sistema esté validado. Requisitos en [`docs/SRS.md`](../SRS.md) y [`docs/REQUISITOS-DE-DATO.md`](../REQUISITOS-DE-DATO.md).

## Estado
Aceptada.

## Fecha
05/11/2026
