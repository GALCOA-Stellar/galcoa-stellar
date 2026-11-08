# Requisitos antes de pasar a red principal

Estado: lista de condiciones. Nada de esto está hecho; hoy todo es testnet con activos de prueba.

| Requisito | Por qué | Estado |
|---|---|---|
| Consulta legal (activos virtuales, impuestos, protección de datos) | Controlar una clave que libera fondos de terceros puede encuadrar como proveedor de servicios | Pendiente |
| Auditoría externa de los contratos | Hoy solo hay revisión propia | Pendiente |
| Cuenta de servicio con varias firmas, rotación y revisión | Hoy hay una sola cuenta de servicio | Pendiente (sprint) |
| Límites de monto y cupos por cuenta | Acotar el daño de una clave robada | Parcial (cupo diario de sellos) |
| Monitoreo y alertas de las cuentas y los contratos | Detectar uso anormal | Parcial (vigilancia externa) |
| Flujo de depósito y retiro (SEP-24 con SEP-10) probado contra un anchor de pruebas | Entrar y salir a dinero real sin que el equipo toque fondos | Sprint (D6) |
| KYC con un proveedor (SEP-12), sin guardar datos personales en la red | Cumplimiento y Ley 25.326 | Solo diseño |
| Plan de contingencia (pausa, revocación, redeploy) | Los contratos no tienen ruta de actualización | Parcial |
