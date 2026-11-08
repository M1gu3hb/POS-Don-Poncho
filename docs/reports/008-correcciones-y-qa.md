# 008 · DP-14 · La ronda de la auditoría final del 7-11: corregir todo, y el QA final

- **Fecha:** 07-11-2026, hora de CDMX.
- **Dónde:** sesión local de Claude Code en la laptop de Miguel, worktree `.claude/worktrees/dp12`, ramas `dp-14` y `dp-14-menores`.
- **Sin secretos ni PIN en este documento:** los accesos viven en `..\_PRIVADO\`.
- **La mudanza (14.4) y la base propia (14.5) siguen en pausa:** no se abrió ningún proyecto de Supabase.
- **En producción sólo se desplegó**, en dos partes: el PR #10 (`7aa5389`) y el PR #11 (`7bdd524`). En cada despliegue:
  - la huella de los otros 10 negocios quedó IDÉNTICA antes y después;
  - la exportación de Don Poncho quedó igual antes y después, sin una sola escritura: 0 cuentas, 0 pagos, 0 folios y 0 cajas;
  - el humo sin cobrar dio 11 de 11.

## 0 · Lo urgente para Miguel

**Hay cambios de PIN pendientes en producción.** Los detalles están en `..\_PRIVADO\AVISO-PIN-DP14.md`, no aquí. Los PIN reales los tecleas tú, desde Configuración → Usuarios (ahora sí te deja editarte a ti mismo).

## 1 · Lo hecho

### Bloqueantes

| # | Qué quedó | Decisión | Evidencia |
| --- | --- | --- | --- |
| 1 | El papel suma: renglones − descuento (+ IVA si no va incluido) + propina = TOTAL = lo cobrado, con un solo cálculo (`totales-del-papel.ts`) en el ticket final, la precuenta, la reimpresión desde Ventas, las partes de una cuenta dividida, el ticket de `/pos` y el cobro de la Caja | DP-D73 | unidad y contrato, mutantes; navegador `ticket-con-descuento` (descuento con PIN → cobrar → ticket → reimprimir desde Ventas) en 3 aparatos; QA-A escena 4 |
| 2 | Usuarios con el puesto real: el puente lo sirve; el diálogo ofrece sólo lo que quien edita puede otorgar; el servidor no toca el puesto si no cambió; uno mismo cambia su nombre y su PIN, nunca su puesto; renombrar a la gerente la deja gerente, con tope de 30 % y sin cerrarle la sesión; un gerente no edita a un dueño; cambiar el PIN funciona para uno mismo y para los demás | DP-D76 | integración y unidad; navegador `usuarios-y-mesas` (teléfono, tableta y escritorio); QA-B escena 1, en 360 px y tableta |

### Medios

| # | Qué quedó | Decisión | Evidencia |
| --- | --- | --- | --- |
| 3 | Dos cajas en pantalla: «No hay caja abierta en este aparato · Abrir caja» si cabe otra; «Traer esta caja aquí» sólo si ya no cabe, con confirmación; en la tercera, «Ya hay 2 cajas abiertas: cierra una» en pantalla; el nombre de cada terminal en Configuración → Caja (dueño y administrador, con auditoría); si otra caja ya cobró, el cobro se cierra y la lista se relee | DP-D74 | integración, contrato y mutantes; QA-A escenas 1, 2 y 8 |
| 4 | El cobro con descuento: Subtotal en bruto, «Descuento −$X», «Autorizó X · motivo» y el Total; el peso con un solo formateador en la Caja y en el «Quitado» de Ventas | DP-D73 | QA-A escenas 3 a 5 |
| 5 | El diálogo del descuento: «Autoriza hasta 30 %» y no deja aplicar más; si el servidor rechaza, borra la autorización y pide el PIN otra vez; contra el doble toque; «Reemplaza el descuento de $X» | DP-D78 | navegador `descuento-y-cancelar-dp14-ronda2`; QA-A escena 4 (40 %, otro monto, PIN reusado, reemplazo) |
| 6 | Cancelar con la cocina sin respuesta: el gerente o el dueño teclea su propio PIN | DP-D78 | QA-A escena 7, como mesero en 360 px y como gerente |
| 7 | Desactivar con confirmación, «Ver desactivados» y «Reactivar»; las mesas del mesero desactivado quedan sin asignar y las ven todos; «Repartir mesas»; el aviso «Pide al dueño o al gerente que te asigne mesas»; la mesera entra a la zona de sus mesas | DP-D77 | integración y unidad; QA-B escena 2 |
| 8 | El gerente no ve las pestañas «Caja» ni «Descuentos» (y el servidor le contesta 403) | DP-D76 | QA-A escena 2 |
| 9 | El carrito caducado: el globo se resuelve al leer el mapa del mesero, sólo en las mesas cuyo carrito pudo caducar y con su candado; «Tu pedido se borró…» sólo para el teléfono que lo tenía | DP-D79 | integración con el candado tomado; QA-B escena 4 |

### Menores (DP-D80)

- `Mesero.jsx`: dos toques rápidos; un diálogo nuevo por turno.
- El color del usuario: el guardado, comparado con los colores reales; renombrar no lo cambia.
- Configuración → Descuentos con los topes reales.
- Los descuentos del corte: la mesa de la madre, el folio con su serie, la cuenta y la suma en SQL sin cortarse en 1000, y el aviso en el papel si la lista se cortó.
- `saneado.ts` tapa la autorización firmada y deja el nonce.
- Fuera `venta.autorizar_descuento` y su ruta.
- `leerMargen` sin lo anulado.
- `/pos` sigue sin descuento (DP-D75).

### Lo que encontraron la revisión, la CI y el QA (arreglado)

- **La revisión adversarial del PR #10:** 2 revisores Sonnet más 2 verificadores, de sólo lectura. De 10 hallazgos, 7 fueron reales y 3 se refutaron. Lo arreglado:
  - el «Autorizó» se relee al reemplazar el descuento;
  - la cola de opciones;
  - el tooltip de la tercera caja;
  - el candado en `repartir_mesas`;
  - el choque de nombres de terminal;
  - la auditoría de usuarios con el «antes».
- **La CI del PR #10:** la mesera entraba a «Interior», llena de mesas sin asignar, y no veía su mesa de «Barra». Arreglo: entra a la zona de sus mesas.
- **El lote de navegador:** el sondeo del mapa tomaba el candado de cada carrito en cada lectura. Ahora hay un prefiltro en SQL.
- **El QA final:**
  - QA2-A1: el peso en «Quitar un platillo».
  - QA2-A3: la propina elegida se conserva tras el descuento.

## 2 · Lo no hecho, y por qué

- **14.4 (mudanza) y 14.5 (base propia):** en pausa, por encargo. Quedó documentado lo que se hace después de importar y la configuración de la base propia (§6).
- **El PIN propio al cancelar se exige en la pantalla, no en el servidor.** La sesión de un gerente ya autoriza cancelar; es el mismo criterio que reabrir. Cambiarlo es una línea, si Miguel lo quiere (DP-D78).
- **Las pestañas «Datos» e «Integraciones» siguen visibles para el gerente:** salen del rol de la sesión, en el que la gerente es «administrador». El encargo pedía ocultar «Caja» y «Descuentos», y eso quedó. ¿Se ocultan también estas dos?
- **Los informativos del QA quedan anotados** (`docs/qa/HALLAZGOS.md`):
  - el renombre de una caja no sale en Registros;
  - «9 ventas» contra «Ventas (13)»;
  - «Nueva mesa» no reusa el número;
  - no hay pantalla para crear una zona.
- **Las specs de la jornada `qa2-*` no están en el repositorio**, porque tres pasan de 300 líneas. Quedaron en `D:\mpos-tmp\qa-dp14-specs`.

## 3 · Las decisiones

DP-D73 a DP-D80 en `DECISIONES.md`:

- DP-D73: el papel suma.
- DP-D74: dos cajas en pantalla.
- DP-D75: `/pos` sin descuento.
- DP-D76: el puesto real.
- DP-D77: desactivar, mesas sin mesero, repartir y la zona de la mesera.
- DP-D78: el tope del PIN y cancelar con el propio PIN.
- DP-D79: el carrito caducado en el mapa, con su prefiltro.
- DP-D80: los menores y los arreglos del QA.

## 4 · Las fichas para el maestro

- **33:** el papel que suma, los usuarios con su puesto real, dos cajas y el descuento.
- **34:** los menores del corte, la auditoría, `autorizar_descuento`, el margen, los topes y la zona de la mesera.

Las dos son genéricas y están en `docs/para-el-maestro/`, con su fila en `00-INDICE.md`.

## 5 · El QA final

No se hizo en producción. Se armaron dos copias desechables con la exportación de producción de hoy, importadas idénticas (filas y md5). Cada una tiene el cupo de cajas en 2, el motivo «Por cancelación» sembrado, PIN de prueba propios (en `_PRIVADO\qa-dp14-*`) y su app compilada. Lo hicieron dos agentes Sonnet en sus worktrees, sin commit.

- **QA-A (caja, dinero y cocina):**
  - 10 escenas.
  - Los cortes de las dos cajas y el Cierre del día cuadraron al centavo: 21 de 21.
  - Consultas de violación: 0 de 34.
  - Hallazgos: 3 bajos (2 arreglados y 1 que es el diseño) y 2 informativos.
- **QA-B (usuarios, mesas y portal):**
  - 36 escenas, en teléfono de 360 px y en tableta.
  - Consultas de violación: 0 de 34.
  - Hallazgos: 4 informativos, uno descartado (la «caja abierta» era de una demo de las migraciones).
- **Ronda 2,** sobre una tercera copia nueva, con lo arreglado:
  - las specs de QA-A del 01 al 06: 57 de 58 chequeos en SÍ, con QA2-A1 y QA2-A3 comprobados;
  - el chequeo en NO leyó la reimpresión todavía «Cargando ticket…»: es un tiempo de la spec, y la reimpresión la cubre `ticket-con-descuento`;
  - después de esa parada, tres pasos de la jornada fallaron en cascada por el estado que dejó; no son defectos confirmados.
- **En producción, sólo humo sin cobrar:** 11 de 11, sin ninguna escritura, y la exportación de Don Poncho igual antes y después.

El detalle está en `docs/qa/JORNADA-2026-11-07.md` (con las bitácoras de QA-A y QA-B) y en `docs/qa/HALLAZGOS.md`.

## 6 · Lo que queda listo para la mudanza (sin hacerla)

- **Importar es repetible:** hoy se importó tres veces la exportación de producción en bases nuevas, idénticas al origen y sin llaves rotas.
- **«Después de importar»** (`docs/infra/MUDANZA-FASE-B.md`):
  - el `insert` de `por_cancelacion`, probado en las tres copias;
  - la consulta de RLS y permisos: en la compartida, 139 de 139 tablas con RLS y 0 permisos para `anon` y `authenticated`.
- **La configuración de la base propia:**
  - el cupo de cajas en 2, probado en las copias;
  - el nombre de las terminales, desde Configuración → Caja;
  - Miguel cambia los PIN.
- **Las guías ya no tienen fechas:** la mudanza va cuando Miguel diga.

## 7 · Lo que Miguel prueba en 10 minutos, con sus PIN

En producción y en sus aparatos. Al final tiene que quedar todo como estaba.

1. **Los PIN pendientes (urgente):** los de `_PRIVADO\AVISO-PIN-DP14.md`, desde Configuración → Usuarios. Entra con el nuevo. Fíjate que en tu propia fila no te deja cambiarte el puesto.
2. **La gerente sigue siendo gerente:** ábrela en Usuarios, cámbiale el nombre a «Gerente» (el mismo) y guarda. Sigue «Gerente» y su sesión no se cierra. Entra como ella: no ve las pestañas «Caja» ni «Descuentos».
3. **Configuración → Caja:** las terminales con su nombre. **Descuentos:** los topes reales (gerente 30 % o $2,000).
4. **El descuento en el cobro:** en una mesa de prueba, pide la cuenta.
   1. En Caja, aplica un descuento pequeño con el PIN de la gerente.
   2. El cobro dice Subtotal, «Descuento −$X», «Autorizó Gerente · motivo» y el Total. Si ya habías elegido la propina, no la vuelve a pedir.
   3. **No cobres:** cancela la cuenta con tu PIN.
5. **Otro aparato sin caja:** con la caja abierta en la PC, entra a Caja desde la tableta. Con el cupo de 1 de la base compartida tiene que decir «Traer esta caja aquí» y pedir confirmación. Toca «No».
6. **Al terminar:** cierra la caja si la abriste y avísame, para tomar la exportación y la huella de después. Deben quedar 0 cuentas abiertas y las cajas cerradas.

## 8 · Los commits

Todos a nombre de M1gu3hb, sin coautoría:

| Commit | Qué |
| --- | --- |
| `aaa6922` | El papel que suma, usuarios con su puesto real, dos cajas, el descuento y el carrito caducado |
| `7b073eb` | La mesera entra a la zona de sus mesas |
| `7aa5389` | Merge del PR #10 (en producción) |
| `f6cc018` | Menores: el corte, la auditoría, `autorizar_descuento`, el margen y los topes reales |
| `2c0f5ad` | La bitácora y la ficha 34 |
| `0fd9cf1` | Lo que encontró el QA final, y su registro |
| `7bdd524` | Merge del PR #11 (en producción) |

Además, este reporte va en un PR sólo de documentos (#12).
