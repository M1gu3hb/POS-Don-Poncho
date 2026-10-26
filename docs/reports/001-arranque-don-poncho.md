# 001 · Arranque de POS Don Poncho

Fecha: 25-10-2026. Estado: **DP-0 a DP-3, DP-5 y el portal QR terminados y probados; CI completa
en verde (16/16); DP-4 (alta en la base compartida) y DP-6 (Vercel) esperan las credenciales de
Miguel; DP-7 queda pendiente sólo en producción.** Sin secretos ni PIN en este documento: los
accesos viven en `..\_PRIVADO\`.

## 1 · Qué se entrega

- **POS Don Poncho**: el restaurante y el núcleo de MorphiqPOS@`5f4534c`, solo, a nombre de La
  Tradicional Barbacoa de Don Poncho. Copiado y podado, no reescrito (`ORIGEN.md`).
- **La marca de la casa**: estilo `don-poncho` (crema, dorado y negro del logo, AA en claro y
  oscuro), logo en acceso, barra, ticket, corte y portal QR, favicon y app instalable, y Morphiq
  sólo en el crédito «Sistema por Morphiq» del acceso (DP-D11).
- **El menú**: 107 productos en 17 categorías, transcrito del PDF y aprobado, listo para cargarse
  por los comandos de la aplicación (`scripts/cargar-menu.mjs`), con receta pendiente en todos,
  barbacoa por kilo con ¼, ½ y 1 kg, pulques con su sabor y tarros como producto extra.
- **El negocio listo** (`scripts/preparar-negocio.mjs`): dirección, estilo, «Salón» con 10 mesas,
  el equipo de 8 personas y quién responde por cada mesa.
- **El portal QR completo**: el menú default y el **personalizado** (8 páginas diseñadas desde el
  menú), los dos con pedido, sabor u opción, cuenta, ayuda y propina del comensal (DP-D18).

## 2 · Commits

Todos a nombre de `M1gu3hb <118588634+M1gu3hb@users.noreply.github.com>`, publicados en
`M1gu3hb/POS-Don-Poncho@main`. Cero líneas `Co-Authored-By` y cero «Generated with» (comprobado
con `git log --format=%B` sobre la historia entera).

| Commit | Qué |
| --- | --- |
| `cf12dcd` DP-1 | Importa MorphiqPOS@5f4534c |
| `7e17400`…`e139205` DP-2a–h | Desacople: sólo restaurante, sin presentación, sin dueño general, sin demos; puertas reducidas sin debilitarlas; CI en `pull_request` y a mano |
| `70ed4c1` DP-3 | Marca y estilo `don-poncho` |
| `3806c25` DP-5a | Arreglos a columnas `jsonb`; barbacoa por kilo con receta |
| `4c150cc` DP-5b | El salón usa las zonas del negocio |
| `024ac2f` DP-5c | Receta pendiente en Recetas, Platillos y el tablero |
| `6a3d6fe` DP-5d | Menú transcrito y guiones de carga |
| `1673cba` DP-5e | Tipos de una prueba |
| `e719a94` DP-5f | El menú personalizado del portal también pide |
| `737ab9c` DP-5g | Las 8 páginas del menú y el portal listo |
| `8254ceb` DP-7a | Next 16.4.3, DOMPurify 3.4.17 y Zod 4.6.7 por la auditoría |
| `ed7c0b7` DP-7b | La prueba del restaurante exige su plantilla en vez de cambiarla |
| `ce25450` DP-5h | Los guiones comparten entorno y huella; las páginas del menú se mudan de dominio |
| `7c2467d` DP-7c | La galería con la marca de Don Poncho y su estilo |
| `6597b9d` DP-7d | Un toque de la cocina en camino no lo deshace la lectura de otro |
| `8e90253` DP-7e | La prueba del menú personalizado deja la demo en limpio |

## 3 · Qué se quitó, qué se quedó y qué se apagó

- **Fuera:** tienda, cafetería, ferretería y estética (módulos, pantallas, comandos y pruebas que
  sólo los servían); modo presentación y su espejo; selector de modelos; dueño general; las cinco
  demos y los nombres MH Astral / Restaurante MH / Demo; los logos de Morphiq.
- **Se quedó:** todo lo que el restaurante alcanza (el menú real de 12 pantallas heredadas, el
  cierre del día y las vistas `/restaurante/*`), las 117 migraciones intactas (el esquema es un
  superconjunto) y los ocho estilos del maestro (se eligen en Configuración).
- **Sustituido:** dos restaurantes de prueba con ID propios y doble guarda para las pruebas
  (DP-D06); Don Poncho como único negocio real, por ID (DP-D07).

## 4 · Defectos heredados del maestro que aparecieron y se arreglaron

Cada uno con la prueba que lo atrapa, escrita antes del arreglo (en las dependencias, la auditoría):

1. **Next.js 16.3.8 con ejecución remota de código** (y DOMPurify, Zod): la auditoría de la CI
   los marcó críticos; subidos a Next 16.4.3, DOMPurify 3.4.17, Zod 4.6.7.
2. **Arreglos a `jsonb`**: no se guardaban los atajos de peso de un producto ni las plantillas de
   compra, tampoco desde sus pantallas (DP-D15).
3. **Zonas fijas del salón**: mesas en «Salón» invisibles para el mesero y una mesa nueva que no
   se podía guardar (DP-D16).
4. **Costo $0.00 y margen 100 % «sano»** en las pantallas de restaurante para un platillo sin
   receta (DP-D17).
5. **El menú público no publicaba las opciones**: desde el QR no se elegía el sabor (DP-D18).
6. **El área de preparación con la que nace un producto no genera comanda**: el cargador pone la
   de su estación (DP-D17).
7. Colores fijos de Morphiq en botones del mesero y en el marcador de platillo sin foto.
8. **La cocina regresaba a «Nuevos» una comanda recién tocada** cuando otro toque iba en camino,
   y el cocinero podía tocar la equivocada; la CI lo atrapó en la jornada (DP-D19).

## 5 · Evidencia

- `pnpm verify` reducido: verde (sin las tres puertas atadas al proyecto vivo, que se corren en
  sólo lectura en DP-4). Integración: 33 archivos, 113 pruebas. Unitarias: 3,592 (8 nuevas de los
  toques de cocina). Auditoría de dependencias limpia.
- Jornada del restaurante en navegador, escritorio, tablet y teléfono: 3/3, cuadrada al centavo.
  Portal y concurrencia 8/8, estilo y estados de mesa en los 9 estilos, operaciones de mesa 15/15,
  estilos y contraste 20/20, menú personalizado con pedido y opción 1/1, vocabulario, pantallas
  y cierre del restaurante con su PDF 3/3, dos toques de cocina en camino 1/1; con el arreglo de
  cocina, otra vez la jornada 3/3 y las suites de mesas, portal y operaciones 42/42.
- Ensayo de alta y carga en base desechable con el ID real de Don Poncho: primera vuelta completa
  (126 altas de catálogo, 10 mesas, 7 personas, 8 páginas), segunda vuelta sin un solo cambio, y
  la mudanza de dominio de las páginas ida y vuelta (DP-5h).
- CI de GitHub (Postgres 17): ver §7.

## 6 · Base compartida y Vercel: lo que falta, y por qué

- **DP-4 no se ejecutó.** El `.env` del maestro apunta a su base LOCAL y las 22 variables del
  Vercel del maestro son *sensibles* (ilegibles por diseño), así que no hay de dónde leer
  `DATABASE_URL` ni las llaves de almacenamiento. **No se escribió una sola fila en la base
  compartida**, y por eso no hay huella antes/después que comparar todavía; el guion de la huella
  (sólo lectura) está listo.
- **DP-6 no se ejecutó** por lo mismo: sin `DATABASE_URL` el despliegue no arranca.
- Ya listo para cuando lleguen: `..\_PRIVADO\fase-a.env` con `SESSION_SECRET` y `PIN_PEPPER`
  nuevos y los huecos para las cuatro credenciales; los PIN del equipo generados (distintos, sin
  patrones) en `..\_PRIVADO\ACCESOS-DON-PONCHO.md`. El bucket `pos-don-poncho` lo crea Miguel.

## 7 · CI

Tres corridas a mano, completas (Postgres 17: la cadena entera, la jornada en tres tamaños,
permisos y aislamiento, y el rastreo del restaurante en los 9 estilos). Cada una, 16 trabajos y
unos 18 minutos de reloj (163 a 169 minutos de máquina sumados).

| Corrida | Sobre | Resultado | Qué salió |
| --- | --- | --- | --- |
| `40261424207` | `737ab9c` | 14/16 | Auditoría: Next 16.3.8 con ejecución remota de código, DOMPurify y Zod → DP-7a. La suite del restaurante llamaba a la ruta de plantilla que DP-2b quitó → DP-7b. La galería no se regeneró (su paso va detrás de la suite roja). |
| `40263378355` | `ce25450` | 15/16 | Galería regenerada → DP-7c. La jornada cayó en escritorio: la cocina regresaba una comanda recién tocada → DP-7d (DP-D19). |
| `40266967242` | `8e90253` | **16/16** | Todo verde, galería comparada contra la nueva referencia. |

## 8 · Pendientes reales

1. Credenciales de la base compartida y del almacenamiento (Miguel) → DP-4, DP-6 y DP-7 en
   producción.
2. Recetas de los 107 platillos (el dueño, en Recetas): hasta entonces costo y utilidad son
   desconocidos y el tablero lo avisa.
3. Del menú: sabores de Refresco y Agua de sabor, precio del alcohol de la Piña colada, teléfono y
   RFC para el ticket, confirmar la tasa de IVA con el contador.
4. Fotos de los platillos: ninguna inventada; el portal usa el marcador de la marca.
5. El reparto inicial de mesas (1–5 / 6–10) es una propuesta: lo confirma el dueño.
6. Favicon: a 16 px el letrero es una silueta; un monograma sería un archivo y una línea.
7. Las tarjetas del tablero y otras piezas del heredado conservan los degradados del maestro
   (protegidos por `verify:aspecto`); recomponerlas sería otra etapa.
8. Para la Fase B: una columna página → categorías en lugar de la regla del título, la migración
   042 que siembra tres demos en una base nueva, y las tres puertas con el proyecto fijo
   (`docs/infra/FASES.md`).
9. Deuda de nombres `@morphiqpos/*` (DP-D09).
