# 012 · DP-21 · El cierre antes de instalar en Don Poncho

- **Fecha:** domingo 15-11-2026, 21:45 → lunes 16-11-2026, hora de CDMX. Instalación: lunes 16-11,
  hacia las 18:00.
- **Dónde:** sesión local de Claude Code en la laptop de Miguel, con dos agentes (Sonnet) en sus
  propios árboles. Tres PR y un arreglo urgente, cada uno con su CI en verde, su humo sin cobrar y su revisión de
  errores en Vercel.
- **Producción no se usó para probar.** Todo se probó en local o sobre una copia. En producción
  sólo se leyó, por la conexión de sesión (5432), en transacciones de sólo lectura; lo único que se
  escribió fue la migración 193 (aditiva, con `pnpm db:migrate`)
  y, cuando Miguel dé sus dos «sí», lo de §6.
- **Sin secretos ni PIN en este documento.** Ningún PIN real lo tecleó un agente.
- Bitácora: `docs/PROGRESO-DP21.md`. Decisiones: DP-D128 a DP-D145. El inventario del Bloque 20:
  `docs/reports/012-anexo-inventario.md`.

## 0 · Lo que necesita Miguel

1. **La lista de las 14:00** (está en el chat y en la bitácora): «Sin IVA»; el cupo y los nombres
   de las cajas; el almacén principal; el ticket a tu gusto y el prefijo «DP»; quién elige la
   propina; y en cada POS su nombre, si tiene cajón y una página de prueba.
2. **Probar en los cuatro POS lo que aquí no se pudo ver:** lo táctil, el teclado y los colores del
   iMin (§4).
3. **Tus dos «sí» para dejar en ceros**, y justo después del cero guardar «Folios» con el primer
   folio 1001 y 101 (el sistema sólo lo deja con los folios en cero) antes de que se active el
   bloqueo.
4. **Decidir, sin prisa:** «Silenciar notificaciones del administrador» (está encendido y ahora sí
   se respeta); el crédito «Sistema por Morphiq»; lo que quedó plegado en Configuración → Avanzado;
   y cuándo se hacen los Bloques 18 y 19 (§3).

### Qué entró y cuándo

| PR | Bloques | En producción | Commit en `main` |
| --- | --- | --- | --- |
| A · [#32](https://github.com/M1gu3hb/POS-Don-Poncho/pull/32) | 1 a 8 | 16-11, 04:01 | `13e9d77` |
| B · [#33](https://github.com/M1gu3hb/POS-Don-Poncho/pull/33) | 9 a 12, 15, lo de dinero y seguridad del 20 y la mudanza del 21 | 16-11, 10:14 | `bed26a5` |
| C · [#34](https://github.com/M1gu3hb/POS-Don-Poncho/pull/34) | 13, 14, 16 y 17 | 16-11, 11:18 | `a69b8b2` |
| D · [#35](https://github.com/M1gu3hb/POS-Don-Poncho/pull/35) | arreglo urgente del 16 y del 9 (DP-D145) | 16-11, 13:58 | `8971c94` |

Los commits por bloque que se citan abajo son los de las ramas de trabajo (`dp-21-a`, `dp-21-pr-b`,
`dp-21-pr-c`); en `main` cada PR entró aplastado en un solo commit.

## 1 · La lista de Miguel

| # | Lo que dijo Miguel | Qué se hizo | Bloque · commit | Cómo se probó |
| --- | --- | --- | --- | --- |
| M1 | Las cajas se suman (Caja 28, 32, 37…) | La caja es un LUGAR con nombre (1 o 2, las que diga el cupo) que se abre o se trae a este aparato; el aparato se llama «Aparato N». Migración 193 (aditiva). | 5 · `36ab6b9` · DP-D132 | 8 casos contra Postgres (`caja/lugares.integracion.test.ts`), e2e `cajas-del-negocio.spec.ts` |
| M2 | Con la barra abierta, el mapa se corta | El mapa escala para caber (nunca agranda, piso de 56 px); las posiciones guardadas no se tocan. | 9 · `f9b8167` · DP-D137 | contrato y unitarias de `tacto/`; día completo en 3 aparatos. **Falta verlo en el iMin y en la PC táctil.** |
| M3 | Un botón claro para la barra lateral | Botón de 44 px que abre y cierra, y recuerda la elección en ese aparato. | 9 · `f9b8167`, `2be9aed` | `tacto/barra-lateral.contrato.test.ts`; el día completo (el cajón del teléfono nunca sale plegado) |
| M4 | La pulsación larga selecciona texto y saca «copiar» | `ArmazonTactil` quita la selección y el menú del sistema fuera de los campos de texto. | 9 · `f9b8167` | contrato; **falta en aparato** |
| M5 | Todo con el dedo; el scroll de Movimientos | La raíz de la Caja deja de ser un desplazable anidado (`overflow-x-clip`); contrato: ninguna página usa `overflow-x-hidden`. | 9 · `f9b8167` | contrato; **falta en aparato** |
| M6 | Folios de verdad | «DP-01001» y «DPC-0101»: prefijo y primer folio en Configuración → Ticket y folios; un solo formateador; la búsqueda acepta las tres formas. H1: desde el arranque real, lo cobrado no se borra. | 6 · `43ab909` · DP-D128 | integración de folios, contrato «ningún `.folio` crudo», e2e `folios-con-prefijo.spec.ts` |
| M7 | Quitar «Control del restaurante» del tablero | Quitado (`AccesosDelDueno`). | 13 · `d88bb8f` · DP-D136 | el rastreador y la galería de la CI (el tablero retratado sin el bloque) |
| M8 | Una gráfica mejor, «cómo va tu semana» | «¿Cómo va tu semana?», con sus filtros, sumada en el servidor por día del negocio (`tablero.serie`). | 13 · `d88bb8f` · DP-D136 | unitarias de periodos y armado, integración `tablero/serie.integracion.test.ts` contra Postgres |
| M9 | Tickets con IVA aunque esté en cero | El campo «IVA» manda (`configuracion.fijar_impuesto`); con 0 no se menciona en el ticket, la precuenta, el corte ni los reportes. | 1 · `424dbe8` · DP-D129 | integración, `test:impresion`, e2e `sin-iva.spec.ts` |
| M10 | Elegir qué sale en el ticket y la precuenta | «El ticket a tu gusto»: interruptores por renglón con vista previa en vivo; por omisión el ticket no cambia ni un punto. | 12 · `511e441` · DP-D140 | `test:impresion` 20 de 20, integración del comando |
| M11 | La propina del portal y la de la caja se pisan | Una sola verdad en el servidor: la primera que se elige manda y la otra pantalla se entera (409 con lo ya decidido). | 4 · `78fe0f4`, `41292f8` · DP-D131 | integración, e2e `propina-una-sola-verdad.spec.ts` |
| M12 | Elegir si el mesero pone la propina | «¿Quién puede elegir la propina?»: comensales, mesero, Caja. Por omisión el mesero no. | 4 · DP-D131 | la misma e2e |
| M13 | Nada de app instalable | Sin manifiesto ni `appleWebApp`; el portal, a salvo desde fuera. | 3 · `53bd278` · DP-D134 | e2e `sin-instalacion.spec.ts`; humo de producción (los manifiestos dan 404) |
| M14 | Se entra sin PIN | El mando y la caja teclean su PIN cada vez que abren la app y tras 10 min sin uso; las estaciones (mesero, cocina) se recuerdan hasta 7 días. | 2 · `89702b1` · DP-D130 | e2e `pin-al-abrir.spec.ts` (8 casos, con reloj falso) |
| M15 | La voz no dice cuántos | Se reprodujo antes de tocar: la voz dice la cantidad una vez («3 tacos de…»). | 8 · `c45370f` · DP-D133 | unitarias de la voz |
| M16 | Con el teclado, la vista brinca | `--alto-visible` y el campo enfocado al centro, una vez. | 9 · `f9b8167` | contrato; **falta en aparato** |
| M17 | «Abrir cajón» sin cajón; PIN para abrirlo a mano | Sin cajón configurado el botón no sale; a mano pide PIN de gerente; `caja.cajon_por_cobro` exige un cobro en efectivo. | 7 · `8af0c71` · DP-D133 | integración y unitarias |
| M18 | Los cortes, en una carpeta de Windows | **No entró.** | 18 | ver §3 |
| M19 | Guías de recetas e inventario | Botón «¿Cómo funciona?» en Recetas, Inventario, Compras y gastos y la ficha del producto; el mismo texto en `docs/cliente/GUIA-RECETAS-E-INVENTARIO.md`. | 17 · `a4f9cee` | contrato: cada afirmación atada al código del servidor o a su prueba; 3 mutantes muertos |
| M20 | Quitar Integraciones | Quitada completa, con su cola de sincronización de demostración. | 21 · `097b6b9` · DP-D141 | `mudanza.contrato.test.ts` |
| M21 | Tarjetas e inputs descuadrados | El corte: sus dos cajas miden lo mismo. El barrido pantalla por pantalla: 14 pantallas en 6 tamaños; tarjetas del mismo alto, nombres en dos renglones, campos alineados. El piso global de 44 px con el dedo entró en el PR C y se quitó en el PR D (§3): los 44 px quedan por componente. | 9 · `f9b8167`; 16 · `945138f`, `a4c71ee` · DP-D144 | `barrido-visual.spec.ts` (14 pantallas sin hallazgos, con dedo emulado), los contratos de `tacto/`, 16 mutantes muertos. **Falta en aparato.** |
| M22 | Gastos de la Caja = Compras y gastos | Un solo catálogo; «Sale del cajón de Caja principal»; aviso si deja la caja en negativo; el renglón en el corte, sin contar doble. | 11 · `9efe2da` · DP-D139 | integración (`compras/pago-de-la-caja`), contrato del catálogo |
| M23 | El corte no debe mandar al campo de lo contado | El corte ya no enfoca nada al abrir. | 9 · `f9b8167` | contrato; **falta en aparato** |
| M24 | «Cambiar de mesa» manda a otra pantalla | Abre ahí mismo las mesas libres, pregunta y avisa. | 10 · `a019fe3` · DP-D138 | 9 mutantes muertos, e2e `cambiar-de-mesa-en-el-mapa.spec.ts` |
| M25 | Colores raros en el iMin | El plugin del modo compatible cubre `lab()/oklch()` y `:has()`; el velo del PIN sin `color-mix`. | 15 · `9cb3290`, `8d483e4` · DP-D142 | `motor-viejo.spec.ts` (Chromium 99 y 103 contra el de hoy). **Falta verlo en el iMin.** |

## 2 · Lo que verificó el orquestador

| # | Qué | Cómo quedó | Bloque |
| --- | --- | --- | --- |
| O1 | El campo «IVA» no estaba conectado | Es el que manda (M9). En producción lo fija Miguel con su PIN. | 1 |
| O2 | Campos de Operación que no hacen nada | Cada clave que la pantalla guarda tiene quien la lea (contrato); «Usar mesas» y «Permitir venta sin stock» pasaron a «Avanzado» con su explicación. | 14, 21 · DP-D135 |
| O3 | El POS y el portal se podían instalar | M13. | 3 |
| O4 | El mapa de 600 px fijos | M2. | 9 |
| O5 | El botón de la barra | M3. | 9 |
| O6 | El corte enfoca «Efectivo contado» | M23 y M21. | 9 |
| O7 | Los diálogos enfocan el primer campo | Con puntero grueso el foco se queda en el diálogo (`foco-al-abrir.ts`). | 9 |
| O8 | La Caja toma una foto de la propina | M11. | 4 |
| O9 | Cada navegador crea una «Caja N» | M1; el guion `scripts/renombrar-aparatos.mjs` pasa las 35 a «Aparato N» al dejar en ceros. | 5 |
| O10 | La sesión dura 8 h para todos | M14. | 2 |
| O11 | «Ajustes de Morphiq POS» | «Ajustes de» + el nombre del negocio. | 14 |
| O12 | El `color-mix` en línea del PIN | M25. | 15 |
| O13 | `motor-viejo.spec.ts` sin estados | M25: seleccionado, abierto, marcado y foco. | 15 |
| O14 | La app de Windows no guarda descargas | **No entró** (M18). | 18 |
| O15 | Producción hoy | Leída otra vez, sólo lectura, antes y después de cada despliegue. | — |
| O16 | La voz repetida | M15. | 8 |
| O17 | `caja.cajon_por_cobro` sin comprobar el cobro | M17. | 7 |

## 3 · Lo que no entró y por qué

- **El piso global de 44 px (Bloque 16) entró y se quitó.** Con el dedo aplastaba a 44 px las
  tarjetas de platillos del mesero (medido sobre una copia con 117 platillos: 44 px contra 86.5 con
  ratón; tras el arreglo, 86.5 a 106.5 en el teléfono y en el iMin). Estuvo en producción de las
  11:18 a las 13:58, antes de que nadie operara. Los 44 px se darán por componente (DP-D145).
- **Bloque 18 · Los cortes en una carpeta (M18 y O14), app de Windows 1.0.2.** No se empezó. Es una
  función nueva del puente de Electron (guardar sólo PDF, sólo en `Documentos\POS Don Poncho\Cortes`,
  sólo desde el origen de producción), su prueba de humo con los fuses intactos, publicar la 1.0.2
  en `canal-don-poncho` y comprobar que un POS la reciba. No cabía antes del congelado sin quitarle
  tiempo a los PR A y B, que iban primero. **Qué sigue igual:** el servidor conserva cada corte, se
  ve y se reimprime en Registros → Cortes, y el POS descarga el PDF como hoy. La app sigue en 1.0.1.
- **Bloque 19 · Lo que quedó de DP-19.** Era «sólo si sobra tiempo» y no sobró. Queda entero: H2
  (los candados de Preparar, Listo y cancelar en el mismo orden), H3 (Registros «Este año»), A23
  (propinas por rango en el servidor), A5, A6, A10, A24 (la merma con existencia negativa), H5, la
  devolución de lo vendido por peso, y X4 y X5.
- **Del Bloque 16:** el barrido no corre en la CI (tarda y necesita su base): se corre a mano. Las
  16 secciones de Configuración se recorren en su propia e2e, no en el barrido.
- **Del Bloque 20:** lo de dinero, seguridad y datos entró en el PR B; el resto del inventario
  (`012-anexo-inventario.md`, con su columna «lo decide Miguel») queda anotado, sin tocar.
- **Del Bloque 11:** el visor heredado de cortes ya cerrados (Registros) no trae el renglón nuevo
  «Compras y gastos pagados de la caja»; la pantalla del corte, su PDF y su papel sí.
- **Una puerta que falta:** las pantallas de `heredado/*.jsx` no pasan por lint ni tipos. El
  barrido de nombres sin declarar se corrió a mano antes de cada commit; conviene volverlo puerta.

## 4 · Lo que no se pudo comprobar aquí

- **Nada de lo táctil se vio en un aparato de verdad** (M2, M3, M4, M5, M16, M21, M23): ni el iMin
  ni las PC táctiles. Todo se midió con Playwright (toque largo, deslizamiento y teclado emulados).
- **Los colores del iMin (M25)** se compararon en Chromium 99 y 103 de escritorio, no en el WebView
  del aparato.
- **El cajón y las impresoras** no se tocaron en DP-21 más allá de la regla de cuándo se ofrece
  «Abrir cajón»: la prueba de impresión por aparato es de Miguel.
- **La voz de cocina (M15)** se probó con sus unitarias, no oyéndola en la bocina del aparato.
- Todo lo anterior está en la lista de pruebas de Miguel de las 14:00.

## 5 · El día del simulador

**No se corrió un día completo; se corrió una rebanada, y hay que decirlo así.** Un día normal son
unas 4 horas reales y los bots eran de las pantallas de DP-18; el agente 2 los adaptó (el PIN al
abrir, la propina por omisión, la Configuración en secciones, las cajas con nombre, «Cambiar de
mesa» ahí mismo, la barra plegada).

| Corrida | Build | Simulado | Resultado |
| --- | --- | --- | --- |
| Día 0 (por pantallas) | PR B | la configuración inicial | 36 de 36 comprobaciones, 0 diferencias |
| Ensayo | PR B (`5d340bd`) | 08:00–09:15 | 0 críticos · 245 comparaciones, 0 diferencias · 21 cobros |
| Día 1, primer intento (10:24) | PR B | nada | murió al arrancar (faltaba el esquema del reloj de pruebas) y no se vio hasta las 12:28 |
| **Día 1** (12:44–13:17) | **`main`, `a69b8b2`** (los tres PR) | **08:00–09:30** | 22 cobros por $4,114.50 (18 para llevar, 4 de mesa; una cuenta dividida en 3) · propinas $291.53 · **255 comparaciones, 0 diferencias** |

- **Cajas e inventario:** al centavo y al gramo dentro de la rebanada (cajas 189, inventario 14,
  compras y gastos 2, el dueño 26, invariantes 24).
- **Propinas:** ninguna perdida; las tres partes de la cuenta dividida llevaron su 5 %.
- **Incidentes:** 3 críticos, 0 altos, 4 medios, 3 bajos. **Ninguno es un defecto de la app:**
  - los 3 críticos son del bot: abrió cada parte de la cuenta dividida esperando el total sin
    propina, y la pantalla decía «TOTAL A COBRAR $1,288.88» = $1,227.50 + la propina del 5 % ya
    elegida (lo que pide M11). El libro registró cada parte con su propina y cuadró;
  - «la mesa 2 no ofrece Cambiar de mesa»: la mesa estaba unida, y un grupo unido no se mueve
    (DP-16);
  - el resto son respuestas lentas con la laptop cargada (cerrar la caja 4.2 y 5.3 s; una compra
    3.3 s).
- **Lo que el simulador sí encontró, y no con sus comprobaciones sino con una captura:** el piso de
  44 px del PR C aplastaba las tarjetas de platillos del mesero con el dedo (DP-D145). Se arregló
  en el PR D.
- **Qué NO se simuló:** la hora pico de la comida, el resto del día 1 después de las 09:30, los
  días 2 a 7, y nada sobre el PR D. La corrección del bot de la cuenta dividida no se volvió a
  correr. Los cambios a los bots quedan en el árbol del agente 2 (`.work\dp18-integrar`), sin subir.

## 6 · Dejar en ceros

**Pendiente al escribir este informe:** espera los dos «sí» de Miguel en el chat.

Lo que se hará, en este orden (`D:\mpos-tmp\dp21\ceros.sh`, por la conexión de sesión 5432):

1. El ensayo de `scripts/dejar-en-ceros.mjs` (qué borraría) y enseñárselo a Miguel.
2. Con su segundo «sí», en serio: purga las cuentas de prueba, borra las cajas con sus cortes y
   reinicia los folios. La auditoría se queda.
3. **Miguel** guarda Configuración → Ticket y folios → «Folios»: primer folio 1001 y 101 (el comando
   sólo lo deja con los folios en cero y antes del bloqueo).
4. `scripts/renombrar-aparatos.mjs`: las 35 terminales «Caja N» pasan a «Aparato N».
5. `scripts/operacion-real.mjs`: activa el bloqueo H1 con la hora del servidor. Desde ahí lo
   cobrado ya no se borra.
6. Verificación de sólo lectura: 0 cuentas, 0 cajas abiertas, 0 cortes, 0 comandas y 0 carritos,
   las mesas libres, `impuesto.puntosBase = 0`, el cupo y los nombres de caja, el almacén principal
   y el siguiente folio «DP-01001».

## 7 · Calificación del POS en la nube

**86 / 100.** La misma nota que al cerrar DP-18, por razones distintas.

- **Lo que sube:** de las 25 cosas que encontró Miguel, 24 están en producción (falta M18). Lo que
  toca dinero (IVA, propina, folios, cajas, gastos, el cajón) tiene pruebas contra Postgres, e2e y
  una rebanada simulada con el libro cuadrado al centavo. Cada PR entró con la CI en 10 de 10, su
  humo y sin un solo error de ejecución en Vercel.
- **Lo que baja:**
  1. **Nada de lo táctil se ha visto en un aparato de verdad**, y era la mitad de lo que Miguel
     reportó. Hasta que él lo pruebe en los cuatro POS, es código probado con un dedo emulado.
  2. **Una regresión visual llegó a producción** (el piso de 44 px, de las 11:18 a las 13:58) y se
     encontró por una captura, no por una prueba. Lo táctil no tiene cobertura visual automática
     con datos reales: la galería es de ratón y el restaurante de prueba tiene pocos platillos.
  3. **El simulador corrió hora y media**, no un día ni una semana como en DP-18.
  4. Los Bloques 18 y 19 no entraron.
  5. Las pantallas de `heredado/` siguen fuera de lint y tipos.
- **Qué la subiría a 90 o más:** la prueba de Miguel en los cuatro POS sin hallazgos graves; un día
  completo del simulador sobre `main`; un barrido con dedo y con el catálogo lleno dentro de la CI;
  y la puerta de nombres sin declarar para `heredado/`.
