# 05 · Botones sobre las páginas del menú QR y aspecto del portal (DP-9.7)

## Qué hace y por qué

Miguel: «la lista de abajo repite lo que ya dice la imagen; quiero tocar el platillo en la carta».

- En Portal QR → Menú QR, cada página tiene «Botones»: un editor sobre la imagen de la carta. Se
  colocan botones arrastrando y se estiran. Dos tipos: platillo («Agregar», con el diálogo de
  siempre) y grupo (despliega los platillos de una categoría o de una lista elegida). Por botón,
  el precio vigente del sistema. Vista previa como comensal.
- El comensal toca el platillo donde lo lee. Ya no va la lista repetida de abajo.
- Aspecto del portal por tokens: estilo, tipografía y fondo.

## Archivos

| Archivo                                                                              | Qué                                                 |
| ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `packages/app/src/portal/botones-del-menu.ts` (+test)                                | La forma de los botones y lo que se publica         |
| `packages/app/src/portal/tema-del-portal.ts`                                         | La forma del aspecto                                |
| `packages/app/src/portal/consulta.ts`, `banderas.ts`                                 | El portal publica botones y aspecto                 |
| `packages/app/src/puente/configuracion.ts`                                           | Las dos claves, validadas al guardar                |
| `packages/app/src/portal/botones.integracion.test.ts`                                | Contra Postgres                                     |
| `apps/web/src/restaurante/menu-qr/*`                                                 | La página con botones, el editor, el aspecto        |
| `apps/web/heredado/pages/PortalCliente.jsx`                                          | Usa la página con botones y el aspecto              |
| `apps/web/heredado/components/portalqr/MenuQRTab.jsx`                                | «Botones» por página y «Aspecto del portal»         |
| `apps/web/app/globals.css`                                                           | `data-tipografia` reasigna `--fuente-ui`            |
| `apps/web/src/restaurante/paginas-del-menu.ts` (+test)                               | Borrado: era la regla del título (DP-D18, superada) |
| `scripts/generar-menu-qr.mjs`                                                        | `--posiciones` mide dónde quedó cada platillo       |
| `docs/cliente/botones-menu-qr.json`                                                  | Las posiciones de las 8 páginas de Don Poncho       |
| `scripts/preparar-negocio.mjs`                                                       | Escribe los botones de las páginas que no tienen    |
| `scripts/verificar-lecturas.mjs`, `aspecto-permitido.json`, `verificar-adopcion.mjs` | Declaraciones                                       |
| `pruebas/e2e/botones-del-menu-qr.spec.ts`                                            | Navegador                                           |

## Migraciones

Ninguna: `configuracion.valores.portal_qr_botones` y `portal_qr_tema`.

## Genérico o de Don Poncho

Genérico. Lo de Don Poncho son las posiciones medidas de SUS 8 páginas
(`docs/cliente/botones-menu-qr.json`) y el paso de `preparar-negocio.mjs` que las escribe.

## Cómo portarlo

1. Copiar los módulos de `packages/app/src/portal/` y `apps/web/src/restaurante/menu-qr/`.
2. Agregar las dos claves a `CLAVES_EDITABLES` y su validación; publicar botones y aspecto en el
   payload del portal.
3. En el heredado: la página con botones en `PortalCliente.jsx` (sin la lista de abajo) y el
   editor y el aspecto en `MenuQRTab.jsx`; las reglas de `data-tipografia` en `globals.css`.
4. Correr unidad, integración y la e2e.
