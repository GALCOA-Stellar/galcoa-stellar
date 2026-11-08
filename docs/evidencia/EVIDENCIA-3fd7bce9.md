# Evidencia de criterios de éxito (corrida 3fd7bce9)

Fecha: 2026-11-08T21:55:44.304Z. Red: testnet. Datos de prueba generados por el guion: no son datos reales de ninguna empresa. Testnet, sin dinero real.

- Contrato de registro: `CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV`
- Contrato de escrow: `CDLP7XWLU6QU6JA6O4RCYPGKRA5UHQTHAAM7PYRGM5EWWJNLCK4T5GAX`

| Criterio | Objetivo | Resultado |
|---|---|---|
| Lotes registrados | 10 a 20 | 3 ✔ |
| Comprobantes emitidos (v2) | uno por documento | 9 ✔ |
| Verificados por un tercero, sin el servidor | al menos 3 | 3 ✔ |
| Escrow de punta a punta | 1 a 2 flujos | 2 ✔ |

Comisión promedio de registrar un lote (testnet): 200509 stroops.

## Lotes registrados
- Lote 1: ledger 5630269, [transacción](https://stellar.expert/explorer/testnet/tx/47fb8f75950da0d4d1faa3e969c02c8dc786bcdc70498e81adafa05e2ce19873), huella `722046ba201846c0…`
- Lote 2: ledger 5630273, [transacción](https://stellar.expert/explorer/testnet/tx/308aaa0bd6d5bbecd977b732ca89fb3e199c6cfa094c9d9216228f28a95b82b7), huella `57b1e328635be3f2…`
- Lote 3: ledger 5630276, [transacción](https://stellar.expert/explorer/testnet/tx/a0eca68aec441bb57c51990f32856062a5b3397ec38ad52541d1ed459e48961c), huella `1bf922924aa4e869…`

## Flujos de escrow
- Flujo 1 (Pago liberado por lote verificado): ✔ [txDeposito](https://stellar.expert/explorer/testnet/tx/e5b6b53ecfdf3af9773dec0012a199eef6f468f32a37f0d511c5f9fbd35acf43), [txLiberacion](https://stellar.expert/explorer/testnet/tx/c880d68b8a1057ad819333c3eb185cde9fcd1256db8d482f718d16e5184ed0ab)
- Flujo 2 (Lote revocado: sin pago y reembolso al vencer): ✔ [txRevocacion](https://stellar.expert/explorer/testnet/tx/661dfa6f466240f11fac41a91e61d91c1010b77e0899f96678a4d2a92166eaa5), [txReembolso](https://stellar.expert/explorer/testnet/tx/b7cf66db9feab5276b6aaa485b54c6f05ad018f1fd248a8c99b5e95164566686)

## Límites
- Los lotes son de prueba, generados por el guion; no son datos de ninguna empresa.
- El tercero es el paquete independiente más un nodo público; lo verificó el mismo equipo, no una persona ajena.
- Costos de testnet; no equivalen a mainnet. La testnet se reinicia: guardar este archivo y capturas del explorador.
