# CONTEXTO · POS Don Poncho

> Léelo antes de tocar nada. Lo acordado vive aquí, en `DECISIONES.md` y en `docs/BITACORA.md`.

## El cliente

**La Tradicional Barbacoa de Don Poncho** — barbacoa de horno desde 1985. Carr. a Sta. Cecilia #1,
San Lorenzo Atemoaya, Xochimilco, CDMX 16400. Primer cliente grande del punto de venta de Morphiq:
licencia permanente y servicio personalizado.

## El producto

**POS Don Poncho**: un punto de venta SÓLO de restaurante, 100 % dedicado a este cliente. Mesas,
comandas a cocina y bebidas, precuenta, portal QR del comensal, caja con pagos mixtos y propina,
cierre y arqueo, platillos y recetas, inventario por ledger, compras, gastos y tablero del dueño.

No hay tienda, cafetería, ferretería ni estética, ni modo presentación, ni selector de modelos, ni
dueño general entre negocios, ni demostraciones.

## De dónde sale

Copia del maestro **MorphiqPOS** en `5f4534c` (A-52 / R3 del maestro), podada a puro restaurante.
Ver `ORIGEN.md`. **No se reescribe**: se copia, se desacopla y se adapta. El maestro no se toca.

## Dónde vive (tres fases, sin reescribir)

| Fase  | Cuándo              | Dónde                                                                                                                                                                         |
| ----- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | hoy → 7-10 nov 2026 | Vercel (`pos-don-poncho`) + la base del proyecto Supabase **MorphiqPOS** (`wyqmzhliurwyxuyxznpb`, us-east-2), **compartida temporalmente**, como la organización `don-poncho` |
| **B** | 7-10 nov 2026       | Su propio proyecto de Supabase (otro encargo)                                                                                                                                 |
| **C** | ene/feb 2027        | Servidor privado en el restaurante, con acceso remoto desde los celulares del dueño (otro encargo)                                                                            |

Lo que lo hace posible y no se pierde: Postgres directo por `pg`/Kysely, migraciones propias,
sesiones y PIN propios (Argon2id + pimienta), almacén S3/MinIO o Supabase por variable,
sincronización por sondeo (sin Realtime) y `docker-compose`. Ver `docs/infra/FASES.md`.

## Reglas que no se negocian aquí

- **Git**: todo a nombre de `M1gu3hb <118588634+M1gu3hb@users.noreply.github.com>`, sin coautorías
  de Claude ni de Anthropic. Commits `DP-<etapa>: …`. Nunca `push --force` sobre lo publicado.
- **El repositorio es PÚBLICO** (decisión de Miguel, 25-10-2026): cero secretos, cero PIN, cero
  llaves. Los accesos viven fuera del repo (`..\_PRIVADO\`).
- **El maestro** (`M1gu3hb/MorphiqPOS`) es sólo lectura. **Pasteleria Confetti**
  (`ivqcxdpqxwjxfohiswqb`) no se toca ni para leer.
- **Base compartida (Fase A)**: cero DDL; sólo filas de `don-poncho` y sólo por comandos o guiones
  de la aplicación (con auditoría); nada destructivo; huella de las otras organizaciones antes y
  después. Lo destructivo va SOLO en bases desechables.
- **Migraciones**: no se borra ni se edita ninguna. El esquema es un superconjunto (tablas de otros
  giros sin uso): así las tres fases tienen exactamente el mismo esquema aplicado desde cero.
- **Calidad**: la del maestro. `REGLAS.md` (R7–R17, R31–R33), `TEAM.md`, `pnpm verify` como
  definición de terminado, la prueba antes que el código y su mutación, cero `any` / `@ts-ignore` /
  `catch` vacío, archivos nuevos ≤ 300 líneas, dinero en centavos, permisos en el servidor.

## Dónde está cada cosa

| Qué                                                       | Dónde                 |
| --------------------------------------------------------- | --------------------- |
| Decisiones con alternativas y consecuencias               | `DECISIONES.md`       |
| Bitácora para retomar                                     | `docs/BITACORA.md`    |
| Cómo operar (alta, migraciones, despliegue, restauración) | `docs/RUNBOOK.md`     |
| Menú del cliente y su carga                               | `docs/cliente/`       |
| Lo que viene (Fases B y C)                                | `docs/infra/FASES.md` |
| Reportes por entrega                                      | `docs/reports/`       |
