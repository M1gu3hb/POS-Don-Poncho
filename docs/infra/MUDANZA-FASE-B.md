# Mudanza a la Fase B · el guion del día

Don Poncho pasa de la base compartida de MorphiqPOS (`wyqmzhliurwyxuyxznpb`, la Fase A) a su
propio proyecto de Supabase. Planeado para el **7 al 10 de noviembre de 2026**. El 7 y el 8 caen
en **sábado y domingo**: si son días fuertes del restaurante, la ventana va el lunes 9 o el
martes 10, de madrugada o con el local cerrado.

Lo que no cambia: el código (la rama `fase-b`), el dominio, `PIN_PEPPER` y `SESSION_SECRET` (los
PIN y las sesiones siguen sirviendo), los ID de todo (los QR impresos siguen sirviendo).

Lo que cambia: cuatro variables de Vercel (`DATABASE_URL` y `STORAGE_*`) y la rama que se
despliega (`fase-b` se fusiona en `main`).

## Antes del día (Miguel)

1. Crear el proyecto de Supabase **en `us-east-2`** (Postgres 17), con una contraseña larga para
   `postgres`, y pasármela por el archivo privado (`..\_PRIVADO\`), nunca por chat ni por correo.
2. En ese proyecto, Almacenamiento → crear el bucket **privado** `pos-don-poncho`, y copiar la
   llave secreta (`sb_secret_…`) al mismo archivo privado.
3. Elegir la ventana, con el restaurante **cerrado**: unas **dos horas** de margen para un trabajo
   de unos 45 minutos.

## Antes del día (la sesión de desarrollo)

1. El rol de la aplicación en el proyecto nuevo (`morphiqpos_app`, con `bypassrls` y su propia
   contraseña, la que irá en `DATABASE_URL`), por SQL como `postgres`. Es el proyecto nuevo: ahí
   sí hay DDL.
2. Un ensayo final con una exportación fresca contra una base desechable con las migraciones de
   `fase-b` (como el de DP-10.5, abajo).

## El día · en orden

Todo se corre desde la raíz del repositorio en la rama `fase-b`, con los secretos en archivos de
`..\_PRIVADO\` (nunca en la línea de comandos que queda en el historial).

| #   | Paso                                                                                             | Tiempo   |
| --- | ------------------------------------------------------------------------------------------------ | -------- |
| 1   | Confirmar con el restaurante que nadie usa el sistema (cajas cerradas, tabletas apagadas)        | 5 min    |
| 2   | **Huella** de las otras 10 organizaciones de la compartida (sólo lectura)                        | 1 min    |
| 3   | **Migraciones** desde cero en la base nueva: `pnpm db:migrate` con su `DATABASE_URL`             | 2-5 min  |
| 4   | **Exportar** con `--exigir-cerrado` (se niega si hay caja abierta, cuenta viva, comanda o unión) | 1-2 min  |
| 5   | **Importar** a la base nueva (una transacción; compara filas y md5 antes de guardar)             | 2-5 min  |
| 6   | `importar-negocio.mjs --solo-verificar` otra vez, ya guardado                                    | 1 min    |
| 7   | **Vercel**: las cuatro variables de Production, por la entrada estándar del CLI                  | 5 min    |
| 8   | **Fusionar** el PR de `fase-b` en `main` (CI verde antes) y esperar el despliegue de Production  | 5-10 min |
| 9   | `preparar-negocio.mjs` contra la base nueva con el `APP_URL` de producción (no duplica nada)     | 2 min    |
| 10  | **Humo** sin dinero y del almacén; **huella** de las otras 10 organizaciones otra vez: idéntica  | 5 min    |
| 11  | Miguel entra con el PIN de cada puesto (lista de abajo)                                          | 10 min   |

Las órdenes:

```bash
node --conditions=react-server scripts/exportar-negocio.mjs --org don-poncho --exigir-cerrado
```

```bash
node --conditions=react-server scripts/importar-negocio.mjs --desde ..\_PRIVADO\mudanza\<fecha> --base <DATABASE_URL de postgres del proyecto nuevo>
```

La exportación lee la compartida con su `DATABASE_URL` y `STORAGE_*` de la Fase A; la
importación escribe la base nueva con el rol `postgres` (hace falta para
`session_replication_role = replica`, como en la restauración oficial de Supabase) y el bucket
nuevo con los `STORAGE_*` del proyecto nuevo.

## Cómo se regresa atrás

- **Antes del paso 7** no cambió nada de producción: la compartida sólo se leyó y Vercel sigue
  igual. Se cancela y el restaurante abre como siempre.
- **Después del paso 7 u 8:** en Vercel, regresar las cuatro variables a las de la Fase A (están
  en el archivo privado) y promover el despliegue de Production anterior a la fusión (Instant
  Rollback). 10 minutos. Lo que se haya escrito en la base nueva después de cambiar se pierde:
  por eso la ventana es con el restaurante cerrado y la decisión se toma antes de abrir.

## Lo que entra con su PIN (Miguel, al final)

| Puesto           | Cae en             | Ve                                                           |
| ---------------- | ------------------ | ------------------------------------------------------------ |
| Dueño Don Poncho | Inicio             | Todo; en Cocina, «Vista general» con comida y bebidas        |
| Gerente          | Inicio             | Igual que el dueño                                           |
| Caja             | Caja               | La caja; puede abrirla (no abrirla el día de la mudanza)     |
| Mesero 1 y 2     | Mesero             | Su mapa de mesas                                             |
| Cocina           | Cocina             | Sólo la estación Cocina                                      |
| Bebidas          | Cocina             | Sólo la estación Bebidas                                     |
| Almacén          | Su menú de almacén | Existencias, entradas, conteo, compras y recetas; no la caja |

## El ensayo (DP-10.5, 27-10-2026)

Con los datos reales de Don Poncho exportados de la compartida (sólo lectura), en bases
desechables de esta PC:

- **Con las migraciones de `main`** (hasta la 185): exportar 16,9 s (132 tablas, 950 filas; el
  bucket está vacío: 0 archivos), migrar desde cero 8 s, importar 1,4 s; filas y md5 idénticos,
  sin llaves rotas.
- **Con las migraciones de `fase-b`** (hasta la 188): ver el reporte 003.

## Después

Retirar `don-poncho` de la compartida sólo con Miguel presente y con respaldo: otro encargo.
