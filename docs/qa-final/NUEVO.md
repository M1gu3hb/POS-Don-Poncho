# NUEVO · DP-22 · Lo que se agregó en la auditoría final

> Cada función nueva lleva su decisión (`DECISIONES.md`), la prueba antes del código con su mutante,
> su texto de ayuda y el mismo ataque que cualquier arreglo (`HALLAZGOS.md`). Aquí queda la cuenta:
> qué se agregó, dónde, cómo se usa y con qué prueba.

## Funciones nuevas

| #   | Qué                                                                                                                                                           | Dónde se usa                                                                                                                                                                                                                | Decisión | Prueba                                                                                                                                                       | Commit                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| 1   | **Los cortes en una carpeta.** Con la app de Windows 1.0.2 el PDF del corte se guarda solo en `Documentos\POS Don Poncho\Cortes\AAAA-MM\` (ya no se descarga) | Al cerrar la caja se guarda solo (sin retrasar el cierre). En Registros → Cortes: «Guardar en la carpeta» por corte y «Abrir carpeta». En un navegador o con la app 1.0.1 todo sigue igual y los botones nuevos no aparecen | DP-D153  | `apps/web/src/corte/carpeta/*.test.ts` (4 suites y el contrato de las pantallas) y, en la app, `electron/pruebas/archivos.test.js` (17); mutantes en los dos | `912c726` (POS) · `ebccf30` (apps) |

**Total: 1.** (Falta publicar la app 1.0.2 en `canal-don-poncho` y verla llegar a una 1.0.1.)

## Lo que la revisión de «lo que falta» encontró (Parte 7)

Primera pasada, leyendo el código (16-11, 23:45). «Por ver» = falta confirmarlo en la app con el
arnés; lo que diga «falta» se construye si es chico o mediano, y si no va a la lista de abajo.

| #   | ¿Debería poder…?                                                  | ¿Existe?                                                                                                              | Qué se hizo / qué sigue                                                                |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Marcar un platillo agotado al vuelo; lo ven el mesero y el portal | Sí: `AgotadosDelDia.tsx` → `catalogo.marcar_agotado`; el portal lo lee (`menu-digital.ts`)                            | por ver en la app (que el mesero lo vea al instante)                                   |
| 2   | Reimprimir o volver a mandar una comanda                          | La cocina es por pantalla: la comanda no se imprime ni se pierde. La precuenta y el ticket sí se reimprimen           | por ver; probable «no aplica» con su razón                                             |
| 3   | Pasar un platillo de una cuenta a otra                            | Sólo dentro de «Dividir la cuenta»; entre dos mesas, no                                                               | falta; por medir (toca cocina, inventario y dinero: si pasa de medio día, va a Miguel) |
| 4   | Transferir una mesa a otro mesero                                 | El comando existe (`restaurante.relevar_responsable`, ruta `/api/restaurante/relevar`) pero ninguna pantalla lo llama | **falta la pantalla: se construye**                                                    |
| 5   | Cancelar con motivo y con quién autorizó                          | Sí: motivos de anulación, `exigirPermisoParaCancelar`, queda en la auditoría y en el corte                            | por ver en la app                                                                      |
| 6   | Descuento o cortesía con PIN de gerencia                          | Sí: `DescuentoAutorizado.tsx` y `descuento-con-clave.integracion.test.ts`                                             | por ver en la app                                                                      |
| 7   | Las propinas por mesero en el corte o en un reporte               | Sí: en el corte (`corte/hoja.ts`) y en Registros (`propinas.del_rango`, lote 1)                                       | por ver con datos                                                                      |
| 8   | Un corte parcial (X) contra el corte final                        | Sí: «Corte de turno» (`venta/CorteDeTurno.tsx`, `/api/caja/corte-turno`)                                              | por ver en la app                                                                      |
| 9   | El arqueo por denominación                                        | Sí en el papel (`corte/hoja.ts`: «Conteo por denominación»); la captura, por ver                                      | por ver en la app                                                                      |
| 10  | Ventas por platillo, por hora y por mesero; lo más vendido        | Por hora, sí (Tablero → Hoy). Por platillo sólo como exportación (Registros); en pantalla no hay «lo más vendido»     | **falta: se construye** (sumado en el servidor)                                        |
| 11  | Buscar un producto en el pedido                                   | Sí: «Buscar producto…» en `CatalogoDelPedido.jsx`                                                                     | por ver con el dedo y el teclado en pantalla                                           |
| 12  | El tiempo de cada mesa abierta y un aviso de mesa sin atender     | Hay «tiempo de servicio» en la mesa activa y el reloj de espera en cocina; en el plano, por ver                       | por ver                                                                                |
| 13  | El aviso de insumo bajo                                           | Inventario ordena por semáforo (agotado, crítico, bajo); no hay aviso fuera de esa pantalla                           | **falta el aviso: se construye** (Tablero de dueño, gerente y almacén)                 |
| 14  | El teléfono y el nombre en los pedidos para llevar                | El nombre sí (`nombrePedido`); el teléfono no                                                                         | **falta el teléfono: se construye**                                                    |
| 15  | La nota por comensal                                              | Hay nota por platillo y «Nota para cocina» del pedido; por comensal, no                                               | por decidir (si la nota por platillo basta, se anota y no se construye)                |
| 16  | Exportar el día                                                   | Sí: exportaciones de Registros y Configuración → Datos (`ExportarDatos.jsx`)                                          | por ver (que sea de un toque y con el día del negocio)                                 |

## Lo grande que queda para después (para Miguel, con su tamaño estimado)

| Qué | Por qué no entra aquí | Tamaño estimado |
| --- | --------------------- | --------------- |
