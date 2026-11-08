# Ruta a la red principal (con fechas y piezas de Stellar)

**Estado real:** hoy todo corre en Testnet con activos de prueba. Esta ruta es un **plan**, no está hecha, y las fechas posteriores al sprint dependen de conseguir financiamiento. Las condiciones de fondo están en [`REQUISITOS-MAINNET.md`](../arquitectura/REQUISITOS-MAINNET.md).

## Hitos
| Cuándo | Hito | Pieza de Stellar | Hecho cuando |
|---|---|---|---|
| 16 al 22/11/2026 | Cuenta del servicio multifirma (2 de 3) con rotación documentada ([issue #55](https://github.com/jfacundoayala/galcoa-stellar/issues/55)) | Cuentas multifirma, umbrales | Un registro de prueba se firma con 2 de 3 |
| 23 al 29/11/2026 | Custodia con lista blanca de tokens: **USDC y XLM** y nada más ([issue #56](https://github.com/jfacundoayala/galcoa-stellar/issues/56)) | Contratos de activo de Stellar (SAC), USDC de Circle | El contrato rechaza otros tokens, con tests; se redespliega en Testnet |
| 30/11 al 6/12/2026 | Flujo de entrada y salida con un anchor de pruebas | **SEP-24** (interactivo) con **SEP-10** (autenticación) | Un depósito y un retiro de prueba de punta a punta |
| 30/11 al 15/12/2026 | Piloto en Testnet con una marca y 2 o 3 distribuidoras sobre al menos 50 remitos, con métricas medidas | Registro y verificador públicos | Hoja de métricas publicada |
| 30/11 al 15/12/2026 | Prueba de cobros con **Cosmos Pay** en Testnet (enlace y QR SEP-7, webhooks firmados), como alternativa o complemento del anchor para entrar y salir de dinero | SEP-7, SDK `@cosmosapp/pay_sdk` | Un cobro de prueba creado, pagado desde una billetera y validado; un webhook firmado verificado. Hoy hay un adaptador experimental, apagado sin clave (`src/lib/stellar/cosmospay.ts`) |
| Después del sprint | Auditoría externa de los contratos | Soroban | Informe y correcciones publicadas |
| Después de la auditoría | Consulta legal (activos virtuales, impuestos, protección de datos, Ley 25.326) | — | Dictamen por escrito |
| Después de lo anterior | Piloto con dinero real, acotado y con límites de monto, con un anchor real y KYC mediante **SEP-12** sin guardar datos personales en la red | Anchor, SEP-12, USDC | Piloto firmado con una marca |

**Sobre Cosmos Pay:** es un proveedor de pagos con criptomonedas que opera en Stellar (más otras redes) y lo desarrolla una organización de la comunidad de Stellar de Latinoamérica. Es una dependencia de terceros: antes de usarlo con dinero real hay que revisar sus condiciones, su custodia de fondos y sus límites, igual que con cualquier anchor. Nada de esto toca el veredicto: lo siguen decidiendo las reglas en código.

## Financiamiento previsto
Instawards (sprint de 30 días) → SCF Build (si el piloto muestra uso y precio) → clientes del piloto. Cada paso decide el siguiente: sin evidencia de uso no se pasa a dinero real.

## Qué no cambia en ningún paso
La IA propone o frena y nunca decide el veredicto; a la red solo van huellas de 32 bytes; las claves viven solo en variables de entorno o en una bóveda; y no hay dinero real sin auditoría y consulta legal previas.
