# Demo local de Don Poncho

Para probar el sistema completo en tu PC, con los teléfonos y la tablet de la misma red wifi, sin
tocar la base de producción. Sirve también para probar lo que vive en la rama `fase-b` (pedido
compartido y unir mesas), que necesita migraciones que la base compartida no admite.

La base de la demo es **desechable**: vive en tu PC y la puedes borrar cuando quieras. El script se
niega a usar una base que no sea de tu máquina, y no lee el `.env`.

## Lo que necesitas

- Node 24 y pnpm (los del repositorio: `corepack enable`).
- PostgreSQL 17 o 18 instalado en la PC (o Docker con `postgres:17.6-alpine`), con un usuario que
  pueda crear bases y roles.
- La PC y los teléfonos en la **misma red wifi**.

## 1 · Preparar la base (una vez)

En la carpeta del repositorio:

```bash
pnpm install
```

```bash
node --conditions=react-server scripts/demo-local.mjs preparar --base postgres://USUARIO:CLAVE@127.0.0.1:5432/don_poncho_demo
```

Cambia `USUARIO:CLAVE` y el puerto por los de tu Postgres. El script:

1. crea la base `don_poncho_demo` si no existe y le aplica las migraciones de la rama en la que
   estás;
2. da de alta a Don Poncho con su ID, su menú completo, su portal QR, sus mesas, su equipo y los
   botones de su menú, todo por los comandos de la aplicación (como en producción);
3. imprime los **PIN de demo** de cada persona. No son los de producción: se inventan la primera
   vez y se guardan, con los secretos de la demo, en `pos-don-poncho-demo/demo.json` dentro de la
   carpeta temporal de tu usuario (fuera del repositorio).

Correrlo otra vez no duplica nada y conserva los mismos PIN.

## 2 · Levantar el servidor

```bash
node --conditions=react-server scripts/demo-local.mjs servir --base postgres://USUARIO:CLAVE@127.0.0.1:5432/don_poncho_demo
```

El script detecta la IP de tu PC en la red (la puedes forzar con `--ip 192.168.1.50`), compila y
deja el servidor en `http://<IP>:3300`. Imprime la dirección de entrada.

**La primera vez, Windows pregunta si dejas que Node acepte conexiones de la red: dile que sí, sólo
en redes privadas.** Si no preguntó y los teléfonos no llegan, revisa el Firewall de Windows: regla
de entrada para el puerto 3300, sólo en red privada.

La demo se sirve por `http` (sin candado). Por eso sus cookies no llevan `Secure`: con `Secure` el
teléfono las descartaría y nadie podría entrar. En producción, con `https`, siempre lo llevan.

## 3 · Probar desde los teléfonos

- **Tablet del mesero, caja y cocina:** abre `http://<IP>:3300/n/don-poncho/login-pos` y entra con
  el PIN de demo de cada quien. Desde la misma PC también sirve `http://localhost:3300/…`.
- **QR de las mesas:** entra como dueño → Portal QR → Mesas QR. Los QR apuntan a
  `http://<IP>:3300/qr/…` (sale de `APP_URL`, no de la pestaña): escanéalos con el teléfono en la
  misma wifi, o imprímelos.
- **Teléfono de cocina:** en Cocina, «Conectar teléfono» → escanea el QR de la estación.

Si la IP de la PC cambia (otro wifi, el router la reasignó), corre otra vez `preparar` (corrige la
dirección de las imágenes del menú) y luego `servir`: los QR salen con la IP nueva. Los QR que
imprimiste con la IP anterior dejan de llegar; en la demo eso no importa.

## 4 · Probar la rama `fase-b`

```bash
git checkout fase-b
```

```bash
node --conditions=react-server scripts/demo-local.mjs preparar --base postgres://USUARIO:CLAVE@127.0.0.1:5432/don_poncho_demo
```

Aplica las migraciones nuevas de `fase-b` a la misma base (o usa otro nombre de base para empezar
en limpio) y vuelve a levantar el servidor con `servir`.

## 5 · Ver el diseño nuevo (DP-11.4)

Está en `main` (y en la rama `dp-11` mientras se publica): con `servir` ya se ve.

- **Estilo:** entra como dueño → Configuración → Apariencia. «Don Poncho» y «Morphiq» usan el
  lenguaje de capas (perilla Elevación en `capas`); «Retro» es el nuevo. Si la demo se preparó
  antes de DP-11.4, su perilla de elevación dice `sombra`: cámbiala a `capas` y «Guardar para el
  negocio».
- **Claro u oscuro:** en la misma pestaña, «Claro u oscuro, en este aparato» (Automático sigue al
  aparato).
- **Las tres pantallas piloto:** el Tablero (dueño), Mesas y pedidos (mesera; abre una mesa) y
  Caja (caja; el diálogo de cobro trae el teclado táctil). En la tablet y el teléfono, la
  navegación es el dock de abajo; en la PC, la barra lateral.
- **Capturas y video para comparar:** `node scripts/capturar-pilotos.mjs --url
  http://localhost:3300 --secretos <demo.json> --salida <carpeta> --video`.

## Borrar la demo

```sql
drop database don_poncho_demo;
```

Y, si quieres PIN nuevos la próxima vez, borra también la carpeta `pos-don-poncho-demo` de tu
carpeta temporal.
