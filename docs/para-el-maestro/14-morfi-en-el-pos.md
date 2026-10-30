# 14 · Morfi en el POS (DP-11.1)

## Qué hace y por qué

Morfi, la mascota de Morphiq, acompaña tres momentos con clips cortos de `M1gu3hb/Morfi-pet`
(`ux-pos/`, commit `c61aab2`):

- **«Cargando»**: asomado detrás de una tarjeta real —texto que dice qué carga y su barra— con las
  manos en la orilla, haciendo malabares con los cubitos. Sólo en cargas de pantalla entera
  (entrar con PIN, el menú del portal QR) y nada antes de 600 ms.
- **La página que no existe** (la de la aplicación y el QR que no lleva a ninguna mesa): se asoma
  por un hoyo de la tarjeta y señala el botón.
- **El modo espera** (DP-11.2): dormido en bucle y despertar.

WebM con transparencia en Chromium y Firefox; WebP animado en Safari y en todo el iPhone y el iPad;
imagen fija con «reducir movimiento». Nunca dos a la vez, se cierran con un toque. Un interruptor
por negocio, «Mascota Morfi», en Configuración → Apariencia.

## Archivos

| Archivo                                                           | Qué                                                   |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| `packages/ui/src/sistema/carga-de-pantalla.tsx`                   | `PantallaDeCarga`: la carga larga del sistema         |
| `packages/ui/src/estilos/base.css` (al final)                     | Aparecer a los 600 ms y la barra                      |
| `apps/web/src/morfi/clips.ts`                                     | Clips, geometría de la orilla y formato por navegador |
| `apps/web/src/morfi/turno.ts`, `use-clip.ts`                      | Uno a la vez; formato, movimiento y turno en React    |
| `apps/web/src/morfi/ClipDeMorfi.tsx`                              | El clip en su formato                                 |
| `apps/web/src/morfi/MorfiCargando.tsx`                            | La carga con Morfi                                    |
| `apps/web/src/morfi/MorfiNoEncontrada.tsx`, `HoyoEnLaTarjeta.tsx` | La página que no existe                               |
| `apps/web/src/morfi/textos-de-carga.ts`                           | «Cargando tu caja», «Cargando las mesas»…             |
| `apps/web/public/morfi/*`                                         | 4 clips × (WebM, WebP, fija)                          |
| `packages/app/src/configuracion/experiencia.ts`                   | «Mascota Morfi» en `configuracion.valores`            |
| `apps/web/src/proveedores/Experiencia.tsx`, `app/layout.tsx`      | El servidor la lee al pintar                          |
| `apps/web/src/configuracion/MascotaDelNegocio.tsx`                | El interruptor                                        |
| `scripts/lib/adopcion.mjs`                                        | La puerta reconoce `PantallaDeCarga`                  |
| `pruebas/e2e/morfi.spec.ts`                                       | Navegador, tres aparatos                              |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico. En el maestro, Morfi es de la marca: los clips y el interruptor sirven a todos los
negocios. Lo de Don Poncho es sólo dónde se montó (`AppLayout`, `PortalCliente`).

## Cómo portarlo

Copiar `apps/web/src/morfi/`, `public/morfi/`, `PantallaDeCarga` y sus dos animaciones de
`base.css`, `experiencia.ts` (con su clave en `CLAVES_EDITABLES` y su `exigirForma` del puente de
configuración), el proveedor y el interruptor. Montar `MorfiCargando` donde haya una carga de
pantalla entera y `MorfiNoEncontrada` en el 404. Al sumar un clip, sus números salen de
`escenas.json` y `recortes.json`, y su prueba de geometría se copia de `clips.test.ts`.
