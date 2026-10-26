# DECISIONES · POS Don Poncho

Cada decisión estructural con sus alternativas y su consecuencia. Una decisión superada no se borra:
se marca y se apunta a la nueva. Las del maestro siguen en su repositorio (`M1gu3hb/MorphiqPOS`,
`DECISIONES.md` y `docs/fase-2/05-DECISIONES.md` en `5f4534c`).

---

## DP-D01 · Origen: `MorphiqPOS@5f4534c` · 25-10-2026

- **Contexto:** el encargo pide copiar el restaurante y el núcleo del maestro, no reescribir.
- **Alternativas:** fork con su historia; paquetes versionados del maestro; copia por
  `git archive` con historia nueva.
- **Elección:** `git archive 5f4534c` (merge del PR #18, `origin/main` confirmado con `git fetch`),
  historia nueva. `ORIGEN.md` registra qué viajó y qué no.
- **Consecuencia:** nada de `.env`, `historico/`, `.work/` ni los siete worktrees sin integrar del
  maestro. Las correcciones se rastrean contra `5f4534c`.

## DP-D02 · El repositorio es público · 25-10-2026

- **Contexto:** el encargo pedía detenerse si `M1gu3hb/POS-Don-Poncho` era público. Lo era.
- **Decisión de Miguel:** «no te detengas, ignora esa parte».
- **Consecuencia:** cero PIN, secretos, llaves o datos personales en el repo; los accesos van a
  `..\_PRIVADO\ACCESOS-DON-PONCHO.md`. Los minutos de Actions de un repo público no se cobran,
  pero la CI igual corre sólo en PR y a mano (DP-D08).

## DP-D03 · Poda por alcanzabilidad, no por nombre de carpeta · 25-10-2026

- **Método:** un grafo de imports, enlaces entre páginas y rutas `/api` del cliente, desde lo que
  abre cada puesto del restaurante (las doce pantallas heredadas del menú real —D-52 del maestro—,
  «Cierre del día», las vistas `restaurante/*`, el login y el portal QR). Las URL que el cliente
  arma con funciones no las ve el detector, así que la API se clasifica por el MÓDULO de comandos
  que importa cada ruta, y se confirma con tipos, pruebas y navegador.
- **Se va:** los módulos `abarrotes`, `cafeteria`, `ferreteria`, `salon` y el dominio `agenda`; sus
  161 rutas y pantallas; la venta de mostrador (suspender, retomar, apartadas, búsqueda, más
  vendidos); los cortes de los otros giros; el repo de tomas de inventario (sin llamadores).
- **Se queda, aunque hoy no tenga pantalla:** el núcleo y el dominio del restaurante completos
  —p. ej. lista de espera, separar mesas, marchar tiempos, kardex, valuación, traspasos—, con sus
  pruebas. Son del restaurante y del núcleo, no de otro giro; quitarlos perdería capacidad probada
  que el cliente puede pedir mañana.
- **Alternativa descartada:** quitar todo lo que no tenga pantalla hoy. Rompía la matriz de
  permisos del núcleo y perdía funciones del restaurante ya probadas.

## DP-D04 · Las migraciones no se tocan: el esquema es un superconjunto · 25-10-2026

- **Consecuencia:** siguen las tablas de otros giros, sin código que las escriba. El contrato de
  «estado ⇒ columna» exige ahora que NADIE escriba los estados de esas tablas
  (`SIN_ESCRITOR_EN_DON_PONCHO`): un hueco nombrado, no una regla ablandada.
- **Para la Fase B:** la migración 042 siembra tres organizaciones de muestra (Don Chuy, La Broca,
  Jacaranda) en cualquier base nueva. En la base propia se tratan con OK de Miguel (ver
  `docs/infra/FASES.md`).

## DP-D05 · Fuera el modo presentación, el dueño general y el selector de modelos · 25-10-2026

- **Alternativas:** desactivar (sin ruta ni menú, el servidor niega) o quitar.
- **Elección:** quitar. El contexto espejo, su historial, el cambio de negocio, la contraseña y el
  cambio de plantilla se fueron con sus rutas, pantallas y pruebas. La sesión dejó de leer la
  presentación (cuatro columnas y un `join` menos por petición).
- **Lo único que queda desactivado y no borrado:** `Ambito.presentador` en contratos (opcional,
  nunca se llena). El resolvedor de sesión rechaza cualquier cookie que traiga una delegación.
  Quitarlo del contrato tocaba la auditoría y el formato del token sin ganar nada.

## DP-D06 · Restaurantes de prueba en vez de demostraciones · 25-10-2026

- **Contexto:** «sin demos», pero las jornadas e2e, la matriz de permisos y el aislamiento
  necesitan un restaurante sembrado.
- **Elección:** dos restaurantes de prueba (`prueba-restaurante`, `prueba-restaurante-dos`) con ID
  propios que no existen en la base compartida; su siembra es la del restaurante del maestro, sin
  los otros giros. Su reseteo (`/api/pruebas/resetear`) tiene DOS guardas: por ID y por base (se
  niega si `DATABASE_URL` es de un proyecto intocable).
- **Consecuencia:** en producción ese reseteo contesta 403 siempre.

## DP-D07 · Don Poncho con ID fijo, alta idempotente y primer acceso único · 25-10-2026

- **Elección:** `NEGOCIO_DON_PONCHO.id` se declara antes del alta. `db:alta-negocio` lo crea con ese
  ID sólo si ni el slug ni el ID existen (con su fila de auditoría) y, si ya existe, no toca nada.
  `db:bootstrap` da el PRIMER acceso y se niega si ya hay dueño con PIN. Los negocios ajenos se
  niegan antes de abrir la base.
- **Consecuencia:** el mismo ID viaja a la Fase B y a la C.

## DP-D08 · CI en `pull_request` y a mano · 25-10-2026

- Sin `push` a `main` durante el arranque (se trabaja directo en `main`). Jobs reducidos al
  restaurante (ver DP-2 en `docs/BITACORA.md`).

## DP-D09 · El renombre `@morphiqpos/*` → `@donponcho/*` queda como deuda · 25-10-2026

- Son 1,089 archivos. No es barato y no lo ve nadie fuera del código; el encargo lo pide sólo si es
  barato. Queda anotado.

## DP-D10 · Los pisos anti-vacío de los contratos se recalibran · 25-10-2026

- Los contratos que escanean el código tenían pisos «al menos N» calibrados para cinco giros
  (p. ej. más de 250 comandos). Se bajan al alcance del restaurante con su razón escrita junto al
  número; siguen atrapando un cargador roto que devuelva unos cuantos.
