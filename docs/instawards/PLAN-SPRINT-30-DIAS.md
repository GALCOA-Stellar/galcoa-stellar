# GALCOA+ en Stellar: plan de sprint de 30 días (borrador para la Instaward)

Borrador interno para trabajar con el equipo y la líder del capítulo. Sigue el formato de los sprints públicos de proyectos que ya recibieron Instawards (cada entregable con su criterio "listo cuando…" y su evidencia). **Los montos, fechas y nombres son propuestas, no compromisos.** No nombrar empresas reales.

**Punto de partida (05/11/2026).** Prototipo en testnet: reglas por atributo ALCOA+, sellado de un lote en una transacción (árbol de Merkle, memo de 32 bytes), acceso por firma de cuenta (SEP-53), verificador público `/verificar`, `stellar.toml`, 45 pruebas automáticas, auditoría de dependencias limpia, multifirma 2 de 2 probada en un script aparte, medición de lote contra uno por uno (−90 % de comisión con 10 documentos). Sin usuarios reales y sin login.

**Objetivo.** Que una distribuidora pueda cargar remitos, que **otra persona distinta los apruebe con su billetera, y que la red misma rechace el sello si no están las dos firmas**; y que un tercero pueda verificar el resultado sin ayuda del equipo.

## Entregables y criterios

| # | Entregable | Listo cuando… | Evidencia |
|---|---|---|---|
| D1 | **Sellado con aprobación 2 de 2 dentro de la app.** La cuenta de sellado exige dos firmas (cargador y aprobador); la app arma la transacción y recoge ambas con la billetera de cada persona. Comisiones patrocinadas para que los usuarios no necesiten XLM. | Una transacción de testnet de la app, firmada por dos cuentas distintas, sella un lote; con una sola firma la red la rechaza. | Hashes en stellar.expert (éxito y rechazo); prueba automática; video de 60 s |
| D2 | **Identidad de personas.** Login, vínculo persona–cuenta y registro de quién cargó, quién aprobó y cuándo. | Quien cargó un documento no puede aprobar el lote, y el archivo del lote nombra a ambas personas. | Pruebas por requisito (RF-02); captura del archivo del lote |
| D3 | **Comprobante abierto y paquete reutilizable.** Especificación del comprobante `galcoa.stellar.comprobante.v1` y paquete con lote Merkle, memo y verificación sin red, con licencia abierta. | Un proyecto ajeno arma y verifica un lote usando solo el paquete y la especificación. | Paquete publicado; ejemplo en `examples/`; especificación en `docs/` |
| D4 | **Pruebas, modelo de amenazas y plan de monitoreo.** STRIDE y plan de monitoreo de las cuentas de sellado y de los firmantes, siguiendo las guías de Stellar. | Cada amenaza tiene al menos un monitor; CI verde; conteo de pruebas y cobertura antes y después. | `docs/amenazas.md`; tabla de pruebas |
| D5 | **Piloto con una distribuidora real.** 50 remitos (reales si lo autoriza, o de prueba), con las reglas pedidas por la propia distribuidora. | Se miden minutos de conciliación por remito y discrepancias detectadas; una persona ajena al equipo sigue la guía desde cero y la corrige donde se traba. | Informe de piloto; guía con capturas |

**Avance D1 (05/11/2026):** sello 2 de 2 funcionando de punta a punta en testnet (script `e2e-2de2`): con una firma el servidor lo rechaza, con dos sella y verifica; la comisión la paga el servicio. Falta: probar el flujo con Freighter real y dos personas.

**Avance D2/D3/D4/D5 (05/11/2026):** ingreso por firma de cuenta (sin probar con Freighter real); especificación abierta y paquete `galcoa-comprobante` (sin publicar; la app y el paquete dan los mismos resultados, con prueba); modelo de amenazas en `docs/amenazas.md`; guía y planilla de piloto en `PILOTO-DISTRIBUIDORA.md` y set de 50 remitos con 9 errores sembrados (`tests/piloto.test.ts`). **Falta lo que depende de personas:** la distribuidora real y la persona ajena.

## Semana por semana
| Semana | Trabajo | Control de fin de semana |
|---|---|---|
| 1 | D2 (login, identidades) y diseño de D1 | Pruebas de cuatro ojos con personas distintas |
| 2 | D1 (2 de 2 en la app, patrocinio de comisiones) | Transacción con dos firmas y rechazo con una |
| 3 | D3 (especificación y paquete) y D4 (amenazas, monitoreo) | Ejemplo ajeno verifica un lote |
| 4 | D5 (piloto) y repetir las mediciones (N = 50, varias corridas) | Informe escrito para la líder del capítulo |

## Plan B
- Si la distribuidora no puede participar a tiempo: el piloto se hace con datos de prueba y una persona de la comunidad actúa como tercero; el informe lo dice con claridad.
- Si la integración de billetera con dos firmantes se complica: se usa firma por pasos (el cargador firma y exporta el sobre, el aprobador lo completa), que es el flujo nativo de Stellar.

## Medición (a completar)
| | Inicio | Fin |
|---|---|---|
| Pruebas automáticas | 45 | 63 (05/11) |
| Comisión por documento (lote de 50) | 0,00001 XLM por documento (individual) | 0,0000002 XLM por documento (lote): −98 %, 3 corridas en testnet el 05/11 |
| Tiempo de sellado de un lote | 4,9 s (N = 10, una corrida) | 5,06 s con 50 documentos (3 corridas); uno por uno: 248–250 s |
| Minutos de conciliación por remito | | |

## Explícitamente fuera del sprint
- Mainnet, dinero real, cobros, pagos condicionados, escrow, tokenización y x402: requieren consulta legal previa.
- Auditoría externa y marco de validación GAMP 5: el sistema se diseña para poder validarse, pero no está validado.
- Firma digital con valor legal (Ley 25.506): se usa firma electrónica y no se afirma equivalencia.
- Lo que el sistema no hace: no verifica que la mercadería exista físicamente; verifica coherencia, atribución y que lo declarado no cambió.
