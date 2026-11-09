# GALCOA+ en Stellar

[English version](README.en.md)

> **Estado: prototipo en Stellar Testnet.** Foco: el remito confirmado por quien lo recibe (enlace por WhatsApp, sin billetera), con prueba verificable. Todavía sin cliente validado ni pago. Sin dinero real, sin red principal, sin auditoría externa.

## En 30 segundos
Cuando alguien ancla un dato en Stellar, la red prueba que **no cambió**; no prueba que **sea correcto**. GALCOA+ es un prototipo que revisa el dato **antes** de anclarlo:

1. Una persona carga una entrega (por ejemplo, un remito).
2. **Reglas escritas en código** le ponen un color: verde (se ancla), amarillo (declarado, se ancla marcado) o rojo (requiere revisión, **no se ancla nunca**).
3. Dos agentes de IA ayudan a ordenar el dato, pero **solo pueden proponer o frenar**: la IA nunca decide el veredicto.
4. A Stellar va solo **una huella de 32 bytes** por lote, nunca documentos ni datos personales.
5. Cualquiera puede verificar el comprobante después, sin cuenta y sin confiar en nosotros.

No prueba que la mercadería exista ni que un dato sea verdadero en el mundo: verifica coherencia, fuente, quién lo cargó y que lo declarado no cambió.

## Probalo (sin instalar nada)
- Sitio: https://galcoa-stellar.vercel.app/ · [cargar una entrega](https://galcoa-stellar.vercel.app/agentes) · [verificar un comprobante](https://galcoa-stellar.vercel.app/verificar)
- Es una demostración en red de prueba, con datos de ejemplo.
- Ruta a la red principal, con fechas: [`RUTA-A-MAINNET`](docs/producto/RUTA-A-MAINNET.md).
- Qué se avanzó durante el evento (track Scale): [`AVANCE-DURANTE-EL-EVENTO`](docs/evidencia/AVANCE-DURANTE-EL-EVENTO.md).

## Qué hay hecho y qué no
| Hay | No hay |
|---|---|
| Dos contratos Soroban en Testnet: un **registro** (exige tres firmas, una de ellas de un aprobador distinto de quien cargó) y una **custodia** de prueba que paga solo si el registro dice que el lote vale | Auditoría externa, dinero real o red principal |
| Reglas con identificador (`ALC-…`), agentes con instrucciones probadas, defensa contra órdenes escondidas en el texto | Un motor de reglas completo: las reglas son **de demostración** |
| Verificador público que falla cerrado: si la red no responde, no dice "verificado" | Usuarios reales ni demanda comprobada |
| 408 pruebas automáticas e integración continua; cobertura medida de la lógica: 80,6 % de las líneas ([detalle](docs/evidencia/COBERTURA.md)) | Firma probada desde un celular real |

## Lo que aprendimos
- Hablamos con roles de distribuidoras: el dolor de los remitos mal cargados existe, pero fue **interés declarado, no una validación**.
- Revisamos proyectos de la comunidad de Stellar para ver cómo cargan y verifican datos: la mayoría registra el dato y su huella, pero casi ninguno revisa el contenido antes. Era la brecha que queríamos probar.
- Todavía no confirmamos que alguien lo necesite lo suficiente como para pagarlo o usarlo a diario: eso es lo que vamos a medir con una marca y sus distribuidoras.

## Detalles técnicos
<details>
<summary>Despliegue en Testnet, cómo funciona, cómo correrlo y estructura</summary>

### Despliegue canónico en Testnet (06/11/2026)
- `registro-lotes`: `CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV`
- `escrow-entrega`: `CAQREI2NEMXVINPMJUPEPHBBNLW6HX3B4EJVXZLDSLMSTGRK6OKRUKIJ` (fija ese registro al crearse)
- Cuenta del servicio (registro) y administradora (custodia): `GCRTRAAGPQJSP444J5QSIBM5MILRUI4XKL36Z4UW7OEE43TAC6X3EI3Y`
- Los contratos anteriores quedan como historial de prueba y no son la referencia. La testnet se reinicia periódicamente (próxima: 16/12/2026), así que estos identificadores pueden dejar de existir.
- **Semántica:** `existe(huella)` significa "registrada y vigente"; una huella revocada sigue en el historial pero `existe` da falso. La custodia libera solo con la huella vigente; si se revoca, no paga y el depósito vuelve al pagador al vencer el plazo.
- **Fuente de verdad:** el estado y los eventos de esos contratos en la red. La web es una comodidad.
- **Comprobar que el código desplegado es el de este repositorio:** `node scripts/comprobar-wasm.mjs <registro.wasm> <escrow.wasm>` compara la huella del WASM en la red con el compilado (`stellar contract build`). La integración continua lo corre como informe en cada cambio ([resultado](docs/evidencia/CODIGO-DESPLEGADO.md)).

### Cómo funciona
0. **Carga con palabras (`/agentes`):** un agente registrador ordena lo que cuenta la persona y un agente verificador independiente lo compara con el mensaje; solo pueden proponer y frenar. Requiere claves de IA (ver `.env.example`); sin ellas queda apagado. No cargar datos reales. Decisión: [`ADR 0009`](docs/adr/0009-dos-agentes-de-ia-que-proponen-y-frenan.md).
1. Las reglas (`src/lib/dominio/rules.ts`) dan a cada entrega verde, amarillo o rojo.
2. La vista previa "qué se sella" muestra qué entra al lote y qué queda afuera, sin tocar la red.
3. Una cuenta autorizada **firma electrónicamente** (SEP-53, con la billetera Varial) la huella exacta del lote.
4. El servidor vuelve a evaluar todo, arma el árbol de Merkle y envía **una** transacción con la huella de 32 bytes en el memo. Si solo hay rojos, no llama a la red.
5. Se descarga el archivo del lote con un comprobante por documento. Cualquiera lo verifica: recalcula la huella y la compara con la red, o sin red con la prueba guardada.

### Contratos y custodia de prueba
- **Registro** (`contracts/registro-lotes`): guarda la huella del lote y su estado (vigente o revocado). `registrar` exige la autorización de tres cuentas (el servicio, quien carga y quien aprueba) y rechaza que cargador y aprobador sean la misma persona.
- **Custodia** (`contracts/escrow-entrega`): consulta al registro (`existe`) antes de ejecutar un pago de prueba; si el lote se revoca, no se ejecuta.
- **Verificación independiente:** paquete `packages/galcoa-comprobante` y guía pública en `/spec`.
- **Evidencia:** `docs/evidencia/TABLA-EVIDENCIA.md` (afirmación, prueba, link y límite).
- Hoy: testnet, activos de prueba, sin auditoría externa. Los contratos no tienen ruta de actualización: ante un error se despliega uno nuevo.

### Cómo correrlo
```bash
npm install
npm run crear-cuenta   # crea una cuenta de TESTNET y escribe .env.local (no va a git)
npm run dev            # http://localhost:4180
npm test && npm run typecheck && npm run build
```
Contratos (Rust): desde `contracts/registro-lotes`, `stellar contract build` y `cargo test`. Flujo completo en testnet sin billetera: `npm run e2e-2de2`. Las variables de entorno están en `.env.example`; las claves van en `.env.local` o en el panel del hosting, nunca en git. En producción `CUENTAS_AUTORIZADAS` y `DESAFIO_SECRETO` son obligatorias.

### Estructura
```
contracts/  Soroban (Rust): registro-lotes y escrow-entrega
packages/   galcoa-comprobante: verificador independiente
src/        app (Next.js) y lib (reglas ALC-..., Merkle, firma SEP-53, Stellar)
tests/ evals/ scripts/ public/ docs/
```

### Documentación
- [`docs/README.md`](docs/README.md): índice. [`FUENTE-DE-VERDAD`](docs/producto/FUENTE-DE-VERDAD.md): qué es, estado real y riesgos.
- [`SRS`](docs/producto/SRS.md), [`arquitectura`](docs/arquitectura/), [`decisiones (ADR)`](docs/adr/), [`tabla de evidencia`](docs/evidencia/TABLA-EVIDENCIA.md).
- Seguridad: [`SECURITY.md`](SECURITY.md). Colaborar: [`CONTRIBUTING.md`](CONTRIBUTING.md).

</details>

Licencia: [Apache-2.0](LICENSE). Proyecto independiente que usa la red Stellar; no cuenta con respaldo de la Stellar Development Foundation. Reglas de demostración, solo Testnet.
