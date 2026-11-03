# 25 · Cancelar con reglas del servidor, el PIN atado a la cuenta (D-5) y el margen «sin receta» (DP-13.2)

## Qué hace y por qué

- **Cancelar o anular** (`restaurante.cancelar_orden`, `restaurante.anular_linea`): no se cancela
  lo pagado, dividido, reembolsado ni absorbido; el mesero sólo en sus mesas (las que atiende o
  tiene asignadas); con la cuenta pedida o la precuenta impresa, el PIN de un gerente o del dueño
  en el mismo diálogo. Bandera `configuracion.valores.pin_al_cancelar_cuenta_pedida` (por omisión
  activa). El aviso de pérdida espera la lectura de cocina y, si falla, dice «No pude comprobar la
  cocina» (DP-D51).
- **Con mesas unidas** la cuenta que queda carga con las que absorbió, también ya separadas: si
  alguna se pidió (`codigo_caja`, que sobrevive a la unión) o se imprimió, pide el PIN; si alguna
  la abrió otro mesero, el mesero no la cancela. Sin esto, unir borraba el «ya se pidió» y le daba
  al mesero la mesa de otro.
- **D-5:** la autorización firmada del supervisor lleva `cuenta` y `para`. El descuento sólo acepta
  la de su cuenta y para descuento; cancelar, la de su cuenta y para cancelar.
- **El margen** (DP-D52): una regla del servidor (`costo-conocido.ts`) dice si una cuenta tiene costo
  conocido, «sin receta» o «receta incompleta»; el corte, el puente (`estado_costo`) y el exporte la
  usan, y las pantallas (Cierre del día, Caja, su corte, el ticket, el CSV) la obedecen. A quien no
  ve márgenes (el puente no le manda el costo: llega `oculto`) no se le pinta ni costo, ni
  utilidad, ni margen —tampoco «sin receta», que sería falso—: `seVeElMargen`.

## Archivos

| Archivo                                                                                                                                                                                                                         | Qué                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `packages/app/src/restaurante/cancelar-con-permiso.ts`                                                                                                                                                                          | Estados, mesero, PIN y bandera       |
| `packages/app/src/identidad/supervisor.ts`, `apps/web/app/api/identidad/supervisor/route.ts`                                                                                                                                    | `cuenta` y `para` en la autorización |
| `packages/app/src/venta/descuento-de-mostrador.ts`                                                                                                                                                                              | El descuento exige SU cuenta         |
| `apps/web/src/venta/PinDeSupervisor.tsx`, `DescuentoDeVenta.tsx`                                                                                                                                                                | El PIN, reutilizable                 |
| `apps/web/src/restaurante/AjustesDeLaCuenta.tsx`, `AnularLineaDialog.tsx`, `CancelarDelMesero.tsx`, `permiso-al-cancelar.ts`                                                                                                    | Los diálogos                         |
| `packages/app/src/caja/corte/costo-conocido.ts`, `consultas.ts`, `packages/app/src/puente/consultar.ts`, `reportes/exportar.ts`                                                                                                 | La regla del margen                  |
| `apps/web/src/restaurante/margen-de-las-ventas.ts`, `resumen-del-dia.ts`, `CierreDiario.tsx`, `apps/web/src/corte/hoja.ts`                                                                                                      | El margen en pantalla                |
| `apps/web/heredado/pages/{Caja,CorteCaja}.jsx`, `components/caja/{ResumenDelDia,CierreDiarioDialog}.jsx`, `tickets/CorteTicket.jsx`, `lib/exportColumns.js`                                                                     | Las heredadas                        |
| Pruebas: `cancelar-con-permiso`, `margen-sin-receta` (integración), `margen-heredado.contrato`, `permiso-al-cancelar`, `margen-de-las-ventas`, `corte.test.ts`; e2e `cancelacion-del-mesero` y D-5 en `restaurante-operaciones` |                                      |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico. La bandera del PIN es por negocio.

## Cómo portarlo

1. `supervisor.ts` (D-5) y sus dos consumidores, juntos: una autorización vieja sin `cuenta` deja de
   servir para descontar.
2. `cancelar-con-permiso.ts` en los dos comandos, y `PinDeSupervisor` en sus diálogos.
3. `costo-conocido.ts` y el paso 9 del puente; luego las pantallas.
