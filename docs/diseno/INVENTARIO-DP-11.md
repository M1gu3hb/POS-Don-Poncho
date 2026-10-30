# DP-11.0 · Inventario de pantallas, línea base de rendimiento y plan

29-10-2026. Sale de leer el código de `main` (= `dp-10`) y de `fase-b` (`42fc58a`), con dos
subagentes Sonnet de sólo lectura (bitácora), y de medir la aplicación compilada.

## 1 · Las pantallas que de verdad se usan

La navegación es `heredado/components/common/AppLayout.jsx` + `Sidebar.jsx` (en el teléfono del
dueño, además, `MobileAdminRadialMenu.jsx`). El menú lo arma `navegacionParaRolYPlantilla` con las
12 entradas heredadas más «Cierre del día». Dueño, gerente y administrador llegan como
«administrador» y ven lo mismo.

**Aspecto:** _recompuesta_ = vive en `apps/web/src` con `@morphiqpos/ui/sistema` y pasa
`verify:adopcion`; _heredado_ = el aspecto de Base44 (`heredado/components/ui`, `Card`,
degradados, tokens en inglés); _mixta_ = cascarón heredado con un bloque visible de `src`.

| Ruta                                  | Pantalla                               | Quién                     | Aparato           | Uso           | Aspecto                             |
| ------------------------------------- | -------------------------------------- | ------------------------- | ----------------- | ------------- | ----------------------------------- |
| `/`                                   | Tablero del dueño                      | dueño, gerente, admin.    | PC, teléfono      | diario        | mixta (`Dashboard.jsx`, 662 líneas) |
| `/mesero`                             | Mesas y pedidos (mapa + mesa activa)   | mesero y dirección        | tableta, teléfono | diario        | mixta (`Mesero.jsx`, 1545 líneas)   |
| `/cocina`                             | Cocina (Cocina y Bebidas)              | cocina y dirección        | tableta, pantalla | diario        | heredado (`Cocina.jsx`, 488)        |
| `/caja`                               | Caja: cobros, corte y cierre           | caja y dirección          | PC                | diario        | heredado (`Caja.jsx`, 1857)         |
| `/ventas`                             | Historial de ventas                    | caja y dirección          | PC                | diario        | heredado (445)                      |
| `/restaurante/cierre-diario-y-arqueo` | Cierre del día y arqueo                | caja y dirección          | PC                | diario        | recompuesta                         |
| `/inventario`                         | Inventario                             | almacén y dirección       | PC                | diario        | heredado (538)                      |
| `/compras`                            | Compras y gastos                       | almacén y dirección       | PC                | diario        | heredado (193)                      |
| `/recetas`                            | Recetas (inicio del almacén)           | almacén y dirección       | PC                | ocasional     | heredado (327)                      |
| `/productos`                          | Platillos                              | almacén y dirección       | PC                | ocasional     | heredado (524)                      |
| `/registros`                          | Registros                              | dirección                 | PC                | ocasional     | heredado (684)                      |
| `/portal-qr`                          | Portal QR (menú, botones, QR de mesas) | dirección                 | PC, tableta       | configuración | mixta                               |
| `/configuracion`                      | Configuración                          | dirección                 | PC                | configuración | mixta                               |
| `/pos`                                | Venta de mostrador                     | dirección (botón tablero) | PC, tableta       | ocasional     | heredado (802)                      |
| `/n/don-poncho/login-pos`             | Entrada con PIN                        | todo el personal          | tableta, PC, tel. | diario        | heredado (`POSLogin.jsx`)           |
| `/qr/[token]`                         | Portal del comensal                    | comensal                  | teléfono          | público       | mixta (`PortalCliente.jsx`)         |
| `/cocina-telefono/[token]`            | Teléfono de una estación               | cocina                    | teléfono          | diario        | recompuesta                         |

Sin interfaz propia: `/mesas` y `/corte-caja` redirigen; `Barra.jsx` y `CorteCaja.jsx` no los
monta nadie (código muerto). `/sistema` es la página del sistema de diseño.

**Lo que más importa para el diseño:** las 12 pantallas recompuestas de
`app/(modelos)/restaurante/*` (mapa de mesas, mesa activa, precuenta, cocina, cobro, caja,
inventario, platillos, recetas, registros, acceso) **no cuelgan del menú real** (D-52): sólo las
abren las pruebas y la galería. Lo que cada puesto usa todos los días es heredado o mixto. Por eso
el diseño nuevo se aplica a las pantallas REALES (DP-D36), no a sus gemelas.

**Lo que `fase-b` cambia aquí:** ninguna ruta nueva. `Mesero.jsx` suma «Unir mesas» y el efecto
líquido (`src/restaurante/unir-mesas/*`), `Caja.jsx` la pregunta al liberar una mesa unida y
`PortalCliente.jsx` el carrito compartido (`src/portal/carrito-compartido/*`).

**Piezas compartidas** que cambian todas las pantallas a la vez: `AppLayout`, `Sidebar`,
`BrandedBackground`, `MobileAdminRadialMenu`, `heredado/components/ui` (Card, Dialog, Tabs,
Button…), `PageHeader` (11 pantallas), `StatCard`, `EmptyState`, `LoadingState`.

**Degradados que `verify:aspecto` no ve** (van en `style` en línea): `Caja.jsx`, `Cocina.jsx`,
`Dashboard.jsx` (`ColoredStatCard`), `Mesero.jsx` (`MesaShape`, `MesaGridMobile`,
`MeseroCartFAB`, `AbrirMesaDialog`), `Sidebar`, `PropinaDialog`. Los de clase sí los protege.

## 2 · Línea base de rendimiento (antes del diseño nuevo)

`scripts/medir-fluidez.mjs` contra la aplicación compilada de `main` y una base de demo
desechable, Chrome con la CPU **4× más lenta**, tableta (Galaxy Tab S4 horizontal) y teléfono
(Pixel 7). Un cuadro es el tiempo entre dos `requestAnimationFrame`; «tirón» = cuadro de más de
50 ms. Datos: `docs/reports/evidencia-004/fluidez-antes.json`.

| Aparato  | Pantalla / acción           | Tiempo | Cuadros por segundo | p95    | Tirones |
| -------- | --------------------------- | ------ | ------------------- | ------ | ------- |
| tableta  | Mesero: cargar              | 1.8 s  | —                   | —      | —       |
| tableta  | Mesero: desplazarse         | —      | 59.6                | 17 ms  | 0       |
| tableta  | Mesero: abrir mesa libre    | 0.40 s | 15.7                | 283 ms | 1       |
| tableta  | Mesero: abrir mesa ocupada  | 1.3 s  | 20.5                | 183 ms | 5       |
| tableta  | Caja: cargar                | 1.6 s  | (no se desplaza)    | —      | —       |
| tableta  | Tablero: cargar / desplazar | 1.4 s  | 54.8                | 17 ms  | 3       |
| teléfono | Mesero: cargar              | 1.3 s  | (cabe en pantalla)  | —      | —       |
| teléfono | Mesero: abrir mesa libre    | 0.40 s | 20.0                | 267 ms | 1       |
| teléfono | Mesero: abrir mesa ocupada  | 0.98 s | 16.8                | 533 ms | 2       |
| teléfono | Caja: cargar                | 1.6 s  | (no se desplaza)    | —      | —       |
| teléfono | Tablero: cargar / desplazar | 1.5 s  | 58.0                | 17 ms  | 1       |

**Lectura:** desplazarse ya va a 55–60 cuadros. Lo pesado es **abrir una mesa**: el diálogo de la
mesa monta los 107 platillos de golpe y el hilo se atora (16–20 cuadros, un cuadro de hasta
0.5 s en el teléfono). Es la meta de DP-11.4: el vidrio y el movimiento no pueden empeorarlo, y
la mesa activa tiene que abrir a 60.

**Hallazgo de paso (no es de diseño):** las 10 mesas de producción están en la misma posición
(100, 100). En la tableta y la PC el mapa las enseña encimadas y sólo se puede tocar la de arriba
(el teléfono usa una cuadrícula y no se nota). En las bases de demo se acomodaron en cuadrícula;
en producción lo decide Miguel.

## 3 · El plan

Regla de esta etapa (el arranque manda sobre el encargo): **todo va a `main` y a producción en
cuanto queda verificado**, con la CI a mano en verde antes y humo y huella después; al cerrar cada
paso, `main` se fusiona en `fase-b`. No hay rama `diseno` (DP-D35).

| Paso    | Qué                                                                                     | A dónde             |
| ------- | --------------------------------------------------------------------------------------- | ------------------- |
| DP-11.1 | Morfi: «Cargando», 404 de la app y del portal, y las dos piezas del modo espera         | `main` → producción |
| DP-11.2 | Modo espera en Caja, Tablero, Cocina y administración (nunca en Mesero ni en el portal) | `main` → producción |
| DP-11.3 | Gestor de sonido, mapa de sonidos y Configuración → Sonidos                             | `main` → producción |
| DP-11.4 | Lenguaje nuevo en el sistema de diseño, `morphiq`, `don-poncho` y `retro`; pilotos      | `main` → producción |
| pausa   | Sin el OK de Miguel no se sigue con el resto de las pantallas                           | —                   |
| DP-11.5 | Las demás pantallas, por lotes                                                          | `main`, con su OK   |

Las preferencias nuevas viven en `configuracion.valores` (por negocio) o en el aparato: ninguna
pide migración. Lo de `fase-b` (unir mesas, carrito compartido) recibe el lenguaje nuevo al
fusionar `main` en `fase-b`.
