# Qué se avanzó durante el evento (track Scale)

**Resumen en una línea:** llegamos con un prototipo de verificación de datos en Stellar Testnet y durante el evento sumamos la custodia v4 desplegada, agentes probados con modelos reales, evidencia de fotos y voz, confirmación por enlace, validación de pedidos y una prueba de que el código desplegado es el de este repositorio.

Todo corre en **Testnet** con activos de prueba, sin auditoría externa ni dinero real.

## Con qué llegamos (antes del inicio)
- Dos contratos Soroban en Testnet: `registro-lotes` (tres firmas, vigencia y revocación) y `escrow-entrega` (paga solo si el lote existe).
- Aplicación web con verificador público, historial, pantalla de custodia, comprobante en PDF y firma con billetera.
- Dos agentes de IA probados solo con proveedores simulados, reglas deterministas con ID, pruebas automáticas y un modelo de amenazas.
- Dos entrevistas (interés declarado, no validación de mercado).

## Qué se sumó durante el evento
| Avance | Dónde verlo |
|---|---|
| **Custodia v4 desplegada:** una entrega respalda un solo pago y no se deposita contra una entrega ya verificada | `contracts/escrow-entrega/`, [contrato en el explorador](https://stellar.expert/explorer/testnet/contract/CDLP7XWLU6QU6JA6O4RCYPGKRA5UHQTHAAM7PYRGM5EWWJNLCK4T5GAX) |
| **El código desplegado coincide con el del repositorio** (huella del WASM comparada en la integración continua) | [`CODIGO-DESPLEGADO.md`](CODIGO-DESPLEGADO.md), `scripts/comprobar-wasm.mjs` |
| **Agentes probados con modelos reales** (dos proveedores distintos), con respaldo automático entre modelos | `src/lib/agentes/`, `evals/agentes/` |
| **Procedencia de cada dato:** el modelo cita el fragmento exacto del mensaje y el código comprueba que exista (`ALC-PRO-01`) | `src/lib/dominio/procedencia.ts`, `tests/procedencia.test.ts` |
| **Defensa contra órdenes escondidas en el texto** (`ALC-INY-01`) y conjunto nuevo de engaños para medirla | `src/lib/dominio/inyeccion.ts`, `evals/agentes/` |
| **Evidencia de fotos y voz** (metadatos, marcas de IA, frase al azar y peritos que solo pueden frenar) | `/evidencia`, reglas `ALC-FOT-01`, `ALC-MED-01`, `ALC-VOZ-01` a `04`, `ALC-EVI-01` |
| **Confirmación por enlace de WhatsApp**, sin billetera, y rondas con un enlace privado por participante | `/confirmar`, `/rondas`, `src/lib/datos/ronda.ts` |
| **Enlace público por lote** con el estado leído directo del contrato y QR | `/lote/[id]` |
| **Validación de los pedidos de la API con Zod** y errores públicos tipados | `src/lib/dominio/esquemas.ts`, `src/lib/servidor/guardas.ts` |
| **Examen de reglas congelado por huella**: cambiar una regla exige la aprobación de una persona | `evals/reglas/`, `npm run aprobar-reglas` |
| **Arquitectura en capas vigilada por un test**; archivos del servidor marcados `server-only` | `tests/limites-de-arquitectura.test.ts` |
| **Pruebas:** 382 automáticas, 80,2 % de las líneas cubiertas, pruebas de propiedades de la huella e integración continua | [`COBERTURA.md`](COBERTURA.md), `tests/` |
| **Extensión de navegador (esqueleto en construcción):** en una página de `localhost` marca cada campo de una entrega en verde, amarillo o rojo con el mismo motor de reglas. No tiene permisos ni pedidos de red, y todavía no es una versión terminada ni está publicada | `extension/`, `tests/extension-campos.test.ts` |
| **Interfaz en español e inglés**, tema claro y oscuro, ícono e imagen para compartir | `src/app/`, `src/lib/i18n/` |
| **Licencia Apache-2.0** y guías para quien colabore (`AGENTS.md`, `design.md`) | `LICENSE`, [ADR 0011](../adr/0011-licencia-apache-2.md) |
| **Tres entrevistas** con permiso para citar con nombre | [`INTERVIEWS-SUMMARY.md`](INTERVIEWS-SUMMARY.md) |

## Cómo lo medimos
- En el repositorio de trabajo, desde el tag `kickoff` hasta hoy: 153 commits y 322 archivos cambiados (`git log kickoff..main`, `git diff kickoff..main --shortstat`). Este repositorio público es una copia curada con un historial reescrito, así que esa comparación solo se puede repetir en el de trabajo.
- Los dos contratos, sus identificadores y la fecha de despliegue están en [`src/lib/config/contratos.ts`](../../src/lib/config/contratos.ts) y [`docs/arquitectura/DESPLIEGUE.md`](../arquitectura/DESPLIEGUE.md).

## Límites
- Solo Testnet; no hay usuarios reales ni piloto todavía. Las entrevistas son interés declarado.
- Sin auditoría externa. La cuenta del servicio es una sola clave (la multifirma está planificada).
- La firma desde un celular real todavía no se probó de punta a punta.
- Las reglas son de demostración.
