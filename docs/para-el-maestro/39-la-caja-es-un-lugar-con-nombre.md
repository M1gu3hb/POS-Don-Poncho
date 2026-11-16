# 39 · La caja es un lugar con nombre, no el aparato (DP-21, Bloque 5)

**Una migración: la 193** (aditiva: una columna en `sesiones_caja`, su `check` y un índice único
parcial; ninguna fila existente cambia). Es genérico de cualquier negocio con caja: el maestro tiene
las mismas `sesiones_caja`, `terminales` y `sucursales.cajas_simultaneas` (la 179).

## Qué hace y por qué

Lo que vio Miguel el 15-11: «las cajas se suman (Caja 28, Caja 32, Caja 37…). Deben ser 1 o 2 fijas,
que se trasladen, y mejor con nombre». Cada navegador o aparato que entra se da de alta como
terminal, y ése era el nombre que veía la caja: 35 terminales «Caja N» en producción, y el corte de
prueba salió en «Caja 33».

- **La migración 193** (`packages/data/src/migraciones/sql/193_lugar_de_caja.sql`):
  `sesiones_caja.lugar` (`smallint`, nulo en las sesiones anteriores), el `check`
  `sesiones_caja_lugar_valido` (nulo o de 1 a 4, que es el tope del cupo de la 179) y el índice
  `sesiones_caja_un_lugar_abierto` (`organizacion_id, sucursal_id, lugar` donde `estado = 'abierta'`
  y `lugar` no es nulo). Tipos en `packages/data/src/esquema.ts`; contrato en
  `scripts/esquema-esperado.json`.
- **Los lugares** (`packages/app/src/caja/lugares.ts`): el cupo de la sucursal define los lugares 1,
  2…; `lugarParaAbrir` da el que se pidió si está libre, o el primero libre; `nombreDeLaCaja` da el
  nombre que le puso el dueño o «Caja N». Los nombres viven en
  `configuracion.valores.nombres_de_cajas` y sólo los escribe `caja.nombrar_cajas` (dueño y
  administrador, con antes y después en la auditoría; dos cajas no se llaman igual).
- **Abrir y trasladar** (`caja/sesion.ts`, `caja/traer.ts`, `caja/consulta.ts`): `caja.abrir` elige
  el lugar dentro de su transacción y contesta `lugar` y `nombreDeLaCaja`; el índice es la red si dos
  aparatos abren en el mismo instante (se traduce a una frase, no a un error interno). `caja.traer`
  sólo cambia la terminal: el lugar, y con él el nombre, viaja con la caja. `caja.estado` dice
  `lugaresLibres` (con su nombre) y, de cada caja abierta en otro aparato, `lugar`,
  `nombreDeLaCaja` y el nombre del aparato.
- **Dónde se lee el nombre:** el corte (`caja/corte/consultas.ts`: «Caja principal · iMin
  mostrador»), el aviso «Ya se cobró en Caja principal» (`venta/ya-cobrada.ts`) y la pantalla de
  Caja. Una sesión anterior a la 193 (sin lugar) se sigue llamando como su aparato.
- **Los aparatos** tienen su propio nombre: una terminal nueva nace como «Aparato N»
  (`identidad/entrar.ts`) y `caja.terminales` devuelve además `esteAparato`, para «Nombre de este
  aparato» en Configuración → Este aparato.
- **Los «Caja N» que ya existían** pasan a «Aparato N» con `mantenimiento.renombrar_aparatos`
  (`packages/app/src/mantenimiento/renombrar-aparatos.ts`): dueño de plataforma, con el nombre del
  negocio como confirmación, sólo cambia el nombre, se salta el que ya tenga su «Aparato N» en la
  sucursal y deja en la auditoría cuántos cambió. Es un comando y no una migración a propósito: el
  cambio queda firmado. No tiene ruta HTTP.
- **La pantalla** (`apps/web`): `heredado/components/caja/CajasEnOtrosAparatos.jsx` («Caja principal
  · abierta en «iMin mostrador»», «Traer Caja principal a este aparato», «Abrir Caja 2 aquí»),
  `heredado/pages/Caja.jsx` (elige lugar cuando hay varios libres; el encabezado dice la caja),
  `src/configuracion/NombresDeLasCajas.tsx` (Configuración → Caja) y
  `src/configuracion/TerminalesDeLaSucursal.tsx` (Configuración → Este aparato).

## Cómo se probó

- Unitarias: `caja/lugares.test.ts`, `apps/web/src/restaurante/cajas-con-nombre.test.ts`,
  `apps/web/src/configuracion/nombres-de-cajas.test.ts` y el contrato
  `dos-cajas-en-pantalla.contrato.test.ts`.
- Integración contra Postgres (`caja/lugares.integracion.test.ts`, 8 casos): con cupo 1, el aparato B
  no abre otra y trae la del A, que sigue llamándose igual; con cupo 2, el B abre la Caja 2 y un
  tercero sólo puede traer; pedir un lugar ocupado o inexistente se niega; dos aparatos que abren a la
  vez, diez veces, nunca quedan en el mismo lugar ni dan error interno; 20 aparatos nuevos no cambian
  el nombre de ninguna caja; y el renombrado de aparatos con su auditoría.
- e2e: `pruebas/e2e/cajas-del-negocio.spec.ts`.
- Nueve mutantes a mano, todos muertos.

## Para llevarlo al maestro

1. Copiar la 193 con su número siguiente; no depende de nada posterior a la 179.
2. Llevar `caja/lugares.ts` y los cambios de `sesion.ts`, `traer.ts`, `consulta.ts` y
   `repos/caja.ts` (`abrirSesion({ lugar })`).
3. Si el maestro ya tiene terminales «Caja N», correr `mantenimiento.renombrar_aparatos` por negocio.
4. No hay que tocar RLS ni permisos: son de la tabla.
