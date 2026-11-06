# ADR 0002: Memo de tipo hash en un pago mínimo, sin contrato inteligente

## Contexto
Hay que dejar una huella pública y con fecha en Stellar. Un contrato inteligente (Soroban) permitiría lógica en la red, pero agrega superficie de ataque, desarrollo, auditoría y costo, y hoy no hace falta lógica en la red: las reglas se evalúan antes, en el servidor. Stellar ofrece un tipo de memo (`MEMO_HASH`) que admite exactamente 32 bytes, justo el tamaño de un SHA-256.

## Decisión
`enviarMemo` (`src/lib/stellar.ts`) arma **una transacción con una operación de pago mínimo (0,0000001 XLM) de la cuenta selladora a sí misma** y le agrega `Memo.hash` con la huella del lote. Se envía por Stellar RPC y se espera la confirmación. La red está fija en testnet (passphrase y URL en el código, no configurables desde afuera). Se reintenta una vez si el pedido choca por número de secuencia.

## Consecuencias
- Mínima complejidad: sin contrato que desplegar ni auditar; el costo es la comisión base (100 stroops = 0,00001 XLM, medido en la transacción de prueba).
- Solo viajan 32 bytes: nunca datos personales ni documentos.
- Cualquiera puede escribir un memo en Stellar: la red no "filtra". Lo que da valor es la **procedencia** (que lo haya anclado una cuenta publicada de GALCOA tras pasar las reglas); la publicación de esas cuentas en `stellar.toml` es una propuesta, todavía no hecha.
- Sin lógica en la red: nada impide que la cuenta selladora escriba otra cosa; la protección está en el servidor ([ADR 0004](0004-lo-rojo-nunca-se-sella-y-sellarlote-reevalua.md) y [ADR 0005](0005-acceso-por-firma-de-cuenta-sep-53.md)).
- Una cuenta selladora envía una transacción por vez; con más volumen habrá que serializar.
- Un contrato Soroban como registro de lotes queda como opción futura, solo si hace falta lógica en la red.
- Es un prototipo en testnet: sin dinero real ni red principal.

## Estado
Aceptada.

## Fecha
05/11/2026
