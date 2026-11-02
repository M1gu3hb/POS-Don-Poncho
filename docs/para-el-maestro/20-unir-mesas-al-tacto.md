# 20 · Unir mesas con el dedo: la misma mesa, el imán en la vecina, la forma fundida (DP-12.3)

## Qué hace y por qué

Miguel: «Que al unir las mesas no cambien, que tiemblen, que se arrastren con el dedo sin brincar y
que se vean fundidas». Y lo que faltaba: preguntar con gente, no perder las alergias, separar desde
el mapa y no dejar uniones varadas.

- En «Unir mesas» las mesas son las mismas del mapa y tiemblan (con «reducir movimiento», un
  contorno punteado). Se arrastran con el dedo o el ratón, 1:1; también con toques.
- El imán es la vecina: se inclina y se estira hacia la mesa que se acerca; al soltar cerca, se
  pegan. El grupo se ve fundido: cápsula horizontal o vertical (redondas), rectángulo o cuadrado.
- Con gente: «La Mesa N tiene gente y un pedido de $X. ¿Unir de todos modos?». Al unir, las
  cuentas, el carrito del portal y las alergias y la celebración se juntan en la que queda.
- En limpieza: «márcala libre primero». Separar: tocar la unión o mantenerla presionada en el mapa
  → «Separar mesas»; cada mesa vuelve a su lugar.
- El editor y «vaciar el mapa» ya no apagan mesas de una unión viva.

## Archivos

| Archivo                                                                                                           | Qué                                                            |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `packages/domain/src/sala/forma-de-la-union.ts` (+test)                                                           | La forma del grupo y la vecina que llama                       |
| `packages/app/src/restaurante/notas-de-la-union.ts`                                                               | Alergias y celebración a la principal                          |
| `packages/app/src/restaurante/union-de-mesas.ts`, `sala-escrituras.ts`                                            | Limpieza con su nombre; las notas al unir                      |
| `packages/app/src/puente/tipos.ts`, `escribir.ts`, `mapa.ts`                                                      | `sinCabezaViva`: no apagar una mesa de una unión viva          |
| `packages/app/src/mantenimiento/comandos.ts`                                                                      | «Vaciar el mapa» con uniones vivas se niega                    |
| `apps/web/src/restaurante/unir-mesas/*`                                                                           | La mesa que tiembla, el arrastre, el aviso con gente, el plano |
| `apps/web/heredado/components/mesas/MesaShape.jsx`, `pages/Mesero.jsx`                                            | La unión fundida en el mapa, «Separar mesas» en el globo       |
| Pruebas: `union-con-gente.integracion.test.ts`, `union-dp12-3.test.ts`, `pruebas/e2e/unir-mesas-al-tacto.spec.ts` |                                                                |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico.

## Cómo portarlo

1. `forma-de-la-union.ts` al dominio con su prueba; `notas-de-la-union.ts`, la guarda de limpieza
   y `sinCabezaViva` al servidor, con `union-con-gente`.
2. `apps/web/src/restaurante/unir-mesas/` completo y `caja` en la mesa del mapa.
3. En la pantalla del mesero: la unión pintada en su caja, «Separar mesas» en el globo y limpiar
   `?unir=`. La prueba de tacto necesita un salón con dos cuadradas, dos redondas apiladas y dos
   redondas lado a lado.
