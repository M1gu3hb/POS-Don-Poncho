# Día 5 · informe del simulador

## Volumen (lo que los bots hicieron, según el libro)

- Cobros: 99 (66 de mesa, 33 para llevar) por $80,991.04
- Por método: efectivo $32,834.17 · tarjeta $34,929.37 · transferencia $13,227.50
- Propinas: $6,353.73 · descuentos: $669.96
- Líneas pedidas: 567
- Asientos por tipo: apertura 2 · linea 567 · descuento 21 · cobro 99 · entrada 2 · cancelacion 14 · compra 3 · gasto 3 · cambio_en_vivo 31 · retiro 9 · merma 4

## El libro contra el sistema

940 comparaciones, 933 iguales, **7 diferencias**.

| Fuente           | Comparaciones | Diferencias |
| ---------------- | ------------: | ----------: |
| cajas            |           797 |           0 |
| inventario       |            14 |           4 |
| compras y gastos |             2 |           0 |
| dueño            |           103 |           1 |
| invariantes      |            24 |           2 |

- [inventario] Carne de prueba: movimiento neto del día (g): esperado **-13150**, real **-13000** (inventario/alto)
- [inventario] Carne de prueba: salida por venta (g): esperado **21150**, real **21000** (inventario/alto)
- [inventario] Pan de prueba: movimiento neto del día (pieza): esperado **-9**, real **-8** (inventario/alto)
- [inventario] Pan de prueba: salida por venta (pieza): esperado **7**, real **6** (inventario/alto)
- [dueño] Cierre del día: cerró con todo cobrado: esperado **sí**, real **no** (dinero/alto)
- [invariantes] I03 · venta: lo descontado ≠ cantidad vendida × receta o ingrediente base (cuentas cobradas): esperado **ninguna fila que viole la regla**, real **53 filas (antes de la semana: 0); ejemplo {"orden":"01f3419d-9adf-43d3-aeef-c72e9bb5f6f8","nombre":"Carne de prueba","esperado":"1150.00000000000000000000000000000000","descontado":"150.0000"}** (inventario/alto)
- [invariantes] I06 · existencia negativa (informativa: tras una cancelación puede ser legítima, DP-D57): esperado **ninguna fila que viole la regla**, real **3 filas (antes de la semana: 0); ejemplo {"nombre":"Maíz pozolero de prueba","cantidad":"-50.0000"}** (inventario/alto)

## Incidentes

- **D5-157** (alto/prueba, repetición) · dueno · Dueño → Cierre del día: Cierre del día. Esperaba: El día cierra y baja su PDF. Pasó: Error: expect(locator).toBeVisible() failed Locator: locator('#contado')
- **D5-158** (alto/inventario) · arbitro · inventario: Comparar «Carne de prueba: movimiento neto del día (g)» entre el libro y el sistema. Esperaba: -13150. Pasó: El sistema dice: -13000
- **D5-159** (alto/inventario) · arbitro · inventario: Comparar «Carne de prueba: salida por venta (g)» entre el libro y el sistema. Esperaba: 21150. Pasó: El sistema dice: 21000
- **D5-160** (alto/inventario) · arbitro · inventario: Comparar «Pan de prueba: movimiento neto del día (pieza)» entre el libro y el sistema. Esperaba: -9. Pasó: El sistema dice: -8
- **D5-161** (alto/inventario, repetición) · arbitro · inventario: Comparar «Pan de prueba: salida por venta (pieza)» entre el libro y el sistema. Esperaba: 7. Pasó: El sistema dice: 6
- **D5-162** (alto/dinero, repetición) · arbitro · dueño: Comparar «Cierre del día: cerró con todo cobrado» entre el libro y el sistema. Esperaba: sí. Pasó: El sistema dice: no
- **D5-163** (alto/inventario) · arbitro · invariantes: Comparar «I03 · venta: lo descontado ≠ cantidad vendida × receta o ingrediente base (cuentas cobradas)» entre el libro y el sistema. Esperaba: ninguna fila que viole la regla. Pasó: El sistema dice: 53 filas (antes de la semana: 0); ejemplo {"orden":"01f3419d-9adf-43d3-aeef-c72e9bb5f6f8","nombre":"Carne de prueba","esperado":"1150.00000000000000000000000000000000","descontado":"150.0000"}
- **D5-164** (alto/inventario) · arbitro · invariantes: Comparar «I06 · existencia negativa (informativa: tras una cancelación puede ser legítima, DP-D57)» entre el libro y el sistema. Esperaba: ninguna fila que viole la regla. Pasó: El sistema dice: 3 filas (antes de la semana: 0); ejemplo {"nombre":"Maíz pozolero de prueba","cantidad":"-50.0000"}
- **D5-001** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-002** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-005** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-006** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-007** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-008** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-009** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-010** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-011** (medio/rendimiento) · gerente · Gerencia: comprar 8 kg de Carne de prueba. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.6 s
- **D5-013** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-017** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-019** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 9 a la 11. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D5-020** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-023** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-024** (medio/ux, repetición) · almacen · Inventario → Registrar compra (almacén): Toqué «Registrar compra» en Inventario con el puesto de almacén. Esperaba: Se abre el formulario de la compra, o el botón no se ofrece. Pasó: Me lleva a Compras, que dice «las compras y los gastos los registra la gerencia» y no deja registrar nada
- **D5-025** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-026** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-027** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-028** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 9 a la 11. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D5-029** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 9 a la 11. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D5-030** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 9 a la 11. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D5-033** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-035** (medio/rendimiento) · almacen · Almacén: registrar merma de Pan de prueba. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.6 s
- **D5-036** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-041** (medio/ui, repetición) · mesero · Mesero · unir mesas: Unir la mesa 3 con la 2. Esperaba: Las dos mesas quedan unidas.. Pasó: unir mesas: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('region', { name: 'Unir mesas' }).getByRole('button', { name: /^Unir 2 mesas/ })[22m
- **D5-042** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-043** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-044** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.1 s
- **D5-045** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-046** (medio/prueba, repetición) · caja · Caja: Cobrar la cuenta de la mesa 11. Esperaba: La cuenta queda cobrada una vez. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-047** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D5-048** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D5-050** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-051** (medio/ux, repetición) · caja · Caja → Pendientes → parte de una cuenta dividida: Abrí «Mesa 19 · cuenta 1 de 2» desde Pendientes. Esperaba: La pregunta de la propina y el cobro se alcanzan por rol (dialog, button), como en una cuenta entera. Pasó: El cobro y la pregunta de la propina se abrieron a la vez y los dos quedaron con aria-hidden="true": «Sin propina» y «Aplicar» no existen en el árbol de accesibilidad
- **D5-052** (medio/prueba, repetición) · caja · Caja: Cobrar la cuenta de la mesa 19. Esperaba: La cuenta queda cobrada una vez. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-053** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-054** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-055** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-057** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.1 s
- **D5-065** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-066** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-067** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-068** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-070** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-072** (medio/ux, repetición) · caja · Caja → Pendientes → parte de una cuenta dividida: Abrí «Mesa 16 · cuenta 1 de 3» desde Pendientes. Esperaba: La pregunta de la propina y el cobro se alcanzan por rol (dialog, button), como en una cuenta entera. Pasó: El cobro y la pregunta de la propina se abrieron a la vez y los dos quedaron con aria-hidden="true": «Sin propina» y «Aplicar» no existen en el árbol de accesibilidad
- **D5-073** (medio/rendimiento) · almacen · Almacén: registrar merma de Leche de prueba. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.1 s
- **D5-074** (medio/prueba, repetición) · caja · Caja: Cobrar la cuenta de la mesa 16. Esperaba: La cuenta queda cobrada una vez. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-075** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-076** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-078** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-086** (medio/ui) · mesero · Mesero · mesa 14: Abrir la mesa 14 para 2. Esperaba: La mesa queda abierta con su cuenta.. Pasó: abrir mesa: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /(?<!\d)(?<!con )(?<!, )(?<!y )14\s*(?:(?:Mesa \d+ · )?Unida con [\d ,y]+?\s*)?(Libre|Esperando orden|Pedido enviado|En preparación|Esperando entrega|Ocupada|Cuenta solicitada|Limpieza)/ }).or(locator(
- **D5-090** (medio/rendimiento) · caja · Caja → Pendientes: abrir la cuenta pendiente. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.1 s
- **D5-092** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.1 s
- **D5-093** (medio/ui) · estacion · Estación Parrilla: Tocar «Listo». Esperaba: La comanda pasa a «Listos» y avisa al mesero.. Pasó: listo: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: 'Listo', exact: true }).first()[22m
- **D5-094** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-096** (medio/ux, repetición) · estacion · Estación Cocina: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-097** (medio/ux, repetición) · caja · Sesión: Seguir cobrando. Esperaba: La sesión de la caja sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-098** (medio/ux, repetición) · estacion · Estación Bebidas: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-099** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.2 s
- **D5-101** (medio/ux, repetición) · caja · Sesión: Seguir cobrando. Esperaba: La sesión de la caja sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-102** (medio/ux, repetición) · estacion · Estación Parrilla: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-104** (medio/ux, repetición) · estacion · Estación Postres: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-105** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-106** (medio/ux, repetición) · estacion · Estación Pulques: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-107** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-109** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-110** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-112** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-113** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-114** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-115** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-116** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-117** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-119** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D5-120** (medio/ui) · mesero · Mesero · mesa 14: Marcar entregado. Esperaba: La mesa queda «Ocupada» con todo entregado.. Pasó: marcar entregado: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /(?<!\d)(?<!con )(?<!, )(?<!y )14\s*(?:(?:Mesa \d+ · )?Unida con [\d ,y]+?\s*)?(Libre|Esperando orden|Pedido enviado|En preparación|Esperando entrega|Ocupada|Cuenta solicitada|Limpieza)/ }).or(locator(
- **D5-121** (medio/ui, repetición) · mesero · Mesero · mesa 14: Marcar entregado. Esperaba: La mesa queda «Ocupada» con todo entregado.. Pasó: marcar entregado: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /(?<!\d)(?<!con )(?<!, )(?<!y )14\s*(?:(?:Mesa \d+ · )?Unida con [\d ,y]+?\s*)?(Libre|Esperando orden|Pedido enviado|En preparación|Esperando entrega|Ocupada|Cuenta solicitada|Limpieza)/ }).or(locator(
- **D5-124** (medio/ui, repetición) · mesero · Mesero · mesa 14: Marcar entregado. Esperaba: La mesa queda «Ocupada» con todo entregado.. Pasó: marcar entregado: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /(?<!\d)(?<!con )(?<!, )(?<!y )14\s*(?:(?:Mesa \d+ · )?Unida con [\d ,y]+?\s*)?(Libre|Esperando orden|Pedido enviado|En preparación|Esperando entrega|Ocupada|Cuenta solicitada|Limpieza)/ }).or(locator(
- **D5-126** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-127** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-128** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-129** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-133** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-134** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-135** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 4 a la 1. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D5-136** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-137** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-139** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-141** (medio/rendimiento) · almacen · Almacén: conteo físico de Leche de prueba con faltante. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.0 s
- **D5-142** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-143** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-144** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-145** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-146** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-147** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-148** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-149** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-150** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D5-151** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D5-152** (medio/prueba, repetición) · caja · Caja → Cierre diario: Cerrar la caja. Esperaba: Cierra (no quedan mesas abiertas). Pasó: El sistema avisó de mesas pendientes
- **D5-153** (medio/prueba, repetición) · caja · Caja → Cierre diario: Cerrar la caja. Esperaba: Cierra (no quedan mesas abiertas). Pasó: El sistema avisó de mesas pendientes
- **D5-154** (medio/ui) · dueno · Registros → Ventas → Ver ticket: Abrí el ticket del folio 785 (cobro de Caja 1). Esperaba: El ticket trae el folio, el total, el descuento, lo que se pidió. Pasó: Al ticket le falta: «Taco de prueba». Dice: «Ticket · 785 Imprimir Don Poncho Carr. a Sta. Cecilia #1, San Lorenzo Atemoaya, Xochimilco, CDMX 16400 TICKET DE PAGO PARA LLEVAR · 3 · Lupita Folio: 785 Mesero»
- **D5-155** (medio/ui) · dueno · Registros → Ventas → Ver ticket: Abrí el ticket del folio 782 (cobro de Caja 2). Esperaba: El ticket trae el folio, el total, lo que se pidió. Pasó: Al ticket le falta: «Taco de prueba». Dice: «Ticket · 782 Imprimir Don Poncho Carr. a Sta. Cecilia #1, San Lorenzo Atemoaya, Xochimilco, CDMX 16400 TICKET DE PAGO PARA LLEVAR · 1 · Joaquín Folio: 782 Meser»
- **D5-156** (medio/ui) · dueno · Registros → Ventas → Ver ticket: Abrí el ticket del folio 783 (cobro de Caja 2). Esperaba: El ticket trae el folio, el total, lo que se pidió. Pasó: Al ticket le falta: «Taco de prueba». Dice: «Ticket · 783 Imprimir Don Poncho Carr. a Sta. Cecilia #1, San Lorenzo Atemoaya, Xochimilco, CDMX 16400 TICKET DE PAGO PARA LLEVAR · 2 Folio: 783 Mesero: Caja 2 »
- **D5-003** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-004** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-012** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-014** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-015** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-016** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-018** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-021** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-022** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-031** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-032** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-034** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-037** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-038** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-039** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-040** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-049** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-056** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-058** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-059** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-060** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-061** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-062** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-063** (bajo/rendimiento) · estacion · Estación Bebidas: Tocar «Listo». Esperaba: Responder en menos de 3 s.. Pasó: listo (lento)
- **D5-064** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-069** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-071** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-077** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-079** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-080** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Agregar 1 × Naranjada. Esperaba: Responder en menos de 3 s.. Pasó: agregar al portal (precio_fijo) (lento)
- **D5-081** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Escanear el QR del teléfono 4. Esperaba: Responder en menos de 3 s.. Pasó: escanear el QR (lento)
- **D5-082** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Agregar 1 × Smirnoff. Esperaba: Responder en menos de 3 s.. Pasó: agregar al portal (precio_fijo) (lento)
- **D5-082** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-084** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-085** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-087** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-088** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-089** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-091** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-095** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-100** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-103** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-108** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-111** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-118** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-122** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-123** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-125** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-130** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Pedir la cuenta con 10 % de propina. Esperaba: Responder en menos de 3 s.. Pasó: pedir la cuenta por el portal (lento)
- **D5-131** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-132** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-138** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D5-140** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)

## Tiempos por acción (segundos reales)

| Acción                                                 |   n |   p50 |   p95 |    máx |
| ------------------------------------------------------ | --: | ----: | ----: | -----: |
| abrir mesa                                             |  33 | 0.6 s | 0.7 s |  0.8 s |
| agregar al portal (porcion_contenedor)                 |   6 | 0.7 s | 1.5 s |  1.5 s |
| agregar al portal (precio_fijo)                        | 215 | 0.7 s | 1.5 s | 16.4 s |
| agregar al portal (variable_medida)                    |  18 | 0.7 s | 1.5 s |  1.5 s |
| agregar porcion_contenedor                             |   5 | 0.5 s | 0.6 s |  0.6 s |
| agregar precio_fijo                                    | 233 | 0.2 s | 1.0 s |  1.6 s |
| agregar variable_medida                                |  28 | 0.5 s | 0.6 s |  0.6 s |
| almacen:conteo físico de Leche de prueba con faltante  |   1 | 3.0 s | 3.0 s |  3.0 s |
| almacen:intentar comprar 40 pieza de Pan de prueba     |   1 | 1.2 s | 1.2 s |  1.2 s |
| almacen:registrar merma de Leche de prueba             |   1 | 3.1 s | 3.1 s |  3.1 s |
| almacen:registrar merma de Pan de prueba               |   1 | 3.6 s | 3.6 s |  3.6 s |
| almacen:registrar merma de Tortilla de prueba          |   1 | 3.0 s | 3.0 s |  3.0 s |
| atender ayuda                                          |  24 | 0.1 s | 0.2 s |  0.2 s |
| caja:abrir la caja                                     |   2 | 0.6 s | 0.7 s |  0.7 s |
| caja:abrir la cuenta pendiente                         |  65 | 2.5 s | 2.9 s |  3.1 s |
| caja:abrir una parte de la cuenta dividida             |   5 | 0.8 s | 1.0 s |  1.0 s |
| caja:aplicar un descuento con PIN                      |  21 | 1.0 s | 1.4 s |  2.0 s |
| caja:armar el pedido para llevar                       |  62 | 1.0 s | 1.7 s |  2.6 s |
| caja:cerrar la caja                                    |   2 | 0.2 s | 0.3 s |  0.3 s |
| caja:cobrar con Efectivo                               |  39 | 0.9 s | 1.2 s |  1.2 s |
| caja:cobrar con Mixto                                  |   5 | 1.1 s | 1.2 s |  1.2 s |
| caja:cobrar con Tarjeta                                |  33 | 1.0 s | 1.2 s |  1.3 s |
| caja:cobrar con Transferencia                          |  19 | 0.9 s | 1.4 s |  1.4 s |
| caja:dividir en 2 cuentas                              |   2 | 0.2 s | 0.2 s |  0.2 s |
| caja:dividir en 3 cuentas                              |   1 | 0.1 s | 0.1 s |  0.1 s |
| caja:registrar un retiro                               |   9 | 0.5 s | 4.2 s |  4.2 s |
| caja:registrar una entrada de cambio                   |   2 | 0.1 s | 0.2 s |  0.2 s |
| cambiar de mesa                                        |  16 | 1.2 s | 1.5 s |  1.5 s |
| conectar teléfono                                      |   2 | 0.7 s | 0.7 s |  0.7 s |
| confirmar pedido del portal                            |  73 | 1.1 s | 1.3 s |  2.0 s |
| dueno:abrir el Tablero                                 |   1 | 1.3 s | 1.3 s |  1.3 s |
| entrar a la mesa                                       |  68 | 0.1 s | 0.2 s |  0.3 s |
| enviar a cocina                                        |  68 | 0.7 s | 0.8 s |  1.1 s |
| escanear el QR                                         |  98 | 0.5 s | 1.1 s |  7.9 s |
| gerente:comprar 10 litro de Pulque de prueba           |   1 | 2.3 s | 2.3 s |  2.3 s |
| gerente:comprar 200 pieza de Tortilla de prueba        |   1 | 2.6 s | 2.6 s |  2.6 s |
| gerente:comprar 8 kg de Carne de prueba                |   1 | 3.6 s | 3.6 s |  3.6 s |
| gerente:marcar agotado Flan de prueba                  |   1 | 2.0 s | 2.0 s |  2.0 s |
| gerente:registrar el gasto «Garrafones de agua»        |   1 | 1.7 s | 1.7 s |  1.7 s |
| gerente:registrar el gasto «Gas del día»               |   1 | 1.7 s | 1.7 s |  1.7 s |
| gerente:registrar el gasto «Servilletas y desechables» |   1 | 1.6 s | 1.6 s |  1.6 s |
| gerente:volver a surtir Flan de prueba                 |   1 | 1.5 s | 1.5 s |  1.5 s |
| listo                                                  | 333 | 0.1 s | 0.1 s |  5.7 s |
| listo (teléfono)                                       |  21 | 0.1 s | 0.1 s |  0.1 s |
| llamar al mesero                                       |  73 | 5.7 s | 7.2 s | 18.8 s |
| marcar agotado                                         |   1 | 0.4 s | 0.4 s |  0.4 s |
| marcar entregado                                       | 137 | 1.1 s | 1.2 s |  2.1 s |
| pedir ayuda                                            |   7 | 0.5 s | 0.8 s |  0.8 s |
| pedir la cuenta                                        |  33 | 2.4 s | 2.6 s |  2.9 s |
| pedir la cuenta por el portal                          |  34 | 1.5 s | 2.6 s |  3.3 s |
| preparar                                               | 342 | 0.1 s | 0.1 s |  0.4 s |
| preparar (teléfono)                                    |  16 | 0.0 s | 0.2 s |  0.2 s |
| quitar agotado                                         |   1 | 0.6 s | 0.6 s |  0.6 s |
| quitar platillo                                        |  14 | 1.2 s | 1.7 s |  1.7 s |
| unir mesas                                             |   9 | 0.6 s | 1.1 s |  1.1 s |
| vaciar el carrito                                      |  68 | 0.1 s | 0.2 s |  0.2 s |
