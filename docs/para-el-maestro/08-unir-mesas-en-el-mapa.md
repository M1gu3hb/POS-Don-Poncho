# 08 · Unir mesas desde el mapa (DP-9.6, fase B)

## Qué hace y por qué

Miguel: «llegan diez, juntan la 4 y la 5, y el sistema sigue viendo dos mesas; para unirlas hay
que elegir de una lista y luego nadie las puede separar».

- **«Unir mesas» en el mapa** del mesero (`/mesero`), con y sin asignación de mesas. Pueden el
  mesero, el gerente y el dueño. Desde la mesa activa, «Unir mesas» lleva al mapa con esa mesa ya
  elegida.
- **Las mesas tiemblan** mientras se une (sólo diseño; con movimiento reducido no). Se arrastran
  con el dedo o el mouse; al acercarse a otra se **atraen** (imán, 36 puntos del plano) y al
  tocarse se **funden** (efecto líquido: un filtro SVG, sin librerías). Para quien no quiere
  arrastrar: tocar una mesa y luego las que se le juntan; cada una se acomoda pegada al grupo.
- **Sólo se unen mesas juntas.** Cada mesa del grupo tiene que tocar a otra (8 puntos de
  tolerancia) y el grupo tiene que caber en **640 × 400 puntos del plano** —una hilera de cinco
  rectangulares medianas, o un bloque de tres por dos—. Sin tope de cuántas (se quitó el «hasta
  seis»), pero medio salón no se une por accidente. La misma regla la usan la pantalla (para
  decir qué falta) y el servidor (para no aceptar otra cosa).
- **«¿Qué número queda?»** con los números de las mesas unidas: la 4 o la 5, nunca «45». Las
  demás se ocultan del mapa mientras dure la unión; la principal dice «Unida con 5».
- **Todo va a la mesa elegida:** pedidos, comandas, cuenta, precuenta, ticket y propina. Si alguna
  tenía cuenta, se absorbe como antes, y lo que la cocina tenía en marcha para ella pasa a la
  cuenta del grupo: «Marcar entregado» en la principal lo alcanza (D-3).
- **El QR de las mesas ocultas** lleva a la principal: sus comensales caen en el mismo pedido
  compartido (DP-9.5) y cuentan como personas de esa mesa.
- **La unión es del SALÓN, no de la cuenta.** Sobrevive al cobro (y a la cancelación). Al limpiar
  la principal se pregunta **«¿Separar mesas o dejarlas unidas?»**: separadas, cada mesa vuelve a
  su lugar original; unidas, el siguiente cliente las encuentra juntas, con el mismo número. Lo
  pregunta toda pantalla que libera mesas (la mesa activa, la de meseros y la caja).
- **«Separar mesas»** en la mesa activa de la principal (D-2) y en el mapa: en «Unir mesas», tocar
  la principal de una unión ofrece separarla. Así se separa una unión que quedó libre.
- El editor de distribución de mesas no cambia.

## Cómo está hecho

- **Migración 187** (`187_unir_mesas_desde_el_mapa.sql`): `uniones_mesa.orden_id` admite NULL
  (una unión sin cuenta entre un cliente y el siguiente); las posiciones ORIGINALES de la
  principal y de cada miembro; `mesas.unida_a_mesa_id`, copia de la unión viva para que el mapa
  oculte las absorbidas y el QR caiga en la principal sin otra lectura.
- **Dominio puro** `packages/domain/src/sala/union.ts`: medidas de cada mesa por forma y tamaño,
  imán, grupo por contacto y la regla de unión. Lo usan la pantalla y el servidor.
- `restaurante.unir_mesas` recibe la principal elegida, las demás y dónde quedó cada una
  (`posiciones`); revisa la regla con las posiciones finales, guarda las originales y mueve las
  mesas. Si la principal no tiene cuenta y otra sí, esa cuenta se muda primero a la principal.
- La cuenta que se abre en la principal de una unión viva es la del grupo (`tomarLaUnionDeLaMesa`,
  también desde el QR). Una absorbida no se abre ni se libera sola.
- Cobrar y cancelar llevan a todo el grupo con la principal (limpieza o libre) y ya no cierran la
  unión. `restaurante.liberar_mesa` sin decisión en una principal responde
  `MESA_UNIDA_SIN_DECISION`; con `grupo: 'separar' | 'mantener'` hace lo pedido.
- El buscador del QR (`portal/ambito.ts`): si el token es de una mesa absorbida, devuelve la
  principal (con el QR de la absorbida mandando: apagado, no sirve).
- El cliente heredado (`heredado/api/cliente.ts`) ya conserva los `datos` del error del servidor:
  sin eso, la mesa de meseros y la caja no sabían que tenían que preguntar.
- **Guardas** (de una revisión independiente del código, cada una con su prueba contra Postgres):
  una principal ya cobrada no absorbe cuentas vivas («márcala limpia antes de unirla»); sólo se
  acomodan las mesas que se están uniendo; una cuenta no se muda a una mesa oculta, y la que se
  muda a la principal de una unión libre es la del grupo; con una cuenta sin cobrar, liberar dice
  eso antes de preguntar por el grupo; y los candados van en el orden de todo el salón (cuentas,
  luego la principal, luego las demás), como el cobro y como liberar: dos meseros —o el mesero y
  la caja— sobre las mismas mesas se esperan en vez de trabarse.
- La mesa activa sabe con qué mesas está unida («Unida con 2») y pregunta ANTES de liberar; si
  una pantalla no lo sabe, lo dice el servidor y se pregunta entonces.

## Archivos

| Archivo                                                                    | Qué                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/data/src/migraciones/sql/187_unir_mesas_desde_el_mapa.sql`       | La unión del salón y las posiciones originales    |
| `packages/data/src/esquema.ts`, `scripts/esquema-esperado.json`            | Sus tipos y su contrato                           |
| `packages/domain/src/sala/union.ts` (+ prueba)                             | Medidas, imán, grupo y regla de unión             |
| `packages/app/src/restaurante/union-de-mesas.ts`                           | Unir (con posiciones) y separar                   |
| `packages/app/src/restaurante/sala-escrituras.ts`                          | Escrituras de unir/separar, D-3                   |
| `packages/app/src/restaurante/union-del-salon.ts`                          | La cuenta del grupo; la absorbida no se abre      |
| `packages/app/src/restaurante/mesas.ts`, `mesas-escrituras.ts`             | «¿Separar o dejarlas unidas?» al liberar          |
| `packages/app/src/restaurante/cancelacion.ts`                              | Cancelar no cierra la unión                       |
| `packages/app/src/portal/ambito.ts`, `portal/mesa.ts`                      | El QR de la absorbida cae en la principal         |
| `packages/app/src/restaurante/union-del-salon.integracion.test.ts`         | Contra Postgres: regla, posiciones, QR, limpieza  |
| `apps/web/src/restaurante/unir-mesas/*`                                    | El mapa de unir, el número, separar y la pregunta |
| `apps/web/src/restaurante/AccionesDeLaMesa.tsx`, `MesaActiva.tsx`          | «Unir» lleva al mapa; «Separar mesas»             |
| `apps/web/src/restaurante/MapaDeMesas.tsx`                                 | Oculta las absorbidas                             |
| `apps/web/heredado/pages/Mesero.jsx`, `Caja.jsx`                           | Botón «Unir mesas»; la pregunta al liberar        |
| `apps/web/heredado/api/cliente.ts`                                         | `ErrorPuente` conserva `datos`                    |
| `packages/app/src/restaurante/union-del-salon-guardas.integracion.test.ts` | Contra Postgres: las guardas de la revisión       |
| `packages/app/src/restaurante/cambio-de-mesa.ts`                           | No se muda una cuenta a una mesa oculta           |
| `pruebas/e2e/unir-mesas-en-el-mapa.spec.ts`                                | Arrastre, imán, número, QR y separar (3 aparatos) |
| `pruebas/e2e/restaurante-operaciones.spec.ts`                              | El flujo del día con el mapa; D-2 y D-3 ya corren |

## Migraciones

`187_unir_mesas_desde_el_mapa.sql`. Vive en la rama `fase-b`: la base compartida no admite DDL,
así que se aplica cuando Don Poncho tenga su propia base (Fase B). Probada desde cero en base
desechable.

## Cómo probarlo

Con `docs/DEMO-LOCAL.md` en la rama `fase-b`: en la tableta, Mesas → «Unir mesas», arrastra la 5
hacia la 4, «Unir 2 mesas», elige la 4. Escanea el QR de la 5 con un teléfono: abre la 4.

## Genérico o de Don Poncho

Genérico.
