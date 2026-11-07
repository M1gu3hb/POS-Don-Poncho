# 31 · La barbacoa por kilo, la mesa limpia y las opciones sin red (DP-14.1, puntos 3 a 5)

Decisiones DP-D63, DP-D64 y DP-D65. **Sin migración.** Lo hicieron dos agentes (Sonnet) en sus
worktrees; la sesión principal lo revisó, lo integró y añadió la existencia del puente.

## Qué hace y por qué

- **Por peso no se parte (DP-D63):** `restaurante/division.ts` (`unidadesRepartibles`) cuenta una
  línea `variable_medida` como una pieza; el diálogo de dividir la lleva con un solo «+». El peso se
  dice «½ kg» en todas las pantallas (`apps/web/src/restaurante/peso.ts`, y `tipoVentaUtils.js` en
  lo heredado). Genérico: el maestro trunca igual.
- **Mesa limpia (DP-D64):** `restaurante/mesas-escrituras.ts` (`cierreDeLaCuenta`) y el «hasta»
  opcional de `olvidarElCarritoDeLaMesa` y `cerrarAvisosDeLaMesa`. Genérico.
- **Opciones sin red (DP-D65):** la «existencia» del puente (`MapaEntidad.existencias`,
  `ProductoTerminado.tiene_opciones`), el tiempo límite y el guardado de
  `use-opciones-de-los-platillos.ts`, `pideOpciones`, `OpcionesNoLeidasDialog.jsx` y el botón de
  Productos. Genérico.

## Pruebas

Integración `restaurante/barbacoa-por-kilo` (14), `restaurante/limpiar-con-la-familia-nueva`,
`puente/tiene-opciones`; unidad `division-por-peso`, `peso`, `barbacoa-por-kilo`, `opciones-sin-red`;
navegador `barbacoa-por-kilo.spec.ts`, `barbacoa-por-kilo-portal.spec.ts`, `opciones-sin-red.spec.ts`.
Ajustadas: `carrito-fantasma` (el contrato de DP-13.2 cambia, ver DP-D64) y `telefono` (el
teléfono de cocina trae el peso).

## Cómo portarlo

1. `peso.ts` y `division.ts` juntos (el cliente y el servidor cuentan igual la pieza).
2. La existencia del puente antes que `pideOpciones`.
3. El «hasta» de la mesa limpia es independiente.
