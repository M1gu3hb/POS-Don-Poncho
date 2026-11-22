# DP-25 · Bitácora · Lo que salió de la capacitación y de la verificación

> Para retomar: si el contexto se compacta, se relee esto primero. Decisiones desde DP-D219.

## Dónde estamos (21-11-2026)

- La capacitación del 21-11 salió bien. El restaurante hace pruebas en producción hoy y mañana: nada de lo suyo se toca y no se
  despliega antes de las 19:00 (o cuando Miguel diga «sube»).
- `main` arrancó en `aac5c3e` (DP-24 completo), con `pnpm verify` corrido ese mismo día sobre ese commit (las puertas que no
  hablan con producción, en verde) y la integración completa sobre una base nueva migrada desde cero hasta la 196.
- Orden de subida: Partes 1, 4, 2, 3, 6, 8, 5, 7 y 9. Decisiones y migraciones numeradas en ese orden (Parte 1: DP-D219 a
  DP-D222 y la migración 197).

## Lo que dejó la capacitación (lectura de producción, sólo lectura)

- Unir mesas: entre las 08:48 y las 09:54 los meseros unieron mesas cuatro veces con «Unir mesas» (1+2; 1+2+3+4; 1+2+3+6+7; y
  3, 4 y 5), todas con éxito y separadas al momento (era práctica). Nadie usó «Agregar mesas». Los rechazos no quedan registrados
  en ningún lado, así que los intentos fallidos no se ven.
- Dos errores de servidor, a las 10:35 y a las 12:00, ambos mientras el dueño creaba mesas en Configuración: un número de mesa
  repetido sale como «Algo falló» en vez de un mensaje claro.

## Parte 1 · Dinero y permisos

- **1.1 · Varias entregas de propina en el mismo turno (DP-D219).** La entrega guarda su caja en `entregada_en_sesion_caja_id`
  (migración 197); el reparto del turno sigue siendo uno. Pruebas: `propinas/varias-entregas-en-el-turno.integracion.test.ts`
  (tres entregas en un turno y el cierre en cero; el doble toque y dos a la vez; el reparto del turno sigue siendo uno).
- **1.2 · El Tablero pregunta de qué caja sale el dinero (DP-D220).** Con cajas abiertas, se elige el cajón o «Fuera de la caja»;
  sin cajas, queda pagada fuera. Mismas pruebas: la gerente desde otro aparato saca del cajón elegido y cuadra; sin caja no se
  mueve ningún cajón; la cajera no saca de otra caja; una caja cerrada no se elige.
- **1.3 · El PIN de quitar y de cancelar es de un solo uso (DP-D221).** Pruebas:
  `restaurante/pin-de-un-uso.integracion.test.ts` (el segundo uso se rechaza, también para cancelar; dos a la vez, sólo uno; la de
  otra cuenta no sirve; la gerencia y el dueño sin PIN).
- **1.4 · Cada pago por separado (DP-D222).** En el detalle de la venta, en «Ver ticket» de Registros, en el visor del corte y en su
  PDF. Pruebas: `venta/pagos-por-separado.test.ts`, `corte/pagos-uno-por-uno.test.ts` y
  `caja/corte/pagos-del-corte.integracion.test.ts`.
- Mutantes: 7 destructivos (cada uno muere con su prueba) y 2 inocuos (pasan).

## Parte 7 · El dueño ve el PIN de su gente (DP-D229)

- Al poner o cambiar un PIN se guarda, junto al hash, una copia cifrada con AES-256-GCM (migración 204,
  `credenciales_pin.pin_cifrado`, con un `check` de su forma). La llave (`PIN_CIFRADO_CLAVE`) vive sólo en el entorno del servidor;
  sin ella la función se apaga sola y cambiar un PIN borra la copia vieja.
- Configuración → Personas: el dueño ve el PIN con el ojito, tecleando el suyo (firma `para: 'ver_pin'`, de un solo uso); se ve 10
  segundos. Cada vista queda en la auditoría (quién vio el de quién y cuándo, nunca el PIN). El servidor lo rechaza para cualquier
  otro puesto. Los PIN de antes dicen «No disponible: asígnalo de nuevo una vez», con el botón para asignarlo.
- Pruebas: `identidad/pin-cifrado.test.ts` (6) y `identidad/ver-el-pin.integracion.test.ts` (7). Mutantes: el gerente lo ve · la
  firma de otro dueño · la de un gerente · la firma no se gasta · el PIN en la auditoría (con otra llave: la llave «pin» ya la quita
  el saneador) · el PIN a la vista en vez de su copia · sin llave la copia vieja se queda · la copia sin atar a su identidad: todos
  mueren. Inocuo: otro nombre del paso de lectura.
