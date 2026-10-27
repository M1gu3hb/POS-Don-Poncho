# 09 · Estaciones Cocina y Bebidas (DP-10.1)

## Qué hace y por qué

En producción (27-10-2026) el único usuario de cocina veía comida y bebidas revueltas en una sola
pantalla. Encender las estaciones lo dejaba peor: la pantalla quedaba VACÍA y sin aviso.

- **La sesión del navegador no traía la estación.** `Cocina.jsx` filtraba con
  `posUser.estacion_preparacion_id` y `posUser.puede_ver_todas_estaciones`, pero ni la entrada
  con PIN ni `/api/catalogo/sesion` los mandaban. Ahora los dos los leen del EMPLEO en el
  servidor (`leerEstacionDeLaSesion`): id, nombre y color de su estación (sólo si está
  encendida y es del mismo negocio) y si ve todas. Dueño, gerente y administrador ven todas.
- **La pantalla espera al servidor.** Lo guardado en la pestaña pinta la barra, pero Cocina no
  decide con ello qué estación enseñar hasta que el servidor confirma la sesión (`verificada`).
  Al volver a la pestaña, si le cambiaron la estación, se adopta la nueva.
- **Cocina:**
  - el cocinero con estación ve la suya, y el que «ve todas», todas;
  - dueño, gerente y administrador ven todo;
  - el cocinero sin estación ve «Tu usuario no tiene estación asignada; pide al administrador
    que te asigne una.», nunca una lista vacía;
  - la voz y el aviso de pedido nuevo salen de la misma lista filtrada: cada pantalla anuncia
    sólo lo suyo. Al cambiar lo que se ve, lo que ya estaba no se anuncia de golpe.
- **El portal QR mandaba comandas sin estación.** Con las estaciones apagadas agrupaba por área
  (comanda sin estación). Encendidas, tomaba la estación de la categoría aunque estuviera
  apagada, con un nombre de instantánea vacío. Ahora sigue la misma cadena que el mesero: la
  estación ACTIVA de la categoría y, si no, la general, con estaciones encendidas o apagadas. La
  bandera `estaciones_preparacion_activas` decide qué se dibuja, no a dónde va la comanda.
- **«Hacer general»** (`restaurante.marcar_estacion_general`). La general es el respaldo de la
  regla 10, y Don Poncho no tenía ninguna. Antes sólo se podía CREAR una general; ahora se
  nombra una existente. Nunca cambia la general de mano.
- `heredado/utils/preparacionEstacionUtils.js` era código muerto (nadie lo importaba): se quitó.

## Archivos

| Archivo                                                                       | Qué                                                  |
| ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| `packages/app/src/identidad/estacion-de-la-sesion.ts` (+test, +integración)   | Qué estación ve quien entró                          |
| `apps/web/app/api/auth/entrar/route.ts`, `app/api/catalogo/sesion/route.ts`   | La sesión trae la estación                           |
| `apps/web/src/restaurante/alcance-de-la-cocina.ts` (+test)                    | Qué ve cada quien, sacado de `Cocina.jsx`            |
| `apps/web/heredado/lib/POSAuthContext.jsx`                                    | `verificada` y adoptar el cambio de estación         |
| `apps/web/heredado/pages/Cocina.jsx`                                          | Usa el alcance; aviso; voz por estación              |
| `packages/app/src/restaurante/estaciones.ts`                                  | `estacionSiLaHay`: los tramos 1 y 2, sin lanzar      |
| `packages/app/src/portal/estaciones.ts`, `banderas.ts`                        | El portal sigue la misma cadena                      |
| `packages/app/src/restaurante/estacion-general.ts` (+integración)             | `restaurante.marcar_estacion_general`                |
| `apps/web/app/api/restaurante/marcar-estacion-general/route.ts`               | Su ruta                                              |
| `apps/web/heredado/components/configuracion/EstacionesPreparacionSection.jsx` | «Hacer general» mientras no haya general             |
| `packages/app/src/restaurante/estacion-de-cada-comanda.integracion.test.ts`   | Mesero y QR, con estaciones encendidas y apagadas    |
| `scripts/preparar-negocio.mjs`, `docs/cliente/negocio-don-poncho.json`        | General, estación de cada cocinero, Bebidas, bandera |
| `scripts/demo-local.mjs`                                                      | Inventa sólo los PIN de demo que falten              |
| `pruebas/e2e/estaciones-de-cocina.spec.ts`                                    | Navegador                                            |

## Migraciones

Ninguna. Las columnas (`empleos.estacion_preparacion_id`, `ve_todas_las_estaciones`,
`estaciones_preparacion.es_general`) existen desde la 045.

## Genérico o de Don Poncho

Todo genérico para el giro restaurante. De Don Poncho son sólo los datos: «Cocina» es la
general, el usuario «Cocina» va a la estación Cocina y el usuario «Bebidas» a la de Bebidas.

## Cómo portarlo

1. Copiar `estacion-de-la-sesion.ts` y su export, y los dos cambios de rutas (`entrar`, `sesion`).
2. Copiar `alcance-de-la-cocina.ts` y los cambios de `POSAuthContext.jsx` y `Cocina.jsx`.
3. Aplicar `estacionSiLaHay` en `restaurante/estaciones.ts` y el `resolverDestinos` del portal;
   quitar `estacionesActivas` de las banderas del portal.
4. Copiar `estacion-general.ts`, su ruta y el botón; regenerar la matriz de permisos.
5. Correr unidad, integración y `estaciones-de-cocina.spec.ts`.
