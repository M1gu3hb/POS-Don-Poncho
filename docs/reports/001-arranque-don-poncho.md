# 001 · Arranque de POS Don Poncho

Fecha: 25-10-2026. Estado: **DP-0 a DP-8 terminados. Don Poncho está dado de alta en la base
compartida (huella de los otros 10 negocios idéntica) y en producción en
https://pos-don-poncho.vercel.app; CI completa en verde (16/16).** Sin secretos ni PIN en este
documento: los accesos viven en `..\_PRIVADO\`.

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
| `2ef1e26` DP-8 | Las fases de la mudanza y este reporte |
| `bba570b` DP-4 | La preparación deja el QR de cada mesa |
| `875c187` DP-8b | Don Poncho en la base compartida y en producción |
| `1ec73cf` DP-7f | `verify:acople` ajustada al producto de sólo restaurante |
| `ce2f2a3` DP-7g | Los toques de una comanda van en fila; la mutación de FORCE RLS, a su consulta |
| `44fbdb7` DP-7h | La prueba de la fila, sin expresión void |

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
   y el cocinero podía tocar la equivocada; y un «Listo» tocado con su «Preparar» todavía en
   camino llegaba en desorden y uno de los dos se rechazaba. La CI atrapó los dos en la jornada
   (DP-D19).

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

## 6 · Base compartida y Vercel (DP-4 y DP-6)

**La credencial.** El `.env` del maestro apunta a su base local y en Vercel la `DATABASE_URL` es
*sensible* (ilegible). La conexión vigente de `morphiqpos_app` por el pooler de transacciones
(6543) estaba en copias anteriores del repositorio del maestro; se probó con una sola lectura y se
copió a `..\_PRIVADOase-a.env` sin imprimirse. No se cambió ninguna contraseña, rol ni permiso.

**DP-4, en este orden, todo por los guiones de la aplicación:**

1. Huella de las 10 organizaciones ajenas (119 tablas por organización, md5 de 17), en una
   transacción `READ ONLY` (el pooler 6543 ignora la opción de sesión).
2. `verify:esquema` (1,727 columnas, 1,363 restricciones, 439 índices) y `verify:rls` (174
   relaciones, 16 funciones): verdes. La base tiene las mismas 117 migraciones que el repositorio.
3. `db:alta-negocio`: Don Poncho con su ID declarado, giro y paquete `restaurante`, sucursal «San
   Lorenzo Atemoaya», auditado. `db:bootstrap`: «Miguel · Morphiq», dueño, PIN temporal.
4. `preparar-negocio` y `cargar-menu`: configuración y portal, estilo, 8 páginas, «Salón» con 10
   mesas, 7 personas, mesas asignadas, 10 QR de mesa; 2 estaciones, 17 categorías y 107 platillos.
   Segunda vuelta de los dos: ni un cambio.
5. Huella otra vez, dos veces (tras la carga y tras los QR): **idéntica**, 276 conteos y 143 md5.

**DP-6.** Proyecto `pos-don-poncho` en `mh-astral-systems`, conectado a `M1gu3hb/POS-Don-Poncho`
(`main` despliega producción), raíz `apps/web`, Next.js, Node 24, funciones en `cle1` (junto a la
base, en Ohio). Las 9 variables, sólo en Production, por la entrada estándar del CLI; las cuatro
secretas, *sensibles*. Sólo las vistas previas están protegidas (Vercel protegía también el
dominio de producción y nadie habría podido entrar). Dominio `pos-don-poncho.vercel.app`.

**DP-7 en producción, sin sesión y sin teclear un PIN:** entrada `/n/don-poncho/login-pos` con el
logo y «Sistema por Morphiq», manifiesto, logo, páginas del menú, el portal QR de la mesa 1 (menú
subido, 8 páginas, 107 platillos, pedidos, cuenta, ayuda y propina, `puede_ordenar`) y la lectura
de datos negada sin sesión. La llave nueva lee el bucket privado.

**`verify:acople` contra producción: verde** (DP-D21). Daba 10 pendientes heredados de la poda y
de la propia puerta; se resolvieron en su causa: una consulta de seguridad única para las dos
puertas (la del acople no veía el disparador de la 179), el «mesa» tecleado a mano en la
cancelación, las suites y las pantallas sin menú derivadas del producto, los 7 comandos de
mostrador y crédito de otros giros declarados contra `MODELOS`, y un falso positivo de prefijo.
Su último requisito, checks de GitHub sobre el commit, se cumple corriendo la CI sobre él.

## 7 · CI

Seis corridas a mano, completas (Postgres 17: la cadena entera, la jornada en tres tamaños,
permisos y aislamiento, y el rastreo del restaurante en los 9 estilos). Cada una, 16 trabajos y
unos 18 minutos de reloj (163 a 169 minutos de máquina sumados).

| Corrida | Sobre | Resultado | Qué salió |
| --- | --- | --- | --- |
| `40261424207` | `737ab9c` | 14/16 | Auditoría: Next 16.3.8 con ejecución remota de código, DOMPurify y Zod → DP-7a. La suite del restaurante llamaba a la ruta de plantilla que DP-2b quitó → DP-7b. La galería no se regeneró (su paso va detrás de la suite roja). |
| `40263378355` | `ce25450` | 15/16 | Galería regenerada → DP-7c. La jornada cayó en escritorio: la cocina regresaba una comanda recién tocada → DP-7d (DP-D19). |
| `40266967242` | `8e90253` | **16/16** | Todo verde, galería comparada contra la nueva referencia. |
| `40315995417` | `1ec73cf` | 14/16 | El banco de mutaciones buscaba la consulta de RLS en su lugar viejo; la jornada en tableta: un «Listo» con su «Preparar» en camino → DP-7g. |
| `40320889728` | `ce2f2a3` | cancelada | El lint marcó una flecha de la prueba nueva → DP-7h; la cancela la siguiente. |
| `40321898271` | `44fbdb7` | **16/16** | Todo verde. Con ella, `verify:acople` contra producción: **completo**. |

## 8 · Pendientes reales

1. **Al entrar por primera vez:** cambiar el PIN temporal de «Miguel · Morphiq», subir el logo
   desde Configuración (prueba la subida al bucket con sesión) e imprimir los QR de las mesas.
2. Recetas de los 107 platillos (el dueño, en Recetas): hasta entonces costo y utilidad son
   desconocidos y el tablero lo avisa.
3. Del menú: sabores de Refresco y Agua de sabor, precio del alcohol de la Piña colada, teléfono y
   RFC para el ticket, confirmar la tasa de IVA con el contador.
4. Fotos de los platillos: ninguna inventada; el portal usa el marcador de la marca.
5. El reparto inicial de mesas (1–5 / 6–10) es una propuesta: lo confirma el dueño.
6. Las vistas previas de Vercel no tienen variables a propósito (ninguna base de prueba que
   servir): un PR construye en rojo en Vercel hasta que haya una.
7. Favicon: a 16 px el letrero es una silueta; un monograma sería un archivo y una línea.
8. Las tarjetas del tablero y otras piezas del heredado conservan los degradados del maestro
   (protegidos por `verify:aspecto`); recomponerlas sería otra etapa.
9. Para la Fase B: una columna página → categorías en lugar de la regla del título, la migración
   042 que siembra tres demos en una base nueva, y las tres puertas con el proyecto fijo
   (`docs/infra/FASES.md`).
10. Deuda de nombres `@morphiqpos/*` (DP-D09).
