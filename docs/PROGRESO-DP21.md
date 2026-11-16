# PROGRESO · DP-21 · El cierre antes de instalar en Don Poncho

> Si la sesión se corta o se compacta, **lo primero es releer este archivo** y seguir desde «Lo que
> sigue». Sin secretos ni PIN aquí: viven en `..\_PRIVADO\`.

Bitácora para retomar. Empezó el domingo 15-11-2026 a las 21:45 (CDMX). Instalación: lunes 16-11,
hacia las 18:00.

## El reloj (lunes 16-11)

| Cuándo | Qué |
| --- | --- |
| 06:00 | PR A (Bloques 1 a 8) en producción |
| 11:00 | PR B (Bloques 9 a 12, 15, lo de dinero del 20 y la mudanza del 21) en producción |
| 14:00 | Congelado: lo que no esté en producción no entra. La lista para Miguel |
| ~16:30 | Dejar en ceros, sólo con el «sí» de Miguel en el chat |
| ~18:00 | Instalación |

La prioridad es la de los PR (A, luego B, luego C) y, dentro de cada uno, por número. Si no alcanza
el tiempo, se cae lo último.

## Dónde está cada cosa

| Qué | Dónde |
| --- | --- |
| Mi árbol (la sesión principal) | `..\.work\dp20`, rama `dp-21-a` (salió de `main` en `faed6cc`) |
| El agente 1 (lo táctil y lo visual) | `..\.work\dp20-lab`, rama `dp-21-ag1` |
| El agente 2 (inventario del Bloque 20, Configuración, tablero, guías) | `..\.work\dp18-integrar`, rama `dp-21-ag2` |
| El checkout principal | `POS Don Poncho`, en `main`: ahí corre el `verify` de línea base |
| Guiones y registros de la etapa | `D:\mpos-tmp\dp21\` (fuera del repo) |
| La base local de pruebas | clúster Postgres 18 en el 55433, base `dp21_pruebas` |
| El mapa de la Configuración | `docs/CONFIGURACION-MAPA.md` |

## Skills cargadas

`engineering:code-review`, `engineering:testing-strategy`, `engineering:debug` y `morphiq-prs`
(apareció como `anthropic-skills:morphiq-prs`). Ninguna faltó.

## Arranque (15-11, 21:45)

- **Repos:** el POS en `faed6cc`; las apps en `d2d94ed` (traían 4 commits de la 1.0.1).
- **`pnpm install`** en verde. **`pnpm verify`**, en dos tramos como en DP-18 y DP-20
  (`D:\mpos-tmp\dp21\verify-local.sh`): todas las puertas menos `verify:esquema`, `verify:rls` y
  `verify:acople` (leen la base compartida; la CI tampoco las corre), y `test:integracion` contra
  `dp21_pruebas`. Resultado: ver «Línea base» abajo.
- **Producción, sólo leyendo** (conexión de sesión 5432, una transacción `read only` con `rollback`;
  `D:\mpos-tmp\dp21\revisar-produccion.mjs`):
  - desplegado `faed6cc`, «Ready»; **0 errores de ejecución en Vercel en 24 h**;
  - 9 cuentas pagadas (folios A-1 a A-9, $3,050.80; el impuesto guardado es el 13.79 % del total:
    16 % incluido), 0 cajas abiertas y 1 cerrada (en «Caja 33»), 11 movimientos de caja, 16
    comandas entregadas, 10 mesas libres, 2 carritos sin renglones, 5 solicitudes del QR;
  - 35 terminales, todas «Caja N» y activas; cupo de cajas en 1; 0 almacenes; folios: `A` sigue
    en 10 y `CC` en 2; 0 compras, gastos y movimientos de inventario; migraciones hasta la 192;
  - `configuracion.valores`: `impuesto` vacío e `iva_porcentaje` vacío;
    `portal_qr_cuenta_modo = ambos`, `portal_qr_envia_a_cocina = mesero`,
    `portal_qr_comensales_abren_mesa = false`, `portal_qr_permitir_propina_cliente = true`,
    `propinas_activas = true`, `propina_porcentajes_sugeridos = 5,10,15,20`.
- **La Configuración de hoy** (conteo estático): 13 pestañas, unas 32 tarjetas y cerca de 75
  controles de valor (43 campos, 20 interruptores, 11 selectores) más unos 80 botones, en 32
  archivos. El inventario automático del Bloque 21 dará el exacto.

### Lo que el encargo dice y el repo no (gana el repo)

- No hay `CLAUDE.md` ni `AGENTS.md` en la raíz: sólo los de `apps/web`.
- La Configuración tiene 13 pestañas, no 14.
- `verify` completo no corre en la laptop (sin Docker): va en dos tramos, como arriba.
- El clúster local de pruebas (55433) estaba apagado; se levantó.
- El encargo DP-21 llegó pegado dentro del mensaje de arranque: se tomó como recibido.

### Decisiones de reparto (se anotan porque cambian la sugerencia del encargo)

- El PR A son ocho bloques y cierra a las 06:00. El **Bloque 8** (la voz) es sólo de pantalla y
  está bien acotado: lo hace el agente 1 antes de pasar a lo táctil. Los demás del PR A, la sesión
  principal.
- El agente 2 empezó por el inventario del Bloque 20 (la parte que se hace leyendo el código).
- Los agentes trabajan en árboles que ya tenían `node_modules` (no hay Docker ni tiempo para tres
  instalaciones desde cero); lo que había sin seguir en `dp20-lab` se guardó en
  `D:\mpos-tmp\dp21\respaldo-dp20-lab\`.

## Línea base

_(se llena al terminar el `verify` de arranque)_

## Estado por bloque

| Bloque | Qué | PR | Estado |
| --- | --- | --- | --- |
| 1 | El IVA | A | en curso |
| 2 | Entrar con PIN y las estaciones que se recuerdan | A | pendiente |
| 3 | Nada de app instalable; el portal a salvo | A | pendiente |
| 4 | La propina: una sola verdad | A | pendiente |
| 5 | Las cajas con nombre fijo | A | pendiente |
| 6 | Folios de verdad | A | pendiente |
| 7 | El cajón | A | pendiente |
| 8 | La voz de cocina | A | agente 1, en curso |
| 9 | Lo táctil | B | pendiente |
| 10 | Cambiar de mesa | B | pendiente |
| 11 | Gastos de Caja = Compras y gastos | B | pendiente |
| 12 | El ticket a tu gusto | B | pendiente |
| 13 | El tablero | C | pendiente |
| 14 | Configuración limpia | C | pendiente |
| 15 | Colores del iMin | B | pendiente |
| 16 | El barrido visual | C | pendiente |
| 17 | Las guías | C | pendiente |
| 18 | Los cortes en una carpeta (app 1.0.2) | C | pendiente |
| 19 | Lo que quedó de DP-19 | C | pendiente |
| 20 | Lo desconectado, roto o sin propósito | B y C | agente 2, inventario en curso |
| 21 | La Configuración, ordenada | B | mapa escrito; mudanza pendiente |

## Lo que sigue

1. Bloque 1 (IVA), con su prueba primero.
2. Revisar e integrar el Bloque 8 cuando el agente 1 termine; luego mandarlo al Bloque 9.
3. Bloques 2 a 7, en orden.
