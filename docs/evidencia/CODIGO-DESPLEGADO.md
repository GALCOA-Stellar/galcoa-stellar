# El código desplegado es el de este repositorio

Comprobado el 08/11/2026 (integración continua, [ejecución 42513239047](https://github.com/jfacundoayala/galcoa-stellar/actions/runs/42513239047)). Se compila cada contrato con `stellar contract build` (stellar-cli 30.0.1) y se compara la huella SHA-256 del WASM con la que guarda la red.

| Contrato | Identificador en Testnet | Huella del WASM | Resultado |
|---|---|---|---|
| `registro-lotes` | `CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV` | `e8707492b10cfdc91e42c5436bac75d7dfd7c4e72121cd0018a4c023d558fc8c` | **Coincide** |
| `escrow-entrega` | `CDLP7XWLU6QU6JA6O4RCYPGKRA5UHQTHAAM7PYRGM5EWWJNLCK4T5GAX` | `e19ca47a4013b4a636265929c8d0808d6b0bba21557ede66c77cd2474685012b` | **Coincide** |

**Cómo repetirlo:** compilá los dos contratos y corré `node scripts/comprobar-wasm.mjs contracts/registro-lotes/target/wasm32v1-none/release/registro_lotes.wasm contracts/escrow-entrega/target/wasm32v1-none/release/escrow_entrega.wasm`. El script lee los identificadores de `src/lib/config/contratos.ts` y la huella desplegada directamente del RPC de Testnet.

**Límites:** prueba que el binario en la red sale de este código con esta versión de la herramienta; no prueba que el código sea correcto ni seguro (no hay auditoría externa). Si se cambia un contrato y no se redespliega, el paso de CI deja de coincidir a propósito. La Testnet se reinicia periódicamente (próxima: 16/12/2026).
