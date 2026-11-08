# Cómo trabajar en este repositorio

## Ramas y cambios
- `main` siempre debe estar verde (pruebas, tipos y build). No se sube directo código roto.
- Cada cambio va en una rama corta (`fix/…`, `feat/…`, `docs/…`) y se integra con un pull request.
- Un pull request cuenta qué cambió y por qué, y qué prueba lo respalda.

## Antes de pedir revisión
```bash
npm test && npm run lint && npm run typecheck && npm run build
node scripts/revisar-enlaces.mjs      # si tocaste documentos
cargo test --manifest-path contracts/registro-lotes/Cargo.toml   # si tocaste contratos
```
Las pruebas de `contracts/escrow-entrega` solo enlazan en Linux: las corre el CI.

## Mensajes de commit
Frase corta en imperativo, en español, que diga el qué: `Corrige la renovación de la instancia al revocar`.

## Reglas que no se rompen
- Las reglas en código deciden el veredicto; la IA no.
- Lo rojo nunca se sella. Quien carga un dato no lo aprueba.
- Solo testnet. Claves y secretos solo en variables de entorno (`.env.local`), nunca en git.
- A la red solo van huellas, nunca datos personales.
- Si cambian los contratos desplegados, actualizar IDs en el código, el README y la documentación de evidencia.

## Seguridad
Ver [`SECURITY.md`](SECURITY.md). Un hallazgo de seguridad se reporta en privado al equipo, no en un issue público.

## Licencia
Todavía sin licencia abierta: todos los derechos reservados hasta que el equipo decida (ver `docs/adr/`).

## Revisión automática antes de cada commit
`npm install` activa un control (`.githooks/pre-commit`) que corre `lint`, `typecheck` y `test`, y frena si hay un archivo `.env` en el commit. Si falla, el commit no se hace: arreglá lo que muestra y repetí.
