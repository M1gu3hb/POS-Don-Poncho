# 005 · PAR-1 · `fase-b` en `main` y el carrito que ya no se traba

Fecha: 31-10-2026, noche (hora de CDMX). Sesión local de Claude Code en la laptop de Miguel. Sin
secretos ni PIN: los accesos viven en `..\_PRIVADO\`. El encargo completo y su evidencia, en el
reporte 023 y en `docs/paridad/PARIDAD-DON-PONCHO.md` §6 del maestro.

## 1 · Fase 4: `fase-b` en `main`

- **Cuándo:** después de que el maestro aplicó la 186 y la 187 a la base compartida (ledger
  117 → 119, `verify:esquema` y `verify:rls` en verde, huella de 11 negocios IDÉNTICA) y puso su
  PR #21 en producción. A las 19:07, Don Poncho sin caja ni ventas; las únicas entradas del día,
  de «Miguel · Morphiq». La cuenta viva de la Mesa 1 (12:02, un «Conejo al pastor») también es
  suya y quedó intacta.
- **PR #1 fusionado con merge** (`6ade1d9`). CI a mano sobre `main`: corrida 41259830541, 16/16.
  Production `READY` en `pos-don-poncho.vercel.app`.
- **`verify:esquema` contra la compartida:** verde (1749 columnas, 1382 restricciones, 445
  índices; lo mismo que el maestro).
- **Humo sin PIN:** la entrada 200; la página que no existe, 404 con Morfi; CSP, HSTS y `nosniff`.
- **Humo con PIN**, sin crear cuentas ni comandas: la 3 arrastrada a la 2 se atrae y se funde,
  «¿Qué número queda?», queda la 2 y la 3 se oculta; se separaron con `restaurante.separar_mesas`.
  En el QR de la Mesa 1, dos pestañas con dos ids de teléfono: un tamal y una quesadilla (con su
  relleno obligatorio), «(2) · $75», cada quien quitó lo suyo, nada enviado.
- **Huella de los otros 10 negocios** antes y después del humo: IDÉNTICA.
- **Índice:** las fichas 07 y 08 marcadas como portadas (PR #21 del maestro, en producción).

## 2 · El carrito ya no se traba con lo que no se puede pedir (DP-D43)

| Qué | Dónde |
| --- | --- |
| Al enviar se aparta lo oculto, desactivado o con una cantidad que ya no se admite; se manda lo demás y se dice | `packages/app/src/portal/carrito-disponibilidad.ts`, `carrito-comandos.ts` |
| Todos los teléfonos ven la línea marcada y no la suman | `carrito.ts` (`disponible`), `CarritoDeLaMesa.tsx` |
| Agregar valora la cantidad | `carrito-comandos.ts` |
| El aviso del envío | `carrito-de-la-mesa.ts` (`avisoDelEnvio`) |

- **Pruebas:** 5 de integración (`carrito-disponibilidad.integracion.test.ts`, también la
  atomicidad con `interrumpirEn`) y 2 unitarias. Primero en rojo (`PRODUCTO_NO_ENCONTRADO`), luego
  verde; las 41 del portal en verde.
- **Mutaciones:** 7, todas muertas (4 del servidor y 3 del teléfono).
- **Revisión independiente** (un Sonnet de sólo lectura en su worktree, sobre el maestro): sin
  críticos ni altos; se atendió todo salvo avisar la lista a los OTROS teléfonos (pediría una
  migración).
- El mismo código que el PR #22 del maestro (comparado archivo por archivo).

## 3 · Hallazgos

- Unir dos mesas libres y arrepentirse no tiene botón: la principal sólo ofrece «Abrir la mesa».
  Igual en el maestro; queda para después de PAR-1.
