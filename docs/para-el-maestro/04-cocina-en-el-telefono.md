# 04 · Cocina en el teléfono (DP-9.4)

## Qué hace y por qué

Miguel: «que cada estación tenga un teléfono que diga la comanda y que el cocinero la marque sin
soltar lo que tiene en las manos».

- En la pantalla de Cocina, «Conectar teléfono» enseña el QR de UNA estación para hoy. Generar
  otro apaga el anterior.
- El teléfono abre una página ligera, sin PIN: la comanda pendiente más reciente de su estación,
  leída en voz al llegar, con «Repetir voz», «Preparar» y «Listo». Al marcar Listo aparece la
  siguiente. La pantalla no se apaga. Una botonera Bluetooth hace lo mismo con teclas.

## Archivos

| Archivo                                                                       | Qué                                                 |
| ----------------------------------------------------------------------------- | --------------------------------------------------- |
| `packages/app/src/telefono-de-cocina/token-de-estacion.ts` (+test)            | La firma del código                                 |
| `packages/app/src/telefono-de-cocina/ambito.ts`                               | Firma, negocio, día y versión contra la base        |
| `packages/app/src/telefono-de-cocina/conectar.ts`                             | El comando que emite (y revoca)                     |
| `packages/app/src/telefono-de-cocina/consulta.ts`, `transicion.ts`, `http.ts` | La API pública estrecha                             |
| `packages/app/src/telefono-de-cocina/*.integracion.test.ts`, `pruebas.ts`     | Contra Postgres                                     |
| `packages/app/src/restaurante/preparacion.ts`                                 | `moverLaComandaEntera`: la misma regla para los dos |
| `packages/app/src/restaurante/datos.ts`                                       | `comandaDeLaEstacion`                               |
| `packages/app/src/puente/configuracion.ts`                                    | La versión nunca sale; `for update` al guardar      |
| `packages/app/src/portal/http.ts`, `limite.ts`, `comando-publico.ts`          | 404/429, límites y `traducirFallo` compartidos      |
| `apps/web/app/api/publico/cocina/[token]/…`                                   | Las dos rutas públicas                              |
| `apps/web/app/api/restaurante/conectar-telefono-de-cocina/route.ts`           | Conectar: firma con la pimienta                     |
| `apps/web/app/cocina-telefono/[token]/page.tsx`                               | La página pública                                   |
| `apps/web/src/telefono-de-cocina/*`                                           | El teléfono y el diálogo «Conectar teléfono»        |
| `apps/web/src/tipos/qrcode.d.ts`                                              | Tipos mínimos de `qrcode`                           |
| `apps/web/heredado/pages/Cocina.jsx`                                          | El botón                                            |
| `docs/cliente/BOTONERA.md`                                                    | Qué botonera comprar y cómo probarla                |
| `pruebas/e2e/telefono-de-cocina.spec.ts`                                      | Navegador                                           |

## Migraciones

Ninguna. La versión vive en `configuracion.valores`.

## Genérico o de Don Poncho

Todo genérico para el giro restaurante. La llave del código se deriva de la pimienta del PIN con
un rótulo propio (`cocina-telefono:v1`): un código de cocina no sirve en ningún otro lado.

## Cómo portarlo

1. Copiar `packages/app/src/telefono-de-cocina/` y su export en `package.json`.
2. Aplicar los cambios de `preparacion.ts` (la extracción), `datos.ts`, `configuracion.ts`,
   `portal/http.ts`, `limite.ts` y `comando-publico.ts`, y los dos códigos de error nuevos.
3. Copiar las rutas, la página, `apps/web/src/telefono-de-cocina/`, `qrcode.d.ts` y el botón de
   `Cocina.jsx`.
4. Regenerar la matriz de permisos y el aislamiento; correr unidad, integración y la e2e.
