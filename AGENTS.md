# AGENTS.md — guía rápida para quien (o qué herramienta de IA) trabaje en este repo

**English summary.** GALCOA+ on Stellar is a Testnet prototype: rules in code decide whether a data batch is anchored, AI agents can only propose or stop, and only a 32-byte fingerprint per batch goes on-chain. Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run build` before any pull request. Never commit secrets; Testnet only.

## Qué es
Prototipo en Stellar Testnet. Un contrato **registro** (`contracts/registro-lotes`) define si un lote vale y exige tres firmas; una **custodia** (`contracts/escrow-entrega`) paga solo si el registro dice que el lote existe. Dos agentes de IA preparan el dato; las reglas en código (`src/lib/dominio/rules.ts`) deciden el veredicto y una persona confirma. Contexto completo: [README](README.md), [arquitectura](docs/arquitectura/ARQUITECTURA.md) y [fuente de verdad](docs/producto/FUENTE-DE-VERDAD.md).

## Comandos
```bash
npm ci                # instalar
npm run dev           # servidor local en el puerto 4180
npm test              # pruebas
npm run cobertura     # pruebas con cobertura (ver docs/evidencia/COBERTURA.md)
npm run lint          # Biome
npm run typecheck     # TypeScript
npm run build         # compilar el sitio
cargo test --manifest-path contracts/registro-lotes/Cargo.toml   # contratos
```

## Reglas que no se rompen
1. **La IA no decide el veredicto.** Lo deciden reglas en código. El verificador solo puede bajar un veredicto, nunca subirlo.
2. **Tres estados:** verde (se ancla), amarillo (se ancla marcado como declarado), rojo (no se ancla jamás). `sellarLote` vuelve a evaluar todo él mismo.
3. **A Stellar solo van huellas**, nunca datos personales ni documentos.
4. **Solo Testnet.** Nada de dinero real ni de la red principal.
5. **Claves y secretos solo en variables de entorno** (`.env.local`, nunca en git ni en los registros). Hay una prueba y un chequeo de CI que buscan claves.
6. **Los identificadores de contratos y cuentas viven solo en `src/lib/config/contratos.ts`**; una prueba controla que los documentos coincidan.
7. **Cada regla tiene un ID (`ALC-…`)** y cada comprobante guarda la versión de reglas. Si cambia una regla o un caso del examen, hay que re-aprobar la huella (`npm run aprobar-reglas`) con nombre de una persona y un motivo.
8. **Cada dato que propone el modelo trae una cita textual del mensaje** (`ALC-PRO-01`, `src/lib/dominio/procedencia.ts`): el código comprueba que la cita esté de verdad en la fuente.
9. **Los pedidos de la API se validan con Zod** (`src/lib/dominio/esquemas.ts` y `leerCuerpo` en `src/lib/servidor/guardas.ts`) antes de tocar nada.
10. **Los servidores asignan quién cargó, quién confirmó y la fecha**; los modelos nunca.

## Estructura de `src/lib` (cada capa solo usa las de su lista)
`dominio` (reglas, codificación, Merkle; no depende de nada) · `agentes` y `documentos` (usan `dominio`) · `servidor` (usa `datos`) · `datos` (usa `dominio`, `servidor`, `stellar`) · `stellar` (usa `dominio`, `servidor`, `config`) · `aplicacion` (casos de uso). Una prueba (`tests/limites-de-arquitectura.test.ts`) falla si se cruza una raya. Los archivos del servidor llevan `import "server-only"` para que no lleguen al navegador.

## Lenguaje de la interfaz y los documentos
Identidad visual y de textos: [design.md](design.md).
Decir "verificación de datos con fuente"; nunca "cumple", "está validado" ni "certificado". Firma **electrónica**, no digital. Decir siempre el estado real: es un prototipo y las reglas son de demostración. No implicar aval de la Stellar Development Foundation ni usar sus logos.

## Antes de abrir una pull request
`npm test`, `npm run lint`, `npm run typecheck` y `npm run build` tienen que pasar. Probá comportamiento visible, no detalles internos. Un requisito nuevo lleva ID en el SRS (`docs/producto/SRS.md`) y una prueba.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
