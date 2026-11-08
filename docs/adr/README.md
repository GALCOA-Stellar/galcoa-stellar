# Decisiones de arquitectura (ADR)

Cada ADR registra una decisión **ya tomada y presente en el código**, con su contexto y consecuencias. Todos tienen estado "Aceptada" y fecha 05/11/2026. Se leen junto con la [arquitectura](../arquitectura/ARQUITECTURA.md), el [glosario](../arquitectura/GLOSARIO.md) y [`docs/producto/FUENTE-DE-VERDAD.md`](../producto/FUENTE-DE-VERDAD.md) (que manda ante cualquier contradicción).

| N.º | Decisión | Estado |
|---|---|---|
| [0001](0001-una-huella-por-lote-con-arbol-de-merkle.md) | Una sola huella por lote con árbol de Merkle | Aceptada |
| [0002](0002-memo-hash-en-pago-minimo-sin-contrato.md) | Memo de tipo hash en un pago mínimo, sin contrato inteligente | Aceptada |
| [0003](0003-las-reglas-deterministas-deciden-no-la-ia.md) | Las reglas deterministas deciden, la IA no | Aceptada |
| [0004](0004-lo-rojo-nunca-se-sella-y-sellarlote-reevalua.md) | Lo rojo nunca se sella y `sellarLote` reevalúa todo | Aceptada |
| [0005](0005-acceso-por-firma-de-cuenta-sep-53.md) | Acceso por firma de cuenta SEP-53 en lugar de código compartido | Aceptada |
| [0006](0006-prueba-guardada-y-archivo-del-lote.md) | Prueba guardada y archivo del lote para sobrevivir al historial de la red | Aceptada |
| [0008](0008-listos-para-dinero-real-sin-moverlo.md) | Listos para dinero real, sin moverlo | Aceptada |
| [0009](0009-dos-agentes-de-ia-que-proponen-y-frenan.md) | Dos agentes de IA que proponen y frenan; las reglas deciden | Aceptada |

Formato: Contexto, Decisión, Consecuencias, Estado, Fecha. Un cambio de decisión se registra con un ADR nuevo que reemplaza al anterior.
