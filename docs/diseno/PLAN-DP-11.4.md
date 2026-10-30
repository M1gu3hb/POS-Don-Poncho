# DP-11.4 · El lenguaje nuevo, sus estilos y las tres pantallas piloto · plan

30-10-2026. Sale del encargo DP-11 (§DP-11.4 y la extensión Retro), del arranque (publicación) y
de dos lectores Sonnet de sólo lectura (bitácora). Las imágenes de referencia que menciona el
encargo («Mesa 08», carruseles…) no llegaron a esta sesión: el lenguaje sale del texto.

## Lo que el reconocimiento cambió del plan

1. Las pantallas reales usan las primitivas heredadas (`heredado/components/ui/*`, sin
   `data-slot`); la perilla de elevación no les llega. El lenguaje nuevo se pinta en las
   primitivas de `packages/ui` y llega a una pantalla cuando se **recompone** en `src/`. Así los
   pilotos lo estrenan y las demás pantallas no cambian de forma hasta el OK (DP-11.5), salvo lo
   que es de todas: la paleta de cada estilo, la navegación y el modo automático.
2. «Automático» no existe: el modo es binario (`mh_theme`).
3. La navegación real es `Sidebar.jsx` + la hamburguesa del teléfono + el menú radial del dueño;
   `BarraLateral` y `AbanicoInferior` de `packages/ui` sólo se ven en `/sistema`.
4. La galería retrata sólo en claro; el vidrio y el halo no tienen color opaco que auditar.
5. No hay teclado de cobro en pantalla: `NumericInput` es un campo. El teclado de cobro es nuevo.

## Decisiones técnicas (DP-D41)

**Perilla `elevacion`: dos valores nuevos.** `capas` (el lenguaje nuevo: sombras largas y suaves
en varias capas, teñidas con `--sombra-tinte`, y vidrio en lo que flota) y `aero` (el de `retro`:
marco de ventana, brillo especular y resplandor). Los demás valores no cambian: `cristal`,
`relieve`, `taller`, `bloque`, `terminal`, `papel` y `noche` se ven como hoy.

**Tokens nuevos** (en `base.css`, iguales para todos; un estilo los ajusta):

| Token                                                     | Qué                                                       |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `--vidrio-alfa`, `--vidrio-desenfoque`                    | Opacidad y desenfoque de lo que flota                     |
| `--luz-borde`                                             | El canto de luz de 1 px arriba (color H S% L%)            |
| `--halo`                                                  | El color del halo de lo activo (por omisión, el primario) |
| `--escala-presion`                                        | 0.97: la presión de un toque, con `--curva-resorte`       |
| `--malla-1..3`                                            | Los tres tonos del gradiente de malla del fondo           |
| `--marco-ventana`, `--brillo-gel`, `--resplandor-ventana` | Los de `retro`; vacíos en los demás                       |

`--sombra-tinte`, `--luz-borde`, `--halo` y `--malla-*` entran al contrato de color: un estilo
que los olvide falla en CI (hoy `--sombra-tinte` no lo exige nadie).

**Dónde va el vidrio** (`capas.css`, por atributo, sólo con `capas` o `aero`): `Superficie`
nivel 3 y 4 (la isla, la cuenta flotante, el dock), el contenido de `Dialog`, `Sheet`,
`Popover` y `DropdownMenu` de `packages/ui` (por `data-slot`) y los avisos. El velo de un
diálogo NO se desenfoca (es la capa más grande de la pantalla). Lo que está en el piso
(cuadrículas, tablas, tarjetas de lista) es sólido. Tope: el vidrio sólo cuelga de esas piezas,
nunca de una clase que se pueda poner en una lista.

**Vidrio sólido** cuando el sistema pide `prefers-reduced-transparency` o el aparato no da: al
arrancar se miden 60 cuadros en reposo y, si la mediana pasa de 22 ms, el aparato queda en
`data-vidrio="solido"` (guardado en el aparato). El aspecto es el mismo con superficie opaca.

**Tacto y halo, por atributo y no por estilo.** `data-tacto` (teclados de cobro y de PIN, el
botón Cobrar, los interruptores): relieve suave que se invierte al apretar. `data-principal`
(Cobrar, Enviar a cocina, la mesa abierta) y `Superficie activa`: el halo del acento detrás.
Toda presión escala a `--escala-presion` con la curva de resorte; en `nula` o con «reducir
movimiento», nada se mueve.

**Claro / oscuro / automático, por aparato.** `mh_theme` = `light` | `dark` | `auto` (sin valor
= automático). Los guiones de arranque resuelven `prefers-color-scheme` antes del primer
pintado y siguen escribiendo `.dark` y `data-modo` (`claro`|`oscuro`), así que nada de lo que
lee el modo cambia. En automático sigue al sistema en vivo. Se elige en Configuración →
Apariencia («En este aparato: Automático, Claro, Oscuro»); el «Modo oscuro» de la barra
lateral sigue siendo un atajo explícito.

**Navegación.** Táctil = `(pointer: coarse)` o menos de 1024 px (la tableta real del local es
de 1280 px en horizontal: el ancho no basta). En táctil: un **dock** flotante abajo
(`src/navegacion/`), píldora de vidrio con hasta 4 secciones del puesto y «Más», que es el
mismo «Abrir menú» de hoy y abre el cajón con el «Menú principal» completo. En PC: la barra
lateral de siempre, como panel flotante de vidrio. Los nombres accesibles, el «Menú principal»
y sus rótulos no cambian.

**Estilos.**

- `morphiq`: negro azulado `#0A0E1A` (224 44% 7%), azul eléctrico `#1E5BFF` (224 100% 56%, letra
  blanca 5.3:1) y acero; `capas`. Claro y oscuro.
- `don-poncho`: los del logo, con `capas`. Sigue siendo el predeterminado.
- `retro` (nuevo, «Retro»): cielo y agua, acento aqua, `aero`, redondeo `sutil` (6 px), pila de
  la época sin descargas, fondo de escritorio de CSS propio (degradado, bokeh, burbujas, rayos).
  Claro por omisión y una variante de vidrio ahumado. Ni un logo, icono, fondo o sonido de
  Microsoft o Apple.

**Pilotos** (recompuestos en `src/` con `@morphiqpos/ui/sistema`, mismos comandos, rutas, textos
y selectores de las pruebas; `Mesero.jsx`, `Caja.jsx` y `Dashboard.jsx` quedan como cascarón):

- **Tablero**: cifras del día (puras, en centavos, con prueba), su fila, la dona de pagos, el
  aviso de caja, cortes recientes.
- **Mesero**: el plano y la rejilla, la mesa abierta con la cuadrícula de platillos y la cuenta
  flotando como tarjetas apiladas, el envío con su confirmación. El borrador de la mesa sale de
  `Mesero` (cada toque re-dibujaba el mapa y los 107 platillos): la meta es abrir una mesa a 60.
- **Caja / Cobro**: pendientes, las teselas de método, el resumen y el **teclado de cobro**
  táctil (nuevo, junto al campo, no en su lugar); un `TecladoNumerico` compartido reemplaza las
  dos copias del de PIN.

## Pasos y commits (`main`, sin publicar hasta tener los tres pilotos)

| Paso   | Qué                                                                      | Quién            |
| ------ | ------------------------------------------------------------------------ | ---------------- |
| 11.4.a | Sistema: elevaciones, tokens, vidrio, tacto, halo, sólido, contrato, AA  | sesión principal |
| 11.4.b | Estilos `morphiq`, `don-poncho` y `retro`; galería +9; `/sistema`        | sesión principal |
| 11.4.c | Automático / Claro / Oscuro por aparato                                  | sesión principal |
| 11.4.d | Tablero recompuesto                                                      | subagente Sonnet |
| 11.4.e | Caja y cobro recompuestos, teclado de cobro, teclado numérico compartido | subagente Sonnet |
| 11.4.f | Navegación: dock táctil y barra lateral de vidrio                        | sesión principal |
| 11.4.g | Mesero recompuesto, y su rendimiento                                     | sesión principal |
| 11.4.h | Evidencia: capturas, video, rendimiento antes y después, demo local      | sesión principal |

Los subagentes no hacen commit: su diff se revisa, se integra y se verifica aquí. Cada paso
lleva su prueba primero y su mutación.

## Publicación

Es un cambio grande de diseño: se publica de una vez cuando los tres pilotos estén verificados,
**fuera del horario de servicio** y avisando antes a Miguel; luego humo, huella y la fusión en
`fase-b` (que trae «unir mesas» en `Mesero.jsx`: el efecto líquido se integra al lenguaje ahí).
Después, la pausa: sin el OK de Miguel no se recompone ninguna otra pantalla.
