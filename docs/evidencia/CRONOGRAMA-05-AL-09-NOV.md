# Cronograma real del proyecto: del primer commit (05/11) al 09/11/2026

Todo lo de este documento se puede comprobar con `git log` del repositorio (fechas y autores de cada cambio). Los números son cuentas del historial, no estimaciones. Es un prototipo en Stellar Testnet; las reglas son de demostración.

## Antes del primer commit (honestidad sobre el punto de partida)
- Hubo una **versión anterior del equipo** (GALCOA sobre otra red), con tres entrevistas a dueños de distribuidoras (ver `ENTREVISTAS-RESUMEN.md`; las dos primeras el 20/10/2026).
- Del 02 al 04/11 se hizo investigación de Stellar (documentación oficial, ecosistema, Protocolo 30); queda en `docs/investigacion/`. **No hay commits de código en este repositorio antes del 05/11** a las 02:46.
- Punto de comparación para Cordillera: el tag `kickoff` (commit del 06/11 09:04; el evento empezó el 06/11 a las 12:20, hora de Argentina). La entrega fue el 08/11 y la devolución del evento se espera dentro de 3 a 5 días. Lo que se hizo después (09/11) es mejora posterior a la entrega.

## Día por día

| Día | Commits | Qué se logró |
|---|---|---|
| **05/11** | 38 | Primer prototipo en Stellar: verificación previa y sellado por lotes; reglas por atributo ALCOA+ con ID; acceso con firma de cuenta; integración continua; guía de Stellar con casos del ecosistema; interfaz con errores claros y vista de celular. |
| **06/11** | 110 | Contratos Soroban desplegados en Testnet (registro de lotes y custodia); identidad visual; constancia en PDF con QR a la transacción; confirmación del comercio por enlace/QR; historial; auditoría interna; examen de reglas con huella; **tag `kickoff` (inicio del evento 12:20)**; guion y hoja de defensa de la demo. |
| **07/11** | 107 | **Custodia v4** (una entrega respalda un solo pago); agentes de IA probados con modelos reales (Gemini y Groq); memoria corta para lecturas a la red (de 5–9 s a inmediato); rondas de confirmación por terceros; evaluación de agentes con 43 casos; detector de órdenes escondidas (ALC-INY-01); capas de arquitectura vigiladas por pruebas; límite de pedidos durable; base Supabase opcional; pruebas con navegador real; reglas de fotos y voz; primeros aportes de Gastón integrados; 233 pruebas. |
| **08/11** | 29 | **Procedencia (ALC-PRO-01):** cada dato propuesto por la IA debe traer una cita del mensaje y el código comprueba que existe; licencia Apache-2.0; validación con Zod; comprobación de que el código compilado coincide con el desplegado en la red; evidencia de criterios de éxito corrida en Testnet; adaptador experimental de Cosmos Pay; esqueleto de extensión de navegador; evaluación del registrador v4 con modelos reales (100 % de detección y 2 % de falsos positivos al contar todas las repeticiones; una primera versión del informe decía 0 % por un error de la cuenta, ya corregido); 408 pruebas y 80,6 % de cobertura; mensajes de error públicos tipados; formulario mejorado tras la primera prueba de una persona externa. |
| **09/11** | 6 | Se detectó y corrigió una caída del sitio (base pausada y claves mal configuradas); verificación automática cada 3 días para mantenerla activa; clave expuesta reemplazada; el ejemplo de la pantalla de agentes pasó a dar verde; cuenta del servicio con dos claves de respaldo y rotación, probada en Testnet con cuentas descartables (7 de 7 comprobaciones); corrección de la cuenta de la evaluación de agentes. |

Total: **290 commits en 5 días** (38 + 110 + 107 + 29 + 6), de tres personas del equipo más herramientas automáticas.

**Qué cuenta como avance del evento:** los días 05/11 y la mañana del 06/11 son anteriores al inicio declarado y se muestran solo como punto de partida. Lo medible como avance es lo posterior al tag `kickoff`.

## Integración con Stellar (qué usa la red y qué no)
- **Dos contratos Soroban en Testnet** (identificadores en `src/lib/config/contratos.ts`); el registro exige tres firmas distintas y la custodia solo paga si el registro dice que el lote existe.
- **A la red va solo una huella de 32 bytes por lote**, nunca datos personales.
- **Verificación pública sin cuenta:** cualquiera lee el estado del lote directo del contrato y valida un comprobante.
- **Firma de cuenta (SEP-53)** y billetera Varial integrada. *No probada de punta a punta desde un celular real.*
- **Código desplegado verificado:** la integración continua compila los contratos y compara su huella con la de la red.
- **Ruta a mainnet** con fechas en `docs/producto/RUTA-A-MAINNET.md`. Hoy no hay dinero real ni red principal.

## Qué NO está probado (declarado)
- Firma desde un celular real; auditoría externa; demanda de desarrolladores (es una hipótesis); la tasa de falsos positivos de los agentes con muestra grande (medimos 2 %, con 43 casos propios y 2 repeticiones).

## Cómo comprobarlo
```bash
git log --reverse --format='%ad %an %s' --date=short   # historial con autores
git diff kickoff..main --stat                           # lo construido después del kickoff
```
