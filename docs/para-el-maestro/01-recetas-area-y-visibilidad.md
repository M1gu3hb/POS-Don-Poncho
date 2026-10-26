# 01 · Recetas y Platillos no pisan el área ni la visibilidad (DP-9.1)

## Qué hace y por qué

Miguel: «al capturar la receta de una bebida, deja de llegar a Bebidas y cae en Cocina; un
platillo oculto del QR reaparece». Además, al probarlo apareció que Recetas no guardaba la receta
de un platillo sin foto.

- Recetas y Platillos tienen un campo «Área de preparación». Al editar enseña el área que el
  platillo tiene y la manda tal cual; al crear, por omisión, «Según su categoría».
- El servidor, al crear un platillo sin área, la aprende de lo que ya hace su categoría o, si es
  nueva, su estación. Si no hay de dónde, se niega y pide escogerla.
- La visibilidad en el menú digital ya no viaja desde Recetas.
- Una receta sin foto manda `imagen_url: null`, no `''`.

## Archivos

| Archivo                                                                                  | Qué                                                        |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/domain/src/catalogo/area-por-omision.ts` (+test)                               | La regla pura: categoría, luego estación; la más frecuente |
| `packages/app/src/catalogo/area-al-crear.ts` (+integración)                              | El paso del servidor al crear un `ProductoTerminado`       |
| `packages/app/src/puente/comandos.ts`                                                    | Llama al paso antes de escribir                            |
| `packages/contracts/src/errores/index.ts`                                                | Código `AREA_DE_PREPARACION_REQUERIDA`                     |
| `apps/web/src/restaurante/area-de-preparacion.ts` (+test), `AreaDePreparacionSelect.tsx` | El campo                                                   |
| `apps/web/heredado/components/recetas/RecetaFormDialog.jsx`                              | Sin área ni visibilidad fijas; imagen `null`               |
| `apps/web/heredado/components/productos/ProductoSimpleDialog.jsx`                        | Sin `ninguno` fijo                                         |
| `apps/web/heredado/utils/importExecutors.js`                                             | Sin `ninguno` inventado                                    |
| `scripts/verificar-adopcion.mjs`                                                         | El campo declarado (no es pantalla)                        |
| `pruebas/e2e/recetas-area-y-visibilidad.spec.ts`                                         | Navegador                                                  |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Todo genérico: el maestro tiene los mismos diálogos, el mismo puente y el mismo defecto. En un
giro sin estaciones (tienda), las categorías no tienen estación y el área se aprende sólo de la
categoría; si el maestro quiere que un producto de tienda nazca en `ninguno` sin preguntar, hay
que decidirlo allá (en la tienda casi nada genera comanda).

## Cómo portarlo

1. Copiar los cuatro archivos nuevos y el código de error.
2. Aplicar los cambios de los dos diálogos y de la importación (son líneas sueltas; el maestro
   tiene los mismos archivos).
3. Agregar el paso a `puente/comandos.ts`.
4. Correr las pruebas de unidad, la integración y la e2e (ajustar el negocio de prueba).
