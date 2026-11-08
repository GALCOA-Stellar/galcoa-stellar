# Cobertura de pruebas

Medida el 08/11/2026 con `npm run cobertura` (Vitest con cobertura V8) sobre la lógica de `src/lib`. Las pantallas (`src/app`) se prueban de punta a punta con Playwright (`npm run e2e`) y no entran en este número.

**Resultado:** 382 pruebas pasan (1 omitida) en 44 archivos.

| Medida | Resultado |
|---|---|
| Líneas | 80,2 % (1221 de 1522) |
| Sentencias | 77,3 % (1663 de 2150) |
| Ramas | 75,7 % (1153 de 1523) |
| Funciones | 84,7 % (364 de 430) |

## Por capa

*(La tabla por capa se midió con 362 pruebas; el total de arriba es el actual.)*

| Capa (`src/lib/…`) | Qué hace | Líneas | Ramas |
|---|---|---|---|
| `dominio` | Reglas, codificación, árbol de Merkle, evidencia | 97,7 % | 93,0 % |
| `datos` | Almacén, rondas, privacidad, cupos | 97,5 % | 86,9 % |
| `agentes` | Registrador, verificador, peritos, evaluación | 96,9 % | 86,9 % |
| `aplicacion` | Casos de uso (sellar un lote, evidencia) | 100 % | 96,2 % |
| `servidor` | Límite de pedidos, guardas, registro | 95,3 % | 77,6 % |
| `config` | Identificadores canónicos | 84,6 % | — |
| `stellar` | Cliente de red, firma, contrato | **44,9 %** | 45,9 % |

## Lo que esta cifra no dice

- **La capa `stellar` está poco cubierta por pruebas unitarias a propósito:** habla con la red de prueba, y se verifica con los scripts de integración (`npm run e2e-2de2`, `scripts/probar-escrow.mjs`) y con las pruebas de los contratos en Rust (`cargo test`, 14 del registro y 18 de la custodia), que no entran en este porcentaje.
- Una cobertura alta no prueba que no haya errores: mide qué líneas se ejecutaron en las pruebas, no si las pruebas son buenas.
- Las reglas tienen además un examen propio con casos de respuesta conocida y huella aprobada (`evals/reglas`).

## Cómo repetirlo

```bash
npm ci
npm run cobertura
```
