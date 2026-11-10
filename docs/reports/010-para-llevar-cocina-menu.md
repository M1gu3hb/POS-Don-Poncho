# 010 · DP-16 · Para llevar, opciones con precio, cocina con volumen, teléfono de cocina y menú del comensal

- **Fecha:** 09-11 en la noche → 10-11-2026, hora de CDMX.
- **Dónde:** sesión local de Claude Code en la laptop de Miguel; una rama y un PR por parte:
  `dp-16` ([#17](https://github.com/M1gu3hb/POS-Don-Poncho/pull/17)), `dp-16-2`
  ([#18](https://github.com/M1gu3hb/POS-Don-Poncho/pull/18)), `dp-16-3`
  ([#19](https://github.com/M1gu3hb/POS-Don-Poncho/pull/19)), `dp-16-4`
  ([#20](https://github.com/M1gu3hb/POS-Don-Poncho/pull/20), el QA) y `dp-16-cierre` (este cierre).
- **Sin secretos ni PIN en este documento:** los accesos viven en `..\_PRIVADO\`.
- **Producción:** las cuatro partes en la base propia de Don Poncho, con CI 10/10 cada una; Don Poncho
  sigue en ceros (0 cajas, 0 cuentas, 0 folios, 0 comandas, 0 carritos, 10 mesas libres). En
  producción no se cobró nada.

## 0 · Lo que necesita Miguel

1. **Su prueba de 10 minutos** (§6), con sus PIN, en su teléfono, la PC y una tableta.
2. **Dos cambios en Configuración, cuando él decida:**
   - **El menú del comensal:** Don Poncho sigue en «Páginas subidas» (lo tenía elegido y se respetó).
     Para estrenar el menú digital: **Portal QR → Configuración → «Cómo se ve el menú» → Menú
     digital** (o «A la carta»). Sin fotos se ve con fondos alternados y la inicial de cada platillo;
     con fotos, mejor. Las fotos se suben en Productos; el fondo de cada platillo sin foto, ahí mismo.
   - **El retiro con PIN de gerente:** **Configuración → Caja → «Pedir PIN de gerente en retiros
     mayores a $____»**. Vacío no pide nada (como hoy). Un monto razonable para empezar: $500.00.
3. **Opcional:** los minutos de la cocina en ámbar y en rojo (Configuración → Operación; 10 y 20 por
   omisión) y las opciones con precio de cada platillo (Productos → el platillo → Opciones).

## 1 · Parte 1 · Para llevar, «Marcar entregado», ventanas y retiros con PIN

- **Para llevar desde la Caja** (DP-D100, migración 191, ficha 37): se arma un pedido sin mesa con su
  nombre y **se cobra al armarlo**; al cobrar recibe su número del día y sale a cocina (la comanda dice
  «Para llevar»); cuando está listo, la Caja lo enseña en «Para llevar de hoy» con su botón
  «Entregado». Lo no cobrado se descarta. El corte y el Cierre separan «Mesas y para llevar»;
  Registros filtra por canal y el CSV trae el canal y el nombre del pedido.
- **«Marcar entregado» del mesero** (DP-D103; dice «Entregar listos» cuando lo listo viene de varias
  estaciones): grande, a todo lo ancho, de 48 px o más, sin recortarse.
- **Las ventanas crecen desde donde se tocó** (DP-D103): 200 ms, sólo `transform` y `opacity`; con
  «reducir movimiento», un fundido.
- **Retiros con PIN de gerente arriba de un monto** (DP-D101): el servidor lo exige, el PIN se gasta una
  vez y queda en el corte quién autorizó.
- **Los menores de la auditoría del 9-11** (DP-D102).

## 2 · Parte 2 · Las opciones cobran, la cocina con volumen y el teléfono de cocina

- **Opciones con precio** (DP-D104, migración 192, ficha 38): precio con signo por opción (+$15.00,
  −$5.00), mínimo y máximo por grupo, una biblioteca de grupos con su editor en Productos; se cobran en
  el mesero, la Caja, para llevar y el portal, y salen en la comanda, el ticket, la precuenta, el CSV y
  el corte («Opciones vendidas · cuánto sumaron»). Lo que va por peso puede venderse «sólo en sus
  presentaciones».
- **La cocina con volumen** (DP-D105): lee sólo lo vivo (de 967 KB a 62 KB por refresco), tres
  columnas, tarjeta compacta, opciones aparte de la nota, la espera en verde, ámbar y rojo.
- **El teléfono de cocina** (DP-D106): todas las comandas activas en carrusel, la tira de mesas por
  estado, los botones sobre la comanda que se ve.

## 3 · Parte 3 · El menú del comensal

- **El menú digital** (DP-D107), el estilo nuevo para quien nunca eligió: barra de secciones pegada que
  sigue a la sección que se lee, tarjetas en dos columnas (tres en tableta) con la foto entera o, sin
  foto, un fondo de una lista cerrada (cuatro colores, dos degradados y tres ilustraciones: papel
  picado, talavera, milpa) con la inicial grande; la ficha del platillo con opciones, peso, cantidad y
  nota; la bolsa de la mesa en el encabezado.
- **«A la carta» mejorado:** todas las secciones seguidas, nombre y precio en la misma línea, el «+» de
  44 px.
- **«Páginas subidas»** se queda como estaba, y sigue siendo el de Don Poncho.
- Capturas de los dos menús en Android 360, iPhone y tableta, con y sin fotos, enviadas a Miguel
  (fuera del repositorio, en `D:\mpos-tmp\dp16\laminas\`).

## 4 · El QA (Parte 4)

Dos rondas con dos agentes Sonnet cada una, en copias desechables de la base propia de ese día
(exportada sólo leyendo por la conexión de sesión; las copias, idénticas al origen) y la app compilada
del commit de cada ronda. Detalle en `docs/qa/HALLAZGOS-DP16.md` y los registros de `docs/qa/`.

- **El dinero, al centavo las dos veces:** ronda 1, la jornada completa (2 cajas, 10 mesas de 7 a 10
  platillos con notas y opciones con precio, 4 para llevar, cocina y bebidas en pantalla y teléfono,
  portal en menú digital, descuentos con PIN, retiros con y sin PIN): 14 tickets, $8,981.10, el
  efectivo esperado igual al contado en las dos cajas y en el Cierre del día; ronda 2, una jornada
  corta tras los arreglos: 8 tickets, $3,966.85, igual. **0 violaciones** de 42 consultas en las dos.
- **Ronda 1:** 3 medios del dinero (presentaciones en la barbacoa, mesas unidas trabando el cierre, el
  corte de Registros sin las secciones nuevas) y 5 de los aparatos (fondo en platillos existentes,
  contraste sobre las fotos, objetivos de menos de 44 px, «Páginas subidas» chica, cocina a 768 px);
  ningún bloqueante. **Todos arreglados** con su prueba y sus mutantes (DP-D108) y comprobados en la
  ronda 2, más 6 mejoras baratas.
- **Lo que queda como mejora** (para después del sábado): folio y mesa escritos distinto en el visor y
  el documento, el Cierre del día que desglosa sólo la caja que cierra, cada mesero une sólo sus mesas,
  la pregunta de separar al cobrar mesas unidas con cuenta dividida, el origen de «Conectar teléfono»,
  la ficha modal para lector de pantalla y textos heredados de 11–12 px.

## 5 · Producción, parte por parte

| Parte | Migración | Merge | `READY` | Ceros y humo | Vercel una hora |
| --- | --- | --- | --- | --- | --- |
| 1 | 191 a las 03:46 | `8f271a2` (#17) | 03:47 | 03:49 y 03:53 | sin errores hasta las 04:49 |
| 2 | 192 a las 07:05 | `2e8da35` (#18) | 07:06 | 07:07 | sin errores de 07:05 a 08:06 |
| 3 | — (venía en la 192) | `4343e62` (#19) | 09:20 | 09:21 | sin errores de 09:19 a 10:22 |
| 4 | — | `a947fcb` (#20) | 12:31 | 12:33 | sin errores de 12:30 a 13:33 |

Cada migración: ensayo y luego en serio, con el script `migrate` de `packages/data`, por la conexión de
sesión (nunca el 6543); después `verify:esquema` estricto y `verify:rls` cerrado. El humo
(`link.mjs`) no cobra: la entrada y el portal en 5 y 6 aparatos, 8 a la vez, red lenta y el manifiesto.

## 6 · Lo que Miguel prueba en 10 minutos

1. **Caja (PC):** «Para llevar» → un pedido con nombre y dos platillos, uno con opciones con precio →
   cobrar (le da su número) → en Cocina sale con «Para llevar» → cuando Cocina lo marca listo, Caja →
   «Para llevar de hoy» → «Entregado». El ticket lista cada opción con su precio.
2. **Cocina (pantalla grande y su teléfono):** la comanda aparece en las dos; «Listo» en una la mueve en
   la otra. En el teléfono: «Conectar teléfono» desde la pantalla de Cocina.
3. **Mesero (teléfono):** abrir una mesa, un platillo con opciones, «Enviar»; cuando Cocina lo marca
   listo, **«Marcar entregado»** («Entregar listos» si viene de cocina y bebidas).
4. **Retiro:** con el umbral puesto, un retiro mayor desde Caja → Movimientos pide el PIN de la gerente.
5. **Portal:** cambiar el modo a «Menú digital», escanear el QR de una mesa, agregar un platillo con
   opciones, ver la bolsa con su número; volver a «Páginas subidas» si aún no lo quiere.
6. Lo que cobre en esta prueba queda en Registros y en el corte (es producción): mejor con montos
   chicos, cancelar esas ventas y cerrar la caja de prueba antes del sábado.

## 7 · Lo no hecho, y por qué

- Las apps (.exe, .apk): fuera de este encargo.
- Las promociones del menú: fuera del encargo; el hueco queda escondido en el menú digital.

## 8 · Las decisiones y las fichas

- DECISIONES: DP-D100 a DP-D108 (la 108, lo que cambió el QA).
- Fichas para el maestro: 37 (para llevar, migración 191) y 38 (opciones con precio y peso en
  presentaciones, migración 192).

## 9 · Los agentes

Ver la tabla «Agentes» de la sección DP-16 de `docs/BITACORA.md`: A, B, C, D y E (Sonnet, cada uno en su
worktree con base desechable, sin commits ni producción) y los cuatro del QA (QA-J, QA-D, QA-R2J y
QA-R2D, Sonnet, en copias desechables de la propia).
