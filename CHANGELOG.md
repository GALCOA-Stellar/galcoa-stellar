# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Prototipo en testnet; las reglas son de demostración.

## [Sin publicar] - 2026-11-06

### Agregado (07/11/2026)
- Registrador v3 y verificador v3: una entrega sin datos se frena en rojo; el campo `hoy` ya no genera falsos positivos. Evaluación real de 43 casos: detección 100 %, falsos positivos 0 %. Custodia nueva con tope de plazo desplegada en testnet.

### Agregado (06/11/2026)
- Custodia v4 (06/11/2026): una huella respalda un solo trato y no se deposita contra una entrega ya verificada; 22 pruebas en Rust y flujo completo probado en Testnet. Ver docs/arquitectura/DESPLIEGUE.md.
- Dos agentes de IA (registrador y verificador) y chat `/agentes`: proponen y frenan; las reglas deciden (ADR 0009). 18 pruebas con proveedores simulados.
- Documentación reordenada en carpetas, `docs/en/` en inglés, README por contrato, `CONTRIBUTING.md`, plantillas de GitHub y D6 "listos para dinero real" en el plan del sprint (ADR 0008).

### Corregido
- La vida de la instancia (donde viven la cuenta del servicio, la dirección del registro y la administración) se renueva ahora en todas las rutas públicas de `registro-lotes` (`registrar`, `revocar`, `renovar`) y de `escrow-entrega` (`depositar`, `liberar`, `reembolsar`). Nueva función `renovar_instancia` en el registro.
- Se precisó que, tras revocar un lote, el reembolso al pagador corre al vencer el plazo del trato.

### Cambiado
- Contratos redesplegados en testnet; la app, las variables de Vercel, los scripts y los documentos apuntan a los nuevos (ver README). La lógica de negocio no cambia. Los anteriores quedan como historial de prueba.
- El CI corre las pruebas de ambos contratos (14 del registro y 18 de la custodia).

## [0.1.0] - 2026-11-05

Primera versión del prototipo (todos los commits son del 05/11/2026).

### Agregado
- **Escrow de entrega (prototipo de testnet)** `contracts/escrow-entrega` + `scripts/probar-escrow.mjs`: el pagador deja un asset de prueba en custodia; se libera solo si el registro tiene la huella vigente; reembolso tras el vencimiento; un lote revocado no se paga. Probado en testnet de punta a punta (8 pruebas nativas y 17 verificaciones en la red). Sin dinero real.
- **Registro v2:** revocación auditable (motivo, quién, cuándo), eventos con `#[contractevent]`, y el verificador distingue vigente / revocado / archivado / no figura.
- **Contrato con cuenta de servicio (hallazgo #2):** `registrar` exige la autorización del servicio además de cargador y aprobador; sin ella nadie registra una huella con cuentas propias. Redesplegado en testnet (contrato anterior, ya reemplazado); la instancia renueva su vida con cada registro. e2e verificado.
- Primeras funciones de la app: **confirmación del comercio por enlace o QR sin cuenta** (un solo uso, vence a los 7 días, el comercio solo ve lo que le toca), **constancia en PDF por documento** con logo, tabla de datos, semáforo y QR a la transacción, **historial de operaciones selladas** (protegido por sesión) y la identidad visual (logo, Manrope + IBM Plex Mono, azul noche, botón amarillo, esquinas rectas).
- Datos personales (Ley 25.326): página `/privacidad`, botones "Descargar mis datos" y "Borrar mis datos" (por persona, con sesión), borrado de una operación del historial, plazo de conservación (12 meses por defecto, `DIAS_CONSERVACION`; confirmaciones 30 días tras vencer el enlace) y registro de borrados sin datos personales. Es un borrador técnico, no reemplaza a un abogado.
- Un reintento no sella dos veces: si el lote (misma huella) ya se selló o hay un envío en curso, responde 409 con la transacción original y no paga otra comisión. Los bloqueos viejos vencen a los 10 minutos.
- Política de contenido (CSP) con nonce por pedido en producción (`src/proxy.ts`): los scripts solo corren con el nonce del pedido. `/api/health` y vigilante externo opcional (`.github/workflows/vigilancia.yml`, solo corre si existe la variable `URL_SALUD`).
- Batería de intrusión (`npm run build && npm run intrusion`): 36 ataques reales contra la app compilada (sesiones falsas, CSRF, path traversal, enlaces reutilizados, comprobantes armados a mano, cuerpos enormes, ráfagas…). Hoy bloquea los 36.
- Almacén de registros en archivos (`.datos/`, fuera de git; carpeta configurable con `GALCOA_DATOS`). Sirve para prototipo y piloto local; en un servidor sin disco persistente se pierde al reiniciar. La interfaz es la misma que tendría una base real (Supabase).
- Registro en el contrato `registro-lotes` con la firma de billetera de cada persona (`signAuthEntry` de Freighter): el servidor arma y simula, cada persona firma su autorización, el servidor paga y envía (`/api/contrato/preparar` y `/enviar`). Probado de punta a punta en testnet con claves descartables (una firma se rechaza, dos se registran). Sin probar todavía con una Freighter real de dos personas.
- Prototipo de verificación previa y sellado por lotes en Stellar testnet: una huella de 32 bytes por lote, árbol de Merkle y comprobante por documento (`d74b16c`).
- Reglas por atributo ALCOA+ (`ALC-COM-01`, `LEG-01`, `ATR-01`, `COH-01`, `CTE-01`, `ORI-01`, `EXA-01`), CI de pruebas y auditoría, y documentación de ingeniería: SRS, requisitos de dato y tablero (`8ca3097`).
- Pantalla "qué se sella" (vista previa sin red), archivo del lote con prueba guardada y verificación sin red (`954f57d`).
- Acceso por firma de cuenta (SEP-53) con lista de cuentas autorizadas (`CUENTAS_AUTORIZADAS`) y secreto de desafío (`DESAFIO_SECRETO`) (`39b347c`).
- Hoja de consulta de Stellar y referencia en `CLAUDE.md` (`c39aeb5`).

- Cuatro ojos completo: el sello se niega (403) si quien aprueba cargó algún documento del lote; la identidad de la cuenta sale de `CUENTAS_AUTORIZADAS` (`G...=id`).
- Verificador público en `/verificar` y `stellar.toml` (SEP-1) en `/.well-known/stellar.toml`.

- **Sello con aprobación 2 de 2 (D1 del plan de sprint):** `/api/sello-2de2/preparar` y `/enviar`; la cuenta de sellado exige dos firmas en la red, el servidor revisa contenido, vigencia, dos personas distintas y cuatro ojos, y paga la comisión con fee-bump. Pantalla en pasos con Freighter, `npm run configurar-2de2` y `npm run e2e-2de2` (probado en testnet de punta a punta; 57 pruebas).
- **Sesión por firma de cuenta (D2, parte 1):** `/api/sesion` emite el mensaje, verifica la firma y devuelve un pase firmado (8 h) con la identidad; el archivo del lote 2 de 2 nombra a quienes firmaron (`personas`) y a quienes cargaron (`cargaron`). 59 pruebas. Falta: usar el pase para fijar `cargadoPor` y la pantalla de ingreso.
- **D3:** `docs/arquitectura/ESPECIFICACION-COMPROBANTE.md` y paquete `packages/galcoa-comprobante` (MIT, sin dependencias, sin publicar). **D5:** guía de piloto y 50 remitos con errores sembrados. 63 pruebas.
- Modo demostración (`MODO_DEMO=1`, solo local), carga de remitos desde planilla CSV, arranque rápido en el README y nota de investigación del Protocolo 30. 65 pruebas; e2e verificado en testnet con Protocolo 30.
- Comparación medida de opciones de integración (memo, datos de cuenta, contrato) en `OPCIONES-DE-INTEGRACION.md` y `comparar-opciones-integracion.mjs`.
- **Contrato conectado:** el verificador consulta `registro-lotes` y muestra quién cargó y quién aprobó; en modo demostración la pantalla registra el lote en el contrato (`/api/contrato/registrar`). Verificado de punta a punta en testnet (`npm run e2e-2de2`, pasos 7 y 8). Con billeteras reales falta que cada persona firme su autorización con `signAuthEntry`.
- **Pantalla renovada:** 4 pasos (Cargar, Revisar, Firmar, Prueba), 2 de 2 como camino principal, estados con ícono y texto, firmas de a dos, mensajes de error visibles, verificador con 3 puntos claros.
- Scripts de prueba en testnet: multifirma 2 de 2 (`prueba-multifirma.mjs`) y lote contra uno por uno (`medir-lote-vs-individual.mjs`).

### Cambiado
- El acceso para sellar pasa del código compartido a la firma de una cuenta autorizada (`39b347c`).

### Documentación
- Guía de Stellar ampliada en las secciones 21 a 31: explorador y Lendwise, fundamentos oficiales, LumAgg, SAFU, ROZO MPP Router, síntesis con agentes gratis, Lend, Trustless Work, Dig, billeteras de hardware y firma (`29fdde7` a `1ff8901`).
- README, MVP, índice de documentación y tablero actualizados al estado real.

### Seguridad
- Límites de pedidos, cuerpo acotado, máximo de 50 documentos por lote y cabeceras de seguridad; solo testnet.

## 06/11/2026 (tarde)
- Textos de la pantalla: Freighter pasa a Varial (antes Freighter); el paquete npm no cambia hasta ver la doc oficial.
- `.mcp.json`: Raven apunta a raven.stellar.org.
- Nuevo `docs/arquitectura/DECISIONES-ANCLAS-INTEROPERABILIDAD.md` (decisiones, antecedente Nirium, preguntas abiertas).
- Paquete de la billetera: `@stellar/freighter-api` reemplazado por `@stellar/varial-sdk@7.0.0` (mismo API; compila y 108 tests en verde).

## 06/11/2026 (noche)
- **Comprobante v2** (`src/lib/dominio/codificacion.ts`): codificación con orden fijo, marcas de tipo, texto NFC, prefijo de dominio y rechazo de campos desconocidos. Los v1 ya emitidos se siguen verificando. Vectores de prueba generados con una implementación independiente en Python (`scripts/generar-vectores-v2.py`, `docs/vectores/comprobante-v2.json`). Paquete `galcoa-comprobante` 0.2.0. Ver `docs/arquitectura/ESPECIFICACION-COMPROBANTE-V2.md`. Idea tomada de Lafiya (MIT).
- **Escrow v2** (contrato anterior, ya reemplazado): historial de cada trato (solo se agrega), regla de agregar claves de almacenamiento solo al final, pausa de depósitos nuevos por un administrador (liberar y reembolsar siguen funcionando), reembolso ejecutable por cualquiera tras el vencimiento (ya era así; ahora con test). No tiene `upgrade`: el código no se puede cambiar. 13 tests nativos; 24 chequeos en testnet.
- 125 tests de la app en verde.
- **Cupo diario de sellos por cuenta** (`src/lib/datos/cupos.ts`, variable `CUPO_DIARIO`, por defecto 20): el servicio paga las comisiones, así que cada cuenta autorizada tiene un tope por día UTC en `sellar-lote` y `sello-2de2/enviar`. Atómico (una casilla por sello). 5 tests nuevos; 130 en total.
- `stellar.toml`: describe el formato v2 del comprobante.
- **Escrow v3** (contrato anterior, ya reemplazado): el administrador y la pausa ahora usan las piezas auditadas de OpenZeppelin (`stellar-access` y `stellar-contract-utils` 0.8.0, MIT, versión fija). Nuevo: el administrador se transfiere **en dos pasos con vencimiento** (`transferir_administracion` y `aceptar_administracion`). 17 tests nativos. Compilado: 12.318 bytes.
  - Probado en testnet: 31 chequeos (pago, reembolso, revocación, historial, pausa y transferencia de administrador en dos pasos). Nota Windows: esas librerías declaran `cdylib`, que no enlaza con la herramienta de Windows que usamos. Para probar en Windows se usan copias locales con `crate-type = ["lib"]` en `contracts/escrow-entrega/.parches-locales/` (ignoradas por git), activadas con `cargo test --config "patch.crates-io.stellar-access.path='.parches-locales/stellar-access'" --config "patch.crates-io.stellar-contract-utils.path='.parches-locales/stellar-contract-utils'"`. El contrato para la red se compila normal (`stellar contract build`).

## 2026-11-06 — Criterios de éxito
- `scripts/criterios-de-exito.mjs`: corrida en testnet (12 lotes, 36 comprobantes v2, 5 verificaciones de tercero, 2 flujos de escrow). Informe en `docs/evidencia/`.
