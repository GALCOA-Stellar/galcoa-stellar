# ADR 0005: Acceso por firma de cuenta SEP-53 en lugar de código compartido

## Contexto
Sellar gasta recursos y deja un registro público, así que hace falta controlar quién puede hacerlo. Un código de acceso compartido no dice quién confirmó, se filtra fácil y no queda atado a un lote concreto. Stellar tiene un estándar para firmar mensajes con la clave de una cuenta (SEP-53).

## Decisión
Para sellar, una **cuenta autorizada firma electrónicamente un mensaje que nombra la huella exacta del lote** (`src/lib/stellar/firma.ts`):
1. `/api/desafio` calcula el memo en el servidor y emite el mensaje (encabezado, acción, cuenta, huella, red, vencimiento a 5 minutos y un código aleatorio), con una **marca HMAC** hecha con `DESAFIO_SECRETO`.
2. La persona firma con su billetera (Varial, antes Freighter) o a mano. La firma es SEP-53: ed25519 sobre SHA-256 de `"Stellar Signed Message:\n"` + mensaje. La clave nunca se envía.
3. `verificarAcceso` comprueba: marca válida, no vencido, cuenta y huella del lote coinciden, red correcta, cuenta en `CUENTAS_AUTORIZADAS` y firma válida; y que el código no se haya usado.
En producción, sin lista de cuentas o sin `DESAFIO_SECRETO`, **nadie puede sellar**. En desarrollo, sin lista, vale cualquier cuenta con firma válida y el secreto es efímero.

## Consecuencias
- Queda registrado qué cuenta confirmó el sello (`firmadoPor`) y la firma no sirve para otro lote, otra cuenta ni otra red.
- Una firma prueba que una **cuenta** firmó, no quién es la persona; por eso hay lista de autorizadas. No es identidad real ni la firma electrónica completa con motivo del GALCOA final.
- El servidor no guarda estado: el control contra reutilización (mapa en memoria) es de **mejor esfuerzo**; un reinicio o varias instancias pueden olvidarlo. Lo acota el vencimiento de 5 minutos y que la firma sea de un lote puntual.
- Hay que gestionar tres variables de entorno ([arquitectura](../arquitectura/ARQUITECTURA.md#6-variables-de-entorno)).
- La cuenta de la persona que firma es distinta de la cuenta selladora (`SELLADOR_STELLAR_SECRETO`), que solo vive en el servidor.
- Cubierto por pruebas: firma válida, otro lote, mensaje inventado, firma de otra cuenta, vencimiento, reutilización y producción sin lista.

## Estado
Aceptada.

## Fecha
05/11/2026
