# Para el maestro · fichas de lo que hizo Don Poncho

Cada cambio se hace primero en POS Don Poncho y después se lleva a MorphiqPOS. Cada ficha dice
qué hace y por qué, los archivos, las migraciones, las pruebas, qué es genérico y qué es de Don
Poncho, y cómo portarlo.

**PAR-1 (31-10-2026): las 16 fichas están portadas al maestro** (`M1gu3hb/MorphiqPOS`, progreso
en su `docs/paridad/PARIDAD-DON-PONCHO.md`). Las que no piden migración, en el PR A (#20, en
producción). El pedido compartido y unir mesas, con la 186 y la 187 idénticas byte por byte, en el
PR B (#21), que se fusiona tras migrar la base compartida desde la laptop.

| #   | Ficha                                                                                                                                       | Encargo        | Migración               | Portada al maestro                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------- | ------------------------------------------------ |
| 01  | [Recetas y Platillos no pisan el área ni la visibilidad](01-recetas-area-y-visibilidad.md)                                                  | DP-9.1         | No                      | PR A #20                                         |
| 02  | [El portal sin asignación de mesas y los globos de solicitud](02-portal-sin-asignacion-y-globos.md)                                         | DP-9.2         | No                      | PR A #20                                         |
| 03  | [La vista «Solicitudes» dentro de Mesas](03-vista-de-solicitudes.md)                                                                        | DP-9.3         | No                      | PR A #20                                         |
| 04  | [Cocina en el teléfono](04-cocina-en-el-telefono.md)                                                                                        | DP-9.4         | No                      | PR A #20                                         |
| 05  | [Botones sobre las páginas del menú QR y aspecto del portal](05-botones-del-menu-qr.md)                                                     | DP-9.7         | No                      | PR A #20                                         |
| 06  | [QR de las mesas con diseño](06-qr-de-mesas-con-diseno.md)                                                                                  | DP-9.8         | No                      | PR A #20                                         |
| 07  | [El pedido compartido de la mesa](07-pedido-compartido.md)                                                                                  | DP-9.5         | 186                     | PR B #21 (`e3edecd`, en producción el 31-10)     |
| 08  | [Unir mesas desde el mapa](08-unir-mesas-en-el-mapa.md)                                                                                     | DP-9.6         | 187                     | PR B #21 (`e3edecd`, en producción el 31-10)     |
| 09  | [Estaciones Cocina y Bebidas](09-estaciones-cocina-y-bebidas.md)                                                                            | DP-10.1        | No                      | PR A #20                                         |
| 10  | [La última caja no cierra con cuentas vivas](10-cierre-de-caja-con-cuentas-vivas.md)                                                        | DP-10.2        | No                      | PR A #20                                         |
| 11  | [Puente de las mesas unidas hasta la mudanza](11-puente-de-mesas-unidas.md)                                                                 | DP-10.3        | No                      | PR A #20 (lo reemplaza el PR B)                  |
| 12  | [Mudar un negocio a su propia base](12-mudanza-de-un-negocio.md)                                                                            | DP-10.5        | En `fase-b`, la 188     | PR A #20 (parametrizada por negocio, sin la 188) |
| 13  | [Un id al azar que también sirve por http](13-id-al-azar-por-http.md)                                                                       | DP-11.0        | No                      | PR A #20                                         |
| 14  | [Morfi en el POS](14-morfi-en-el-pos.md)                                                                                                    | DP-11.1        | No                      | PR A #20                                         |
| 15  | [El modo espera](15-modo-espera.md)                                                                                                         | DP-11.2        | No                      | PR A #20                                         |
| 16  | [Los sonidos de la interfaz](16-sonidos.md)                                                                                                 | DP-11.3        | No                      | PR A #20                                         |
| 18  | [El usuario de plataforma](18-usuario-de-plataforma.md)                                                                                     | DP-12.1        | No                      | Pendiente                                        |
| 19  | [Los comensales arman, el mesero confirma](19-portal-modo-mesero.md)                                                                        | DP-12.2        | No                      | Pendiente                                        |
| 20  | [Unir mesas con el dedo](20-unir-mesas-al-tacto.md)                                                                                         | DP-12.3        | No                      | Pendiente                                        |
| 21  | [Las estaciones de punta a punta](21-estaciones-de-punta-a-punta.md)                                                                        | DP-12.5        | No                      | Pendiente                                        |
| 22  | [El mesero cancela, y el corte lo dice](22-cancelar-desde-el-mesero.md)                                                                     | DP-12.4        | No                      | Pendiente                                        |
| 23  | [Las pantallas que se veían mal](23-pantallas.md)                                                                                           | DP-12.6        | No                      | Pendiente                                        |
| 24  | [El corte: la pérdida por lo que valía, y cada caja con sus cuentas](24-corte-por-caja-y-perdida.md)                                        | DP-13.2        | No                      | Pendiente                                        |
| 25  | [Cancelar con reglas, el PIN atado a la cuenta y el margen sin receta](25-cancelar-con-pin-y-margen.md)                                     | DP-13.2        | No                      | Pendiente                                        |
| 26  | [La cámara del escáner, el sonido y el carrito de la mesa](26-camara-sonido-y-carrito.md)                                                   | DP-13.2        | No                      | Pendiente                                        |
| 27  | [Plataforma, purgas, unir y separar con el portal, el sonido y la merma de lo cancelado](27-plataforma-purgas-union-y-merma.md)             | DP-13.3        | No (una clave opcional) | Pendiente                                        |
| 28  | [El portal: el teléfono firmado, el aviso del vaciado, abrir y enviar, la cuenta pedida](28-portal-telefono-firmado-y-cuenta-pedida.md)     | DP-13.3        | No                      | Pendiente                                        |
| 29  | [Lo que encontró el QA: cuentas, cortes, propinas, topes y entradas](29-lo-que-encontro-el-qa.md)                                           | DP-13.5        | No                      | Pendiente                                        |
| 30  | [Lo quitado no se cobra, los descuentos con clave y dos cajas](30-quitado-descuentos-con-clave-y-dos-cajas.md)                              | DP-14.1 y 14.2 | No                      | Pendiente                                        |
| 31  | [La barbacoa por kilo, la mesa limpia y las opciones sin red](31-barbacoa-por-kilo-mesa-limpia-y-opciones.md)                               | DP-14.1        | No                      | Pendiente                                        |
| 32  | [Cancelar una parte, la opción obligatoria, cancelar sin la cocina, el margen y los menores](32-partes-opciones-cocina-margen-y-menores.md) | DP-14.6        | No (un dato opcional)   | Pendiente                                        |
| 33  | [El papel que suma, los usuarios con su puesto real, dos cajas y el descuento](33-papel-que-suma-usuarios-y-dos-cajas.md)                   | DP-14 ronda 2  | No                      | Pendiente                                        |
| 34  | [Los menores: el corte, la auditoría, `autorizar_descuento`, el margen y los topes](34-menores-del-corte-auditoria-y-topes.md)              | DP-14 ronda 2  | No                      | Pendiente                                        |
