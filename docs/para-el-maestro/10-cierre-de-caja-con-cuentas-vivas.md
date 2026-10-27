# 10 · La última caja no cierra con cuentas vivas (DP-10.2, C10)

## Qué hace y por qué

`caja.cerrar` dejaba cerrar con una mesa abierta: su cuenta no tiene `sesion_caja_id` hasta que
se cobra, así que para el cierre era invisible. Pasaban tres cosas:

- el corte salía cuadrado sin una venta que ya se había comido;
- la mesa se quedaba sentada toda la noche sin caja que la cobrara;
- una cuenta dividida a medias quedaba repartida entre dos cortes.

La única defensa era la pantalla de Cierre diario, que lee el salón y luego escribe sin volver a
mirar.

Ahora lo decide el servidor, dentro de la transacción del cierre:

- **Última caja abierta de la sucursal con cuentas vivas → no cierra.** El mensaje dice qué
  mesas faltan: «Quedan cuentas sin cobrar en las mesas 1 y 2: cóbralas antes de cerrar la
  última caja abierta.»
- **Con otra caja abierta → cierra y avisa.** La respuesta trae `aviso` («… las cobrará la otra
  caja abierta.») y las pantallas de Caja y de Corte lo enseñan.
- **Cuenta viva** es una orden cobrable de la sucursal que cuelga de una mesa, o una parte sin
  cobrar de una cuenta dividida (la parte no tiene mesa; su madre sí). Un carrito de mostrador no
  cuenta: no es del salón y tiene sus propias reglas.
- **Dos cajas que cierran a la vez no pueden creer las dos que «queda la otra».** El cierre
  bloquea las cajas abiertas de la sucursal en orden de id ANTES que la suya; la segunda espera,
  y al soltarse el candado ya ve cerrada a la primera.

La pantalla de Cierre diario conserva su muro (no deja cerrar con mesas abiertas, haya o no otra
caja): es el cierre del día del restaurante entero, más estricto que el servidor.

## Archivos

| Archivo                                                                            | Qué                                           |
| ---------------------------------------------------------------------------------- | --------------------------------------------- |
| `packages/app/src/caja/cuentas-vivas-al-cerrar.ts` (+test)                         | Bloqueo, cuentas vivas, decisión y su texto   |
| `packages/app/src/caja/sesion.ts`                                                  | `caja.cerrar` la usa; `aviso` en el resultado |
| `packages/app/src/restaurante/cierre-de-caja-con-mesa-abierta.integracion.test.ts` | Reescrita: afirma el rechazo                  |
| `apps/web/heredado/pages/Caja.jsx`, `CorteCaja.jsx`                                | Enseñan el aviso                              |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico para el giro restaurante: sin mesas ni cuentas divididas no hay cuentas vivas y nada
cambia en los demás giros.

## Cómo portarlo

1. Copiar `cuentas-vivas-al-cerrar.ts` y su prueba.
2. En `caja.cerrar`: el paso `bloquear_cajas_de_la_sucursal` antes de `cargar_caja`, el paso
   `contar_cuentas_vivas` antes del arqueo, y `aviso` en el resultado y la auditoría.
3. Copiar la prueba de integración C10 y los dos `toast.warning` de las pantallas.
