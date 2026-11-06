# Evidencia de criterios de éxito (corrida 8435d44b)

Fecha: 2026-11-06T10:52:30.793Z. Red: testnet. Datos de prueba generados por el guion: no son datos reales de ninguna empresa. Testnet, sin dinero real.

- Contrato de registro: `CCNUNX6W7MPIPABZQOWOCBF46G4HDWQT6YW3OPKNT7ZGRA5MZKTRK5JV`
- Contrato de escrow: `CASLCSQ3QYDJBPVLQS275HMMDDWJSNUQDS3Q7ES36ZPQWWADPRTID5G6`

| Criterio | Objetivo | Resultado |
|---|---|---|
| Lotes registrados | 10 a 20 | 12 ✔ |
| Comprobantes emitidos (v2) | uno por documento | 36 ✔ |
| Verificados por un tercero, sin el servidor | al menos 3 | 5 ✔ |
| Escrow de punta a punta | 1 a 2 flujos | 2 ✔ |

Comisión promedio de registrar un lote (testnet): 200509 stroops.

## Lotes registrados
- Lote 1: ledger 5587752, [transacción](https://stellar.expert/explorer/testnet/tx/f33407d7bbed6a8e0ca376b42a474c810c7b6364521c677d53712196f9d0a2d4), huella `ec5dedf0b5c18380…`
- Lote 2: ledger 5587756, [transacción](https://stellar.expert/explorer/testnet/tx/076b26224caf5992e11c9e4fec887e1fbc91999edbd9037dbc719ef2c8b0d413), huella `71c697025af95333…`
- Lote 3: ledger 5587760, [transacción](https://stellar.expert/explorer/testnet/tx/4470c1896592450d6aeef007a2e5beb85b79255e0fdbf9849d8d75d0bfba9575), huella `e3da3fa5956089e4…`
- Lote 4: ledger 5587763, [transacción](https://stellar.expert/explorer/testnet/tx/d92067b28ef312852773d833cab036bde256aacf15e43ecafb3eac74807a7b43), huella `6ed684828bd25905…`
- Lote 5: ledger 5587768, [transacción](https://stellar.expert/explorer/testnet/tx/b14d3f7bbb36678c350baab7317d36012fb3ef949e9832f2b2bc6c2100caa9dd), huella `0cfd0bf800ba69b5…`
- Lote 6: ledger 5587773, [transacción](https://stellar.expert/explorer/testnet/tx/7eac66c38275614db0b8e35c969192cf647e2edda83f166c066ae275dbab1282), huella `24bd905e800c7397…`
- Lote 7: ledger 5587776, [transacción](https://stellar.expert/explorer/testnet/tx/070f67c0d55deae1cf7da77113cc6fa260059610fc8ef3a1db2955dc17d3a253), huella `2f50512f2e8b795c…`
- Lote 8: ledger 5587780, [transacción](https://stellar.expert/explorer/testnet/tx/212a3db8201f58210e77f0b064c78cf8444532113d9533d931bcc00a2f5294bf), huella `b0725d30c3edb7d7…`
- Lote 9: ledger 5587783, [transacción](https://stellar.expert/explorer/testnet/tx/98b62795bb78fad5e9024f5d40a60fc4cfa115ceee84f5cfc18574a033a87803), huella `98af2d7543127175…`
- Lote 10: ledger 5587784, [transacción](https://stellar.expert/explorer/testnet/tx/deb1a564ceba4a4647a4dad1f140c87f9f52193d7370fcfc606fa9f3caa1153e), huella `ddf9ec21204691e7…`
- Lote 11: ledger 5587789, [transacción](https://stellar.expert/explorer/testnet/tx/1b84b4a0784aac088613b93ea3466a2fef300f6c00f15f419aef07ec27a77eae), huella `6d183e165a98787e…`
- Lote 12: ledger 5587792, [transacción](https://stellar.expert/explorer/testnet/tx/de0fdc866616f211d27ed3974d19dbdd57b53fb88971d4b58eb6ab31e8148f80), huella `b7b2f70dc67dc3ef…`

## Flujos de escrow
- Flujo 1 (Pago liberado por lote verificado): ✔ [txDeposito](https://stellar.expert/explorer/testnet/tx/ee7c3789eedad9cca2b33d35558556d6585e1e92a324ac0a1af245ad86d7dc60), [txLiberacion](https://stellar.expert/explorer/testnet/tx/d6e7e119e7d7f1caa37cc9bb485896538779a71fbb956ca1f68ff9811b84590b)
- Flujo 2 (Lote revocado: sin pago y reembolso al vencer): ✔ [txRevocacion](https://stellar.expert/explorer/testnet/tx/909637bfb1a9cbd92071c6154fd97613257ee3682cfda4d98816644df9a24898), [txReembolso](https://stellar.expert/explorer/testnet/tx/9cc04019d7246830c063fbc0aaa84cc6248303ce58cf55992cf8081b87b1b132)

## Límites
- Los lotes son de prueba, generados por el guion; no son datos de ninguna empresa.
- El tercero es el paquete independiente más un nodo público; lo verificó el mismo equipo, no una persona ajena.
- Costos de testnet; no equivalen a mainnet. La testnet se reinicia: guardar este archivo y capturas del explorador.
