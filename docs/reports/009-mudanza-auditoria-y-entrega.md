# 009 · DP-15 · La mudanza a la base propia, la auditoría por función y la entrega con el puro link

- **Fecha:** 08 y 09-11-2026, hora de CDMX.
- **Dónde:** sesión local de Claude Code en la laptop de Miguel; rama `dp-15` (la mudanza) y
  `dp-15-codigo` (los arreglos), en el PR [#13](https://github.com/M1gu3hb/POS-Don-Poncho/pull/13).
- **Sin secretos ni PIN en este documento:** los accesos viven en `..\_PRIVADO\`.
- **Producción, desde el 08-11 a las 11:03, en la base propia** (proyecto de Supabase «POS Don Poncho»,
  us-east-2, Postgres 17). La base compartida conserva intactos los datos de Don Poncho como respaldo,
  y la huella de los otros 10 negocios quedó idéntica antes y después.

## 0 · Lo que necesita Miguel

1. **Su revisión de 10 minutos con sus PIN, antes del sábado** (`docs/ENTREGA-DON-PONCHO.md`, «La
   revisión de Miguel»): entrar a cada puesto desde su teléfono, la PC y una tableta, el QR de una
   mesa y «Agregar a inicio». Los PIN reales no los teclea un agente (DP-D88).
2. **El sábado:** nombrar las dos cajas en Configuración → Caja después de abrirlas («Caja 1» la PC,
   «Caja 2» la tableta) y probar el ticket en la impresora térmica real (58 u 80 mm).
3. **La primera semana:** mirar el uso en Vercel (invocaciones, CPU activa, transferencia) y el egress
   de Supabase (`docs/infra/CAPACIDAD.md`).

## 1 · La mudanza (fases 1, 3 y 4)

- **El proyecto nuevo** (lo creó Miguel): sus datos con la CLI de Supabase, el bucket privado
  `pos-don-poncho` y las llaves en `_PRIVADO\fase-b.env`. El almacén va por la API de Supabase, sin
  llaves S3 (DP-D81).
- **La base:** `pnpm db:migrate` hasta la 188 y `verify:esquema` estricto; RLS en 139 de 139 tablas y
  0 permisos para `anon` y `authenticated`, sin migración nueva: las de siempre ya los dejan así
  (DP-D81). La importación de Don Poncho, idéntica en conteos y md5.
- **Los PIN:** todos nuevos, al azar, aplicados por el comando del sistema antes de cambiar Vercel
  (DP-D82); viven en `_PRIVADO\PINES-DON-PONCHO.md`. El aviso del PIN público queda resuelto en la base
  propia.
- **Vercel:** cambiaron sólo las cinco variables de Production (base y almacén); `PIN_PEPPER`,
  `SESSION_SECRET`, `ORGANIZACION` y `APP_URL` no. El humo en producción, sin cobrar: 38 de 38.
- **El regreso atrás**, escrito y probado en seco: `docs/infra/MUDANZA-FASE-B.md` y
  `_PRIVADO\mudanza\regreso-atras\LEEME.md` (10 minutos; lo escrito después en la base propia no viaja).
- **Lista para operar:** cupo de 2 cajas a la vez, el usuario «Caja 2», descuentos con el PIN de
  gerente, administrador o dueño. **Respaldos:** el plan Pro guarda un respaldo diario de 7 días (se
  restaura desde el panel, todo el proyecto a ese día; sin PITR) y hay una exportación manual de la base
  ya lista en `_PRIVADO\mudanza\`.
- **La migración 189** (`productos.agotado_hasta`, aditiva) se aplicó a la base propia con
  `pnpm db:migrate` antes de desplegar el código que la lee (DP-D83, ficha 35).

## 2 · La capacidad (fase 2)

Medido por aparato abierto (`docs/infra/CAPACIDAD.md`): el personal cabe holgado en los dos planes;
lo que acercaba al límite era el portal del comensal, que bajaba el menú completo cada 4 s. Con 10
teléfonos abiertos la jornada entera, Vercel se pasaba del crédito del equipo (≈ 39 USD contra 20);
en lo realista quedaba justo (≈ 15 USD). **El ajuste más barato, aplicado:** el portal relee su estado
completo cada 12 s y al volver a la pantalla (−67 % de transferencia por teléfono, −28 % de peticiones;
estimado con los tamaños medidos). Las conexiones van por el pooler de transacción (6543), 10 por
instancia como máximo, contra 200 clientes del pooler.

## 3 · La auditoría por función (fase 5) y los arreglos (fase 6)

Dos auditorías Sonnet sobre copias de la base propia, módulo por módulo
(`docs/qa/AUDITORIA-POR-FUNCION.md`): **2 bloqueantes y 15 medios. Todos arreglados o justificados**, con
prueba en rojo antes y sus mutantes:

- **Bloqueantes:** el platillo agotado del día (DP-D83; la cocina lo marca y vuelve solo al día
  siguiente) y los movimientos de efectivo de la cajera en `/caja` (DP-D84).
- **Medios, entre otros:** la mesa llega a «Esperando entrega» con varias estaciones y la cocina se
  limpia al cobrar (DP-D87); el diálogo «Cobrar» en tableta y PC; el Cierre del día avisa si queda otra
  caja (DP-D85); el cierre dice lo mismo que Registros (½ kg); el CSV en hora de México; el ticket en 58
  u 80 mm; el Tablero suma todas las cajas; «Agregar producto»; la gerente sin Datos ni Integraciones
  (DP-D86); el pedido a medias del mesero sobrevive a una recarga.
- **Una revisión de código del servidor** (Sonnet, sólo lectura): sin bloqueantes. Probando uno de sus
  hallazgos contra Postgres real salió que **la entrada de cambio heredada nunca se había podido
  guardar** (dos restricciones del esquema; sus pruebas eran con una base falsa): arreglada (DP-D89).
- **El build** cazó un nombre importado dos veces en la pantalla del mesero: arreglado antes de
  desplegar.

## 4 · El QA final (fase 7)

Sobre copias nuevas de la base propia, con la app compilada de la rama; tres agentes Sonnet:

- **QA-J, la jornada completa** (`docs/qa/JORNADA-2026-11-08.md`): dos cajas (PC y tableta), tres
  meseros en Android y tableta, Cocina y Bebidas, el dueño y comensales en 4 mesas (uno en iPhone
  WebKit, dos teléfonos con el carrito compartido). 14 cobros con efectivo, tarjeta, transferencia y
  mixto, descuentos con PIN, cancelaciones, división de cuentas, propinas, retiros y entradas de
  cambio. **Los dos cortes y el Cierre del día cuadraron al centavo** (ventas $4,077.15, propinas
  $327.51, descuentos $90.60) y **las 34 consultas de violación dieron 0 filas**.
- **QA-D, los aparatos** (`docs/qa/APARATOS-2026-11-08.md`): 54 de 54 entradas sin desborde, 8 aparatos
  a la vez sin bloqueo, sesiones independientes, el portal en teléfonos, la red lenta (3G: 25 s de la URL
  a la pantalla del puesto, 1.7 s abrir mesa, 1.0 s la comanda en Cocina), la red que se cae (el pedido
  se recupera) y la pantalla de inicio.
- **Lo que encontraron** (`docs/qa/HALLAZGOS-DP15.md`): un bloqueante (el ticket impreso salía cortado
  por la izquierda) y cinco medios (no se podía nombrar «Caja 1» porque 25 aparatos dormidos ya se
  llamaban así; el Cierre del día resumía sólo la última caja; el fondo de apertura con las entradas de
  cambio; la precuenta del mesero sin rastro; la comanda cobrada atorada en «Listos»). **Todos
  arreglados** (DP-D90).
- **Ronda 2** sobre una copia nueva (`docs/qa/RONDA2-2026-11-08.md`): **9 de 9 en SÍ**, cuadre al
  centavo, 0 de 34 violaciones, sin hallazgos nuevos.

## 5 · El puro link en producción (fase 8)

Con `main` en `cd76829` ya desplegado (`READY` el 09-11 a las 04:24), sin PIN y sin escribir nada de
negocio (DP-D88), con Playwright desde la laptop contra https://pos-don-poncho.vercel.app:

- **La entrada del personal** (`/n/don-poncho/login-pos`): 200 y sin desborde en Android 360 y 412,
  iPhone 390 (WebKit), iPad 768, tableta 1024 y PC 1366; de 0.7 a 1.6 s. La primera petición tras el
  despliegue tardó 7.7 s: el arranque en frío.
- **El portal de una mesa**, abierto con el token de siempre de su QR: el menú en los cinco teléfonos y
  tabletas, de 0.5 a 1.1 s. El QR impreso no se escaneó con una cámara: eso va en la revisión de
  Miguel.
- **8 aparatos a la vez:** todos 200, en 2.5 s.
- **Red lenta (3G emulado):** la entrada, 9.8 s la primera vez y 1.4 s con caché; el portal, 12.2 s y
  1.8 s.
- **«Agregar a inicio»:** el manifiesto (`display: standalone`, «Don Poncho», iconos de 192, 512 y
  *maskable*) y las etiquetas del iPhone, incluida `apple-mobile-web-app-capable` (DP-D90).
- **Producción limpia** (lectura): 0 sesiones de caja, 0 cuentas, 0 folios, 0 comandas y las 10 mesas
  libres.
- **Lo que un agente no hace:** entrar con los PIN reales y probar en los teléfonos de verdad. Es la
  revisión de 10 minutos de Miguel (§0).

## 5b · Las alertas intermitentes de producción (DP-D91)

Tras la mudanza, Vercel registró que el limitador de intentos no pudo contar algunas veces y que el
carrito del portal devolvió 500 (13:50 del 08-11, durante la prueba del link, y 2 de 16 lecturas en una
sonda posterior). Nunca en local. La causa no se registraba, así que primero se desplegó la causa (la
clase y el código) en esas alertas. Con eso, la prueba del link del 09-11 dijo `sqlstate 25006`:
transacción de sólo lectura.

**Las causaban mis propios guiones de verificación.** Leían producción por el pooler de transacción y
empezaban con `set default_transaction_read_only = on`. En ese pooler, el `SET` se queda en la conexión
del servidor y la app lo heredaba hasta que Supavisor cerraba la conexión. Los guiones ahora usan
`begin read only … commit`, y la misma prueba dio **cero alertas**. La base compartida no se tocó:
todas esas corridas fueron contra la propia, y los guiones del repo que leen la compartida ya usaban la
transacción. La regla quedó en la ficha 35. También se desplegó `attachDatabasePool`, la recomendación
de Vercel para `pg`: no era la causa, pero se queda.

## 6 · Lo no hecho, y por qué

- **Fuera de este encargo:** el rediseño, las apps, la impresión directa a las térmicas, Google Drive,
  Mercado Pago y el servidor privado.
- **Mejoras anotadas** (ninguna estorba el día 1): «Dividir cuenta» en partes iguales; las mesas de
  cuentas divididas quedan en «Limpieza» hasta «Marcar libre» (diseño, DP-D66); la compra en efectivo
  con dos cajas abiertas (el día 1 se registra como retiro de la cajera, DP-D84); que el servidor exija
  también «Oculto en el POS»; detalles de la pantalla del celular (el menú tapa «Mesa N», «Historial» a
  360 px); `@page size: 58mm auto` (Chromium usa la hoja de la impresora: se confirma el sábado).
- **Las recetas:** los 107 platillos siguen sin receta; el margen dice «sin receta» hasta cargarlas.
- **Local:** `verify:entorno` pide Postgres 17 y la laptop tiene 18; corrió todo lo demás, y la CI
  corre su parte.

## 7 · Las decisiones y la ficha

- DECISIONES DP-D81 a DP-D91.
- La ficha 35 para el maestro (`docs/para-el-maestro/35-agotado-movimientos-dos-cajas-y-puestos.md`),
  con la migración 189.

## 8 · Los commits

El PR [#13](https://github.com/M1gu3hb/POS-Don-Poncho/pull/13) (`dp-15-codigo` → `main`), con la mudanza
(`df2c1e0`) y los arreglos, todos a nombre de M1gu3hb. El merge a `main` es `cd76829` (09-11, 04:22), desplegado en producción (`dpl_8d4e…`). Este reporte, la
bitácora y DP-D91 van en el PR de documentos que le sigue.
