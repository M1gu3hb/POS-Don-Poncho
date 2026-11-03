# 27 · Plataforma, purgas de un día real, unir y separar con el portal, el sonido a la mano y la merma de lo cancelado (DP-13.3)

## Qué hace y por qué

- **Plataforma (13.3.8):** toda escritura de `configuracion.valores` que lee antes de escribir toma
  la fila con `for update` (`configuracion/documento-con-candado.ts`): dos guardados que se cruzan
  ya no se borran la marca de plataforma ni «quién manda a cocina». `mantenimiento.quitar_plataforma`
  quita la marca o la pasa a otro dueño, sin ruta HTTP y sólo para quien ya es de plataforma; un
  empleo desactivado la pierde en la misma transacción; la clave de idempotencia del guion lleva el
  hash de la lista y la versión del documento.
- **Purgas (13.3.9):** `purgar_ventas`, `reiniciar_pruebas` y `reiniciar_todo` abortaban en un día
  real (`movimientos_cuenta`, uniones, carritos, solicitudes, lista de espera). Ahora se sueltan
  las mesas (las uniones vivas vuelven a su lugar), se rompe el ciclo `ordenes.union_id` ↔
  `uniones_mesa.orden_id` y se borra en el orden de las llaves; también `eventos_mesa`.
- **La configuración sin `plataforma` (13.4.25):** un contrato inventaría a todo el que lee la tabla
  y seis caminos se prueban con valores centinela.
- **Unir y separar (13.3.10, DP-D56):** las solicitudes pendientes viajan con el carrito; el tope
  de 60 vale para los carritos juntos (si no caben, no se une); al separar, el pedido del portal y
  las notas se quedan en la principal y el resultado lo dice; las notas juntas miden 300.
- **El sonido a la mano (13.3.14):** junto a «Salir», «Sonido de este aparato» abre el mismo ajuste
  de Configuración → Este aparato, para cualquier puesto.
- **Merma por cancelación (13.3.16, DP-D57):** lo cancelado o anulado que ya estaba hecho sale del
  almacén con la traducción del cobro; el corte lo dice «Por cancelación».

## Archivos

| Archivo                                                                                                                                                                                                                                        | Qué                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `packages/app/src/configuracion/documento-con-candado.ts` y sus escritores; `mantenimiento/plataforma*.ts`, `clave-de-plataforma.ts`                                                                                                           | El candado y la marca               |
| `packages/app/src/identidad/empleados.ts`, `scripts/marcar-plataforma.mjs`                                                                                                                                                                     | Desactivar quita la marca; el guion |
| `packages/app/src/mantenimiento/purgas.ts`                                                                                                                                                                                                     | El orden de borrado                 |
| `packages/app/src/restaurante/carrito-del-salon.ts`, `al-separar.ts`, `notas-de-la-union.ts`, `union-de-mesas.ts`; `unir-mesas/SepararMesasDialog.tsx`                                                                                         | Unir y separar                      |
| `apps/web/src/configuracion/BotonDelSonido.tsx`, `heredado/components/common/Sidebar.jsx`                                                                                                                                                      | El sonido junto a «Salir»           |
| `packages/app/src/restaurante/merma-por-cancelacion.ts`, `cancelacion.ts`, `anulacion-linea.ts`, `venta/cobrar.ts`, `caja/corte/consultas.ts`                                                                                                  | La merma                            |
| Pruebas: `carrera-de-escrituras`, `plataforma-cambios`, `purgas-del-dia`, `claves-del-servidor`, `unir-y-separar-con-carrito`, `merma-por-cancelacion` (integración); `documento.contrato`, `clave-de-plataforma`, `plataforma`; e2e `sonidos` |                                     |

## Migraciones

Ninguna. **Para el maestro (opcional, en la base compartida):** sembrar en `motivos_merma` la
clave `por_cancelacion` («Por cancelación», giro restaurante) y cambiar `MOTIVO_DE_LA_MERMA` en
`merma-por-cancelacion.ts`. Don Poncho no la siembra porque el catálogo es de todos los negocios.

## Genérico o de Don Poncho

Genérico.

## Cómo portarlo

1. `documento-con-candado.ts` primero y luego cada escritor de `configuracion.valores`.
2. La purga con su prueba de un día completo: el orden de las llaves es lo que la hace pasar.
3. `planearConsumo(…, soloLoHecho)` antes que la merma: es la misma traducción del cobro.
