# ADR 0001: Una sola huella por lote con árbol de Merkle

## Contexto
Anclar una huella por cada documento significaría una transacción por documento: más costo, más espera (confirmar tarda unos 10 s) y más carga sobre una cuenta que solo puede enviar de a una transacción por vez. Además, cada documento tiene que poder verificarse por separado, sin publicar los demás.

## Decisión
Los documentos elegibles (verdes y amarillos, hasta `MAX_DOCUMENTOS` = 50) se resumen en un **árbol de Merkle** (`src/lib/dominio/merkle.ts`): hoja = SHA-256(`0x00` ‖ huella del manifiesto), nodo = SHA-256(`0x01` ‖ izquierda ‖ derecha); si un nivel es impar, el último nodo sube sin duplicarse. A Stellar va **una sola huella de 32 bytes por lote**: el SHA-256 del resumen canónico `{cantidadHojas, raiz, schemaVersion: "galcoa.batch.v1"}` (`memoDelLote` en `src/lib/aplicacion/lote.ts`). Cada documento recibe un comprobante con su camino hasta la raíz.

## Consecuencias
- Una transacción por lote, sin importar cuántos documentos tenga; cada documento se verifica solo con su comprobante.
- Los prefijos distintos de hoja y nodo evitan confundir una hoja con un nodo intermedio.
- La cantidad de hojas queda dentro de la huella, así que no se puede presentar un árbol de otro tamaño.
- Si cambia un solo documento del lote, cambia la raíz y el memo: no se pueden agregar ni quitar documentos después de sellado.
- Sin el comprobante (o el archivo del lote) no se puede reconstruir el camino: ver [ADR 0006](0006-prueba-guardada-y-archivo-del-lote.md).
- A la red no van datos ni identificadores, solo la huella.

## Estado
Aceptada. Cubierta por pruebas de lotes de distintos tamaños y de documentos y raíces alterados (`tests/nucleo.test.ts`).

## Fecha
05/11/2026
