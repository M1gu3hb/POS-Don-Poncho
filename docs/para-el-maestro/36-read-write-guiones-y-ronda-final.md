# 36 · Las escrituras en `read write`, los guiones fuera del pooler y la ronda final (DP-15.1)

Decisiones DP-D92 a DP-D96 (la DP-D97 es de Don Poncho y queda sin hacer). **Una migración: la 190**
(sólo la configuración de una función). Todo es genérico: el maestro tiene las mismas piezas y el
mismo modo de fallo.

## Qué hace y por qué

- **Las escrituras de la app no heredan un sólo lectura** (DP-D92):
  - `packages/data/src/cliente.ts`: `conTransaccion` abre `setAccessMode('read write')`. Por el pooler
    de transacción una conexión del servidor la comparten muchos clientes; si alguien dejó en ella
    `default_transaction_read_only = on`, un `begin` a secas la heredaba y la escritura moría con
    `25006` (el limitador y el carrito del portal, en producción).
  - Las escrituras que iban sueltas sobre `obtenerDb()` pasan a `conTransaccion`: el limitador
    (`repos/limite.ts`: contar, devolver, purgar), cerrar sesión (`packages/app/src/sesion/cerrar.ts`)
    y la cuota de archivos (`repos/archivos.ts`).
  - Pruebas: `solo-lectura-heredada.integracion.test.ts` (el pool con la opción en todas sus
    conexiones: la escritura suelta falla, la transacción y el limitador escriben) y
    `escrituras-en-transaccion.contrato.test.ts` (ninguna escritura suelta sobre `obtenerDb()`).
- **Los guiones que leen una base real** (`scripts/lib/lectura-segura.mjs`):
  `exigirConexionDirecta` rechaza una cadena del 6543 (el puerto de la app) y `leerEnSoloLectura` abre
  `read only` y cierra con `rollback` en un `finally`. Los usan `exportar-negocio` y `huella-ajena`;
  `importar-negocio` exige la conexión directa o de sesión. Prueba: `scripts/lib/lectura-segura.test.ts`.
- **La regla** (`docs/RUNBOOK.md` §3): ninguna revisión contra producción por el pooler de transacción
  mientras el negocio opera; nunca un `SET` de sesión en un guion.
- **La 190** (`packages/data/src/migraciones/sql/190_search_path_lealtad.sql`): `search_path` fijo para
  `lealtad_movimientos_inmutables`, la única función que marcaba el linter de Supabase (regla 0011).
  Prueba: `migraciones/search-path-de-funciones.integracion.test.ts` (ninguna función de `public` sin
  `search_path` fijo, salvo las de extensiones).
- **Lo que el servidor le acepta a la cajera** (DP-D93): `puedeRegistrarMovimiento` en
  `packages/app/src/caja/sesion.ts` (retiro sí; gasto, depósito y ajuste sólo gerencia,
  `MOVIMIENTO_NO_PERMITIDO`); el motivo recortado y 5 letras para el retiro
  (`LARGO_MINIMO_DEL_MOTIVO_DE_RETIRO` en `packages/contracts/src/comandos/movimientos-de-caja.ts`); los
  ajustes con motivo y quién en `caja.hoja_del_corte` y el documento del corte
  (`caja/corte/consultas.ts`, `documento.ts`; `apps/web/src/corte/hoja.ts`); el importe con coma de
  miles (`apps/web/src/venta/importe-tecleado.ts`).
- **La auditoría con filtro en el servidor** (DP-D95): `packages/domain/src/auditoria/grupos.ts` (los
  grupos, con su contrato contra el catálogo), `reportes.auditoria_reciente` con grupo, día del negocio
  (`limitesDeLaFecha` en `reportes/dia.ts`) y páginas; `apps/web/src/registros/` (la pantalla y
  `describir-accion.ts`, que también marca «Intento rechazado»).
- **El mesero y su pedido** (DP-D94): `apps/web/src/restaurante/puede-mover-la-cuenta.ts`,
  `apartar-agotados.ts` y el barrido de `borrador-del-pedido.ts`.
- **Zonas y Tablero** (DP-D96): `restaurante.fijar_zona_activa` (`restaurante/zona-activa.ts`, su ruta y
  `ZonasDelSalonDialog.jsx`); `apps/web/src/tablero/dia-del-negocio.ts`, `use-inicio-del-dia.ts` y
  `AvisoDelTopeDeVentas.tsx`.

## Pruebas

- Integración: `solo-lectura-heredada`, `search-path-de-funciones`, `ajustes-del-corte`,
  `auditoria-reciente`, `zona-activa`.
- Unidad y contratos: `escrituras-en-transaccion`, `lectura-segura`, `movimiento`, `importe-tecleado`,
  `corte`, `puede-mover-la-cuenta`, `apartar-agotados`, `borrador-del-pedido`, `describir-accion`,
  `filtros-de-auditoria`, `grupos`, `grupos-de-auditoria`, `dia-del-negocio`, `zonas-del-salon`.
- Mutaciones: cada arreglo con sus mutantes, todos muertos salvo uno equivalente (la bitácora los
  cuenta).

## Cómo portarlo

1. `conTransaccion` y las escrituras sueltas primero (no dependen de nada); su contrato encontrará en
   el maestro las que falten.
2. `lectura-segura.mjs` y los tres guiones.
3. La 190 con `pnpm db:migrate`: no toca datos ni permisos; en la base compartida, con su huella antes
   y después.
4. Lo demás es independiente entre sí y sin migración; el comando nuevo de zonas pide regenerar la
   matriz de permisos y el aislamiento (`pruebas/e2e/*.json`) con sus generadores.
