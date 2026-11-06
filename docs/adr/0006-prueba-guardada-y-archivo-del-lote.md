# ADR 0006: Prueba guardada y archivo del lote para sobrevivir al historial de la red

## Contexto
El Stellar RPC guarda solo unos 7 días de historial; Horizon conserva más, pero figura en mantenimiento en la documentación; y la testnet se reinicia (próxima: 16/12/2026) y borra todo. Un comprobante que dependa únicamente de consultar la red deja de poder verificarse.

## Decisión
- Al sellar, `enviarMemo` guarda en el comprobante una **prueba** (`Prueba`): número de ledger, hora de cierre del ledger, el **sobre firmado de la transacción (XDR)** y el resultado (XDR). Es opcional y queda fuera de la huella del documento.
- `armarArchivo` arma el **archivo del lote** (`galcoa.stellar.archivo.v1`): sellado más todos los comprobantes con su prueba; la pantalla permite descargarlo.
- Para verificar (`/api/verificar`): primero se comprueba la coherencia del comprobante (sin red); luego se lee el memo de la red (RPC y, si ya no está, Horizon); si la red no lo tiene, se usa `verificarPruebaLocal`: el sobre guardado debe tener el hash de transacción declarado y un memo hash igual a la huella esperada.

## Consecuencias
- Un comprobante se puede revisar aunque la red haya olvidado la transacción o se haya reiniciado.
- La respuesta distingue los casos: con red ("completo") o con prueba guardada. En este último caso **aclara que no se pudo consultar la red** y que no se confirma que la red haya incluido la transacción: prueba qué contenía lo firmado, no que se haya ejecutado.
- Quien conserva el archivo y los comprobantes custodia los documentos: viven fuera de la red y pueden contener datos del negocio; usar identificadores internos, no nombres.
- Si se pierde el archivo y la red olvidó la transacción, no hay forma de reconstruir los comprobantes: guardar el archivo es responsabilidad de quien sella.
- La testnet seguirá reiniciándose: esto mitiga la verificación, no hace perdurable la prueba pública. Para algo de largo plazo habría que pasar a otra red, con consulta legal previa.
- Cubierto por pruebas: verificación sin red, rechazo de prueba con otro memo u otro hash, y armado del archivo.

## Estado
Aceptada.

## Fecha
05/11/2026
