# 41 · El costo exacto de un insumo (DP-22, DP-D165, hallazgo 14 de la auditoría)

**Una migración: la 195** (aditiva: una columna nueva en `insumos`, `movimientos_stock` y
`valuacion_lineas`, con su `check`, un disparador y cuatro vistas vueltas a definir con las MISMAS
columnas). Es genérica de cualquier negocio con inventario por unidad base: el maestro tiene las
mismas tablas y las mismas cuatro vistas. **Es una regla de dinero**: lo que se guarda, con qué
precisión y dónde se redondea está escrito en `DECISIONES.md` (DP-D165).

## Qué arregla

El costo por unidad base (el gramo, el mililitro, la pieza) vivía en **centavos enteros**. En un
restaurante un centavo por gramo es demasiado grueso: la leche a $480.00 los 20 L son 2.4 ¢/ml y se
guardaba como 2 (−16.7 %); el maíz a $540.00 los 12 kg son 4.5 ¢/g y se guardaba como 5 (+11 %).
«Valor de inventario», el costo de cada receta, la merma, el consumo y el kardex multiplican
cantidad por ese costo, y heredaban el error (siete compras que sumaban $11,570.50 decían $11,552.00).

## Qué hace

- **Se guarda además el costo EXACTO**, en diezmilésimas de centavo por unidad base
  (`costo_exacto_dmc`, `bigint` ≥ 0): 2.4 ¢/ml = 24 000; 4.5 ¢/g = 45 000. Es la misma escala de cuatro
  decimales de las cantidades. En `insumos` (el costo vigente: el promedio ponderado), en
  `movimientos_stock` (el que tenía el insumo al moverse) y en `valuacion_lineas` (con el que se valuó).
- **`costo_unitario_centavos` se queda** y es el exacto redondeado al centavo (medio centavo hacia
  arriba). Un `check` por tabla lo exige (`*_costo_exacto_coherente`) y un disparador
  (`costo_exacto_coherente`) completa la columna que no se escribió: quien sólo conoce los centavos
  (una semilla, un `psql`) deja el exacto en centavos × 10 000.
- **Quien MULTIPLICA usa el exacto y redondea UNA sola vez, a centavos:** el valor del inventario
  (dominio `valuarInventario`, comando `inventario.valuar` y la vista `existencias_por_insumo`), el
  costo de la receta (`recalcularCostosRecetas`: suma de líneas y un redondeo; el costo por pieza del
  platillo sigue en centavos), el consumo de la casa, la merma «Por cancelación», el corte (insumos
  consumidos y salidas sin venta), la reposición sugerida y el valor de cada movimiento del kardex
  (vistas `kardex`, `descuentos_inventario_venta`, `merma_barra_turno`).
- **El costo promedio ponderado** se calcula sobre el exacto, con una sola división y un solo
  redondeo (a la diezmilésima). Una existencia en negativo cuenta como cero.
- **El puente** sirve el costo por unidad base con todos sus decimales (conversión nueva
  `dinero_fino`: `0.024` pesos el ml). Las pantallas lo enseñan por kilo y por litro
  (`apps/web/src/inventario/costo-por-unidad.ts`): «$24.00/L», «$45.00/kg».
- **Una existencia en negativo vale cero también en la vista `existencias_por_insumo`** (antes
  restaba): es lo que ya hacían la valuación guardada y la tarjeta (DP-D116, DP-D146).

## Lo que NO cambia

Los precios de venta, los totales de las cuentas, el corte (sus totales), las propinas, el costo por
pieza de un platillo como dato (centavos enteros), las unidades base del restaurante y el costo que se
captura a mano (`crear_insumo`, `actualizar_costo`: centavos por unidad base; el exacto sale de las
compras).

## Cómo se aplica

`pnpm --filter @morphiqpos/data migrate`: la 195 es aditiva. Rellena las filas que ya existen con
`centavos × 10 000` (lo que siempre valieron), así que una base con datos queda **igual** hasta la
siguiente compra de cada insumo, que ya promedia sobre el exacto. **Migrar ANTES de desplegar el
código nuevo** (el código nuevo escribe la columna). Con un libro de movimientos muy grande el relleno
y el `check` recorren la tabla entera: se hace en una ventana tranquila (en Don Poncho hoy son cero
insumos).

## Cómo se probó

- Integración contra Postgres: `inventario/costo-exacto.integracion.test.ts` (8: siete compras
  de $12,000.00 = «Valor de inventario» al centavo; la leche y una receta de 250 ml que cuesta $6.00;
  el promedio ponderado; la existencia en negativo; ajuste e inventario inicial; venta, merma «Por
  cancelación» y kardex) y `inventario/costo-exacto-migracion.integracion.test.ts` (6: el relleno de
  la migración y la regla en la base).
- Unitarias: `compras/costeo` (promedio y costo exacto), `compras/costo-exacto.propiedad.test.ts`
  (`fast-check`: el valor difiere de lo comprado en a lo más ⌊Σ Q_k/20 000 + ½⌋ ¢), dominio
  (`costo-exacto.test.ts`, `valuacion.test.ts`), puente, pantalla y nota del proveedor.
- Mutantes (todos muertos): redondear el costo a centavos antes de multiplicar (dominio, receta, cobro,
  merma, corte, valuación, pantalla, puente), redondear dos veces, no rellenar la migración (las tres
  tablas) y el promedio sin ponderar.

## Para llevarlo al maestro

1. Copiar la 195 con su número siguiente y actualizar `esquema.ts` / `scripts/esquema-esperado.json`.
2. Llevar `domain/inventario/costo-exacto.ts` y los cambios de `valuacion.ts`, `compras/*`,
   `inventario/{inventario,recetas,valuacion,consumo-interno}.ts`, `repos/stock.ts`,
   `restaurante/merma-por-cancelacion.ts`, `caja/corte/consultas.ts`, `reportes/piezas.ts` y el puente
   (`tipos.ts`, `mapa.ts`, `consultar.ts`).
3. Las pantallas: `valor-de-inventario.ts`, `costo-del-platillo.ts` y `costo-por-unidad.ts`.
