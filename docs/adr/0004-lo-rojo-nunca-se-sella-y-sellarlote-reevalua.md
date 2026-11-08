# ADR 0004: Lo rojo nunca se sella y `sellarLote` reevalúa todo

## Contexto
Si el sellado confiara en un veredicto calculado antes (por ejemplo, el de la vista previa o uno que mande el navegador), un pedido manipulado podría hacer sellar un documento rojo. Lo sellado es público y no se puede borrar.

## Decisión
`sellarLote` (`src/lib/aplicacion/lote.ts`) **no recibe veredictos: recibe los documentos crudos y vuelve a evaluar cada uno con `evaluar`**. Solo entran al lote los que no son rojos y tienen documento válido. Si no queda ningún elegible, devuelve el resultado **sin llamar al enviador** (la red). La ruta `/api/sellar-lote` tampoco confía en el navegador: recalcula la huella con `previsualizarLote` antes de validar la firma. `previsualizarLote` usa la misma lógica, así que la vista previa anticipa exactamente la raíz y el memo que después se sellan.

## Consecuencias
- Un rojo no llega a la red por ningún camino de la aplicación, aunque el navegador diga otra cosa.
- Existe una prueba obligatoria: un lote con solo rojos nunca llama a la red; y otra: el rojo queda afuera y el resto va en una sola transacción (`tests/nucleo.test.ts`).
- Se evalúa dos veces (vista previa y sellado): costo despreciable por ser código puro, a cambio de coherencia garantizada.
- El enviador es un parámetro (`Enviador`), lo que permite probar sin red.
- Lotes vacíos o de más de 50 documentos se rechazan.
- Límite: la garantía rige para el código de esta aplicación; la red en sí no impide que la cuenta selladora escriba otro memo si alguien con su clave lo hiciera ([ADR 0002](0002-memo-hash-en-pago-minimo-sin-contrato.md)).

## Estado
Aceptada.

## Fecha
05/11/2026
