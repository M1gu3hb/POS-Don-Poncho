# 17 · El lenguaje de capas y «Retro» (DP-11.4)

## Qué hace y por qué

Un POS que se vea caro y serio sin parecer generado: lo que flota es vidrio ahumado y lo que está
en el piso, sólido; sombras largas teñidas del color del estilo; un halo del acento sólo detrás de
lo activo o principal; tacto físico sólo en lo que se aprieta mucho. Todo vive en el sistema de
diseño como tokens, una perilla y atributos: una pantalla lo estrena cuando se recompone con
`@morphiqpos/ui/sistema`.

- Perilla `elevacion`: `capas` (el lenguaje) y `aero` (el de «Retro»).
- Vidrio sólo en lo que flota; sólido con «menos transparencia» o si el aparato no da 60 cuadros.
- Atributos: `data-tacto`, `data-principal`, `data-activa`, `data-capa="flotante"`,
  `data-fondo="escritorio"`.
- Estilos: `morphiq` (la marca), `don-poncho` (el logo, con `capas`) y «Retro» (Frutiger Aero).
- Claro, oscuro o automático, por aparato.

## Archivos

| Archivo                                            | Qué                                                      |
| -------------------------------------------------- | -------------------------------------------------------- |
| `packages/ui/src/estilos/base.css`                 | `capas`, `aero`, el vidrio sólido y la presión           |
| `packages/ui/src/estilos/lenguaje.css`             | Vidrio, ventana, tacto, halo, gel y fondo (por atributo) |
| `packages/ui/src/estilos/morphiq.css`              | La marca de Miguel                                       |
| `packages/ui/src/estilos/retro.css`                | «Retro»: sólo tokens                                     |
| `packages/ui/src/tokens/contrato.ts`, `estilos.ts` | Los estilos, la perilla y los tokens nuevos              |
| `packages/ui/src/tokens/lenguaje-de-capas.test.ts` | El contrato del lenguaje, sin navegador                  |
| `packages/ui/src/tokens/leerCss.ts`                | `leerReglas` y `partirSelectores` para esa prueba        |
| `apps/web/heredado/tema-arranque.ts`               | Automático y vidrio sólido antes del primer pintado      |
| `apps/web/heredado/lib/ThemeContext.jsx`           | La preferencia y el sistema, en vivo                     |
| `apps/web/src/proveedores/preferencia-de-modo.ts`  | Preferencia → modo (puro)                                |
| `apps/web/src/proveedores/vidrio.ts`               | Cuándo medir y qué decidir (puro)                        |
| `apps/web/src/proveedores/MedidorDelVidrio.tsx`    | Mide una vez y guarda en el aparato                      |
| `apps/web/src/configuracion/ModoDelAparato.tsx`    | Automático / Claro / Oscuro en Apariencia                |
| `packages/app/src/configuracion/apariencia.ts`     | Los diez estilos y las seis elevaciones del servidor     |
| `pruebas/e2e/modo-del-aparato.spec.ts`             | El modo en el navegador, tres aparatos                   |

## Migraciones

Ninguna. La apariencia del negocio ya vivía en `configuracion.valores`; el modo y el vidrio, en el
aparato.

## Genérico o de Don Poncho

Genérico. De Don Poncho: su estilo con `capas` como predeterminado de la casa. En el maestro el
predeterminado será `morphiq`.

## Cómo portarlo

Copiar las hojas (`base.css`, `lenguaje.css`, `morphiq.css`, `retro.css`), el contrato y su
prueba, el guion de arranque, la preferencia de modo, el medidor del vidrio y el selector de modo;
sumar `retro`, `capas` y `aero` a las listas del servidor. Marcar la capa de fondo del armazón con
`data-fondo="escritorio"` y lo que flota con `data-capa="flotante"`.
