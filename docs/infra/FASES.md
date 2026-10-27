# FASES · dónde vive POS Don Poncho y cómo se muda

El mismo código en las tres fases: Postgres por `pg`/Kysely, migraciones propias del repositorio,
PIN con Argon2id y pimienta, almacenamiento S3 (Supabase Storage o MinIO) y sondeo en vez de
tiempo real. Lo que cambia de una fase a otra son **variables de entorno**, no código.

| Fase  | Cuándo                      | Base                                                                                 | Almacenamiento                                     | Aplicación                                           |
| ----- | --------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------- |
| **A** | desde el 25-10-2026         | Supabase compartido `MorphiqPOS` (`wyqmzhliurwyxuyxznpb`), organización `don-poncho` | bucket privado `pos-don-poncho` del mismo proyecto | Vercel `pos-don-poncho` (equipo `mh-astral-systems`) |
| **B** | 7 a 10 de noviembre de 2026 | Supabase PROPIO de Don Poncho                                                        | bucket del proyecto propio                         | el mismo Vercel                                      |
| **C** | enero-febrero de 2027       | Postgres 17 en el servidor del restaurante (`infra/docker`)                          | MinIO en el mismo servidor                         | el mismo servidor, en la red del local               |

## Lo que viaja igual en las tres

- **`PIN_PEPPER`** — se fija una vez en la Fase A y **no se rota nunca**: rotarla invalida todos
  los PIN. Vive en el archivo privado de Miguel (`..\_PRIVADO\`), nunca en el repositorio.
- **El ID de Don Poncho**, `617ec3ad-cdc5-46d4-8d71-a1ed479c496b` (`NEGOCIOS_REALES`). El alta lo
  crea con ese ID en cualquier base; las guardas lo reconocen por ID.
- `ORGANIZACION=don-poncho`, `TZ=America/Mexico_City`, moneda MXN e IVA 16 % incluido en precio.

## Fase A → B (base propia)

1. Proyecto Supabase nuevo (región `us-east-2`, Postgres 17) y su rol de aplicación.
2. `pnpm db:migrate` contra la base nueva: crea el esquema completo desde cero.
   **Ojo:** la migración `042` siembra tres negocios de demostración (Don Chuy, La Broca y
   Jacaranda) en cualquier base nueva. Son ajenos (`NEGOCIOS_AJENOS`), las guardas los niegan y no
   estorban, pero en la base propia sobran: se archivan con una migración nueva del repositorio,
   probada antes en base desechable.
3. Copiar SOLO las filas de `don-poncho` (`exportar-negocio.mjs` e `importar-negocio.mjs`) y
   verificar conteos y md5 por tabla contra la base compartida (el importador lo hace antes de
   guardar).
4. Cambiar en Vercel `DATABASE_URL`, `STORAGE_*` (bucket nuevo) y volver a desplegar.
5. Correr `scripts/preparar-negocio.mjs` contra la base nueva con el `APP_URL` del despliegue: no
   duplica nada y corrige la dirección de las páginas del menú QR (guardan la dirección absoluta
   del sitio; sólo las que puso el guion, no las que subió el dueño).
6. Las puertas `verify:esquema`, `verify:rls` y `verify:acople` toman el proyecto de
   `MORPHIQPOS_PROYECTO_VERIFICADO` (sin ella, el `wyqmzh…` de la Fase A), desde DP-10.5.

El paso a paso del día, con tiempos y cómo regresar: `docs/infra/MUDANZA-FASE-B.md`. Las
herramientas: `scripts/exportar-negocio.mjs` y `scripts/importar-negocio.mjs` (DP-D34). 7. Retirar `don-poncho` de la base compartida sólo con Miguel presente, y con respaldo.

## Fase B → C (servidor del restaurante)

- `infra/docker/docker-compose.yml`: Postgres 17 + MinIO. Extensiones que piden las migraciones:
  `pg_trgm`, `unaccent` (esquema `extensions`), `btree_gist` y **`pg_cron`** (la `053` programa
  la retención de comandos: hace falta `shared_preload_libraries = 'pg_cron'`).
- Respaldos (R20): `pg_dump` cifrado cada noche a un disco aparte y una copia fuera del local;
  restauración probada una vez al mes en base desechable.
- Red: el servidor en la LAN del restaurante; las tabletas y teléfonos entran por la red local.
  Acceso remoto de Miguel por túnel (no se abre un puerto a internet).
- **Sin internet el restaurante sigue**: todo corre en la LAN. El portal QR del comensal necesita
  que su teléfono llegue al servidor (wifi del local, o el túnel publicado).
- UPS para el servidor y el módem: un apagón a media cuenta no puede dejar la base a medias (las
  escrituras son transaccionales, pero el disco necesita apagarse bien).

## Lo que se configuró en la Fase A y viaja con los datos

- Portal QR con todo encendido en «menú subido» (8 páginas en `apps/web/public/menu-qr`) y la
  asignación de mesas (1–5 «Mesero 1», 6–10 «Mesero 2»), que pedir desde el QR exige.
- El QR de cada mesa (su token viaja con la fila de la mesa: los QR impresos siguen sirviendo
  después de la mudanza, mientras el dominio sea el mismo o redirija).
- Vercel `pos-don-poncho`: `main` despliega producción, raíz `apps/web`, funciones en `cle1`;
  variables sólo en Production (las cuatro secretas, _sensibles_); vistas previas protegidas y sin
  variables (DP-D20). Al mudar de base cambian `DATABASE_URL` y `STORAGE_*`, y se redespliega.
- Todo el menú con receta pendiente: el costo y la utilidad son desconocidos hasta capturarlas.

## Antes de cada despliegue

- `pnpm audit --audit-level high --prod` en verde (la CI lo corre). El 25-10-2026 apareció Next.js
  16.3.8 con ejecución remota de código y se subió a 16.4.3 (con DOMPurify 3.4.17 y Zod 4.6.7).

## Pendientes conocidos para la mudanza

- `@morphiqpos/*` → `@donponcho/*` (DP-D09): deuda de nombres, no bloquea.
- Los modificadores con precio (E9-3 del maestro): hoy los tarros son productos extra (DP-D12).
