# Mudanza a la Fase B · el guion del día

Don Poncho pasa de la base compartida de MorphiqPOS (`wyqmzhliurwyxuyxznpb`, la Fase A) a su
propio proyecto de Supabase el **lunes 9 de noviembre de 2026**, con el restaurante cerrado (abre
con el POS el sábado 14). Lo que hace Miguel, clic por clic, está en
[`MUDANZA-LO-QUE-HACE-MIGUEL.md`](MUDANZA-LO-QUE-HACE-MIGUEL.md).

## Qué cambia y qué no

- **El código ya está en `main`:** la rama `fase-b` se fusionó; no hay rama que desplegar.
- **La 188** (`demostraciones_archivadas`) está en `main` pero **sólo corre en la base propia**:
  la compartida se queda en la 187 y con cero DDL (la 188 apagaría las demostraciones de los otros
  negocios).
- **No cambian:** el dominio, `PIN_PEPPER` y `SESSION_SECRET` (los PIN, las sesiones, los
  teléfonos de cocina firmados y las autorizaciones siguen sirviendo), `ORGANIZACION` y `APP_URL`.
- **Los id de todo y los `qr_token` de las mesas se conservan** (la importación copia las filas
  tal cual): los QR impresos de las mesas siguen sirviendo.
- **Cambian sólo cinco variables de Vercel** (Production): `DATABASE_URL` y `STORAGE_ENDPOINT`,
  `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`. Después, redesplegar.

### Lo que cambió desde el ensayo de DP-10.5

- `configuracion.valores` lleva más documentos (experiencia, botones del menú, QR de las mesas,
  `descuentos_permitidos`): viajan dentro de la misma fila.
- Los **teléfonos de cocina van firmados** (con el secreto de sesión, que no cambia) y su versión
  vive en `configuracion.valores.telefonos_de_cocina`: el teléfono conectado sigue conectado.
- `plataforma` (los empleos de plataforma, DP-12.1) va por **id de empleo**: se conservan.
- **Cajas a la vez** (`sucursales.cajas_simultaneas`, DP-D60): en la base propia queda en **2**
  (14.5, por la pantalla).
- Las migraciones siguen hasta la **188** (ninguna nueva desde el ensayo).

## Inventario de lo que no es tabla (06-11-2026, sólo lectura)

| Qué                 | En la compartida                                                                                                                                                         | En la propia                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Bucket              | `pos-don-poncho` privado, **0 archivos** de Don Poncho (y 0 en `morphiqpos`)                                                                                             | `pos-don-poncho` privado, nuevo (Miguel) |
| Funciones Edge      | ninguna                                                                                                                                                                  | ninguna                                  |
| Tareas programadas  | `pg_cron`: `morphiqpos_retencion_comandos` (03:17 diario, borra `comandos_ejecutados` de más de 90 días), de la migración 053                                            | la crea la 053 al migrar                 |
| Webhooks            | ninguno (sin `pg_net`, sin disparadores HTTP)                                                                                                                            | ninguno                                  |
| Vercel (Production) | 9 variables: `DATABASE_URL`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`, `PIN_PEPPER`, `SESSION_SECRET`, `ORGANIZACION`, `APP_URL` | cambian las 5 primeras                   |

Nada más apunta a la compartida: sin integraciones, sin dominios propios, sin tareas fuera de la
base. **Región:** `us-east-2` (Ohio), la más cercana a las funciones de Vercel (`cle1`).

## Domingo 8 · el proyecto vacío (la sesión de desarrollo)

1. El rol de la aplicación, `morphiqpos_app` (`login bypassrls`, contraseña propia generada aquí y
   guardada en `..\_PRIVADOase-b.env`), por SQL como `postgres`. Es el proyecto nuevo: ahí sí
   hay DDL.
2. `pnpm db:migrate` con la `DATABASE_URL` de `postgres` (sesión) del proyecto nuevo, hasta la
   188; luego `verify:esquema` estricto contra esa base.

## El lunes · en orden

Todo desde la raíz del repositorio en `main`, con los secretos en archivos de `..\_PRIVADO\`
(nunca en la línea de comandos que queda en el historial). Cada paso con su hora en la bitácora.

| #   | Paso                                                                                                                                                            | Tiempo |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Confirmar con el restaurante que nadie usa el sistema (cajas cerradas, tabletas apagadas)                                                                       | 5 min  |
| 2   | **Huella** de las otras 10 organizaciones de la compartida (sólo lectura)                                                                                       | 1 min  |
| 3   | **Exportar** con `--exigir-cerrado` (se niega si hay caja abierta, cuenta viva o comanda)                                                                       | 1 min  |
| 4   | **Importar** a la base nueva (una transacción; compara filas y md5 antes de guardar)                                                                            | 1 min  |
| 5   | `importar-negocio.mjs --solo-verificar` otra vez, ya guardado; `verify:esquema` estricto                                                                        | 2 min  |
| 6   | **Vercel**: las cinco variables de Production, por la entrada estándar del CLI                                                                                  | 5 min  |
| 7   | **Redesplegar** Production y esperar `READY`                                                                                                                    | 5 min  |
| 8   | **Humo** sin cobrar: entrada 200, Miguel entra con su PIN, el QR de una mesa con su token, el teléfono de cocina, el portal; cada pantalla una vez; folios en 0 | 10 min |
| 9   | **Huella** de las otras 10 otra vez: idéntica                                                                                                                   | 1 min  |

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

- **Antes del paso 6** no cambió nada de producción: la compartida sólo se leyó y Vercel sigue
  igual. Se cancela y todo sigue como estaba.
- **Después del paso 6 o 7:** en Vercel, regresar las cinco variables a las de la Fase A (están en
  `..\_PRIVADOase-a.env`) y redesplegar (o promover el despliegue anterior). 10 minutos. Lo que
  se haya escrito en la base nueva después de cambiar se pierde: por eso la ventana es con el
  restaurante cerrado. Ensayado el 07-11 (abajo).

## La compartida después de la mudanza

- Los datos de Don Poncho se quedan **intactos** como respaldo: nada de borrar ni archivar. Eso va
  en otro guion, que Miguel aprueba, dos semanas después del sábado 14.
- Desde ese momento, la compartida sigue con **cero DDL y cero escrituras de Don Poncho**.
- En la base propia, las migraciones van sólo con `pnpm db:migrate` y sólo si de verdad hacen
  falta, cada una con su ficha para el maestro.

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

## El ensayo de DP-14.3 (06-11-2026, con la exportación de ese día)

En una base desechable de esta PC (Postgres 18, clúster nuevo en el 5450), con la PC cargada (dos
agentes compilando y probando a la vez):

| Paso                                                                                 | Resultado                                                                                                                                                                                                                                                                                                                                                              | Tiempo                                |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Exportar de producción con `--exigir-cerrado` (sólo lectura)                         | 135 tablas, 1,174 filas, 0 archivos                                                                                                                                                                                                                                                                                                                                    | 20 s                                  |
| Migrar desde cero hasta la 188 (`pnpm db:migrate`)                                   | 188 aplicadas                                                                                                                                                                                                                                                                                                                                                          | 229 s (8 s sin carga en DP-10.5)      |
| Importar                                                                             | idénticas al origen (filas y md5), sin llaves rotas                                                                                                                                                                                                                                                                                                                    | 71 s de reloj (50,6 s de importación) |
| `--solo-verificar`                                                                   | 135 tablas idénticas                                                                                                                                                                                                                                                                                                                                                   | 19 s                                  |
| El esquema contra el contrato (la consulta y la comparación de `verify:esquema`)     | 1,749 columnas, 1,382 restricciones y 445 índices: cumple                                                                                                                                                                                                                                                                                                              | 5 s                                   |
| La app compilada de `dp-14`, con la `PIN_PEPPER` y el `SESSION_SECRET` de producción | la entrada 200; entra la gerente con un PIN de ensayo (sólo en la copia); `/`, `/caja`, `/mesero`, `/cocina`, `/registros`, `/ventas`, `/configuracion`, `/productos` 200; el QR de la mesa 1 con su token de siempre sirve el portal con el menú (la barbacoa incluida); el teléfono de cocina con un token firmado hoy con la misma pimienta, 200; 0 ventas cobradas | unos 4 s en total                     |

**El regreso atrás, ensayado:** con la app ya arrancada contra la copia, sólo se cambió
`DATABASE_URL` (a otra copia con los datos de Don Poncho, la del QA de DP-13, como si fuera la
compartida) y se reinició: la misma compilación sirvió esa base (11 personas en la lista, contra 9
de la copia del ensayo). En Vercel es lo mismo: regresar las cinco variables y redesplegar.

El lunes, sin la carga, la mudanza debería tardar lo del ensayo de DP-10.5: unos minutos.

## El ensayo (DP-10.5, 27-10-2026)

Con los datos reales de Don Poncho exportados de la compartida (sólo lectura), en bases
desechables de esta PC:

- **Con las migraciones de `main`** (hasta la 185): exportar 16,9 s (132 tablas, 950 filas; el
  bucket está vacío: 0 archivos), migrar desde cero 8 s, importar 1,4 s; filas y md5 idénticos,
  sin llaves rotas.
- **Con las migraciones de `fase-b`** (hasta la 188): migrar desde cero 7 s, importar 2,2 s (3 s
  de reloj); filas y md5 idénticos; la 188 deja apagadas las tres demostraciones de la 042 y a
  Don Poncho activo.
- En las dos: la aplicación compilada, con la `PIN_PEPPER` de producción, lista al personal y
  entra con PIN (un gerente de ensayo dado de alta sólo en la copia; ningún PIN real), y la
  jornada completa del restaurante pasa en el navegador. Detalle en el reporte 003.
