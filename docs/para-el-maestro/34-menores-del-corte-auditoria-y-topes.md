# 34 · Los menores de la auditoría del 7-11: el corte, la auditoría, `autorizar_descuento`, el margen y los topes (DP-14, ronda 2)

Decisión DP-D80, más la zona de la mesera (DP-D77). **Sin migración.** Todo es genérico: el maestro
tiene los mismos huecos.

## Qué hace y por qué

- **Los descuentos del corte** (`packages/app/src/caja/corte/descuentos-del-corte.ts`):
  - la parte de una cuenta dividida sale con la mesa de su madre;
  - el folio lleva su serie;
  - la cuenta y la suma salen de SQL sobre todos, y la lista sigue con su tope.

  El papel (`CorteTicket.jsx`, con `avisoDeLosDescuentosCortados`) dice «Sólo se muestran X de N…» si la lista se cortó.

- **La auditoría** (`packages/app/src/saneado.ts`): tapa la autorización firmada (`cuerpo.firma`) y deja el nonce de un solo uso, porque `gastarLaAutorizacion` lo busca ahí.
- **Fuera `venta.autorizar_descuento`** y su ruta: escribía autorizaciones que nadie aplicaba.
- **El margen** (`reportes/piezas.ts`): no suma los platillos anulados aparte.
- **Los topes reales** (`venta/topes-de-los-puestos.ts`, `apps/web/src/configuracion/topes-de-los-puestos.ts`, `CajaYDescuentos.tsx`): Configuración → Descuentos dice lo que el servidor aplica a cada puesto.
- **La zona de la mesera** (`apps/web/src/cliente/mesas-del-mapa.ts`, `zonaDeSusMesas`, en `Mesero.jsx`): con la asignación encendida entra a la zona de sus mesas, porque también ve las que no tienen mesero.

## Pruebas

- Integración: `descuentos-del-corte-menores`, `margen-sin-lo-anulado`, `topes-de-los-puestos`.
- Unidad y contratos: `comando.auditoria` (el nonce), `descuentos-del-corte` (el aviso en el papel), `topes-de-los-puestos`, `zona-de-sus-mesas`.
- Mutaciones: 12 de 12 y 5 de 5.

## Cómo portarlo

Independientes entre sí. El saneado va antes de cualquier comando que gaste autorizaciones.
