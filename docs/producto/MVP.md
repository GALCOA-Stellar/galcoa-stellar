# MVP — GALCOA+ en Stellar

Estado: prototipo en **testnet** con reglas de demostración. Detalle en [`FUENTE-DE-VERDAD.md`](FUENTE-DE-VERDAD.md).

## Problema
Hoy el remito y la recepción se cargan a mano, se discuten después y no queda una prueba que un tercero pueda verificar sin confiar en quien la guarda.

## Usuario
Distribuidoras pymes del NEA argentino que entregan mercadería a comercios y deben mostrar a terceros (marcas, clientes, bancos) que los datos de cada entrega fueron controlados antes de usarse.

## Qué entra
- Reglas deterministas por atributo ALCOA+ (`ALC-COM-01`, `LEG-01`, `ATR-01`, `COH-01`, `CTE-01`, `ORI-01`, `EXA-01`) con tres estados: verde, amarillo, rojo.
- Vista previa "qué se sella": qué entra al lote y qué queda afuera, sin tocar la red.
- Un lote (hasta 50 documentos) en **una** transacción de testnet con una huella de 32 bytes (árbol de Merkle).
- Acceso por firma electrónica de cuenta autorizada (SEP-53).
- Comprobante por documento y archivo del lote con la prueba guardada.
- Verificación contra la red y verificación sin red.

## Qué NO entra
- Red principal, dinero real, pagos, cobros o tokenización (requieren consulta legal previa).
- Motor de reglas completo de GALCOA, usuarios y firma electrónica con valor legal.
- Decisiones de la IA sobre el veredicto: lo deciden reglas en código; una persona revisa lo rojo.
- Datos personales o documentos en la red: solo la huella.
- Hecho al 05/11: verificador público en `/verificar`, `stellar.toml` en `/.well-known/`, y negativa a sellar si quien aprueba cargó algún documento del lote.
- Todavía: usuarios reales con login, multifirma nativa, pago por consulta (x402).

## Criterios de aceptación (verificables)
1. Un lote con solo rojos **no llama a la red** (prueba: "un lote con solo rojos NUNCA llama a la red").
2. Un documento alterado no verifica; una raíz o un comprobante alterados tampoco.
3. Sin firma de una cuenta autorizada no se sella; la firma de un lote no sirve para otro lote; el mensaje vence y no se reutiliza.
4. En producción, sin `CUENTAS_AUTORIZADAS` nadie puede sellar.
5. La vista previa anticipa exactamente la raíz y el memo que después se sellan, sin llamar a la red.
6. Quien carga un dato no lo confirma (`ALC-ATR-01` da rojo).
7. El comprobante se verifica sin red con su prueba guardada; con otro memo u otro hash de transacción se rechaza.
8. `npm test` (40 pruebas), `npm run typecheck` y `npm run build` pasan.

## Demo de 3 minutos
1. (0:00) Abrir la app y explicar en una frase: se verifica antes de anclar; solo una huella va a la red.
2. (0:20) Cargar un lote de ejemplo con verdes, amarillos y rojos.
3. (0:50) Mostrar la vista previa "qué se sella": los rojos quedan afuera, con la regla que falló.
4. (1:20) Conectar la billetera de una cuenta autorizada y firmar electrónicamente el lote.
5. (1:50) Mostrar la transacción en el explorador de testnet: una sola, con la huella de 32 bytes y comisión de 0,00001 XLM.
6. (2:15) Descargar el archivo del lote y verificar un comprobante: verifica.
7. (2:40) Alterar un dato del comprobante y verificar de nuevo: no verifica. Cierre: la IA no decide; deciden las reglas y una persona.

## Medidas de éxito del sprint de 30 días (del SOW borrador)
| Entregable | Medida de éxito |
|---|---|
| Aplicación pública con acceso protegido y límites | Funciona con 20 documentos de ejemplo sin errores |
| Pantalla "qué se sella" probada con usuarios | 5 personas la usan y marcan si entienden qué se sella y qué queda afuera |
| Archivo de comprobantes y verificador público | Un tercero verifica un comprobante sin ayuda nuestra; la verificación sin red funciona |
| Piloto con 1–2 distribuidoras | 50 entregas o más procesadas; % de rojas, amarillas y verdes; tiempo de carga |
| `stellar.toml` y especificación abierta del comprobante | Documento público versionado |
| Informe de cierre | Entrevistas, cambios realizados y decisión de seguir |

Las partes marcadas **[COMPLETAR]** del SOW (tracción, equipo, monto) las aporta el equipo; no se inventan.
