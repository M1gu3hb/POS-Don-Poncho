# 002 · Paquete 1 de cambios del cliente (DP-9)

Fecha: 27-10-2026. Estado: **los ocho cambios están hechos y probados. Seis viven en producción
(`main`, https://pos-don-poncho.vercel.app) y dos en la rama `fase-b` (necesitan migraciones que
la base compartida no admite), con su PR abierto contra `main` y sin fusionar.** Sin secretos ni
PIN en este documento.

## 1 · Cada cambio

| Encargo | Qué                                                        | Dónde    | Commits                         | Ficha | Decisión |
| ------- | ---------------------------------------------------------- | -------- | ------------------------------- | ----- | -------- |
| DP-9.1  | Recetas y Platillos no pisan el área ni la visibilidad     | `main`   | `0ce0e9e`                       | 01    | DP-D22   |
| DP-9.2  | Portal sin asignación de mesas y globos de solicitud       | `main`   | `8aa1a6e`                       | 02    | DP-D23   |
| DP-9.3  | Vista «Solicitudes» dentro de Mesas                        | `main`   | `37c5310`, `295a18a`            | 03    | DP-D24   |
| DP-9.4  | Cocina en el teléfono                                      | `main`   | `5e4b2c5`                       | 04    | DP-D25   |
| DP-9.7  | Botones sobre las páginas del menú QR y aspecto del portal | `main`   | `b338ea2`, `aa3ab7c`            | 05    | DP-D26   |
| DP-9.8  | QR de las mesas con diseño (motor de Morphiq-QRs)          | `main`   | `3f246a2`, `408fb69`            | 06    | DP-D28   |
| DP-9.9  | Demo local en la red (`docs/DEMO-LOCAL.md`)                | `main`   | `0a7319c`                       | —     | DP-D27   |
| DP-9.5  | El pedido compartido de la mesa (migración 186)            | `fase-b` | `6341a60`, `311cf2c`            | 07    | DP-D29   |
| DP-9.6  | Unir mesas desde el mapa (migración 187)                   | `fase-b` | `fad280d`, `c7a90c8`, `222cbe3` | 08    | DP-D30   |

Fichas en `docs/para-el-maestro/` (índice `00-INDICE.md`); decisiones en `DECISIONES.md`;
bitácora en `docs/BITACORA.md`.

### Evidencia por cambio

- **Pruebas:** cada cambio trae unidad, integración contra Postgres real y navegador (escritorio,
  tableta y teléfono donde aplica), y su banco de mutaciones: DP-9.1 (6), DP-9.2 (11), DP-9.3 (10),
  DP-9.4 (15), DP-9.7 (11), DP-9.8 (17), DP-9.5 (16), DP-9.6 (28): todas atrapadas (las
  de DP-9.5, 9.6 y 9.8, con el arnés corregido; ver §4).
- **CI a mano antes de `main`:** verde en cada rama (`workflow_dispatch`, 16 trabajos):
  DP-9.1 `40396447746`, DP-9.2 `40405811466`, DP-9.3 `40411902028`, DP-9.4 `40419619389`,
  DP-9.7 `40432449250`, demo local `40435538921`, DP-9.8 `40447773811`. `verify:acople` verde
  contra producción antes de cada fusión.
- **Producción** (después de cada despliegue): humo sin dinero verde y huella de las otras 10
  organizaciones **idéntica**. DP-9.7 escribió los 97 botones de las 8 páginas de Don Poncho con
  `preparar-negocio.mjs` (sólo cambió `portal_qr_botones`). DP-9.8 no escribió nada en la base:
  el diseño general por omisión es el de siempre hasta que el dueño lo cambie; humo verde,
  licencia de jsQR servida en `/licencias/`, huella idéntica (26-10, 04:29 → 04:39 UTC).
- **`fase-b`:** las 119 migraciones aplican desde cero hasta la 187 en una base desechable nueva,
  y `scripts/demo-local.mjs preparar` deja a Don Poncho completo encima (menú, equipo, mesas,
  portal). CI de la rama en verde: a mano `40465804034` (16 trabajos, con la galería
  regenerada) y la del PR `40468278523` (8 trabajos, con la galería comparada).

## 2 · Cómo probar lo de `fase-b`

Con `docs/DEMO-LOCAL.md`, sección 4:

```bash
git checkout fase-b
```

```bash
node --conditions=react-server scripts/demo-local.mjs preparar --base postgres://USUARIO:CLAVE@127.0.0.1:5432/don_poncho_demo
```

```bash
node --conditions=react-server scripts/demo-local.mjs servir --base postgres://USUARIO:CLAVE@127.0.0.1:5432/don_poncho_demo
```

- **Pedido compartido (DP-9.5):** abre el QR de una mesa en dos teléfonos de la misma wifi; cada
  uno agrega, los dos ven todo, uno lo manda («¿Ya pidieron todos?») y sale una vez.
- **Unir mesas (DP-9.6):** en la tableta, Mesas → «Unir mesas»; arrastra la 5 hacia la 4 (se
  atraen y se funden), «Unir 2 mesas», elige la 4. El QR de la 5 abre la 4. Al limpiar la 4
  pregunta «¿Separar mesas o dejarlas unidas?»; en «Unir mesas», tocar la 4 ofrece «Separar
  mesas».

## 3 · Migraciones nuevas para la Fase B

| #   | Archivo                            | Qué                                                                                              |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| 186 | `186_pedido_compartido.sql`        | `carrito_mesa_lineas`, `dispositivos_mesa`, `carritos_mesa` (RLS)                                |
| 187 | `187_unir_mesas_desde_el_mapa.sql` | Unión sin cuenta, posiciones originales, `mesas.unida_a_mesa_id` y su relleno para uniones vivas |

Ninguna se aplicó en la base compartida (cero DDL). En `fase-b`, `verify:esquema` y `verify:rls`
fallan a propósito: comparan con la base compartida, que no tiene la 186 ni la 187; la CI no las
corre.

## 4 · Lo que apareció en el camino

- **Una revisión independiente del código de DP-9.6** (sólo lectura) encontró cinco defectos
  reales; cada uno quedó con su prueba en rojo contra Postgres y luego en verde (ficha 08).
- **El arnés de mutaciones de DP-9.5, DP-9.6 y DP-9.8 no corría las pruebas:** desde Python,
  `subprocess.run(['bash', …])` en Windows llega al lanzador de WSL (System32 va antes que Git
  Bash) y todo salía «muerta». Se corrigió —Git Bash por ruta, una línea base que debe pasar
  antes de mutar y cada mutante de navegador comprobado compilando (uno de DP-9.8 moría por no
  compilar y se reescribió)— y los tres bancos se repitieron: DP-9.8 17 de 17 (lo publicado era
  cierto), DP-9.6 28 de 28 y DP-9.5 16 de 16. En DP-9.5 vivía quitar el candado de la cuenta al
  enviar: el envío doble lo ordena la fila de `carritos_mesa`, y el candado de la cuenta cubre
  otra carrera (enviar mientras la caja cierra la cuenta), que ahora tiene una prueba
  determinista contra Postgres. Los bancos de DP-9.1 a 9.4 y 9.7 usaban `shell=True`, que sí
  llega a Git Bash.
- **Pendientes que no son de este encargo:** el monitor de recogida acepta cualquier cookie de
  aparato de caja como ficha y no tiene límite de peticiones; la sesión puede no traer
  `estacion_preparacion_id`; D-5 (la autorización de supervisor no va atada a la cuenta) sigue en
  `test.fixme`.

## 5 · CI usada

Repositorio público: GitHub Actions no cobra minutos. Aun así, lo consumido por este encargo:
10 corridas a mano para lo que entró a `main` (incluidas una cancelada y una fallida) suman
1 620 minutos de trabajo, y 3 de `fase-b` (una a mano y dos del PR) suman 277: **1 897 minutos de
trabajo** en total (los 16 trabajos corren en paralelo; unos 20-27 minutos de reloj por corrida
completa). A eso se suma la corrida que valida este reporte antes de entrar a `main`.

## 6 · Commits

Todos a nombre de `M1gu3hb <118588634+M1gu3hb@users.noreply.github.com>`. Cero líneas
`Co-Authored-By` y cero «Generated with» (comprobado con `git log --format=%B`).

En `main` (producción):

| Commit    | Qué                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------- |
| `408fb69` | DP-9.8: retratos de la galería de Portal QR con el diseño de los QR                                |
| `aa3ab7c` | DP-9.7: la suite del menú personalizado pide desde los botones de la página                        |
| `3f246a2` | DP-9.8: QR de las mesas con diseño; sólo se imprime lo que se lee                                  |
| `0a7319c` | DP-9.9: demo local en la red y cookies Secure sólo con https                                       |
| `b338ea2` | DP-9.7: botones sobre las páginas del menú QR y aspecto del portal                                 |
| `5e4b2c5` | DP-9.4: cocina en el teléfono — un QR por estación, firmado para el día y revocable                |
| `295a18a` | DP-9.3: la e2e de la vista «Solicitudes» entra al paso «Los cambios del cliente» del CI            |
| `37c5310` | DP-9.3: vista «Solicitudes» dentro de Mesas; la voz de las solicitudes sólo ahí; la caja no las ve |
| `8aa1a6e` | DP-9.2: el portal funciona sin asignación de mesas; globos de solicitud sobre cada mesa            |
| `0ce0e9e` | DP-9.1: Recetas y Platillos no pisan el área ni la visibilidad                                     |

En `fase-b` (PR [#1](https://github.com/M1gu3hb/POS-Don-Poncho/pull/1), borrador, sin fusionar):

| Commit    | Qué                                                                                       |
| --------- | ----------------------------------------------------------------------------------------- |
| `222cbe3` | DP-9.6: retratos de la galería de Mesero con «Unir mesas»                                 |
| `c7a90c8` | DP-9.6: la frontera de sucursal cubre las posiciones; la mesa activa conserva su etiqueta |
| `311cf2c` | DP-9.5: el candado del envío, dicho y probado contra la caja                              |
| `fad280d` | DP-9.6: unir mesas desde el mapa (fase B, migración 187)                                  |
| `6341a60` | DP-9.5: el pedido compartido de la mesa (fase B, migración 186)                           |
