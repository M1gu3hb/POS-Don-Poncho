# BITÁCORA · POS Don Poncho

Para retomar si se corta la sesión. Lo más reciente arriba. Sin secretos ni PIN.

## Cómo está montada la cadena local (máquina de Miguel)

- `source "/d/MIS PROYECTOS/MORPHIQ POS/.work/env.sh"` antes de `pnpm` (cachés en D:).
- Postgres 18 local de `.work/pg/data`, puerto **55433**, usuario `morphiqpos` / `postgres`.
  Arranque: `pg_ctl -D ".work/pg/data" -l ".work/logs/pg.log" start`.
- Base desechable nueva y migrada desde cero:
  `createdb` (o `psql -c "create database <n> owner morphiqpos"`) y
  `DATABASE_URL=postgres://morphiqpos:…@127.0.0.1:55433/<n> pnpm --filter @morphiqpos/data migrate`.
- Integración: `DATABASE_URL_PRUEBAS=<url> DATABASE_URL=<url> pnpm test:integracion`.

## 2026-10-25 · DP-0 y DP-1

### Origen

`M1gu3hb/MorphiqPOS` en `origin/main` = `5f4534c` (merge PR #18), confirmado con `git fetch`.
Copia por `git archive` (ver `ORIGEN.md`). Repo `M1gu3hb/POS-Don-Poncho`: **público**; Miguel
decidió seguir así («no te detengas»). Consecuencia: nada de PIN ni secretos en el repo.

### Decisiones de Miguel (chat, 25-10)

- 10 mesas en «Salón» (pendiente confirmar la distribución real).
- Barbacoa por peso ($795/kg) con atajos ¼, ½ y 1 kg. Licores y vinos por copa.
- Tarros: extra con precio sobre TODAS las cervezas. Pulques: producto por categoría y tamaño,
  sabor como opción; Natural $70 = litro.
- Ticket: sólo nombre y dirección (teléfono y RFC pendientes).
- Tabla del menú (103 productos) aprobada tal cual.

### Línea base ANTES de podar (`5f4534c` + `ORIGEN.md`)

Base desechable `dp_linea_base` en el Postgres 18 local, migrada desde cero con las 117
migraciones del repo (12 s).

| Paso | Resultado | Tiempo |
| --- | --- | --- |
| `pnpm format:check` | verde | 43 s |
| `pnpm lint` | verde | 329 s |
| `pnpm typecheck` | verde | 72 s |
| `pnpm test:unit` | verde · 409 archivos · 4,559 pruebas (3 omitidas, heredadas) | 118 s |
| `pnpm test:integracion` | verde · 48 archivos · 179 pruebas | 135 s |

No corrido en la línea base (se corre al cerrar DP-2): `pnpm verify` completo (incluye build,
puertas contra base viva y navegador). Cualquier rojo posterior en estos cinco pasos es de la poda.

### Mapa de alcance (herramienta)

Script de alcanzabilidad (grafo de imports + enlaces entre páginas + rutas `/api` del cliente),
desde las entradas del restaurante: login, `(modelos)/restaurante/*`, las doce pantallas
heredadas del menú real (D-52), portal QR, `middleware`, CLIs. Resultado: ~768 de 1,425 archivos
fuente los alcanza el restaurante; el resto es de los otros cuatro giros, del modo presentación y
de las demos. Las URL que el cliente arma con funciones (portal QR) no las ve el detector: la API
se decide por dominio y se confirma con grep, tipos y pruebas.

## 25-10-2026 · DP-2 cerrada

Siete commits (`DP-2a` … `DP-2g`). Lo que quedó fuera y lo que se conservó está en
`DECISIONES.md` (DP-D03 a DP-D10).

| Paso | Resultado | Tiempo |
| --- | --- | --- |
| `pnpm verify` reducido, sin las tres puertas que miran la base viva | verde (`rc=0`) | ~20 min |
| · `test:unit` | 285 archivos · 3,335 pruebas (3 omitidas, heredadas) | 84 s |
| · `build` | verde | 3 min |
| `pnpm test:integracion` (base desechable `dp_integ`) | 32 archivos · 111 pruebas | 82 s |
| Jornada del restaurante en navegador (`dp_e2e`): escritorio, tablet y teléfono | 3/3 | 5 min |

- `verify:esquema`, `verify:rls` y `verify:acople` están atadas al proyecto vivo y se corren en
  sólo lectura contra la base compartida en DP-4 (para Fase B/C: parametrizarlas, ver FASES).
- `verify:entorno` pide Postgres 17 para la base de pruebas y aquí hay 18: la cadena completa en
  17 corre en GitHub (`workflow_dispatch`).
- El servidor de la jornada registra «The destination stream closed early» cuando el navegador
  cambia de pantalla a media respuesta. No es un 5xx ni un error de consola (la jornada vigila
  ambos y pasó); se revisa en producción en DP-7.

### Dos decisiones de Miguel del 25-10 (chat)

- Credenciales de la base compartida y del almacenamiento: el `.env` del maestro apunta a la base
  LOCAL, así que se leen del proyecto Vercel `morphiqpos` (producción, sólo lectura) a un archivo
  temporal fuera del repo.
- Tarros: en el restaurante los modificadores viajan como nota y no cobran (E9-3 del maestro).
  Cada tarro es un **producto extra** en Cerveza. El menú queda en 107 productos.

## 25-10-2026 · DP-3 · La marca de la casa

- Estilo `don-poncho` (DP-D11), el predeterminado. Contraste AA en claro y oscuro por la auditoría
  (`verify:estilos`, 9 estilos × 2 modos) y la prueba de contrato; colores de gráfica a ≥ 0.12 en
  OKLab entre sí y ≥ 4.9:1 contra la superficie.
- Logo de la casa en el acceso, la barra lateral, el ticket, el corte y el portal QR (vector en
  pantalla, PNG en lo que se imprime). Favicon, `apple-touch-icon` y app instalable
  (`app/manifest.ts`). Se fueron los logos de Morphiq del repositorio.
- Morphiq firma una vez: «Sistema por Morphiq» en el acceso. Ticket del comensal: logo, nombre y
  dirección. Una prueba lo comprueba contra los archivos y su mutación se detecta.
- El acceso dejó el degradado azul y los resplandores (excepción de `verify:aspecto` declarada con
  sus 80 testigos). Los botones flotantes del mesero dejaron el azul de Morphiq fijo: ahora son el
  primario y el acento del estilo, planos.
- El restaurante de prueba usa ya `don-poncho`: la jornada y la galería prueban el estilo real.
- **Quedan con degradado** las tarjetas del tablero y otras ~70 piezas del heredado: son el diseño
  protegido del maestro (`verify:aspecto`, guía §7: no se toca el heredado). Recomponerlas es otra
  etapa, si Miguel la quiere.
- Resto de DP-2 que apareció al correr el portal en local: la suite esperaba «Restaurante MH».
  Ahora sale del contrato de negocios de prueba.
- **Hallazgo para DP-4/DP-6:** las variables del Vercel del maestro son *sensibles* (ilegibles por
  diseño), así que la decisión de leerlas de ahí no se puede cumplir (DP-D13). Hace falta que
  Miguel entregue `DATABASE_URL` y `STORAGE_*`.

## 25-10-2026 · DP-5 · El menú, la receta pendiente y lo que apareció al ensayar

- `scripts/cargar-menu.mjs` y `scripts/preparar-negocio.mjs`: por los comandos de la aplicación,
  idempotentes. Ensayo en base desechable (`dp_ensayo`) con Don Poncho y su ID real: la primera
  vuelta crea 2 estaciones, 17 categorías y 107 platillos (34 a cocina, 73 a barra), 10 mesas en
  «Salón» y 7 personas; la segunda no cambia nada. 107 con receta pendiente; barbacoa por kilo a
  $795.00 con ¼, ½ y 1 kg.
- Tres defectos heredados encontrados al ensayar, cada uno con prueba antes del arreglo: los
  arreglos hacia `jsonb` (DP-D15), las zonas fijas del salón (DP-D16) y el área de preparación con
  la que nace un producto (DP-D17).
- Las pantallas `/restaurante/recetas` y `/restaurante/productos` enseñaban costo $0.00 y margen
  100 % «sano» a un platillo sin receta: ahora «Costo desconocido» y «Sin costo».
