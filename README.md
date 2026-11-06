# GALCOA+ en Stellar (prototipo)

[English version](README.en.md)

Verifica los datos de entregas entre empresas **antes** de anclarlos y deja en **Stellar testnet** una sola huella de 32 bytes por lote. Lo que requiere revisión (rojo) no se ancla nunca.
Cada documento recibe un comprobante para verificarse solo. Es "verificación de datos con fuente": la IA no decide el veredicto, lo deciden reglas en código y una persona revisa lo rojo.

## Estado (honesto)
- **Prototipo en testnet**: sin dinero real, sin red principal, sin datos personales en la red.
- Las reglas son **de demostración** (`reglas-demo-0.2`): sirven para mostrar el principio, no reemplazan al motor completo de GALCOA.
- Repositorio privado. Fuente de verdad: [`docs/FUENTE-DE-VERDAD.md`](docs/FUENTE-DE-VERDAD.md).

## Despliegue canónico en Testnet (06/11/2026)
- `registro-lotes`: `CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV`
- `escrow-entrega`: `CASLCSQ3QYDJBPVLQS275HMMDDWJSNUQDS3Q7ES36ZPQWWADPRTID5G6` (fija ese registro al crearse)
- Cuenta del servicio (registro) y administradora (custodia): `GCRTRAAGPQJSP444J5QSIBM5MILRUI4XKL36Z4UW7OEE43TAC6X3EI3Y`
- **Motivo del redeploy:** la vida de la instancia (donde viven la cuenta del servicio y las direcciones fijadas) ahora se renueva en todas las operaciones públicas, más pruebas nuevas. La lógica de negocio no cambió. Los contratos anteriores quedan como historial de prueba y no son la referencia.
- **Semántica:** `existe(huella)` significa "registrada y vigente"; una huella revocada sigue en el historial (`obtener`, eventos) pero `existe` da falso. La custodia libera solo con la huella vigente; si se revoca, no paga y el depósito vuelve al pagador al vencer el plazo. `renovar` solo extiende la vida del dato, sin cambiar su contenido.
- **Fuente de verdad:** el estado y los eventos de esos contratos en la red. La web es una comodidad.

## Cómo funciona
1. Se cargan las entregas y las reglas (`src/lib/rules.ts`) dan a cada una verde, amarillo (declarado) o rojo (requiere revisión).
2. La vista previa "qué se sella" muestra qué entra al lote y qué queda afuera, sin tocar la red.
3. Una cuenta autorizada **firma electrónicamente** (SEP-53, con Varial, la billetera antes llamada Freighter) la huella exacta del lote.
4. El servidor vuelve a evaluar todo, arma el árbol de Merkle y envía **una** transacción con la huella de 32 bytes en el memo. Si solo hay rojos, no llama a la red.
5. Se descarga el archivo del lote con un comprobante por documento (con la prueba guardada). Cualquiera lo verifica: recalcula la huella y la compara con la red, o sin red con la prueba guardada.

## Contratos y custodia de prueba (lo que corre hoy en testnet)
- **Registro** (`contracts/registro-lotes`): guarda la huella del lote y su estado (vigente o revocado). `registrar` exige la autorización de tres cuentas (el servicio, quien carga y quien aprueba) y rechaza que cargador y aprobador sean la misma persona. Emite un evento por cada registro y revocación.
- **Custodia** (`contracts/escrow-entrega`): consulta al registro (`existe`) antes de ejecutar un pago de prueba; si el lote se revoca, no se ejecuta y el depósito se reembolsa al pagador una vez vencido el plazo del trato. Emite eventos `depositado`, `liberado` y `reembolsado`.
- **Verificación independiente:** paquete `packages/galcoa-comprobante` y guía pública en `/spec`. Lecturas del estado y de los eventos en `/verificar`, `/custodia` y la portada.
- **Evidencia:** `docs/evidencia/TABLA-EVIDENCIA.md` (afirmación, prueba, link y límite) y `scripts/criterios-de-exito.mjs` (corrida reproducible en testnet).
- Hoy: testnet, activos de prueba, sin auditoría externa. Los contratos no tienen ruta de actualización: ante un error se despliega uno nuevo.

## Cómo correrlo
```bash
npm install
npm run crear-cuenta   # crea una cuenta de TESTNET y escribe .env.local (no va a git)
npm run dev            # http://localhost:4180
npm test               # pruebas automáticas (130 en la app, más las de los contratos con cargo test)
npm run typecheck
npm run build
```

### Arranque rápido (10 minutos, sin billetera)
1. `npm install` y `npm run crear-cuenta`.
2. Probar todo el flujo de punta a punta en testnet, sin tocar nada a mano: `npm run e2e-2de2` (crea cuentas descartables, levanta la app, firma con una y con dos cuentas, y verifica).
3. Para probarlo en la pantalla sin Freighter: poné `MODO_DEMO=1` y dos claves de prueba (ver `.env.example`); aparecen los botones "Firmar como cargador / aprobador". Es solo para desarrollo local; en producción se ignora.
4. Para cargar remitos desde Excel: guardalo como CSV (la primera fila con los nombres de campo) y usá "cargá una planilla".

### Contrato (Rust)
Requiere Rust, la CLI de Stellar y un enlazador (en Windows sin Visual Studio: MinGW y la cadena `stable-x86_64-pc-windows-gnu`). Desde `contracts/registro-lotes`: `stellar contract build` y `cargo test`. Prueba en testnet: `scripts/probar-contrato.mjs`. **No correr `npm run e2e-2de2` con otro `next dev` abierto en el proyecto:** Next no permite dos.

## Variables de entorno
Ver `.env.example`. Guardalas en `.env.local` o en el panel de tu hosting; nunca en git.

| Variable | Qué es |
|---|---|
| `SELLADOR_STELLAR_SECRETO` | Clave secreta (empieza con S) de una cuenta de **testnet** que paga y envía el sello. Nunca de la red principal. |
| `CUENTAS_AUTORIZADAS` | Cuentas públicas (empiezan con G, separadas por coma) autorizadas a firmar y confirmar sellos. |
| `CUENTA_SELLADORA_2DE2` | Cuenta pública que exige dos firmas en la red (`npm run configurar-2de2`). |
| `CONTRATO_REGISTRO_ID` | Contrato `registro-lotes` desplegado en testnet (C...). Si está, el verificador muestra quién cargó y quién aprobó. |
| `DESAFIO_SECRETO` | Secreto largo y aleatorio con el que el servidor firma los mensajes que emite (no es una clave de Stellar). |
| `DIAS_CONSERVACION` | (Opcional) Días que se conservan los lotes guardados antes de borrarse solos. Por defecto 365. |
| `PERMITIR_UNA_FIRMA` | (Opcional) `1` habilita en producción el modo de una sola firma, que **no puede asegurar los cuatro ojos**. Mejor dejarlo apagado. |
| `URL_SALUD` | (Variable del repositorio en GitHub, no de la app) URL de `/api/health` para el vigilante externo. |
| `GALCOA_DATOS` | (Opcional) Carpeta donde se guardan confirmaciones del comercio e historial. Por defecto `.datos/` junto a la app. Debe ser un disco que no se borre al reiniciar. |

**En producción `CUENTAS_AUTORIZADAS` y `DESAFIO_SECRETO` son obligatorias**: sin ellas, nadie puede sellar.

## Estructura de carpetas
```
.
├── README.md  CHANGELOG.md  SECURITY.md
├── .env.example
├── scripts/crear-cuenta-testnet.mjs
├── src/
│   ├── app/
│   │   ├── page.tsx, layout.tsx, globals.css   # pantalla
│   │   └── api/  desafio · previsualizar · sellar-lote · verificar
│   └── lib/
│       ├── rules.ts       # reglas ALC-... (verde/amarillo/rojo)
│       ├── lote.ts        # sellarLote, comprobantes, archivo del lote
│       ├── merkle.ts      # árbol de Merkle y caminos
│       ├── canonical.ts   # JSON canónico y SHA-256
│       ├── firma.ts       # acceso por firma SEP-53
│       ├── stellar.ts     # envío y lectura en testnet
│       └── guardas.ts     # límites y chequeos de pedidos
├── tests/nucleo.test.ts
└── docs/                  # ver docs/README.md
```

## Los 5 entregables de un desarrollo
| Entregable | Dónde está |
|---|---|
| SRS (requisitos) | [`docs/SRS.md`](docs/SRS.md) |
| Tablero | [`docs/TABLERO.md`](docs/TABLERO.md) |
| Desarrollo | [`src/`](src/) |
| MVP | [`docs/MVP.md`](docs/MVP.md) |
| Código fuente | este repositorio |

## Documentación
- [`docs/README.md`](docs/README.md) — índice completo.
- [`docs/FUENTE-DE-VERDAD.md`](docs/FUENTE-DE-VERDAD.md) — qué es, estado real, arquitectura, riesgos.
- [`docs/SRS.md`](docs/SRS.md) y [`docs/REQUISITOS-DE-DATO.md`](docs/REQUISITOS-DE-DATO.md) — requisitos y atributos ALCOA+ (enfoque GAMP 5).
- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md), [`docs/GLOSARIO.md`](docs/GLOSARIO.md), [`docs/adr/`](docs/adr/) (decisiones 0001–0006).

## Seguridad
Ver [`SECURITY.md`](SECURITY.md): firma de cuenta autorizada, límites de pedidos, cabeceras, CI con `npm audit`, solo testnet.

## Herramientas de Stellar para trabajar con IA (ya configuradas en el proyecto)
- **MCP `stellar-docs`** (`https://developers.stellar.org/mcp`): documentación oficial, sin inicio de sesión.
- **MCP `stellar-raven`** (`https://raven.stellar.buzz/mcp`): documentación + datos vivos del ecosistema. Autenticarse con `/mcp` en Claude Code.
- **Plugin `stellar-dev`** (skills de `stellar/stellar-dev-skill`): se activa solo al abrir el proyecto; si no, `/plugin marketplace add stellar/stellar-dev-skill` y `/plugin install stellar-dev@stellar-dev`. Su README admite que fue generado con IA: no es fuente última.
- **llms.txt**: `https://developers.stellar.org/llms.txt`.

Al abrir el proyecto, Claude Code pide aprobar estos servidores y el plugin: es lo esperado. Este proyecto no implica aval de la Stellar Development Foundation.
