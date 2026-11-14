# Día 3 · informe del simulador

## Volumen (lo que los bots hicieron, según el libro)

- Cobros: 155 (116 de mesa, 39 para llevar) por $150,496.24
- Por método: efectivo $62,784.30 · tarjeta $66,278.24 · transferencia $21,433.70
- Propinas: $12,916.27 · descuentos: $1,553.26
- Líneas pedidas: 969
- Asientos por tipo: apertura 2 · linea 969 · cobro 155 · descuento 33 · entrada 2 · compra 3 · cambio_en_vivo 37 · cancelacion 19 · gasto 3 · retiro 9 · merma 4 · traslado 1

## El libro contra el sistema

1444 comparaciones, 1435 iguales, **9 diferencias**.

| Fuente           | Comparaciones | Diferencias |
| ---------------- | ------------: | ----------: |
| cajas            |          1245 |           0 |
| inventario       |            14 |           6 |
| compras y gastos |             2 |           0 |
| dueño            |           159 |           1 |
| invariantes      |            24 |           2 |

- [inventario] Tortilla de prueba: movimiento neto del día (pieza): esperado **52**, real **174** (inventario/alto)
- [inventario] Tortilla de prueba: salida por venta (pieza): esperado **136**, real **14** (inventario/alto)
- [inventario] Carne de prueba: movimiento neto del día (g): esperado **-33280**, real **-28620** (inventario/alto)
- [inventario] Carne de prueba: salida por venta (g): esperado **41280**, real **36620** (inventario/alto)
- [inventario] Tequila de prueba: movimiento neto del día (ml): esperado **0**, real **-1710** (inventario/alto)
- [inventario] Tequila de prueba: salida por venta (ml): esperado **0**, real **1710** (inventario/alto)
- [dueño] Cierre del día: cerró con todo cobrado: esperado **sí**, real **no** (dinero/alto)
- [invariantes] I03 · venta: lo descontado ≠ cantidad vendida × receta (cuentas cobradas con receta activa): esperado **ninguna fila que viole la regla**, real **110 filas (antes de la semana: 0); ejemplo {"orden":"039bf78e-fd85-46c0-92bd-04e3b7ae9954","nombre":"Tequila de prueba","esperado":null,"descontado":"90.0000"}** (inventario/alto)
- [invariantes] I06 · existencia negativa (informativa: tras una cancelación puede ser legítima, DP-D57): esperado **ninguna fila que viole la regla**, real **2 filas (antes de la semana: 0); ejemplo {"nombre":"Tequila de prueba","cantidad":"-115.0000"}** (inventario/alto)

## Incidentes

- **D3-200** (alto/prueba, repetición) · dueno · Dueño → Cierre del día: Cierre del día. Esperaba: El día cierra y baja su PDF. Pasó: Error: expect(locator).toBeVisible() failed Locator: locator('#contado')
- **D3-201** (alto/inventario) · arbitro · inventario: Comparar «Tortilla de prueba: movimiento neto del día (pieza)» entre el libro y el sistema. Esperaba: 52. Pasó: El sistema dice: 174
- **D3-202** (alto/inventario) · arbitro · inventario: Comparar «Tortilla de prueba: salida por venta (pieza)» entre el libro y el sistema. Esperaba: 136. Pasó: El sistema dice: 14
- **D3-203** (alto/inventario) · arbitro · inventario: Comparar «Carne de prueba: movimiento neto del día (g)» entre el libro y el sistema. Esperaba: -33280. Pasó: El sistema dice: -28620
- **D3-204** (alto/inventario) · arbitro · inventario: Comparar «Carne de prueba: salida por venta (g)» entre el libro y el sistema. Esperaba: 41280. Pasó: El sistema dice: 36620
- **D3-205** (alto/inventario) · arbitro · inventario: Comparar «Tequila de prueba: movimiento neto del día (ml)» entre el libro y el sistema. Esperaba: 0. Pasó: El sistema dice: -1710
- **D3-206** (alto/inventario) · arbitro · inventario: Comparar «Tequila de prueba: salida por venta (ml)» entre el libro y el sistema. Esperaba: 0. Pasó: El sistema dice: 1710
- **D3-207** (alto/dinero, repetición) · arbitro · dueño: Comparar «Cierre del día: cerró con todo cobrado» entre el libro y el sistema. Esperaba: sí. Pasó: El sistema dice: no
- **D3-208** (alto/inventario) · arbitro · invariantes: Comparar «I03 · venta: lo descontado ≠ cantidad vendida × receta (cuentas cobradas con receta activa)» entre el libro y el sistema. Esperaba: ninguna fila que viole la regla. Pasó: El sistema dice: 110 filas (antes de la semana: 0); ejemplo {"orden":"039bf78e-fd85-46c0-92bd-04e3b7ae9954","nombre":"Tequila de prueba","esperado":null,"descontado":"90.0000"}
- **D3-209** (alto/inventario) · arbitro · invariantes: Comparar «I06 · existencia negativa (informativa: tras una cancelación puede ser legítima, DP-D57)» entre el libro y el sistema. Esperaba: ninguna fila que viole la regla. Pasó: El sistema dice: 2 filas (antes de la semana: 0); ejemplo {"nombre":"Tequila de prueba","cantidad":"-115.0000"}
- **D3-001** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-002** (medio/ui) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 2 a la 4. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D3-003** (medio/rendimiento) · gerente · Gerencia: comprar 8 kg de Carne de prueba. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.1 s
- **D3-007** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-008** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-009** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-010** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 9 a la 11. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D3-011** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-012** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-013** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-014** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-016** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-017** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-018** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-019** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-020** (medio/ux, repetición) · almacen · Inventario → Registrar compra (almacén): Toqué «Registrar compra» en Inventario con el puesto de almacén. Esperaba: Se abre el formulario de la compra, o el botón no se ofrece. Pasó: Me lleva a Compras, que dice «las compras y los gastos los registra la gerencia» y no deja registrar nada
- **D3-025** (medio/rendimiento) · almacen · Almacén: registrar merma de Pan de prueba. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.3 s
- **D3-026** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-028** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-030** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-031** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-032** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-033** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-037** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.1 s
- **D3-038** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-040** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-042** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-043** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-045** (medio/ux, repetición) · caja · Caja → Pendientes → parte de una cuenta dividida: Abrí «Mesa 9 · cuenta 1 de 2» desde Pendientes. Esperaba: La pregunta de la propina y el cobro se alcanzan por rol (dialog, button), como en una cuenta entera. Pasó: El cobro y la pregunta de la propina se abrieron a la vez y los dos quedaron con aria-hidden="true": «Sin propina» y «Aplicar» no existen en el árbol de accesibilidad
- **D3-046** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-047** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 8 a la 7. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D3-050** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-053** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 8 a la 5. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D3-055** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-056** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 13 a la 12. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D3-060** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-061** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-062** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 13 a la 12. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D3-063** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.1 s
- **D3-065** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-066** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-069** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-070** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-071** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-072** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 4 a la 3. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D3-076** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-079** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-080** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-081** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-082** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-083** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-084** (medio/ui) · mesero · Mesero · mesa 20: Entrar a la mesa 20. Esperaba: Abrir el diálogo de la mesa.. Pasó: entrar a la mesa: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /(?<!\d)(?<!con )(?<!, )(?<!y )20\s*(?:(?:Mesa \d+ · )?Unida con [\d ,y]+?\s*)?(Libre|Esperando orden|Pedido enviado|En preparación|Esperando entrega|Ocupada|Cuenta solicitada|Limpieza)/ }).or(locator(
- **D3-087** (medio/rendimiento) · almacen · Almacén: registrar merma de Leche de prueba. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.4 s
- **D3-090** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-095** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-096** (medio/ui) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 15 a la 17. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /(?<!\d)(?<!con )(?<!, )(?<!y )15\s*(?:(?:Mesa \d+ · )?Unida con [\d ,y]+?\s*)?(Libre|Esperando orden|Pedido enviado|En preparación|Esperando entrega|Ocupada|Cuenta solicitada|Limpieza)/ }).or(locator(
- **D3-098** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-101** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-103** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-104** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-105** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-106** (medio/rendimiento) · caja · Caja → Pendientes: abrir la cuenta pendiente. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.1 s
- **D3-107** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-108** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-113** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.1 s
- **D3-115** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-116** (medio/rendimiento) · caja · Caja → Pendientes: abrir la cuenta pendiente. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.2 s
- **D3-118** (medio/ux, repetición) · estacion · Estación Cocina: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-120** (medio/ux, repetición) · caja · Sesión: Seguir cobrando. Esperaba: La sesión de la caja sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-122** (medio/ux, repetición) · estacion · Estación Bebidas: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-123** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.1 s
- **D3-124** (medio/ux, repetición) · estacion · Estación Parrilla: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-125** (medio/ux, repetición) · estacion · Estación Postres: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-127** (medio/ux, repetición) · estacion · Estación Pulques: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-128** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-131** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-132** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-134** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-135** (medio/ux, repetición) · caja · Caja → Pendientes → parte de una cuenta dividida: Abrí «Mesa 11 · cuenta 1 de 2» desde Pendientes. Esperaba: La pregunta de la propina y el cobro se alcanzan por rol (dialog, button), como en una cuenta entera. Pasó: El cobro y la pregunta de la propina se abrieron a la vez y los dos quedaron con aria-hidden="true": «Sin propina» y «Aplicar» no existen en el árbol de accesibilidad
- **D3-136** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-137** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-138** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-139** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-140** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D3-144** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-145** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 4 a la 3. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D3-147** (medio/ux, repetición) · caja · Caja → Pendientes → parte de una cuenta dividida: Abrí «Mesa 17 · cuenta 1 de 2» desde Pendientes. Esperaba: La pregunta de la propina y el cobro se alcanzan por rol (dialog, button), como en una cuenta entera. Pasó: El cobro y la pregunta de la propina se abrieron a la vez y los dos quedaron con aria-hidden="true": «Sin propina» y «Aplicar» no existen en el árbol de accesibilidad
- **D3-148** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 4 a la 1. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D3-149** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-151** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-152** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $70.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-153** (medio/ui, repetición) · mesero · Mesero · mesa 13: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D3-155** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 17 a la 16. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D3-157** (medio/ux, repetición) · caja · Caja → Pendientes → parte de una cuenta dividida: Abrí «Mesa 11 · cuenta 1 de 3» desde Pendientes. Esperaba: La pregunta de la propina y el cobro se alcanzan por rol (dialog, button), como en una cuenta entera. Pasó: El cobro y la pregunta de la propina se abrieron a la vez y los dos quedaron con aria-hidden="true": «Sin propina» y «Aplicar» no existen en el árbol de accesibilidad
- **D3-158** (medio/prueba, repetición) · caja · Caja: Cobrar la cuenta de la mesa 11. Esperaba: La cuenta queda cobrada una vez. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-164** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 4 a la 3. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D3-165** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-166** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-168** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-169** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-170** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-171** (medio/ui, repetición) · mesero · Mesero · unir mesas: Unir la mesa 1 con la 4. Esperaba: Las dos mesas quedan unidas.. Pasó: unir mesas: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('region', { name: 'Unir mesas' }).getByRole('button', { name: /^Unir 2 mesas/ })[22m
- **D3-172** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-173** (medio/ui, repetición) · telefono_cocina · Teléfono de Cocina: Tocar «Preparar». Esperaba: La comanda pasa a preparación.. Pasó: preparar (teléfono): el servidor rechazó «Preparar»
- **D3-174** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-175** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-179** (medio/rendimiento) · almacen · Almacén: conteo físico de Leche de prueba con faltante. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.1 s
- **D3-180** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-181** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-184** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-185** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-186** (medio/ux, repetición) · caja · Caja → Pendientes → parte de una cuenta dividida: Abrí «Mesa 3 · cuenta 1 de 2» desde Pendientes. Esperaba: La pregunta de la propina y el cobro se alcanzan por rol (dialog, button), como en una cuenta entera. Pasó: El cobro y la pregunta de la propina se abrieron a la vez y los dos quedaron con aria-hidden="true": «Sin propina» y «Aplicar» no existen en el árbol de accesibilidad
- **D3-187** (medio/prueba, repetición) · caja · Caja: Cobrar la cuenta de la mesa 3. Esperaba: La cuenta queda cobrada una vez. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-188** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-189** (medio/ui, repetición) · mesero · Mesero · mesa 14: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D3-190** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-191** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-192** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-193** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-194** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-195** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $105.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-196** (medio/ux, repetición) · caja · Caja → Para llevar: Abrí «Para llevar» para armar un pedido nuevo. Esperaba: El pedido empieza vacío (el anterior ya se cobró o se descartó). Pasó: El pedido arrancó con $35.00 de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta
- **D3-197** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D3-198** (medio/prueba, repetición) · caja · Caja → Cierre diario: Cerrar la caja. Esperaba: Cierra (no quedan mesas abiertas). Pasó: El sistema avisó de mesas pendientes
- **D3-199** (medio/prueba, repetición) · caja · Caja → Cierre diario: Cerrar la caja. Esperaba: Cierra (no quedan mesas abiertas). Pasó: El sistema avisó de mesas pendientes
- **D3-004** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-005** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-006** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-015** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-021** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-022** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-023** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-024** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-027** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-029** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-034** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-035** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-036** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-039** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-041** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-044** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-048** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-049** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-051** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-052** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-054** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-057** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-058** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-059** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-064** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-067** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-068** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-073** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-074** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-075** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-077** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-078** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-085** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Pedir la cuenta con 10 % de propina. Esperaba: Responder en menos de 3 s.. Pasó: pedir la cuenta por el portal (lento)
- **D3-086** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-088** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-089** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-091** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-092** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-093** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-094** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-097** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-099** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-100** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-102** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-109** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-110** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-111** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-112** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-114** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-116** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-119** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-121** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-126** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-129** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-130** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-133** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-141** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-142** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-143** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-146** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-150** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-154** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-156** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-159** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-160** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-161** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-162** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-163** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-167** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-176** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-177** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-178** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-182** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D3-183** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)

## Tiempos por acción (segundos reales)

| Acción                                                 |   n |   p50 |   p95 |   máx |
| ------------------------------------------------------ | --: | ----: | ----: | ----: |
| abrir mesa                                             |  54 | 0.6 s | 0.8 s | 1.0 s |
| agregar al portal (porcion_contenedor)                 |  11 | 1.0 s | 1.5 s | 1.5 s |
| agregar al portal (precio_fijo)                        | 379 | 0.7 s | 1.5 s | 2.1 s |
| agregar al portal (variable_medida)                    |  45 | 0.7 s | 1.4 s | 1.6 s |
| agregar porcion_contenedor                             |  10 | 0.5 s | 0.6 s | 0.6 s |
| agregar precio_fijo                                    | 399 | 0.2 s | 1.4 s | 2.1 s |
| agregar variable_medida                                |  47 | 0.6 s | 0.8 s | 1.0 s |
| almacen:conteo físico de Leche de prueba con faltante  |   1 | 3.1 s | 3.1 s | 3.1 s |
| almacen:intentar comprar 40 pieza de Pan de prueba     |   1 | 1.4 s | 1.4 s | 1.4 s |
| almacen:registrar merma de Leche de prueba             |   1 | 3.4 s | 3.4 s | 3.4 s |
| almacen:registrar merma de Pan de prueba               |   1 | 3.3 s | 3.3 s | 3.3 s |
| almacen:registrar merma de Tortilla de prueba          |   1 | 3.0 s | 3.0 s | 3.0 s |
| atender ayuda                                          |  41 | 0.1 s | 0.2 s | 0.3 s |
| caja:abrir la caja                                     |   2 | 0.6 s | 0.6 s | 0.6 s |
| caja:abrir la cuenta pendiente                         | 111 | 2.6 s | 2.9 s | 4.2 s |
| caja:abrir una parte de la cuenta dividida             |  13 | 0.7 s | 1.0 s | 1.0 s |
| caja:aplicar un descuento con PIN                      |  33 | 1.1 s | 1.3 s | 1.3 s |
| caja:armar el pedido para llevar                       |  78 | 1.0 s | 1.8 s | 2.0 s |
| caja:cerrar la caja                                    |   2 | 0.2 s | 0.2 s | 0.2 s |
| caja:cobrar con Efectivo                               |  47 | 1.0 s | 1.2 s | 1.2 s |
| caja:cobrar con Mixto                                  |  25 | 1.1 s | 1.4 s | 1.4 s |
| caja:cobrar con Tarjeta                                |  49 | 1.0 s | 1.2 s | 1.3 s |
| caja:cobrar con Transferencia                          |  20 | 0.9 s | 1.2 s | 1.2 s |
| caja:dividir en 2 cuentas                              |   5 | 0.2 s | 0.3 s | 0.3 s |
| caja:dividir en 3 cuentas                              |   2 | 0.2 s | 0.2 s | 0.2 s |
| caja:registrar un retiro                               |   9 | 0.4 s | 4.1 s | 4.1 s |
| caja:registrar una entrada de cambio                   |   2 | 0.1 s | 0.2 s | 0.2 s |
| caja:traer la caja a este aparato                      |   1 | 0.4 s | 0.4 s | 0.4 s |
| cambiar de mesa                                        |  26 | 1.1 s | 1.6 s | 1.6 s |
| conectar teléfono                                      |   2 | 0.7 s | 0.7 s | 0.7 s |
| confirmar pedido del portal                            | 122 | 1.1 s | 1.4 s | 1.9 s |
| dueno:abrir el Tablero                                 |   1 | 1.3 s | 1.3 s | 1.3 s |
| entrar a la mesa                                       | 117 | 0.1 s | 0.3 s | 0.8 s |
| enviar a cocina                                        | 117 | 0.7 s | 0.8 s | 1.2 s |
| escanear el QR                                         | 167 | 0.5 s | 0.8 s | 2.5 s |
| gerente:comprar 10 litro de Pulque de prueba           |   1 | 2.5 s | 2.5 s | 2.5 s |
| gerente:comprar 200 pieza de Tortilla de prueba        |   1 | 2.6 s | 2.6 s | 2.6 s |
| gerente:comprar 8 kg de Carne de prueba                |   1 | 3.1 s | 3.1 s | 3.1 s |
| gerente:marcar agotado Flan de prueba                  |   1 | 1.8 s | 1.8 s | 1.8 s |
| gerente:registrar el gasto «Garrafones de agua»        |   1 | 1.6 s | 1.6 s | 1.6 s |
| gerente:registrar el gasto «Gas del día»               |   1 | 1.6 s | 1.6 s | 1.6 s |
| gerente:registrar el gasto «Servilletas y desechables» |   1 | 1.7 s | 1.7 s | 1.7 s |
| gerente:volver a surtir Flan de prueba                 |   1 | 1.9 s | 1.9 s | 1.9 s |
| listo                                                  | 423 | 0.1 s | 0.1 s | 0.2 s |
| listo (teléfono)                                       | 180 | 0.1 s | 0.1 s | 0.3 s |
| llamar al mesero                                       | 122 | 5.7 s | 6.2 s | 7.7 s |
| marcar agotado                                         |   1 | 0.4 s | 0.4 s | 0.4 s |
| marcar entregado                                       | 238 | 1.1 s | 1.2 s | 1.6 s |
| pedir ayuda                                            |   7 | 0.5 s | 0.6 s | 0.6 s |
| pedir la cuenta                                        |  54 | 2.2 s | 2.6 s | 2.7 s |
| pedir la cuenta por el portal                          |  58 | 1.5 s | 2.6 s | 3.3 s |
| preparar                                               | 543 | 0.1 s | 0.1 s | 0.5 s |
| preparar (teléfono)                                    |  92 | 0.1 s | 0.1 s | 0.2 s |
| quitar agotado                                         |   1 | 0.5 s | 0.5 s | 0.5 s |
| quitar platillo                                        |  19 | 1.3 s | 1.6 s | 1.6 s |
| unir mesas                                             |  11 | 0.6 s | 1.0 s | 1.0 s |
| vaciar el carrito                                      | 117 | 0.1 s | 0.2 s | 0.2 s |
