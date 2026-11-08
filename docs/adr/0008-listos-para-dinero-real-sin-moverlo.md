# 0008 — Listos para dinero real, sin moverlo (06/11/2026)

Estado: aceptada por Facundo.

## Decisión
En el sprint no se mueve dinero real ni se pasa a la red principal. Se agrega un entregable (D6) que deja el sistema preparado: flujo de depósito y retiro hosteado (SEP-24) con autenticación (SEP-10) contra un anchor de pruebas de Stellar y activos de prueba, diseño en papel de KYC (SEP-12) y un documento de requisitos antes de mainnet.

## Por qué
- Si el servicio controla una clave que libera fondos de terceros, podría encuadrar como proveedor de servicios de activos virtuales: hace falta consulta legal antes de cualquier uso con dinero real.
- Con USD 5.000 y 30 días, pasar a mainnet pondría en riesgo lo ya entregado. Hoy hay una sola cuenta de servicio.
- Lo que se muestra queda verificable: se puede probar en testnet.

## Consecuencias
- Redacción permitida: "diseñado y probado en testnet para dinero real, con estos requisitos antes de pasar a mainnet". No se promete mainnet.
- Requisitos mínimos antes de mainnet: auditoría externa, cuenta con varias firmas y rotación de claves, consulta legal, límites de monto.
- Verificado el 06/11/2026: el anchor de pruebas de Stellar (`testanchor.stellar.org`) publica su `stellar.toml` con SEP-10, SEP-12, SEP-6, SEP-24, SEP-31, SEP-38 y SEP-45, y los activos de prueba SRT y USDC. Hay que reconfirmarlo en la primera semana del sprint.
