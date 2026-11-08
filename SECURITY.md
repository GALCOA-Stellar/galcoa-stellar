# Seguridad

Prototipo en **Stellar testnet**: sin dinero real, sin datos personales en la red.

## Medidas aplicadas
- ninguna clave en el código ni en el historial; `.env*` fuera de git (solo `.env.example` vacío).
- Una cuenta de **testnet** dedicada; la clave vive solo en variables de entorno. La red no es configurable desde afuera.
- Sellar exige **firma de una cuenta autorizada** (SEP-53) sobre la huella exacta del lote; sin lista `CUENTAS_AUTORIZADAS` ni `DESAFIO_SECRETO` en producción, nadie puede sellar. El mensaje vence a los 5 minutos y no se reutiliza (mejor esfuerzo en servidor sin estado). La firma prueba que una cuenta firmó, no quién es la persona.
- Límite de pedidos, cuerpo acotado (100 KB), máximo 50 documentos, rechazo de pedidos de otro sitio, errores sin detalles internos.
- Cabeceras: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- CI en cada cambio: tipos, pruebas, compilación y `npm audit` de dependencias de producción.
- Alertas de dependencias y actualizaciones de seguridad de GitHub activadas.

## Lo que falta o conviene mejorar
- Política de contenido (CSP) con valores únicos por pedido.
- Límite de pedidos distribuido (el actual es "mejor esfuerzo" en un servidor sin estado).
- Escáner de secretos y revisión de acciones de CI por huella (hoy van fijadas por versión mayor).
- Autenticación real de usuarios y firma electrónica (del GALCOA completo).
- Revisión por un especialista antes de cualquier uso fuera de la testnet.

## Cómo reportar un problema
Avisar en privado al equipo; no abrir incidencias públicas con datos sensibles.
