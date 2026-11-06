# Tablero del proyecto (listo para pasar a Trello)

Columnas sugeridas. Cada tarjeta tiene "hecho cuando…". Dueños: a definir por el equipo.

## Hecho
- Reglas por atributo ALCOA+ (7 reglas de demostración) — hecho cuando: pruebas en verde.
- Lote con árbol de Merkle y una transacción en Stellar testnet — hecho cuando: transacción visible en el explorador.
- Comprobante y verificación desde la red — hecho cuando: un documento verifica y uno alterado no.
- Vista previa "qué se sella" — hecho cuando: anticipa la raíz y el memo exactos sin llamar a la red.
- Archivo del lote con prueba guardada y verificación sin red — hecho cuando: un comprobante verifica sin conexión y uno con otro memo o hash se rechaza.
- Acceso por firma de cuenta (SEP-53) en lugar del código compartido — hecho cuando: sin firma autorizada no se sella.
- Pantalla de sellado y verificación, límites y cabeceras de seguridad.
- 40 pruebas automáticas — hecho cuando: `npm test` en verde.
- SRS, requisitos de dato, fuente de verdad, guía de Stellar, hoja de consulta, MVP.
- Repositorio privado con CI de pruebas y auditoría.

## En curso / próximo
- Desplegar en Vercel con `SELLADOR_STELLAR_SECRETO`, `CUENTAS_AUTORIZADAS` y `DESAFIO_SECRETO` — hecho cuando: demo funcionando y las tres variables solo en el panel (la clave, de testnet).
- Completar la pre-inscripción de las Instawards — hecho cuando: enviada antes del cierre (domingo 8/11, 2:59 AM de Argentina).
- Capturas y video corto de la demo con la transacción — hecho cuando: guardadas antes del reinicio de testnet del 16/12/2026.
- Usuarios reales con login para cargar y confirmar (hoy son identificadores declarados) — hecho cuando: quien carga no puede confirmar y queda registrado quién fue.
- Probar un tercero con `/verificar` — hecho cuando: alguien ajeno verifica un comprobante sin ayuda del equipo.
- Probar la multifirma nativa de Stellar para el sellado — hecho cuando: una transacción de prueba exige dos firmas.

## Decisiones del equipo
- Monto a pedir y dedicación real del equipo.
- ¿x402 dentro o como cierre opcional del sprint?
- Qué parte del motor de reglas real de GALCOA se lleva a este proyecto.

## Sprint de 30 días (propuesta)
1. Motor de reglas completo con identidad y firma electrónica.
2. Multifirma nativa y publicación de la especificación abierta del comprobante.
3. Mediciones de costo, tiempo y carga por documento (lote vs. uno por uno).
4. Opcional: pago por consulta con x402 en testnet.

## Después / con consulta legal
Anclas y USDC para dinero local, pagos condicionados, cualquier uso con dinero real o red principal, posicionamiento hacia activos del mundo real.
