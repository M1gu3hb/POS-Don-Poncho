# DP-11.4 · Reconocimiento de los pilotos y la navegación (30-10-2026)

Lector Sonnet de sólo lectura sobre `93f2884`. Las líneas citadas son de ese commit.

## Nota sobre la rama

`HEAD` (93f2884) es igual a `origin/main`. El `main` local está obsoleto (6f8e9a3, era DP-10). Por eso `git diff main..origin/fase-b` mezcla todo el trabajo de DP-11.0 a 11.2 con lo propio de fase-b. Lo propio de fase-b se ve con `git diff HEAD...origin/fase-b`: 12 commits, 108 archivos, DP-9.5 (pedido compartido) y DP-9.6 (unir mesas).

## 1. Tablero (`heredado/pages/Dashboard.jsx`, 662 líneas)

La ruta es `app/(interno)/page.tsx`. Es un componente de servidor: dueño, administrador y gerente ven el tablero, y los demás van a `IrAlInicioDelRol`.

**Secciones**

- Encabezado, líneas 265-293. Usa `PageHeader`, que pinta un `h1` "Buen día" seguido de un `div` hermano con las acciones. Las acciones son "Nueva venta" (a `/pos`, si hay mesas), "Ir a Caja" (si no hay mesas) y "Registrar compra".
- Dos bloques que ya son de `src`: `AccesosDelDueno` (línea 295, usa `Superficie`) y `RecetasPendientes` (línea 296).
- `PrimerosPasosCard`, 302.
- Aviso de caja abierta o cerrada, 306-324.
- Esqueletos de `~/cliente/EstadosDeCarga`, 334.
- Cifras: cuatro `ColoredStatCard` en 345-381 (Ventas hoy, Costo de ventas, Utilidad bruta, Ticket promedio).
- Fila de pagos en 384-424: `PaymentCard` local (línea 614) para Efectivo, Tarjeta y Transferencia, más Gastos operativos y Utilidad neta.
- Inventario crítico, 427. `FinancialChart`, 438. `PropinasDashboardSection`, 441.
- `ChartsRow`, 444 y 477: dona de recharts (`PaymentDonut`, 553) y alertas de inventario.
- `CorteHistorialList`, 454-471.

**Datos**

- Todo es `useQuery` sobre `api.entidades.*`, el puente de `heredado/api/cliente.ts`: ventas pagadas (línea 69), ingredientes (75) y gastos (81), con `staleTime` de 5 s.
- Cinco consultas de onboarding (104-128), activas solo con `enabled: onboardingVigente`.
- `useCajaAbierta` (`lib/useCajaAbierta.js`).
- Los KPI se calculan en el navegador, en el `stats` de 147-206. Usan pesos como números, no centavos, y filtran las ventas por `corte_caja_id` o por `fecha_cierre` posterior a la apertura. Esa función es pura y se puede extraer.

**Aspecto**

- Las tarjetas se pintan con degradados y hex en línea. `ColoredStatCard` usa `STATCARD_PALETTES` (`lib/darkPalettes.js`) y la clase `premium-sheen` (`index.css:165`).
- `PAYMENT_COLORS` son hex.
- El tooltip de recharts lleva hex oscuros en línea (574-595).
- Todo depende de `useIsDark()` (`lib/ThemeContext.jsx`).

## 2. Mesero (`heredado/pages/Mesero.jsx`, 1545 líneas)

**Reparto del archivo**

- Imports, 1-80. `useIsMobile` local (menos de 768 px), 86. Error boundary, 116. Componente `Mesero`, 127.
- Consultas: solicitudes cada 6 s (174), mesas cada 5 s con `claves.mesas.activas()` (248), productos (~284), categorías (296).
- Manejadores:
  - `onMesaClick`, 350. Hace `Venta.get` y luego `DetalleVenta.filter` en serie (401-403).
  - `confirmarAbrirMesa`, 419. `cerrarDialog`, 491.
  - Carrito, 527-660. `enviarPedido`, 660.
  - `pedirCuenta`, 781. `finalizarPedirCuenta`, 878. `liberarMesaHuerfana`, 961.
- Render, 986-1545:
  - Encabezado con `h1` "Mesero".
  - `SelectorDeVista` (1029) y `VistaDeSolicitudes` (1037).
  - Pestañas de zona.
  - Mapa: `isMobile ? MesaGridMobile (1086) : MesaShape (1111)` sobre `FLOOR_BG`, con 600 px de alto.
  - Leyenda (1149).
  - `AbrirMesaDialog` (1169).
  - Diálogo de la mesa (1183-1500):
    - Título con pastilla de estado.
    - `ListosParaRecogerCard` (1263).
    - Catálogo (1310).
    - Columna derecha `md:w-72` con "PEDIDO ACTUAL", carrito, "Enviar a Cocina" y "Solicitar cuenta".
    - `MeseroCartFAB` (1451).
  - `PropinaDialog` (1504). Diálogo de precuenta (1516).

**Lo que ya viene de `src`**

- `GlobosDeSolicitud`, `SelectorDeVista`, `VistaDeSolicitudes` y los módulos `globos-de-solicitud` y `vista-de-solicitudes`.
- `~/cliente/mesas-del-mapa` y `claves`.
- `MesaActiva.tsx` no se usa aquí. Es de la gemela.

**Código muerto**

- `components/mesero/MesaActivaView.jsx`, 359 líneas, no lo importa nadie.
- `Barra.jsx` y `CorteCaja.jsx` (según `INVENTARIO-DP-11.md`).

**Lo pesado al abrir una mesa**

- Es `productosFiltrados.map` en la línea 1310. Monta 107 botones, cada uno con `PrecioProductoMesero`, `VariableBadge`, un icono, un `style` en línea y `productoTieneModificadores(p)` calculado en cada render.
- Nada está memorizado, y todo está dentro del Dialog de Radix.
- `carrito` y `busquedaProducto` viven en el `Mesero` de nivel superior. Cada toque, tecla o sondeo (5 s y 6 s) re-renderiza el mapa y los 107 botones.
- Línea base, tomada con CPU 4× más lenta: abrir mesa ocupada da 20 fps y p95 de 183 ms en tableta; en teléfono, 17 fps y 533 ms (`INVENTARIO-DP-11.md` §2, `evidencia-004/fluidez-antes.json`).

## 3. Caja y cobro (`heredado/pages/Caja.jsx`, 1857 líneas)

- Estado y consultas, 124-215: `ventas_pendientes_caja` cada 2 s, pagadas, gastos, cortes.
- Manejadores:
  - `buscarVenta`, 302. `abrirVenta`, 376.
  - `handleEliminarTicketCero`, 475.
  - `handleCobrar`, 520, que usa `/api/venta/cobrar` y clave de idempotencia.
  - `handleAbrirCaja`, 854. `handleCorteTurno`, 900.
  - `intentarAbrirCierreDiario`, 925. `handleCierreDiario`, 954.
- Render, 1074-1857:
  - Encabezado con `h1` "Caja" y tres botones: "Abrir caja" / "Corte de turno" / "Cierre diario". En teléfono se acortan a "Abrir" / "Turno" / "Cierre".
  - Pestañas (1227): Pendientes (n) (1248), Buscar (1346), Resumen (`ResumenDelDia`, 1372), Historial (1385).
  - Diálogo de cobro (1391-1698). Título "Cobrar — Mesa N". Cuatro teselas de método (`METODOS`, 78 y 1516). Campo "Recibido" (`NumericInput`, 1531). Tres campos en el mixto más la propina por método (1551-1633).
  - Ticket final (1700, "TICKET DE PAGO"), `PropinaDialog`, `AbrirCajaDialog`, `CorteTurnoDialog`, `CierreDiarioDialog`, `MesasPendientesCierreDialog`, `CorteViewerDialog`.
- **No existe teclado en pantalla de cobro.** `NumericInput` es un campo de texto con `inputMode="decimal"` (líneas 39-40).
- Los únicos teclados son los de PIN, y hay dos copias hechas con `Button` outline:
  - `AccesoPorPin.tsx:200` (`TecladoNumerico`).
  - `espera/PedirPinAlDespertar.tsx:121`.
- El "teclado de cobro" neumórfico es un componente nuevo, no un restilizado.
- Tampoco hay `Switch` en estos tres pilotos. Los interruptores están en Configuración.

## 4. Las gemelas (`src/restaurante`)

| Gemela                                 | Qué es                                                                                                        | Qué le falta frente a la heredada                                                                                                                                                                                                                                        | Veredicto                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `MapaDeMesas.tsx` (496)                | Rejilla por urgencia, sin plano posicional. `h1` "Mesas", zonas con `aria-pressed`, leyenda, `ViewTransition` | Plano con `posicion_x` y `posicion_y`; sondeo de 5 s (no tiene); globos de solicitud; selector Mesas/Solicitudes; filtro por asignación; flujo de limpieza y de mesa huérfana; abrir mesa con alergias y celebración (navega a `mesa-activa`); unir mesas; `h1` "Mesero" | Alimenta: reutilizar `ESTADOS`, `porUrgencia` y `zonasDe` |
| `MesaActiva.tsx` (925)                 | Pantalla, no diálogo. Comanda, enviadas, anular, dividir, unir, cambiar, listos                               | Categorías; modificadores; productos variables por kilo (importante para barbacoa); alergias, celebración y cliente al abrir; notas y exclusiones por línea                                                                                                              | No sustituye. Solo se le toma el patrón del catálogo      |
| `Cobro.tsx` (770) + `piezas-del-cobro` | Pantalla de cobro con propina, descuento, cancelar, dividir, F12; `CampoDeDinero`                             | Es página, no diálogo; cambia la lógica de entrada                                                                                                                                                                                                                       | Alimenta con `pagos-del-cobro.ts` y `ParedDePropina`      |
| `Caja.tsx` (947)                       | Tabla o tarjetas, Buscar, Movimientos                                                                         | Sin corte de turno ni cierre (viven en `CierreDiario.tsx`); no abre diálogo de cobro                                                                                                                                                                                     | Parcial                                                   |

La conclusión de `INVENTARIO-DP-11.md` es que el diseño nuevo se aplica a las pantallas reales y no a las gemelas. Sus piezas sí sirven como código.

## 5. Navegación

- **`AppLayout.jsx`** (106 líneas). Aplica la guarda de ruta (`rutaPermitidaParaElPuesto`). Muestra `MorfiCargando` mientras carga. Monta `ModoEspera` encima.
  - En línea 88, el `main` lleva `lg:ml-60` o `lg:ml-16`.
  - El prop `marco="modelo"` empieza con la barra colapsada.
- **`Sidebar.jsx`** (362 líneas).
  - `nav aria-label="Menú principal"`, línea 205.
  - Barra fija `hidden lg:flex`, línea 356.
  - Hamburguesa `lg:hidden` con `aria-label="Abrir menú"` (línea 321), con z-70.
  - Cajón con `aria-label="Cerrar menú"` (líneas 335 y 344).
  - `ThemeToggle`, línea 275.
  - `SidebarContent` es un componente definido dentro de `Sidebar`, así que se re-crea en cada render.
- **`MobileAdminRadialMenu.jsx`**. Botón flotante abajo a la derecha (z-60), con abanico de ocho entradas (`CUPO_DEL_ABANICO`).
  - Detecta compacto con `window.innerWidth < 1024` (línea 68).
  - El dock lo sustituye o convive con él.
- **`BrandedBackground.jsx`**. Fondo fijo con degradado, más `GlassPanel` (ya tiene un `backdrop-blur-xl` sin uso en los pilotos).
- **Origen del menú.** `navegacionParaRolYPlantilla` está en `heredado/lib/packageConfig.js:405`. Combina:
  - Las 12 entradas de `NAV_ITEMS` (`lib/permissions.js:60`).
  - "Cierre del día" (permiso `ver_caja`).
  - El contrato `packages/contracts/src/comandos/navegacion.ts`.
- **Entradas por rol en restaurante:**
  - Dueño, gerente, administrador: 13 (Dashboard, Mesas y pedidos, Cocina, Caja, Ventas, Recetas, Platillos, Inventario, Compras, Registros, Portal QR, Configuración, Cierre del día).
  - Cajero: Caja, Ventas, Cierre del día.
  - Mesero: solo Mesas y pedidos.
  - Cocina: solo Cocina.
  - Almacén: Recetas, Platillos, Inventario, Compras.
- **Cómo se decide tableta, teléfono o PC.** Hay cuatro criterios distintos:
  - CSS `lg` (1024) para barra o hamburguesa.
  - JS `<768` en `Mesero.jsx:86` y `hooks/use-mobile.jsx`.
  - JS `<1024` en el menú radial.
  - `matchMedia` de 1280 en `Caja.tsx` (`useEsPC`).
- **Efecto en Playwright.** El proyecto `tablet` mide 1138 px de ancho, así que hoy ya usa la barra de PC. Un dock "en tableta" cambia ese comportamiento. Los tres proyectos son `escritorio` (1280), `tablet` (1138) y `telefono` (412).

## 6. Lo que las pruebas exigen (no romper)

**Tablero** (`restaurante.spec.ts:201`, `ayudantes/sesion.ts:885`, `dia-completo:701,743`)

- `h1` "Buen día".
- `accionesDelTablero` navega con `xpath=../following-sibling::div[1]` desde el `h1`. Hay que conservar esa estructura de dos `div` hermanos.
- Botón "Nueva venta", presente. Botón "Ir a Caja", ausente en restaurante, pero con una segunda aparición legítima en el aviso.
- Texto "No hay caja abierta".
- El importe del día se busca con `getByText('$x,xxx.xx')`. `Dinero` es compatible, porque su `textContent` es "$1,234.56".

**Mesero** (`ayudantes/mesas-heredadas.ts`, `estados-de-mesa.spec.ts`)

- `h1` "Mesero".
- Número de mesa: `span.font-heading` con texto exacto.
- Diálogo con nombre `^Mesa N ` (título, pastilla de estado, personas). Se usa también `h2 span.rounded-full` para la pastilla.
- Plano de PC: `div.cursor-pointer.select-none`, etiqueta de estado `span.leading-tight`.
- Rejilla de teléfono: `button.rounded-2xl`, etiqueta `span.rounded-full.border`.
- Leyenda: `div[class~="text-[10px]"] div.bg-card`.
- Zonas: botón `^Zona\b`.
- Diálogo "Abrir mesa N" (el primer `spinbutton` son las personas) y botón "Abrir mesa".
- Platillos: botón con nombre `^Nombre \$` (nombre, precio, área).
- Botones: "Enviar a Cocina" (exacto), "Solicitar cuenta" (exacto), "Marcar entregado".
- FAB de teléfono con nombre `/\d+ productos? .*Ver pedido|^Mesa abierta\b/`.
- Mensaje "¡Pedido enviado a cocina!".
- Propina: "¿Desean agregar propina?", "Sin propina", "Aplicar", "10%", "15%".
- Precuenta: "PRE-CUENTA", "TOTAL", código `M\d{2}-\d{4}`, "Cerrar".
- `confirm()` nativo "¿Marcar mesa como limpia…?".
- Selector de vista: botones `^Mesas` y `^Solicitudes`.
- Globos: "Mesa 5: Necesita ayuda. Tocar para atender.".
- `MESA_STATUS_CONFIG` se lee con una expresión regular sobre `heredado/lib/constants.js`.
- `ponerElModo` escribe `mh_theme='dark'` o lo borra. Se espera `data-modo` igual a `claro` u `oscuro`. El modo "Automático" nuevo tiene que resolver a esos dos valores.

**Caja**

- Pestaña `^Pendientes`.
- Botón con nombre `^Mesa N Cuenta`. En el JSX el folio queda entre "Mesa N" y la insignia "Cuenta". No verifiqué cómo cumple hoy el nombre accesible, así que no hay que mover el orden.
- Diálogo con "Cobrar — Mesa N".
- Teselas de método con nombre exacto (Efectivo, Tarjeta, Transferencia, Mixto).
- Placeholder `0.00` en Recibido y `0` en los campos del mixto. El orden de los campos importa (`nth(0)`, `nth(1)`, `nth(3)`, `nth(4)`).
- Texto `✓ La venta ($…) queda cubierta.`.
- Botón `^Cobrar \$`.
- "TICKET DE PAGO".
- "Abrir caja" (con `.first()`), "Efectivo inicial contado", "Caja abierta. Ya puedes cobrar.".
- Botones "Corte de turno" o "Turno", "Cierre diario" o "Cierre".
- Diálogos "Corte de turno" y "Cierre de caja diario", "PROPINAS DEL DÍA (PENDIENTES DE LIQUIDAR)", "Cerrar caja del día" y la descarga `Corte_*.pdf`.

**Navegación y PIN**

- `button[aria-label="Abrir menú"]` con un `svg` dentro.
- Su contraste (icono contra fondo) debe ser al menos 3 en los nueve estilos, claros y oscuros (`dia-completo:361`).
- `nav` "Menú principal" con enlaces cuyo `innerText` sea el rótulo exacto. `elMenuDe` espera `['Mesas y pedidos']` para el mesero.
- Botón "Cerrar menú" que deja el menú en cero visibles.
- `aria-label` "Expandir", "Colapsar" y "Salir".
- Teclas de PIN con nombre exacto igual al dígito.
- "Cambiar de persona".

**Visuales y de estilos**

- La galería (`galeria.spec.ts`) tiene 81 retratos (9 pantallas × 9 estilos) de escritorio en Linux. Incluye `inicio`, `mesas` y `heredado-mesero`. Con `maxDiffPixels` de 150, todos cambian.
- Un estilo nuevo `retro` se suma a `Object.keys(ESTILOS)` y pide 9 retratos más.
- La galería fija 5 atributos `data-*` en `<html>`. Una perilla `aero` necesita su atributo ahí y en `atributosDeEstilo` (`tokens/estilos.ts:210`).
- Varias pruebas mandan `{estilo, densidad, redondeo, elevacion, movimiento}` a `/api/configuracion/apariencia`. La perilla nueva debe ser opcional en el servidor.
- `dia-completo-restaurante.spec.ts:344` tiene la lista de nueve estilos escrita a mano.
- `estilos-del-negocio.spec.ts` fija "son nueve" y parsea `ESTILOS_DISPONIBLES` en `packages/app/src/configuracion/apariencia.ts`.
- El rastreador mide contraste solo dentro de `table *` y `[data-dinero]`. Omite lo que tenga `background-image`.

**Contratos estáticos y puertas**

- `apps/web/src/cliente/pantallas-de-mesas.contrato.test.ts` fija en `Mesero.jsx` el inicializador `mesasZona`, las props de `MesaGridMobile` y `mesasZona.map((mesa)=>`.
- `claves-sin-colisiones.contrato.test.ts` lee todos los `useQuery` de `heredado`.
- `verify:aspecto` compara clases, textos e iconos de cada `.jsx` contra una base. Todo cambio estructural necesita su entrada en `scripts/aspecto-permitido.json`.
- `verify:adopcion` exige que lo nuevo en `src` use `Superficie`, `Tabla`, `Dinero` y los tres estados del sistema.

## 7. fase-b (`git diff HEAD...origin/fase-b`)

- `Mesero.jsx` (+79).
  - Botón "Unir mesas", visible para mesero y administrador.
  - `mesasZona` pasa a un `useMemo` con `sinAbsorbidas` y `nombreConUnidas`, y aparece `mesasDeLaZona`.
  - Si `uniendo`, se renderiza `<UnirMesasEnElMapa>` en lugar del mapa.
  - `liberarMesaConPregunta` en las líneas ~411 y ~1011.
  - Se llega por `?unir=<mesa>`.
- `Caja.jsx` (+14): la misma pregunta "¿Separar las mesas?" al liberar o cancelar.
- `globals.css`: `--animate-temblar` (rotación de ±1.5° con `alternate`).
- **El efecto líquido** es SVG con un filtro gooey, sin canvas ni librerías. Está en `unir-mesas/MesasQueSeFunden.tsx`:
  - Aplica `feGaussianBlur` (`stdDeviation=9`), `feColorMatrix` (alfa `22 -10`) y `feComposite atop`.
  - Dibuja una elipse o rectángulo por mesa con `fill-primario` o `fill-borde-fuerte` (tokens).
  - Los botones reales van encima, con arrastre y atracción.
- `UnirMesasEnElMapa.tsx` (267 líneas) lleva `Superficie nivel={0}` sobre `bg-fondo-sutil`, con alto de 600 px escalado. Es la superficie que más sufre con un `backdrop-filter`.
- fase-b cambia 9 retratos de `heredado-mesero`, los contratos y `restaurante-operaciones.spec.ts` (+228 líneas).
- Hay conflicto seguro con DP-11.4 en `Mesero.jsx` y en los PNG.
- Pruebas nuevas de fase-b:
  - `unir-mesas-en-el-mapa.spec.ts`: región "Unir mesas", botones `Mesa N`, "Unir 2 mesas", "¿Qué número queda?", "Separar mesas".
  - `pedido-compartido.spec.ts`.

## 8. Propuesta de corte (≤300 líneas cada archivo, usando `Superficie`, `Dinero`, `Tabla` y `Esqueleto`)

**Tablero**. `Dashboard.jsx` queda en unas 150 líneas: consultas, gates de módulo y orden.

- `src/tablero/cifras-del-dia.ts`, con su prueba (el `stats` de 147-206, en centavos).
- `CifraDelTablero.tsx`: sustituye `ColoredStatCard` y `PaymentCard`, con tono semántico por token.
- `FilaDeCifras.tsx`.
- `DonaDeMetodosDePago.tsx`: usa `sistema/grafica.tsx` y colores tomados de tokens.
- `AlertasDeInventario.tsx`.
- `CortesRecientes.tsx`.
- `AvisoDeCaja.tsx`.
- `EncabezadoDelTablero.tsx`, con la estructura `h1` más `div` hermano.
- Se quedan en `.jsx`: `PrimerosPasosCard`, `FinancialChart`, `PropinasDashboardSection`, las consultas de onboarding.

**Mesero**. `Mesero.jsx` queda como cascarón: consultas, comandos con claves de idempotencia, y el cableado de `PropinaDialog`, `AbrirMesaDialog`, `PreCuentaTicket` y `AlertasMeseroDialog`.

- `src/mesero/TeselaDeMesa.tsx`. Recibe una prop `forma`: `plano` | `rejilla`. Conserva las clases que usan las pruebas, o se cambian en el mismo commit.
- `PlanoDelSalon.tsx` (suelo sólido, ya no `FLOOR_BG` en línea) y `RejillaDeMesas.tsx`.
- `ZonasDelSalon.tsx`.
- `LeyendaDeEstados.tsx`.
- `CabeceraDeLaMesa.tsx`.
- `CatalogoDeLaMesa.tsx` y `PlatilloTesela.tsx` (con `memo`, `content-visibility` o virtualización).
- `PedidoDeLaMesa.tsx`.
- `use-borrador-de-la-mesa.ts`. Mueve `carrito`, la búsqueda y el filtro fuera de `Mesero`, que es la mayor ganancia de rendimiento. Se llama así para no chocar con el carrito del comensal en `src/portal/carrito-compartido`.
- Serializar menos `Venta.get` y `DetalleVenta.filter` con `Promise.all`.
- Hay que actualizar `pantallas-de-mesas.contrato.test.ts` y el dock sobre el FAB del carrito (z-58 y z-65/66).

**Caja y cobro**. `Caja.jsx` conserva los manejadores.

- `src/caja/CabeceraDeCaja.tsx` (los tres botones con sus rótulos cortos).
- `CuentasPendientes.tsx`.
- `TeselasDeMetodo.tsx`.
- `TecladoDeCobro.tsx`: nuevo y neumórfico, y además de `NumericInput`, no en su lugar.
- `TecladoNumerico.tsx` compartido, que reemplaza las dos copias de PIN.
- `ResumenDeCobro.tsx`.
- Los diálogos de caja se quedan heredados en la primera pasada.

**Navegación**. En `src/navegacion/` o `packages/ui/sistema/navegacion.tsx`, sin tocar `packageConfig`:

- `DockFlotante.tsx`: `nav aria-label="Menú principal"` con enlaces con texto.
- `BarraLateral.tsx`.
- `use-formato-del-aparato.ts`: un solo punto de decisión de tableta, teléfono y PC.
- `SelectorDeModo.tsx` (Automático, Claro, Oscuro), compatible con `mh_theme` y `data-modo`.
- `AppLayout` cambia los márgenes (`lg:ml-60`, `pt-14`) y retira la hamburguesa y el menú radial.

## 9. Riesgos principales para DP-11.4

- Cambiar las clases marcadoras de mesa obliga a editar `estados-de-mesa.spec.ts` y `mesas-heredadas.ts` en el mismo commit.
- Para el dock, el z-index tiene que quedar por debajo de los diálogos (z-50) y no chocar con `MeseroCartFAB` ni con el menú radial.
- La galería de 81 PNG se regenera completa, más 9 nuevos para `retro`.
- La perilla `aero` debe ser opcional en el comando del servidor.
