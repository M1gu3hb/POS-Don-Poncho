# Hallazgos del QA de DP-16 · 10-11-2026

Dos rondas, cada una con dos agentes Sonnet en copias desechables de la base propia de Don Poncho de
ese día (exportación de sólo lectura por la conexión de sesión; 135 tablas, 1,272 filas, idénticas al
origen) y la app compilada del commit de la ronda: QA-J (la jornada con dinero) y QA-D (los aparatos).
Los registros completos: `JORNADA-2026-11-10.md`, `APARATOS-2026-11-10.md` (ronda 1),
`JORNADA-R2-2026-11-10.md` y `APARATOS-R2-2026-11-10.md` (ronda 2). La evidencia (capturas, guiones,
salidas de las consultas) quedó fuera del repositorio, en `D:\mpos-tmp\dp16-qa\`.

## El dinero

| Ronda                                         | Cajas | Tickets | Ventas    | Efectivo esperado contra contado | Violaciones |
| --------------------------------------------- | ----- | ------- | --------- | -------------------------------- | ----------- |
| 1 (jornada completa: 10 mesas, 4 para llevar) | 2     | 14      | $8,981.10 | $0.00 de diferencia en las dos   | 0 de 42     |
| 2 (jornada corta tras los arreglos)           | 2     | 8       | $3,966.85 | $0.00 de diferencia en las dos   | 0 de 42     |

## Lo que se arregló (con prueba, mutante y comprobado en la ronda 2)

| #      | Gravedad | Qué                                                                                                                                                          | Arreglo                                                                              |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| J-H1   | medio    | «Vender sólo en estas presentaciones» no se guardaba en la barbacoa: el formulario exigía un insumo que Don Poncho no lleva, y Recetas no mandaba la bandera | ingrediente base opcional en lo que va por peso; Recetas carga y manda la bandera    |
| J-H2   | medio    | Mesas unidas tras dividir y cobrar: «Limpieza» y el cierre trabado; la pregunta de separar no se veía                                                        | la decisión en el renglón de la mesa, dentro del diálogo del cierre                  |
| J-H3   | medio    | Registros → Cortes → «Ver PDF» sin «Opciones vendidas» ni «Retiros con PIN»                                                                                  | el visor lee la hoja del servidor y las pinta                                        |
| J-H8   | mejora   | Banda ámbar «Cuenta cobrada» en la comanda para llevar                                                                                                       | sólo en mesas                                                                        |
| J-H9   | mejora   | «Sin menú configurado todavía.» bajo el menú digital                                                                                                         | ya no sale en el modo digital                                                        |
| D-H-01 | medio    | El fondo de la tarjeta no se podía poner a un platillo existente (con recetas)                                                                               | el selector también en Recetas                                                       |
| D-H-02 | medio    | El nombre sobre fotos claras bajo AA (10–47 % del recuadro bajo 4.5:1)                                                                                       | sombra propia del bloque de texto: 0 %, peor píxel 8.0:1                             |
| D-H-03 | medio    | Ficha, «×» del carrito y botón del tema bajo 44 px                                                                                                           | 44 px o más                                                                          |
| D-H-04 | medio    | «Páginas subidas» con fichas de 30 px y «Agregar» de 41 px                                                                                                   | 44 y 48 px                                                                           |
| D-H-05 | medio    | Cocina a 768 px: el texto de «Listo» y su botón se enciman                                                                                                   | el botón baja de fila                                                                |
| D-H-06 | mejora   | «Entregar» por estación del mesero de 28 px                                                                                                                  | 44 px                                                                                |
| D-H-08 | mejora   | La ventana no crecía desde el toque en Y (142–213 px)                                                                                                        | origen medido desde el centro: «Agotados» 0.3 px; «Conectar teléfono» todavía 113 px |
| D-H-09 | mejora   | La ficha del platillo no era un diálogo                                                                                                                      | `role="dialog"`, `aria-modal`, título, foco al abrir, Escape, nombres en − y +       |
| R2-01  | mejora   | «Quitar» del carrito de 41 px                                                                                                                                | 44 px                                                                                |

## Lo que queda como mejora (sin cambiar, para después del sábado)

- El folio y la mesa se escriben distinto en el visor de Registros y en el documento al cerrar.
- El Cierre del día habla de todas las cajas pero desglosa canal, opciones y retiros sólo de la que
  cierra.
- Cada mesero une sólo sus mesas (el dueño puede unir cualquiera).
- El CSV de Ventas no trae «Opciones» (está en «Exportar productos»).
- Al cobrar mesas unidas con la cuenta dividida no se pregunta si separarlas: quedan en «Limpieza» y se
  resuelven desde el cierre (o el mesero).
- «Liberando…» queda junto a la pregunta de separar mientras se decide.
- «Conectar teléfono» crece 113 px abajo del toque; los puntos del carrusel del teléfono de cocina con
  muchas comandas; la tira de mesas repite el número cuando una mesa tiene dos rondas.
- Las tarjetas de atrás de la ficha siguen en el árbol de accesibilidad (la ficha no es modal para el
  lector de pantalla todavía).
- Textos de 11–12 px heredados («Atención», «Mesa»); la campana flotante tapa la columna izquierda al
  desplazar; el carrito no dice el precio por renglón.
- Con ocho personas entrando a la vez en la laptop, cada entrada tardó 8–12 s (en producción, 8 a la vez
  en 2.7 s).
