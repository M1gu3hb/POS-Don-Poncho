# 07 · El pedido compartido de la mesa (DP-9.5, fase B)

## Qué hace y por qué

Miguel: «en una mesa de seis, cada teléfono mandaba su pedido por separado; la cocina recibía
seis comandas sueltas y nadie sabía si ya habían pedido todos».

- **Un carrito por mesa.** Todos los teléfonos que escanean el QR de la mesa arman el mismo
  pedido: lo que agrega uno lo ven los demás en 2-3 segundos. Cada quien quita sólo lo suyo
  (lo de otro teléfono dice «De otro teléfono» y no tiene «Quitar»).
- **Personas conectadas.** Arriba del portal: «3 personas conectadas» (teléfonos distintos que
  miraron el pedido en el último minuto desde que se abrió la cuenta).
- **Esperar a todos.** Con dos o más teléfonos, o si la mesa se abrió para dos o más: «Esperen a
  que todos agreguen su pedido antes de enviarlo».
- **Se manda UNA vez.** Cualquiera envía; en una mesa de dos o más, antes pregunta «¿Ya pidieron
  todos?» con el pedido completo. Sale entero —una comanda por estación—, con el precio del
  catálogo, y el carrito se vacía para todos; los demás teléfonos ven «Pedido enviado». Después
  se puede armar otra ronda.
- **Dos «Enviar» a la vez son un solo pedido**: el segundo espera al primero (la cuenta se lee con
  candado) y encuentra el carrito vacío.
- Funciona con y sin asignación de mesas (DP-9.2). Con mesas unidas (DP-9.6), el QR de cualquier
  mesa del grupo cae en el carrito de la principal.

## Cómo está hecho

- **Migración 186** (`packages/data/src/migraciones/sql/186_pedido_compartido.sql`):
  `carrito_mesa_lineas` (qué, cuánto, nota y la HUELLA del teléfono que lo agregó; sin precio),
  `dispositivos_mesa` (el último latido de cada teléfono) y `carritos_mesa` (la ronda de cada
  mesa; su fila es también el cerrojo del envío). RLS como el resto.
- **El id del teléfono** lo inventa su navegador y se guarda en él; en el servidor sólo vive su
  huella (HMAC con la pimienta del servidor).
- **Tres comandos públicos** auditados e idempotentes: `portal.carrito_agregar`,
  `portal.carrito_quitar` (sólo lo propio) y `portal.carrito_enviar` (pide confirmación con dos
  o más; reusa `pedirEnLaMesa`, la misma función del pedido de siempre).
- **El sondeo** `POST /api/publico/qr/:token/carrito` deja el latido y devuelve el carrito. NO es
  un comando: el latido es presencia, no un hecho del negocio, y auditarlo escribiría una fila por
  teléfono cada tres segundos. Tiene su límite por token (240 por minuto).
- En el portal, el carrito local (`CarritoQR.jsx`) se va: lo reemplaza
  `src/portal/carrito-compartido/` (el pedido de la mesa, el aviso de arriba y el sondeo).

## Archivos

| Archivo                                                         | Qué                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| `packages/data/src/migraciones/sql/186_pedido_compartido.sql`   | Las tres tablas                                      |
| `packages/data/src/esquema.ts`, `scripts/esquema-esperado.json` | Sus tipos y su contrato                              |
| `packages/app/src/portal/carrito.ts`                            | Huella, forma, latido y lectura del carrito          |
| `packages/app/src/portal/carrito-comandos.ts`                   | Agregar, quitar y enviar                             |
| `packages/app/src/portal/carrito-http.ts`                       | El sondeo con latido                                 |
| `packages/app/src/portal/pedido.ts`                             | `pedirEnLaMesa`, compartida con el pedido de siempre |
| `packages/app/src/portal/carrito.integracion.test.ts`           | Contra Postgres, con dos «Enviar» simultáneos        |
| `apps/web/app/api/publico/qr/[token]/carrito/**`                | Las cuatro rutas                                     |
| `apps/web/src/portal/carrito-compartido/*`                      | El pedido de la mesa en el teléfono                  |
| `apps/web/heredado/pages/PortalCliente.jsx`                     | Usa el pedido de la mesa                             |
| `apps/web/heredado/components/portalqr/CarritoQR.jsx`           | Borrado                                              |
| `pruebas/e2e/pedido-compartido.spec.ts`                         | Dos teléfonos en la misma mesa                       |

## Migraciones

`186_pedido_compartido.sql`. Vive en la rama `fase-b`: la base compartida no admite DDL, así que
se aplica cuando Don Poncho tenga su propia base (Fase B). Probada desde cero en base desechable.

## Cómo probarlo

Con `docs/DEMO-LOCAL.md` en la rama `fase-b`: abre el QR de una mesa en dos teléfonos de la misma
wifi.

## Genérico o de Don Poncho

Genérico.
