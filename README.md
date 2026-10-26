# POS Don Poncho

Punto de venta de **La Tradicional Barbacoa de Don Poncho** (San Lorenzo Atemoaya, Xochimilco).
Sólo restaurante: mesas, comandas a cocina y bebidas, precuenta, portal QR del comensal, caja con
pagos mixtos y propina, cierre y arqueo, platillos y recetas, inventario, compras y tablero.

Sale del maestro **MorphiqPOS** en `5f4534c` (ver [`ORIGEN.md`](ORIGEN.md)). Antes de tocar nada
lee [`CONTEXTO.md`](CONTEXTO.md), [`DECISIONES.md`](DECISIONES.md), [`TEAM.md`](TEAM.md) y
[`REGLAS.md`](REGLAS.md). Para retomar una sesión: [`docs/BITACORA.md`](docs/BITACORA.md).

> **El repositorio es público.** Ningún PIN, llave, contraseña ni dato de cliente entra aquí.

## Levantarlo

Necesitas **Node 20.11 o superior** y un Postgres 16+ (local o el del `docker-compose`).

```bash
corepack enable
pnpm install
cp .env.example .env            # y GENERA tus secretos, no uses los de ejemplo
pnpm db:up                      # Postgres 17 + almacenamiento, en contenedores (opcional)
pnpm db:migrate                 # el esquema, desde cero, con las migraciones del repo
pnpm dev                        # http://localhost:3000
```

`SESSION_SECRET` y `PIN_PEPPER` no tienen valor por defecto: el proceso no arranca sin ellos.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`PIN_PEPPER` es la pimienta del hash de los PIN. **Rotarla invalida todos los PIN**: se fija una
vez y viaja igual a la base propia (Fase B) y al servidor del restaurante (Fase C).

## Dar de alta el negocio

```bash
pnpm db:alta-negocio --slug don-poncho --nombre "Don Poncho" --giro restaurante \
  --paquete restaurante --sucursal "San Lorenzo Atemoaya"
pnpm db:bootstrap --org don-poncho --persona "<nombre>" --pin <4-8 dígitos>
```

El alta es idempotente y deja su rastro en `auditoria`; el primer acceso se da una sola vez. Lo
demás (empleados, mesas, menú) se hace desde la aplicación o con los guiones de `scripts/`.

## Los comandos que vas a usar

| Comando                        | Qué hace                                                        |
| ------------------------------ | --------------------------------------------------------------- |
| `pnpm verify`                  | **La puerta completa.** Es lo que decide si algo está terminado |
| `pnpm test:unit`               | Pruebas unitarias, sin base de datos                            |
| `pnpm test:integracion`        | Contra Postgres real. Pide `DATABASE_URL_PRUEBAS` desechable    |
| `pnpm test:e2e`                | Playwright, contra un build y un restaurante de prueba          |
| `pnpm lint` · `pnpm typecheck` | Cero errores, siempre                                           |

## Cómo está organizado

```
apps/web/            La aplicación. Next.js App Router único
packages/
  contracts/         Tipos, errores tipados, entorno y las guardas de negocios
  domain/            Reglas puras. Cero I/O, cero React, cero SQL
  data/              El único lugar que conoce SQL. Las migraciones viven aquí
  app/               Casos de uso: comandos y consultas, con permisos en el servidor
  ui/                Tokens, el motor de estilos y las primitivas
  testing/           Inyección de fallos, datos sintéticos, arranque de Postgres
infra/docker/        Postgres + almacenamiento, para el servidor del restaurante
pruebas/e2e/         Las jornadas de navegador, sobre un restaurante de prueba
```
