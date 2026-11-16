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

`main` en `faed6cc`: puertas estáticas, formato, lint y tipos en verde; unitarias 5,991 de 5,992
(`portal/avisos-caducados.test.ts` se pasó de tiempo bajo carga —14 s contra 5 s— y sola pasa en
2 s: el mismo ruido ambiental de DP-18). La cadena se detuvo ahí; la CI de `faed6cc` estaba en
verde (PR #31).

## Estado por bloque (16-11, 04:10)

| Bloque | Qué | PR | Estado |
| --- | --- | --- | --- |
| 1 | El IVA | A | hecho (`424dbe8`) · DP-D129 · e2e `sin-iva.spec.ts` |
| 2 | Entrar con PIN y las estaciones que se recuerdan | A | hecho (`89702b1`) · DP-D130 · e2e `pin-al-abrir.spec.ts` |
| 3 | Nada de app instalable; el portal a salvo | A | hecho (`53bd278`, agente) · DP-D134 |
| 4 | La propina: una sola verdad | A | hecho (`78fe0f4`, `41292f8`) · DP-D131 · e2e `propina-una-sola-verdad.spec.ts` |
| 5 | Las cajas con nombre fijo | A | hecho (`36ab6b9`) · migración 193 · DP-D132 · e2e `cajas-del-negocio.spec.ts` |
| 6 | Folios de verdad | A | hecho (`43ab909`, agente 2) · DP-D128 · e2e `folios-con-prefijo.spec.ts` |
| 7 | El cajón | A | hecho (`8af0c71`, agente) · DP-D133 |
| 8 | La voz de cocina | A | hecho (`c45370f`, agente 1) · DP-D133 |
| 9 | Lo táctil | B | hecho por el agente 1 (`f9b8167`), en `dp-21-pr-b`; falta probar en aparato |
| 10 | Cambiar de mesa | B | hecho (`a019fe3`) · 9 mutantes muertos · e2e `cambiar-de-mesa-en-el-mapa.spec.ts` |
| 11 | Gastos de Caja = Compras y gastos | B | agente 2, en curso |
| 12 | El ticket a tu gusto | B | hecho por el agente 2 (`511e441`) · `test:impresion` 20 de 20 |
| 13 | El tablero | C | pendiente |
| 14 | Configuración limpia | C | pendiente |
| 15 | Colores del iMin | B | agente 1, en curso |
| 16 | El barrido visual | C | pendiente |
| 17 | Las guías | C | pendiente |
| 18 | Los cortes en una carpeta (app 1.0.2) | C | pendiente |
| 19 | Lo que quedó de DP-19 | C | pendiente |
| 20 | Lo desconectado, roto o sin propósito | B y C | inventario hecho (`docs/reports/012-anexo-inventario.md`, 128 renglones) |
| 21 | La Configuración, ordenada | B | mudanza hecha por el agente 2 (`097b6b9`): 16 secciones, 49 tarjetas; e2e `configuracion-secciones.spec.ts` |

### Ramas

- `dp-21-a` (árbol `.work\dp20`): el PR A completo, Bloques 1 a 8.
- `dp-21-b` (árbol `.work\dp18-integrar`): `dp-21-a` + Bloque 9; ahí trabaja el agente 2 la mudanza.
- `dp-21-ag1` (árbol `.work\dp20-lab`): el agente 1, Bloque 15.

### Decisiones tomadas sin Miguel (opción por omisión, anotadas)

- El almacén teclea su PIN como el cajero (DP-D130).
- La voz conserva «Nuevo pedido mesa 4:» (DP-D133).
- El portal sólo manda a calificar si la cuenta sigue abierta; «Tu cuenta ya se pagó» cierra y ya.
- El mapa de la Configuración lo redactó el agente 2 (hizo el inventario) y lo revisó la sesión
  principal; sus 14 dudas se resolvieron con la opción por omisión del encargo y están en el mapa.
- Integraciones se quita completa en la mudanza, con su «Cola de sincronización» (era de demostración).
- El arnés e2e deja la marca del PIN tecleado en las sesiones guardadas (DP-D130).

### Trampas de esta etapa

- La base desechable de las e2e usa un directorio fijo: dos corridas a la vez necesitan
  `MORPHIQPOS_BASE_DESECHABLE_DIR` y `…_PUERTO` propios (`D:\mpos-tmp\dp21\e2e-entorno.sh`).
- `verify:mutaciones-backend` tiene mutantes que buscan texto: si el código cambia de forma, el
  mutante «no cambia el archivo» y hay que apuntarlo a la forma nueva (pasó con el resolver de sesión).

### El cierre del PR A (16-11, madrugada)

- **Migración 193 en la base propia:** ensayo correcto (aplicó y revirtió) y luego en serio, las dos
  veces por la conexión de sesión (5432) con `pnpm db:migrate` (`D:\mpos-tmp\dp21\migrar-produccion.sh`),
  hacia las 02:56. Segunda pasada: «Sin migraciones pendientes (125 ya aplicadas)». Es aditiva: el
  código desplegado (`faed6cc`) corre igual sobre ella.
- **Un hueco del Bloque 2 que encontró la revisión antes de subir:** el acceso de producción
  (`heredado/pages/POSLogin.jsx`, el de `/login-pos`) no dejaba la marca del PIN: tras entrar, el
  candado lo habría pedido otra vez. Lo deja `login()` de `POSAuthContext`; contrato
  `espera/pin-al-entrar.contrato.test.ts` (toda pantalla que comprueba un PIN deja la marca) y e2e.
- **`verify` local:** estáticas, formato, lint, tipos, 6,307 unitarias, 102 mutantes del backend,
  contratos de catálogo/inventario/venta/identidad/paquetes, build, modo compatible, cobertura y
  cabeceras. La integración completa corre al final y en la CI.
- **e2e del PR A**, contra un solo build y la base desechable propia (5437): `pin-al-abrir`,
  `sin-instalacion`, `cajas-del-negocio`, `sin-iva`, `folios-con-prefijo` y
  `propina-una-sola-verdad`.

### PR A en producción (16-11, 04:01)

- [PR #32](https://github.com/M1gu3hb/POS-Don-Poncho/pull/32) unido a `main` como `13e9d77`, con la CI
  en 10 de 10. La primera vuelta de la CI encontró dos cosas que el `verify` local por partes no
  había visto y se corrigieron antes de unir: una prueba de integración del cupo que esperaba el
  mensaje de antes («Caja 1» era el aparato), y el día completo, que pide la cuenta con la mesera
  eligiendo la propina (el restaurante de prueba enciende ahora esa casilla; DP-D131).
- Despliegue de **Production** «Ready» con `13e9d77`. **Humo sin sesión y sin cobrar: 19 de 19**
  (`D:\mpos-tmp\dp21\humo-produccion.sh`; contra la versión anterior marcaba justo las 8 cosas
  nuevas: las 6 rutas del PR A y el manifiesto). **0 errores de ejecución en Vercel.**
- Producción, sólo leyendo, después del despliegue: lo mismo que al empezar (9 cuentas pagadas,
  $3,050.80; 1 caja cerrada; 35 terminales «Caja N»; cupo 1). Nada se escribió salvo la 193.
- Lo que cambia para Miguel desde ese momento: el mando y la caja teclean su PIN al abrir la app;
  el mesero ya no pregunta la propina; el IVA sigue en 16 % incluido hasta que él elija «Sin IVA».
- Lección: antes de subir, correr la integración COMPLETA y las suites que corre la CI
  (`restaurante`, `dia-completo-restaurante`, `rastreo`), no sólo las del bloque. Variables del
  restaurante de prueba para correrlas en local: las del flujo `verificar.yml`.

## Lo que sigue

1. PR B (11:00): está ensamblándose en `dp-21-pr-b` (árbol `.work\dp20`): el PR A + Bloque 9
   (táctil) + Bloque 10 (cambiar de mesa) + Bloque 12 (el ticket a tu gusto) + Bloque 21 (la
   mudanza). Faltan el Bloque 11 (agente 2, en curso), el Bloque 15 (agente 1, en curso) y lo de
   dinero, seguridad y datos del Bloque 20. Luego: e2e, `verify`, integración completa, las suites
   de la CI en local, retratos de la galería (`/configuracion` cambió entera), PR, CI, unir, humo.
2. Vigilar los errores de Vercel del PR A hasta las 05:00.
3. PR C y la Parte final (simulador, lista para Miguel a las 14:00, dejar en ceros con sus dos «sí»).
