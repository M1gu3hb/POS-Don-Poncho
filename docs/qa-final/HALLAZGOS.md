# HALLAZGOS · DP-22 · La auditoría final

> Cada hallazgo se anota al momento. **Severidad:** crítico (dinero, datos, seguridad o algo que
> detiene la operación) · alto (un flujo roto que tiene salida) · medio (visual o confuso) · bajo
> (cosmético). Lo crítico se arregla de inmediato; lo demás, en lotes de 2 o 3. Un hallazgo se
> cierra sólo con evidencia: la prueba que falló antes y pasa después, su nombre y el commit.
>
> **Ataques** (lo que pasó cada arreglo antes de darse por bueno): U unitaria · I integración contra
> Postgres · E e2e táctil en los aparatos · M mutante · O orillas (0, negativos, decimales, enormes,
> acentos, emojis, textos largos) · T toque doble y repetido · C carreras (dos aparatos, recargar) ·
> R red (sin red, lenta) · S sesión vencida · P permisos por puesto · V motor viejo del iMin ·
> G regresión de la zona.

## Resumen

| Severidad | Encontrados | Arreglados | Abiertos |
| --------- | ----------: | ---------: | -------: |
| Crítico   |           0 |          0 |        0 |
| Alto      |           1 |          1 |        0 |
| Medio     |           0 |          0 |        0 |
| Bajo      |           0 |          0 |        0 |

## Lista

| #   | Sev. | Pantalla · aparato                                               | Qué pasa                                                                                                                                                    | Estado                                               |
| --- | ---- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | alto | Compras y gastos, Inventario, exportaciones · todos los aparatos | Después de las 18:00 «hoy» era mañana: «Registrar gasto» y «Registrar compra» proponían la fecha del día siguiente y un gasto en efectivo quedaba rechazado | arreglado (lote 1); falta su e2e táctil con el arnés |

## Detalle

_(Cada hallazgo: pasos para reproducirlo, causa con `archivo:línea`, captura, el arreglo, la prueba,
los ataques que pasó y el commit.)_

### 1 · alto · Después de las 18:00, «hoy» era mañana

- **Cómo se encontró:** la línea base de `verify` sobre `main` corrió de noche (16-11, 22:40) y
  `packages/app/src/tablero/serie.integracion.test.ts` falló 2 de 6: el gasto «de hoy» no caía en
  la cubeta de hoy. De día pasa; por eso la CI nunca lo vio.
- **Pasos:** a partir de las 18:00 (hora de México) abrir Compras y gastos → «Registrar gasto». La
  fecha que propone es la de mañana. Con «Efectivo» y la caja abierta hoy, al guardar el servidor
  contesta «Un gasto en efectivo sale del cajón de la caja abierta, que es la del 16, así que no se
  puede fechar el 17…». Con tarjeta o transferencia se guarda fechado mañana, sin aviso: el tablero
  y Registros de hoy no lo cuentan y los de mañana sí. Lo mismo en «Registrar compra» y en los
  gastos fijos. El restaurante cierra a las 19:00: pasaba todos los días, en la última hora.
- **Causa:** las pantallas sacaban el día de `new Date().toISOString().slice(0, 10)`, que es UTC
  (`heredado/components/compras/RegistrarGastoDialog.jsx:50`, `RegistrarCompraDialog.jsx:52` y
  `:110`, `PlantillasGastoSection.jsx:105`, `pages/CorteCaja.jsx:46`, `pages/Inventario.jsx:147`
  —el «consumo de hoy» se quedaba en cero—, los nombres de los archivos exportados y
  `utils/importValidators.js:546`). Y en el servidor, un gasto o una compra SIN fecha tomaba el
  valor por omisión de la columna (`current_date`, el día de la base: UTC)
  (`packages/app/src/compras/gastos.ts`, `compras.ts`).
- **Arreglo:** un solo ayudante, `apps/web/src/cliente/dia-del-negocio.ts` (`hoyDelNegocio`: el día
  en la zona del negocio, no en UTC ni en la del aparato), usado en las once pantallas; y en el
  servidor, sin fecha vale el día del negocio (`reportes/dia.ts`, la zona de la organización).
- **Pruebas (rojo antes, verde después):** `apps/web/src/cliente/dia-del-negocio.test.ts` (11
  casos: el día a las 18:30, a las 23:59 y a las 00:00, y el contrato «ninguna pantalla saca hoy
  de `toISOString()`», que en rojo listó los 11 archivos);
  `packages/app/src/compras/fecha-del-negocio.integracion.test.ts` (contra Postgres, con el reloj
  fijo a las 18:30: el gasto y la compra salían fechados `2026-11-17`, el día UTC);
  `tablero/serie.integracion.test.ts` vuelve a pasar de noche.
- **Ataques:** U ✓ · I ✓ (15 de 15 en `compras` y `tablero`) · M ✓ (5 destructivas fallan: el gasto
  y la compra con el día en UTC, las dos pantallas con el patrón viejo —también con `split`—, y
  el ayudante en UTC; 1 inocua pasa: el patrón citado en un comentario) · O ✓ (fin de mes, fin de
  año, fecha inválida) · G ✓ (2,704 unitarias de las pantallas, compras y tablero) · P no aplica
  (no cambia quién puede) · **E y V pendientes** (la e2e táctil a las 18:30 con el reloj falso y
  el motor viejo, con el arnés).
- **Commit:** en el lote 1.

## Pendientes conocidos que entran como hallazgos (Parte 9)

Se numeran aquí al cerrarse cada uno, con su evidencia.

| Clave | Qué                                                                                       | Lote | Estado                   |
| ----- | ----------------------------------------------------------------------------------------- | ---- | ------------------------ |
| H2    | Los candados de Preparar, Listo y cancelar, en el mismo orden (200 cruces sin un 500)     | 1    | en curso (agente 1)      |
| A24   | La merma con existencia negativa: nunca un error mudo                                     | 1    | en curso (agente 1)      |
| DEV   | La devolución de lo vendido por peso o porción                                            | 1    | en curso (agente 1)      |
| X4    | Tope por IP en la entrada del laboratorio                                                 | 1    | en curso (agente 1)      |
| H3    | Registros «Este año»: sin truncar, con agregados del servidor                             | 1    | en curso (agente 2)      |
| A23   | Propinas por mesero, por rango, en el servidor                                            | 1    | en curso (agente 2)      |
| A5    | El almacén registra compras desde Inventario                                              | 1    | en curso (agente 2)      |
| A6    | El Cierre no pide «no recogido»                                                           | 1    | en curso (agente 2)      |
| A10   | «Editar receta» sólo con el renglón abierto                                               | 1    | en curso (agente 2)      |
| X5    | Tiempo de espera del lado de la página al imprimir                                        | 1    | en curso (agente 2)      |
| H5    | A7 y A9 con prueba de comportamiento en Playwright                                        | 2    | pendiente (con el arnés) |
| LINT  | La puerta de `heredado/*.jsx` (TS2304 y TS2552) en `verify` y en la CI                    | 1    | pendiente                |
| B18   | Los cortes en una carpeta de Windows (app 1.0.2)                                          | 4    | pendiente                |
| P012  | Lo que el anexo 012 dejó para Miguel (PUBLICOS, comandos sin pantalla, crédito, Avanzado) | 3    | pendiente                |
| COLA  | El aviso de «la cola de sincronización» al cajero                                         | 3    | pendiente                |
| VOZ   | Dos pantallas de la misma estación anuncian doble                                         | 3    | pendiente                |
| SIL   | `silenciar_notificaciones_admin` en la operación de Don Poncho                            | 3    | pendiente (decisión)     |
