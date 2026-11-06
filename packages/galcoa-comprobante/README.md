# galcoa-comprobante

Arma y verifica lotes de comprobantes con árbol de Merkle, en el formato `galcoa.stellar.comprobante.v2` (y verifica también los v1 ya emitidos). Sin dependencias (solo `node:crypto`), licencia MIT. Especificación completa: [`docs/ESPECIFICACION-COMPROBANTE.md`](../../docs/ESPECIFICACION-COMPROBANTE.md).

```js
import { armarLote, verificarComprobante, coincideConMemo } from "galcoa-comprobante";
const { memo, comprobantes } = armarLote(manifiestos); // `memo` es lo único que va a la red (32 bytes)
verificarComprobante(comprobantes[0]);                  // { coherente: true, memoEsperado }
coincideConMemo(comprobantes[0], memoLeidoDeLaRed);     // true / false
```

Ejemplo: `node examples/verificar-un-lote.mjs`. **Estado:** 0.1.0, todavía no publicado en npm. No decide veredictos ni envía nada a Stellar: solo arma y verifica las pruebas.
