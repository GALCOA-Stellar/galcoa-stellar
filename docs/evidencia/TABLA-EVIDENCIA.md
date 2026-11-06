# Tabla de evidencia: qué afirmamos, cómo se prueba y qué límite tiene

Fecha de medición: 06/11/2026 (Stellar testnet). Cada afirmación del formulario apunta a una prueba que se puede abrir. Si algo no está probado, figura como siguiente hito.

| Afirmación | Prueba | Dónde verla | Límite |
|---|---|---|---|
| Hay 2 contratos desplegados en testnet (registro y custodia) | Contratos públicos en el explorador | [Registro](https://stellar.expert/explorer/testnet/contract/CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV) · [Custodia](https://stellar.expert/explorer/testnet/contract/CASLCSQ3QYDJBPVLQS275HMMDDWJSNUQDS3Q7ES36ZPQWWADPRTID5G6) | Sin auditoría externa. Testnet puede reiniciarse |
| 12 lotes registrados con cuentas distintas | Un evento `lote_registrado` por lote; transacciones en el informe | `docs/evidencia/EVIDENCIA-8435d44b.md` · [guía de `getEvents`](https://galcoa-stellar.vercel.app/spec#eventos) | Datos de prueba, no de empresas reales |
| El contrato exige la autorización de dos cuentas distintas | Pruebas nativas del contrato y registro con cuentas nuevas en testnet | `scripts/criterios-de-exito.mjs` y el informe | Son cuentas, no personas: la prueba con dos personas reales y dos billeteras es el siguiente hito |
| 5 verificaciones con el verificador independiente | Paquete aparte que recalcula la huella y consulta al contrato; un comprobante alterado no verifica | [Guía](https://galcoa-stellar.vercel.app/spec) · informe de evidencia | Hechas por el equipo; en el sprint se suman al menos 3 verificaciones de personas ajenas |
| 2 flujos de custodia completos (pago de prueba liberado; lote revocado sin pago y con reembolso) | Transacciones de depósito, liberación, revocación y reembolso; eventos `depositado`, `liberado`, `reembolsado` | [Pantalla de custodia](https://galcoa-stellar.vercel.app/custodia) · informe de evidencia | Activo de prueba, sin dinero real. La pantalla solo lee de la red |
| Un tercero puede leer estado y eventos sin nuestra infraestructura | Cualquier nodo RPC de Stellar responde `getEvents` y la lectura del contrato | [Guía](https://galcoa-stellar.vercel.app/spec#eventos) | La página web de verificación sí pasa por nuestro servidor; la vía independiente es el paquete más un nodo |
| Solo huellas, estados, cuentas y eventos en cadena | Revisión del contrato y del formato del comprobante | [Especificación](https://galcoa-stellar.vercel.app/spec) | La validación previa (reglas y una persona) ocurre fuera de cadena; el contrato la vuelve portable y verificable |
| El problema aparece en dos roles distintos | Dos entrevistas con permiso para citar sin nombre | `docs/evidencia/ENTREVISTAS-RESUMEN.md` | Base inicial: en el sprint se suman al menos 10 entrevistas más (meta: 20). Los pagos atrasados quedan como hipótesis a probar |

**Cómo encuadramos el proyecto:** comprobantes comerciales portables, verificables por terceros y que habilitan una consecuencia económica sobre un estado público compartido.

**Visión (no es capacidad actual):** pymes distribuidoras del NEA con un historial verificable que las marcas piden para representarlas; después del sprint, camino a mainnet, pagos reales y anclas (SEP-24/31).
