# Glosario

Actualizado: 05/11/2026. Términos de negocio y técnicos, explicados simple. Orden alfabético. Ver también la [arquitectura](ARQUITECTURA.md) y [`docs/FUENTE-DE-VERDAD.md`](FUENTE-DE-VERDAD.md).

**Amarillo.** Veredicto de un documento que no tiene fallas críticas pero sí una advertencia (por ejemplo, carga tardía o falta la huella del original). Se incluye en el lote **marcado como declarado**. Ver *veredicto*.

**ALCOA+.** Conjunto de atributos que debe tener un dato para merecer confianza: Atribuible, Legible, Contemporáneo, Original, Exacto, y además Completo, Consistente, Perdurable, Disponible y Trazable. Cada regla del prototipo (`ALC-...`) apunta a un atributo. Es un criterio de diseño; no significa que el sistema esté avalado por nadie.

**Archivo del lote.** Archivo JSON (`galcoa.stellar.archivo.v1`) que se descarga al sellar: junta los datos del sellado y **todos los comprobantes**, cada uno con su prueba guardada. Hay que guardarlo por fuera de la red, porque la red puede olvidar el historial.

**Árbol de Merkle.** Forma de resumir muchos documentos en una sola huella. Cada documento tiene su huella; se juntan de a dos y se vuelven a resumir, y así hasta quedar una sola, la **raíz**. Permite probar que un documento está en el conjunto sin mostrar los demás. Ver *hoja*, *raíz*.

**Cuatro ojos.** Principio por el cual quien carga un dato no puede ser quien lo confirma. En el prototipo la regla `ALC-ATR-01` solo comprueba que ambos identificadores sean distintos; la versión completa (identidad real, auditoría) **no está implementada**.

**Comprobante.** Papel digital de cada documento sellado (`galcoa.stellar.comprobante.v1`). Lleva el documento, su huella, el camino hasta la raíz, la raíz, la red, el hash de la transacción y, opcionalmente, la prueba guardada. Con él se puede verificar el documento solo.

**Escrow.** Depósito en garantía que libera fondos al cumplirse una condición. **No se usa** en este prototipo: no maneja dinero. Queda como idea de largo plazo y exigiría consulta legal previa.

**Firma electrónica.** Aprobación de una persona sobre algo concreto, hecha con la clave de su cuenta. En este proyecto siempre se dice *electrónica* (no "digital"). Ver *SEP-53*.

**GAMP 5.** Guía de buenas prácticas para validar sistemas informatizados con enfoque basado en riesgo (requisitos, controles, pruebas, trazabilidad). GALCOA+ está **diseñado para poder validarse**; no está validado.

**Hash / huella.** Resultado de pasar cualquier contenido por una función que devuelve un resumen de tamaño fijo. Si el contenido cambia en una coma, la huella cambia por completo. No permite recuperar el contenido original. Ver *SHA-256*.

**Hoja.** Cada extremo del árbol de Merkle: la huella de un documento (con un prefijo `0x00` para distinguirla de los nodos intermedios).

**Horizon.** Servicio de Stellar que guarda y ofrece el historial de transacciones. Acá se usa **solo como respaldo de lectura** para comprobantes viejos cuando el RPC ya no los tiene; su documentación lo marca en mantenimiento.

**Ledger.** Cada "página" que Stellar va agregando a su libro de transacciones (aproximadamente cada 5 segundos). El comprobante guarda el número y la hora de cierre del ledger donde quedó la transacción.

**Lote.** Conjunto de documentos (hasta 50) que se sellan juntos con una sola transacción y una sola huella.

**Memo.** Campo opcional de una transacción de Stellar para adjuntar una nota. Hay un tipo *hash* que admite exactamente 32 bytes: ahí va la huella del lote. Cualquiera puede escribir un memo; lo que da valor es que lo ancle una cuenta publicada y que la huella salga de un lote verificado.

**Raíz.** La huella única en la punta del árbol de Merkle, que resume todo el lote. El memo es el SHA-256 de un resumen canónico del lote (raíz, cantidad de hojas y versión del esquema).

**Rojo.** Veredicto de un documento que requiere revisión de una persona (incluye "no se pudo leer"). **Nunca se sella.** Ver *veredicto*.

**RPC (Stellar RPC).** Servicio por el que el servidor envía transacciones a la red y consulta su estado. Guarda solo unos 7 días de historial. En este prototipo se usa el de testnet.

**SEP-53.** Estándar de Stellar para firmar un mensaje de texto con la clave de una cuenta. Se firma el SHA-256 de `"Stellar Signed Message:\n"` más el mensaje. Acá se usa para que una cuenta autorizada confirme el sellado de un lote concreto en lugar de compartir un código.

**SHA-256.** Función de hash que produce 32 bytes (64 caracteres hexadecimales). Es la base de todas las huellas del proyecto.

**Testnet.** Red de pruebas de Stellar: funciona igual que la real pero con fondos sin valor. Se **reinicia periódicamente y borra todo** (próxima: 16/12/2026). Este proyecto usa solo testnet.

**Trustline.** Autorización para que una cuenta tenga un activo emitido por otro (por ejemplo, una moneda estable). **No aplica**: el prototipo solo mueve el activo nativo (XLM de prueba) en un pago mínimo a la propia cuenta.

**Veredicto.** Resultado de evaluar un documento con las reglas: **verde** (todo verificado, se sella), **amarillo** (declarado, se sella marcado) o **rojo** (requiere revisión, no se sella). Lo deciden reglas en código, nunca la IA.

**Verde.** Veredicto de un documento cuyas reglas se verifican todas. Se incluye en el lote. Ver *veredicto*.

**XDR.** Formato binario con el que Stellar codifica transacciones y resultados (se muestra en base64). El comprobante guarda el *sobre firmado* de la transacción en XDR para poder revisarla sin consultar la red.
