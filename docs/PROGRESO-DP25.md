# DP-25 · Bitácora · Lo que salió de la capacitación y de la verificación

> Para retomar: si el contexto se compacta, se relee esto primero. Decisiones DP-D219 a DP-D230.

## Dónde estamos (21-11-2026, cierre)

- **Ocho partes subieron el 21-11 después de las 19:00; la Parte 5 (CI en verde) sube después de las 19:00 del 22-11**, porque el
  restaurante sigue con sus pruebas en producción durante el día. Cada una con su PR, su CI en verde sobre la
  combinación real con `main`, Vercel en «Ready», el humo de producción en 11/11 y 0 errores de ejecución. Antes y después de
  cada despliegue se tomó la huella de los datos del negocio (ventas, pagos, cuentas, cajas, platillos y liquidaciones): quedó
  idéntica en todos. Los datos de prueba del restaurante no se tocaron.
- **Migraciones**, todas con `pnpm db:migrate` por la conexión de sesión y con su ensayo antes: 197 (Parte 1), 201 (Parte 6) y
  204 (Parte 7). Ninguna otra parte necesitó migración.
- **El jugo «Mixto»** (+$0, en «Sabor del jugo») se agregó en producción con el guion del repo, en ensayo y luego en real,
  firmado por «Dueño» y auditado. El catálogo exportado antes y después difiere sólo en esa opción.

| Parte | PR | En `main` | Migración |
| --- | --- | --- | --- |
| 1 · Dinero y permisos | #55 | `0f09342` | 197 |
| 2 · Pedir la cuenta con pendientes | #54 | `8f1d6b0` | — |
| 6 · Unir mesas poco a poco | #57 | `5632f7f` | 201 |
| 4 · La mesa y el «Preparar» que se perdía | #58 | `77cc47b` | — |
| 3 · Lo que ve el mesero | #60 | `6e22e21` | — |
| 8 · Dónde se oculta un platillo y el jugo Mixto | #59 | `4e0232e` | — |
| 7 · El dueño ve el PIN de su gente | #56 | `1e42c68` | 204 |
| 9 · Mesa repetida y revisiones | #61 | `a6c2649` | — |
| 5 · La bolita de «agregado al pedido» | #62 | después de las 19:00 del 22-11 | — |

- El orden sugerido era 1, 4, 2, 3, 6, 8, 5, 7 y 9. Se subió cada parte en cuanto su CI quedó en verde sobre `main`: la 4
  necesitó sus 50 corridas, y la 3, la 8 y la 7 se apilaron (cada rama llevaba la anterior) para que cada CI probara la
  combinación real y la siguiente quedara con el árbol idéntico al ya probado.

## Lo que dejó la capacitación (lectura de producción, sólo lectura)

- Unir mesas: entre las 08:48 y las 09:54 los meseros unieron mesas cuatro veces con «Unir mesas» (1+2; 1+2+3+4; 1+2+3+6+7; y
  3, 4 y 5), todas con éxito y separadas al momento (era práctica). Nadie usó «Agregar mesas». Los rechazos no quedan registrados
  en ningún lado, así que los intentos fallidos no se ven.
- Dos errores de servidor, a las 10:35 y a las 12:00, ambos mientras el dueño creaba mesas en Configuración: un número de mesa
  repetido salía como «Algo falló» en vez de un mensaje claro (arreglado en la Parte 9).

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
  PDF. Cada pago guarda la hora exacta en que se registra, así que los de un mismo cobro salen en el orden del cobro. Pruebas:
  `venta/pagos-por-separado.test.ts`, `corte/pagos-uno-por-uno.test.ts` y `caja/corte/pagos-del-corte.integracion.test.ts`.
- Mutantes: 15 destructivos (cada uno muere con su prueba) y 4 inocuos (pasan).

## Parte 2 · Pedir la cuenta con platillos pendientes (DP-D224)

- `restaurante.solicitar_cuenta` avisa en el servidor si hay platillos sin preparar o listos sin entregar, con la lista por
  estación, y sólo pide la cuenta con la confirmación explícita («Pedir la cuenta de todos modos» / «Regresar»). Vale en la
  tableta del mesero y en el mapa del administrador; el portal QR no se bloquea.
- Pruebas: `restaurante/cuenta-con-pendientes.integracion.test.ts` (10), la del portal en `carrera.integracion.test.ts`,
  `pendientes-de-la-cuenta.test.ts` y `cuenta-con-pendientes.spec.ts` con dedo en tableta y teléfono.

## Parte 3 · Lo que ve el mesero (DP-D225)

- El estado de cada platillo enviado (Nuevo, En preparación, Listo, Entregado) con glifo y palabra; las opciones y notas en el
  carrito, en lo enviado y en el aviso de «listo»; una leyenda con «?»; el avance por estación con su nombre («Bebidas 2 de 3»,
  «Cocina ✓» en verde y más grande); y si otra persona cancela o cobra la cuenta abierta, un aviso y de vuelta al mapa.
- Pruebas: `estado-del-platillo.test.ts`, `cuenta-cerrada-por-otro.test.ts`, `leyenda-de-la-mesa.test.ts`,
  `avisos-de-listo-con-opciones.integracion.test.ts` y `lo-que-ve-el-mesero.spec.ts` con dedo en tableta y teléfono.

## Parte 4 · La mesa naranja y el «Preparar» que se perdía (DP-D223) · causa raíz

Se reprodujo con una mini jornada de dos estaciones y la CPU estrangulada a 4×. Eran cuatro defectos:

1. **La mesa de la cuenta.** Al cambiar el estado de un platillo, el servidor movía la mesa de la COMANDA y no la de la CUENTA:
   con mesas unidas, la principal se quedaba en «pedido enviado» o «en preparación». Ahora mueve la de la cuenta.
2. **Una sola fila de toques para toda la cocina.** El servidor llegaba de 1.6 a 3 s detrás de lo que la pantalla ya pintaba.
   Ahora la fila es por cuenta.
3. **La espera de un candado.** Con Cocina y Cantina sobre la misma cuenta, una espera de más de 3 s salía como «Algo falló» y
   el toque pintado no se guardaba. Ahora el comando se repite entero (tope de 3 intentos, la misma clave), y un cobro repetido
   no cobra dos veces.
4. **El «Preparar» perdido.** Los avisos verdes «Platillo en preparación» se apilaban sobre las tarjetas y el toque siguiente
   caía en el aviso, no en el botón: el navegador veía el clic y no salía ninguna petición. Esos avisos informativos de cocina ya
   no reciben toques; los avisos con botón de todas las pantallas siguen igual.

- Las 50 corridas con el arreglo: 49 bien y 0 toques perdidos; la otra falló al preparar los datos de la prueba, antes de llegar
  a cocina. La prueba ya no repite un toque que no se registró: si falla, se cuenta.
- Pruebas: `cocina-de-la-mesa-unida.integracion.test.ts`, `cobro-con-candado-ocupado.integracion.test.ts`, el caso nuevo de
  `comando.concurrencia.test.ts`, `cocina/avisos-sin-toque.contrato.test.ts` y `mini-jornada-de-cocina.spec.ts`.

## Parte 5 · La bolita de «agregado al pedido» (DP-D228)

- Cada toque que agrega lanza una bolita que vuela al pedido y el número rebota; sale sólo después de que el toque seguro aceptó
  el toque y el platillo se agregó (deslizar no la lanza). Sólo `transform` y `opacity`, en una capa fuera del flujo, con tope de
  6 a la vez. Con movimiento reducido sólo rebota el número; sin WAAPI cae a `requestAnimationFrame` o al rebote.
- En el motor viejo del iMin (Chromium 99 y 103), 10 toques seguidos tardan lo mismo con y sin la bolita (2 a 11 ms por agregado).
- Pruebas: `tacto/bolita.test.ts`, `tacto/bolita.contrato.test.ts` y `bolita-de-agregado.spec.ts` con dedo en tableta y teléfono.

## Parte 6 · Unir mesas poco a poco, sin error (DP-D226)

- Unir con una mesa que ya está en un grupo la agrega a ese grupo; «Agregar mesas» desde cualquier mesa del grupo; cada
  platillo guarda su mesa de origen («(Mesa 7)» en la cuenta y la precuenta; migración 201); cocina y los avisos de «listo» dicen
  la principal; «La cuenta de la mesa 7 pasó a la mesa 3». Se arregló una carrera real al agregar mesas dos personas a la vez.
- Pruebas: `unir-con-grupo-existente.integracion.test.ts`, `union-flujo-real.integracion.test.ts` (5 mesas, precuenta y cobro
  una vez, separar al final), `unir-con-un-grupo-vivo.test.ts` y `unir-poco-a-poco-sin-error.spec.ts` con dedo.

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

## Parte 8 · Dónde se oculta un platillo y el jugo Mixto (DP-D227)

- En «El orden del menú» se oculta del portal QR, del POS (mesero y Caja) o de todo, y cada platillo dice dónde se ve. El portal
  obedece sólo a su propio «visible»; la Caja y el mesero respetan «oculto del POS»; lo que ya está en una cuenta se sigue
  cobrando. El guion `scripts/agregar-jugo-mixto-produccion.mjs` es idempotente y tiene su ensayo.
- Pruebas: `orden-del-menu-donde.integracion.test.ts`, `portal-oculto-del-pos.integracion.test.ts`, `donde-se-ve.test.ts`, su
  contrato, `jugo-mixto.test.ts`, `donde-se-ve-el-platillo.spec.ts` y `jugo-mixto.spec.ts`.

## Parte 9 · Mesa repetida y revisiones (DP-D230)

- Crear o editar una mesa con el número de otra activa responde «Ya hay una mesa activa con el número 7.» en vez de un 500.
- `verify:acople`: las tres fallas de código resueltas (los cuatro comandos de mantenimiento se declaran como de guion, con su
  razón; «Platillos» y «Mesa» salen del vocabulario). Quedan 6, todas de las que piden producción, un servidor o la CI.
- El editor del mapa ya guardaba una sola vez al soltar; una spec lo fija.
- Pruebas: `puente/numero-de-mesa-repetido.integracion.test.ts` y `mapa-de-mesas-editor.spec.ts`.

## Lo que hace Miguel

- Recargar los POS (cerrar y abrir la app o recargar la página) para tomar la versión nueva.
- Para ver el PIN de alguien con el ojito, asignárselo una vez más: los PIN de antes no tienen copia.
- Lo físico: las impresoras que no imprimen están dañadas (es hardware) y no se investigaron.
- Probar con el dedo en los aparatos: el aviso al pedir la cuenta con pendientes, lo que ve el mesero, la bolita en el iMin.

## Pendientes y lo que no se comprobó

- **Por decidir:** en «apartar un pedido anticipado» del portal, un platillo oculto sólo del POS sale en gris (esa lista lee
  «oculto del POS» como «hoy no hay»). Y, de DP-24, si al unir mesas se conserva la propina elegida en una cuenta absorbida.
- **El editor del mapa:** las 4,794 escrituras de la mañana no se explican con el código de hoy; si vuelve a pasar, hay que mirar
  qué aparato las manda.
- **El simulador de bots sin el mesero quitando platillos** no entró (sus guiones no pasan el lint).
- **No comprobado:** la pantalla del ojito de la Parte 7 en un navegador (sí su servidor, su cifrado y sus permisos); el contraste
  de la Parte 3 en modo oscuro medido en pantalla; la palomita del mapa vista directamente en la mini jornada; la bolita en la
  mesa activa del administrador (ahí no vuela) y el respaldo sin WAAPI en el motor viejo; el aviso hablado aún no dice las
  opciones del platillo.
- Fuera de este encargo: los ceros finales y el bloqueo H1 (la próxima semana).
