# Modelo de amenazas (STRIDE) y plan de monitoreo

Borrador del 05/11/2026 para el prototipo en testnet. Cubre lo que hoy existe: reglas, lote Merkle, acceso por firma, sello 2 de 2, verificador. **No es una auditoría externa.** Cada amenaza dice qué lo frena hoy, qué falta y qué se vigila.

| # | Tipo | Amenaza | Qué lo frena hoy | Qué falta | Monitor |
|---|---|---|---|---|---|
| T1 | Suplantación | Alguien se hace pasar por un aprobador | Firma SEP-53 de la cuenta, lista `CUENTAS_AUTORIZADAS`, mensaje con vencimiento y marca HMAC | Robo de la clave de la billetera: se mitiga con billetera de hardware | Alerta si una cuenta firmante firma desde horarios o cantidades inusuales |
| T2 | Suplantación | Repetir una firma vieja (replay) | Código único por mensaje, vencimiento de 5 min, la firma incluye la huella del lote | El registro de códigos usados está en memoria: se pierde al reiniciar | Contar rechazos por "firma ya usada" |
| T3 | Manipulación | Cambiar documentos después de firmar | La huella se recalcula en el servidor; el memo de la transacción debe coincidir | — | Prueba automática de memo distinto |
| T4 | Manipulación | Cambiar qué hace la transacción firmada (pago a un tercero) | `evaluarSello` exige 1 operación: pago mínimo a la propia cuenta, memo exacto, vigencia | — | Cualquier operación de la cuenta de sellado distinta de ese pago |
| T5 | Manipulación | Evadir las dos firmas | La red exige umbral 2 con la clave maestra en 0; el servidor revisa antes de enviar | Cambio de firmantes: exige las dos firmas, hay que alertarlo | Alerta ante cualquier `SetOptions` de la cuenta de sellado |
| T6 | Repudio | "Yo no aprobé eso" | La firma es de su cuenta; el archivo nombra a quienes firmaron y a quienes cargaron | Registro de auditoría persistente (hoy solo el archivo del lote) | Guardar cada sello con fecha, firmantes y huella |
| T7 | Divulgación | Se filtran datos personales o comerciales | A la red solo va una huella de 32 bytes; no hay base de datos | Los documentos pasan por el servidor al sellar: no se guardan, pero hay que decirlo | Revisar que los logs no incluyan documentos |
| T8 | Divulgación | Filtración de claves del servidor | Claves solo en variables de entorno; `.env.local` fuera de git | Rotación de `DESAFIO_SECRETO` y `SELLADOR_STELLAR_SECRETO` | Escaneo de secretos en CI |
| T9 | Denegación | Inundar de pedidos al servidor | Límite por IP, tamaño máximo de cuerpo, máximo 50 documentos | El límite es en memoria y por IP | Tasa de 429 |
| T10 | Denegación | Quedarse sin XLM para pagar comisiones | Comisión de 0,00001 XLM por sello | Aviso de saldo bajo | Saldo de la cuenta que paga la comisión |
| T11 | Elevación | Quien cargó documentos aprueba su propio lote | Cuatro ojos: el servidor niega si todas las firmas son de quienes cargaron | Que `cargadoPor` sea la identidad de la sesión y no texto libre | Contar rechazos "Cuatro ojos" |
| T12 | Elevación | Sellar algo en rojo | El lote solo incluye verdes y amarillos; la prueba obligatoria verifica que lo rojo nunca llega al envío | — | Prueba automática en CI |
| T13 | Integridad de la prueba | La red pierde el historial | El archivo del lote guarda el sobre firmado y la hora del ledger | El archivo hay que conservarlo | Recordatorio de descarga |
| T14 | Cadena de suministro | Dependencia vulnerable | `npm audit` en CI | Fijar versiones y revisar actualizaciones | Resultado semanal de la auditoría |

## Plan de monitoreo mínimo (a implementar en el sprint)
1. **Cuenta de sellado:** vigilar con el servicio de eventos de Horizon/RPC cualquier operación que no sea el pago de sello, y cualquier cambio de firmantes o umbrales.
2. **Firmantes:** registrar cada firma (cuenta, identidad, hora, huella) y avisar de horarios fuera de lo habitual.
3. **Servidor:** tasa de 401/403/429, errores de red de Stellar y tiempo de confirmación.
4. **Saldo:** aviso cuando la cuenta que paga comisiones baje de un mínimo.

## Lo que este documento no cubre
Mainnet, dinero real, auditoría de terceros, ataques físicos a las billeteras y los riesgos legales de firma electrónica (ver `docs/` de negocio).
