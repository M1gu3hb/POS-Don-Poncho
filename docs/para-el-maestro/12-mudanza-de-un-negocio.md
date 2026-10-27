# 12 · Mudar un negocio a su propia base (DP-10.5)

## Qué hace y por qué

Para la Fase B (Don Poncho en su propio Supabase) hace falta sacar SUS filas de la base compartida
y meterlas en una base nueva sin perder ni cambiar nada. Sin esto la mudanza no se puede hacer.

- **`scripts/exportar-negocio.mjs`** sólo lee la base de origen, en una transacción
  `read only` con la instantánea fija:
  - las tablas con `organizacion_id`, la fila de `organizaciones` y las hijas que cuelgan de
    ellas por llave foránea aunque no tengan la columna (`identidades`, `credenciales_pin`…),
    descubiertas del CATÁLOGO, no de una lista;
  - cada fila como `to_jsonb`, sin pasar por números de JavaScript;
  - el manifiesto: migraciones del origen y, por tabla, columnas, filas y md5;
  - todo el bucket, con el md5 de cada archivo;
  - la salida va fuera del repositorio: trae hashes de PIN.
- **`scripts/importar-negocio.mjs`** escribe en una base NUEVA con las migraciones aplicadas desde
  cero, en una sola transacción, con los ID de siempre:
  - sin disparadores (`session_replication_role = replica`): los ledgers se insertan tal cual y
    ningún saldo se vuelve a aplicar;
  - las llaves foráneas se comprueban a mano antes del `commit`;
  - las secuencias quedan después del mayor id;
  - columnas nuevas del destino toman su valor por omisión;
  - antes de guardar compara filas y md5 de cada tabla con el origen: si una sola no cuadra, no
    guarda nada;
  - luego copia el bucket y lee de vuelta cada archivo.
- **El almacén aprende a `listar`** (S3 y la API de Supabase, que pagina y va por carpetas).
- **`verify:esquema`, `verify:rls` y `verify:acople`** ya no tienen clavado el proyecto de la Fase
  A: `MORPHIQPOS_PROYECTO_VERIFICADO` dice cuál (sin ella, el de siempre).
- El guion del día: `docs/infra/MUDANZA-FASE-B.md`.

## Archivos

| Archivo                                                                               | Qué                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------ |
| `scripts/lib/mudanza.mjs`                                                             | Catálogo, filtro del negocio, conteo y md5 |
| `scripts/exportar-negocio.mjs`                                                        | Exportar (sólo lectura)                    |
| `scripts/importar-negocio.mjs`                                                        | Importar y verificar                       |
| `packages/data/src/archivos.ts` (+`archivos-listar.test.ts`)                          | `listar` en los dos conductores            |
| `packages/data/src/verificacion/consulta-directa.ts` (+test)                          | `proyectoVerificado`                       |
| `scripts/verificar-esquema-aplicado.mjs`, `verificar-rls.mjs`, `verificar-acople.mjs` | Toman el proyecto de la variable           |
| `docs/infra/MUDANZA-FASE-B.md`                                                        | El guion del día                           |

## Migraciones

En `main`, ninguna. En `fase-b`, la 188: archiva los tres negocios de demostración que la 042
siembra en cualquier base nueva, y sólo si la base no tiene otros negocios (en la compartida no
hace nada).

## Genérico o de Don Poncho

Genérico: sirve para mudar cualquier negocio de una base compartida a la suya. Sólo acepta los
negocios de `NEGOCIOS_REALES` y se niega a importar en el proyecto de la Fase A.

## Cómo portarlo

Copiar los tres guiones, `listar` del almacén y `proyectoVerificado`. En el maestro, la lista de
negocios que acepta es la suya.
