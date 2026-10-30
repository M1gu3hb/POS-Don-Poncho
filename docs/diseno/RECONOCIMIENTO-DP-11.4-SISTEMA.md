# DP-11.4 · Reconocimiento del sistema de diseño (30-10-2026)

Lector Sonnet de sólo lectura sobre `93f2884`. Las líneas citadas son de ese commit.

**Cuatro hallazgos que cambian el plan.**

1. Las pantallas reales (112 archivos de `heredado/`) usan las primitivas shadcn de Miguel (`@/components/ui/*`), no las de `packages/ui`. Sólo 6 archivos heredados importan `@morphiqpos/ui`, y sólo `Esqueleto` y `ErrorDePantalla`. Esas primitivas escriben `shadow`/`shadow-lg`, `h-9` y `bg-card`: `heredado/components/ui/button.jsx:14-22`, `dialog.jsx:35`, `card.jsx:9`, `switch.jsx:10`. Por eso la perilla `elevacion` (`--sombra-N`) no les llega. Les llegan los colores, vía los alias en inglés de `heredado/index.css:47-103`, y `--radius`, que es `--radio-lg` (`index.css:76`).
2. El modo «Automático» no existe.
3. La navegación real es `heredado/components/common/Sidebar.jsx`. `BarraLateral` y `AbanicoInferior` de `packages/ui` sólo se usan en `/sistema`.
4. La galería retrata sólo en claro. Cada token nuevo se mide como color opaco; el vidrio y el halo no se miden.

## 1 · packages/ui

Estructura:

- `src/estilos/`: `base.css`, `index.css`, `capas.css` y un CSS por estilo.
- `src/tokens/`: `contrato.ts`, `estilos.ts`, `color.ts`, `leerCss.ts`.
- `src/hooks/useApariencia.ts`.
- `src/primitivas/`: 36 archivos.
- `src/sistema/`: 11 piezas.

Tokens:

- Los tokens que no son color y las 4 perillas viven en `base.css`. Los de `:root` van en `:12-111`; las perillas en `:146-294`.
- Los colores van por estilo, bajo `[data-estilo='x']` y `[data-estilo='x'][data-modo='oscuro']` (por ejemplo `morphiq.css:36,145`).
- El contrato en TS es `contrato.ts`: `ESTILOS_CONSTRUIDOS` `:39`, 37 `TOKENS_COLOR` `:57`, `TOKENS_BASE` `:126`, `PERILLAS` `:196`, 24 `PARES_DE_CONTRASTE` `:237`.
- `--sombra-tinte` es por estilo y no está en el contrato. Si un estilo lo olvida, ninguna prueba falla y las sombras se rompen.

**Un estilo** son tres cosas:

- el archivo `estilos/<clave>.css` (el nombre debe ser la clave exacta);
- su entrada en `ESTILOS` (`estilos.ts:32-161`) con sus 4 perillas de fábrica;
- su clave en `ESTILOS_CONSTRUIDOS` y su `@import` en `estilos/index.css:7-19`.

`capas.css` guarda lo que un token no dice (blur, texturas, tipografía).

| Estilo     | Perillas (densidad / redondeo / elevación / movimiento) | Qué fija                                                          |
| ---------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| morphiq    | normal / media / sombra / normal                        | Azul `217 91% 45%`, fondo `220 20% 98%`, lateral `222 47% 7%`     |
| cristal    | normal / amplia / sombra / expresiva                    | Primario `198 90% 32%`. Su blur está en `capas.css:30-38`         |
| relieve    | normal / amplia / doble-bisel / sutil                   | Gris azulado; invierte la sombra al pulsar (`capas.css:47-52`)    |
| taller     | guantes / media / doble-bisel / normal                  | Naranja; texturas en `capas.css:62-82`                            |
| bloque     | guantes / nula / linea-dura / sutil                     | Violeta; borde de 3 px (`capas.css:112`)                          |
| terminal   | compacta / nula / plana / nula                          | Ámbar; todo en monoespaciada (`capas.css:94`)                     |
| papel      | normal / sutil / plana / sutil                          | Tinta y papel; tracking cerrado                                   |
| noche      | cómoda / media / sombra / sutil                         | Turquesa; sin blanco puro (`capas.css:151`)                       |
| don-poncho | cómoda / sutil / sombra / sutil                         | Crema `56 60% 95%`, dorado `34 35% 38%`, lateral negro `60 5% 8%` |

El predeterminado es don-poncho, repetido en tres sitios que una prueba compara:

- `estilos.ts:185`;
- `packages/app/src/configuracion/apariencia.ts:199-205`;
- `configuracion.ts:114-120`.

**Cómo se aplica:**

- El servidor escribe 5 atributos en `<html>` (`app/layout.tsx:202-206`).
- `GUION_SIN_PARPADEO` (`heredado/tema-arranque.ts:25-38`) pone el estilo por omisión y la clase `.dark`.
- `GUION_DEL_MODO` (`src/proveedores/modo.ts:19-25`) deriva `data-modo` de `.dark`.
- `useApariencia.ts:86-93` reescribe los 5 atributos.
- En Tailwind, `oscuro:` apunta a `[data-modo='oscuro']` (`globals.css:57`) y `shadow-N` es `--sombra-N` (`globals.css:162-166`).

**Perillas.** Hoy son 4; ninguna se llama «aero». Interpreto «capas» y «aero» como dos valores nuevos de `elevacion`.

| Perilla    | Valores                                | Dónde se lee                                                                       |
| ---------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| densidad   | guantes, comoda, normal, compacta      | `base.css:146-186`: `--factor-espacio`, `--altura-control`, `--area-tactil-minima` |
| redondeo   | nula, sutil, media, amplia, pastilla   | `:191-224`: `--radio-*`                                                            |
| elevacion  | plana, sombra, doble-bisel, linea-dura | `:228-268`: `--sombra-0..4` y `--borde-ancho`                                      |
| movimiento | nula, sutil, normal, expresiva         | `:272-294`: `--duracion-*`                                                         |

Dos huecos útiles para el lenguaje nuevo:

- `--curva-resorte` (`base.css:84`) está en el contrato y nadie la usa.
- La presión es un literal en TSX: 0.97 en `button.tsx:24` y 0.98 en `superficie.tsx:134`. No hay token de presión.

## 2 · Claro/oscuro hoy

- **Existe, pero es binario.** `ThemeContext.jsx:22-28` devuelve `'light'` si no hay valor y el guion de arranque sólo mira `=== 'dark'` (`tema-arranque.ts:34`).
- **No hay «Automático».** No hay `prefers-color-scheme` en ningún CSS ni TS.
- **Dónde se elige.** El `ThemeToggle` está en el pie de `Sidebar.jsx:277,283` y en `PortalCliente.jsx:527`.
- **Apariencia no lo tiene.** `SelectorDeApariencia.tsx` sólo maneja estilo y 4 perillas (pestaña montada en `Configuracion.jsx:552-554`). `/sistema` tampoco tiene botón de modo.
- **Dónde se guarda.**
  - La elección de claro/oscuro va por aparato en `localStorage['mh_theme']`. No hay cookie, así que el servidor no puede saber el modo y todo depende del guion previo al primer pintado.
  - El estilo y las perillas van por negocio en `configuracion.valores.apariencia` (`apariencia.ts:91-196`).
- **Cómo añadir Automático sin romper la auditoría.**
  - Resolver `matchmedia` en los guiones y en `ThemeContext`, y seguir derivando `.dark` y `data-modo`.
  - Un `@media (prefers-color-scheme)` en las hojas no lo lee la auditoría: `resolverTokens` compara el selector exacto (`leerCss.ts:126-130`).
  - Las pruebas a tocar son `estilo-de-arranque.test.ts` y el helper `mh_theme` de `estados-de-mesa.spec.ts:350`.

## 3 · Primitivas

| Pieza                                                       | Cómo lee tokens                                                                     | Dónde pintar vidrio y borde de luz                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `Superficie` (`superficie.tsx:111-144`)                     | `nivel` 0-4 da `shadow-N`; lleva `bg-superficie border-borde` y expone `data-nivel` | `capas.css` con `[data-elevacion='x'] [data-nivel='3'\|'4']` (patrón de `capas.css:72`) |
| `Isla` (`:165`)                                             | Superficie nivel 3, radio completo, usa `--alto-abanico`                            | Hereda lo anterior                                                                      |
| `BarraFija` (`:200`)                                        | `bg-fondo/95 backdrop-blur-sm` y `shadow-2` si está pegada                          | El blur ya está en una clase TSX                                                        |
| `AbanicoInferior` (`navegacion.tsx:215`)                    | Ancho completo (`fixed inset-x-0 bottom-0 z-40`), mide su alto                      | Es el dock. Hoy es una barra, no una píldora                                            |
| `BarraLateral` (`:66`)                                      | `bg-lateral-fondo`, `w-16/w-60`                                                     | Sin uso real                                                                            |
| `Button` (`button.tsx:23-60`)                               | cva con `data-slot`, `data-variant`, `data-size`; `active:scale-[0.97]`             | Los teclados usan `variant` outline/ghost/default, sin gancho propio                    |
| `Dialog`, `AlertDialog`, `Sheet`                            | `bg-fondo` opaco, `shadow-3`; overlay `bg-velo/50`                                  | Hay que pintarlos por `data-slot` en `capas.css`                                        |
| `Popover`, `DropdownMenu`                                   | `bg-superficie-elevada shadow-2/3`                                                  | Mismo mecanismo (como el cristal actual)                                                |
| `Switch` (`switch.tsx:19`)                                  | Alto fijo `1.15rem`, `shadow-1`, `data-slot="switch"`                               | Neumorfismo por `data-slot` en CSS                                                      |
| `Tabs`, `ToggleGroup`                                       | `shadow-1` y `oscuro:`                                                              | Sin trabajo especial                                                                    |
| `ConfirmacionDestructiva` (`retroalimentacion.tsx:210-222`) | Overlay propio con `backdrop-blur-[2px]`                                            | Hay que alinearlo                                                                       |
| `Tabla`, `Dinero`, `Estados`                                | Sólo colores y `Superficie`                                                         | Sin cambio                                                                              |

Faltan dos ganchos: un `data-tacto` o `variant` para teclados de cobro/PIN, Cobrar y switches, y un token de presión (0.97). Hoy los teclados usan `Button variant` outline/ghost/default (`AccesoPorPin.tsx:211-218`) y el botón Cobrar es `size="lg"` (`Cobro.tsx:727`).

Un riesgo con el vidrio: `heredado/index.css:228-234` anula con `!important` todo `.backdrop-blur*` bajo `html.dark`. El vidrio hecho con clases Tailwind (`BarraFija`, `AbanicoInferior`) se apagaría en oscuro. Conviene hacerlo con `backdrop-filter` en `capas.css`.

## 4 · Compuertas

**`verify:estilos`** (`scripts/auditar-estilo.mjs`, más `sistema.test.ts`):

- Itera `ESTILOS_CONSTRUIDOS` y lee `base.css` más `estilos/<clave>.css` (`:41-51`).
- Resuelve `:root`, el selector del estilo, y en oscuro el selector con `[data-modo='oscuro']` (`:57-58`).
- Mide 24 pares (4.5 el texto, 3 los elementos de interfaz) y la distancia OKLab ≥ 0.12 entre `grafico-1..6`.
- Los valores deben ser `H S% L%` sin alpha (`color.ts:35`).
- Un estilo «retro» nuevo necesita:
  - su clave en `ESTILOS_CONSTRUIDOS`;
  - `retro.css` con los 37 tokens de color en claro y oscuro;
  - su entrada en `ESTILOS`;
  - un primario o una perilla distinta de cada otro estilo (`sistema.test.ts:94-117`).
- Una elevación nueva rompe `sistema.test.ts:163-169`, que exige exactamente 4 sombras distintas. Hay que subirlo a 5 o 6.
- `estilo-predeterminado.test.ts:27-42` fija la lista exacta de 9 estilos.

**`verify:primitivas`** son tres pasos:

- `tokenizar-primitivas --verificar` falla si una primitiva trae `dark:`, `shadow-md`, `h-9`, `p-4`, `duration-200` o `transition-all`.
- `tokenizar-pantallas --verificar` hace lo mismo con espacio y duración en `apps/web/src/**/*.tsx`.
- `verificar-primitivas.mjs` (`REGLAS` `:88`) escanea `.ts/.tsx/.jsx/.js` de `packages/ui/src`, `apps/web/app` y `apps/web/src`, y **no** mira `.css`. Prohíbe:
  - hex y `rgb()`/`hsl()` literal (permite `hsl(var(--x))`);
  - paleta Tailwind, `bg-white/black`, `h-6..16`, `shadow-xs..2xl`;
  - `duration-N`, `ease-[cubic-bezier]`, espacio de 3 en adelante, `text-[Npx]`, `text-4xl` o más;
  - emoji, `[var(--x)]`, alias en inglés y `dark:`.
  - También `.dark` dentro de las hojas del sistema (`:406`).
- Los exentos son `globals.css`, `colores-del-qr.ts`, `manifest.ts` y `src/mh` (`:250`). `TECHO_DE_RITMO = 0` (`:394`).
- Consecuencia: todo valor literal de vidrio, halo y degradado va en un `.css` de `packages/ui`.

**`verify:adopcion`** (`scripts/verificar-adopcion.mjs`, `scripts/lib/adopcion.mjs:200-211`):

- Revisa cada `.tsx` de `apps/web/src`.
- Marca como «superficie a mano» cualquier etiqueta en minúscula, `Link` o `button`/`a`/`label` con radio, fondo y borde o sombra (`esSuperficie`, `adopcion-jsx.mjs:62`). Los inputs quedan exentos.
- Exige también `Vacio`, `Esqueleto` y `ErrorDePantalla`/`Aviso`, o una fila en `SIN_ESTADO` con razón de al menos 40 caracteres.
- Los componentes con mayúscula (`Superficie`, `Button`) no se marcan.
- Un dock o una barra lateral nuevos en `apps/web/src` deben usar `Superficie` o `Button`, o se declaran en `SIN_ESTADO`.

**`verify:aspecto`** (`scripts/verificar-aspecto.mjs`):

- Compara `heredado/` contra el commit `cf12dcd` por clases, textos, iconos y atributos visibles. No ve `style` en línea.
- Cada cambio en `heredado/` (`Sidebar.jsx`, `ThemeToggle.jsx`, `Configuracion.jsx`, `POSLogin.jsx`, ...) exige testigos exactos en `scripts/aspecto-permitido.json`, con un `porque` de al menos 20 caracteres.
- `Sidebar.jsx` y `ThemeToggle.jsx` están intactos hoy. El patrón que ya se usa es escribir el componente en `apps/web/src` y montarlo con una línea (`Configuracion.jsx:45-47,554`).

**Galería** (`pruebas/e2e/galeria.spec.ts`):

- 9 pantallas × 9 estilos = 81 retratos; la carpeta de retratos tiene 81 archivos.
- Recorre `Object.entries(ESTILOS)` (`:156`) y escribe los 5 atributos (`:158-166`). Un estilo nuevo entra solo y suma 9 retratos.
- Los retratos de referencia son los de CI en Linux. Se regeneran con `actualizar_galeria` (`.github/workflows/verificar.yml:37`).
- No fija `data-modo`: sólo retrata en claro. El resto del `if` de la prueba es constante (`maxDiffPixels: 150`).
- Hay que añadir un `setAttribute` si se agrega un atributo nuevo, y un barrido en oscuro si se quiere cubrirlo.

**Listas fijas de estilos a editar a mano:**

- `pruebas/e2e/estilos.spec.ts:~52`.
- `pruebas/e2e/dia-completo-restaurante.spec.ts:343-353`.
- `apps/web/src/proveedores/estilo-de-arranque.test.ts:~80`.
- `ESTILOS_DISPONIBLES` y `ELEVACIONES` en `packages/app/.../apariencia.ts:30-45`. Es una copia manual del contrato: un valor de elevación no listado ahí lo rechaza el zod al guardar.
- Al leer, `useApariencia.ts:44-50` cae al valor de fábrica del estilo en silencio.

## 5 · GUIA-DE-RECOMPOSICION (`docs/fase-2/GUIA-DE-RECOMPOSICION.md`)

1. «Adoptada» exige 4 condiciones: cero superficies a mano, cero tablas a mano, cero dinero a mano y los 3 estados del sistema.
2. Toda caja es `Superficie` (`nivel`, `radio`, `relleno`, `interactiva`, `activa`); toda lista de filas es `Tabla`; todo importe es `Dinero`; todo vacío es `Vacio`.
3. Cada pantalla se valida sola con `node scripts/comprobar-pantalla.mjs <archivo>`.
4. Los colores llevan nombre del sistema en español: `bg-superficie`, `text-texto-sutil`, `oscuro:`. Los alias en inglés y los literales se rechazan.
5. El ritmo se escribe con tokens: `p-(--espacio-4)`, `h-(--altura-control)`, `shadow-0..4`, `duration-(--duracion-*)`.
6. Cero emoji; los iconos son de `lucide-react`.
7. El movimiento sólo explica algo (`conTransicion` y `VIAJE`); ninguna animación decorativa.
8. Los comandos, rutas, datos, textos visibles, `id` y `aria-label` no se cambian.
9. Cada modelo respeta su `04-INTERFAZ.md` y su vocabulario.
10. §7 prohíbe degradados y «cristal por todas partes», que **contradice el lenguaje nuevo**. Hay que reescribir esa sección. DP-3 y `POSLogin.jsx` ya eliminaron degradados.

## 6 · `/sistema`

- La ruta es `apps/web/app/sistema/page.tsx` y el componente es `src/sistema/PaginaDelSistema.tsx`, de 490 líneas.
- Tiene un selector de estilo y las 4 perillas (`:100-106`, `:150-186`).
- Enseña estas secciones: superficies, controles, dinero, datos, vacío/cargando/error, gráficas, retroalimentación y navegación.
- No tiene botón de modo claro/oscuro, y `estilos.spec.ts` no prueba oscuro.
- El dock y la barra lateral rediseñada se enseñan aquí, en la sección de navegación (`:451`).

## 7 · Riesgos si se cambia un token global

- **Alias en inglés.** Cambiar `--superficie`, `--borde` o `--primario` mueve los alias que usan los 112 archivos heredados (`index.css:47-103`). `--accent` es en realidad `--acento-suave` (`index.css:63`).
- **Tokens nuevos de color.** Cada uno necesita su `--color-*` en `globals.css`, y los contenedores imprimibles (`index.css:272-300`) tienen que redefinirlo si se pinta dentro de ellos (`imprimibles-en-papel.contrato.test.ts`).
- **Sombra del heredado.** `shadow`, `shadow-sm` y `shadow-lg` del heredado no leen la perilla; el cambio no los alcanza.
- **Brand dinámico.** El gradiente del ítem activo de `Sidebar.jsx` y los colores de marca (`--brand-*`) son independientes del estilo.
- **Contraste dependiente del fondo.** Un cambio en `--fondo`, `--superficie` o `--velo` mueve 24 pares × 9 estilos × 2 modos. Los pares de `anillo` (3:1) controlan el halo.
- **Blur en gama baja.** Baseline de rendimiento: abrir una mesa en el teléfono lleva un cuadro de hasta 0.5 s (`INVENTARIO-DP-11.md:81`).
- **Rastreo.** `textosIlegibles` compone fondos de ancestros y no ve `backdrop-filter`, imágenes ni degradados de fondo.
- **Dock.** `estilos.spec.ts` no mide si un dock fijo tapa la última fila. Cada pantalla debe reservar hueco con `--alto-abanico`.
- **Contratos de tamaño.** `--area-tactil-minima` lo mide `estilos.spec.ts` en un navegador real.

## Para añadir el lenguaje nuevo hay que tocar:

**Sistema de diseño (`packages/ui`)**

- `src/tokens/contrato.ts`: `ESTILOS_CONSTRUIDOS`, `PERILLAS.elevacion` (`capas`, `aero`) y, si hace falta, nuevos tokens y pares.
- `src/tokens/estilos.ts`: entrada `retro` y perillas rehechas de morphiq y don-poncho.
- `src/estilos/base.css`: bloques `[data-elevacion='capas'|'aero']`, más tokens de vidrio, halo y presión.
- `src/estilos/retro.css` (nuevo) con claro y oscuro; `morphiq.css` y `don-poncho.css` rehechos; `index.css` con el `@import`; `capas.css` para blur, borde de luz y neumorfismo por `data-slot` y `data-nivel`.
- `src/sistema/superficie.tsx` y `navegacion.tsx` (dock, píldora, barra lateral), `retroalimentacion.tsx`, y `primitivas/button.tsx`, `switch.tsx`, `dialog.tsx`, `sheet.tsx`, `popover.tsx` y `dropdown-menu.tsx` (ganchos y presión).
- `src/hooks/useApariencia.ts` sólo si hay atributo nuevo.

**Capa de datos**

- `packages/app/src/configuracion/apariencia.ts:30-45,199-205` y `configuracion.ts:114-120` (listas y defaults).
- `packages/app/src/negocio-de-prueba/como-nueva.ts:28` y `docs/cliente/negocio-don-poncho.json:25` (valores guardados).

**Aplicación**

- `apps/web/app/globals.css`: `@theme inline` para tokens nuevos y `custom-variant`.
- `apps/web/heredado/index.css`: la regla de blur en oscuro (`:228-234`) y los contenedores imprimibles.
- `apps/web/heredado/tema-arranque.ts`, `src/proveedores/modo.ts` y `heredado/lib/ThemeContext.jsx`: Automático.
- Un `ModoClaroOscuro.tsx` nuevo en `src/configuracion/`, montado con una línea en `Configuracion.jsx`.
- `src/configuracion/SelectorDeApariencia.tsx`, `src/sistema/PaginaDelSistema.tsx` y `app/layout.tsx` sólo si hay atributo nuevo.
- Navegación nueva: componente en `apps/web/src` con `Superficie`/`Button`, montado desde `AppLayout.jsx:80-104` y `Sidebar.jsx:317-361`.

**Puertas y documentos**

- `scripts/aspecto-permitido.json`, con testigos y `porque` por cada archivo heredado tocado.
- `scripts/verificar-adopcion.mjs` (`SIN_ESTADO`) para componentes nuevos sin los 3 estados.
- Pruebas: `packages/ui/src/tokens/sistema.test.ts:130-133,163-169`, `estilo-predeterminado.test.ts`, `estilo-de-arranque.test.ts`, `configuracion.test.ts`.
- E2E: `estilos.spec.ts`, `galeria.spec.ts` (más 9 retratos, y barrido en oscuro si se quiere), `dia-completo-restaurante.spec.ts`, `estilos-del-negocio.spec.ts`.
- `docs/fase-2/GUIA-DE-RECOMPOSICION.md`, §7.
