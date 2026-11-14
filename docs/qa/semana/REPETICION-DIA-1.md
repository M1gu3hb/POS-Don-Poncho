# Día 1 · informe del simulador

## Volumen (lo que los bots hicieron, según el libro)

- Cobros: 212 (130 de mesa, 82 para llevar) por $133,439.02
- Por método: efectivo $66,473.82 · tarjeta $53,797.80 · transferencia $13,167.40
- Propinas: $9,692.85 · descuentos: $1,959.48
- Líneas pedidas: 923
- Asientos por tipo: apertura 3 · linea 923 · descuento 41 · cobro 212 · cambio_en_vivo 39 · entrada 2 · compra 3 · gasto 3 · cancelacion 19 · retiro 9 · merma 4 · traslado 1 · corte 3

## El libro contra el sistema

1965 comparaciones, 1962 iguales, **3 diferencias**.

| Fuente           | Comparaciones | Diferencias |
| ---------------- | ------------: | ----------: |
| cajas            |          1709 |           0 |
| inventario       |            14 |           2 |
| compras y gastos |             2 |           0 |
| dueño            |           216 |           0 |
| invariantes      |            24 |           1 |

- [inventario] Carne de prueba: movimiento neto del día (g): esperado **-47480**, real **-45480** (inventario/alto)
- [inventario] Carne de prueba: salida por venta (g): esperado **55480**, real **53480** (inventario/alto)
- [invariantes] I06 · existencia negativa (informativa: tras una cancelación puede ser legítima, DP-D57): esperado **ninguna fila que viole la regla**, real **1 filas (antes de la semana: 0); ejemplo {"nombre":"Carne de prueba","cantidad":"-6980.0000"}** (inventario/alto)

## Incidentes

- **D1-121** (alto/dinero) · dueno · Registros → Ventas: Busqué en el historial de ventas el folio 2 que cobró Caja 1. Esperaba: Aparece con total $27.00 (ya con su descuento de $3.00). Pasó: No aparece en el historial
- **D1-122** (alto/dinero, repetición) · dueno · Registros → Ventas: Busqué en el historial de ventas el folio 6 que cobró Caja 2. Esperaba: Aparece con total $70.00. Pasó: No aparece en el historial
- **D1-123** (alto/inventario) · arbitro · inventario: Comparar «Carne de prueba: movimiento neto del día (g)» entre el libro y el sistema. Esperaba: -47480. Pasó: El sistema dice: -45480
- **D1-124** (alto/inventario) · arbitro · inventario: Comparar «Carne de prueba: salida por venta (g)» entre el libro y el sistema. Esperaba: 55480. Pasó: El sistema dice: 53480
- **D1-125** (alto/inventario) · arbitro · invariantes: Comparar «I06 · existencia negativa (informativa: tras una cancelación puede ser legítima, DP-D57)» entre el libro y el sistema. Esperaba: ninguna fila que viole la regla. Pasó: El sistema dice: 1 filas (antes de la semana: 0); ejemplo {"nombre":"Carne de prueba","cantidad":"-6980.0000"}
- **D1-002** (medio/rendimiento) · gerente · Gerencia: comprar 8 kg de Carne de prueba. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.3 s
- **D1-005** (medio/ui) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 18 a la 20. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D1-007** (medio/prueba) · caja · Caja → Para llevar: Marcar «Entregado» un pedido para llevar listo. Esperaba: El pedido pasa a entregado. Pasó: Error: expect(received).toBeLessThan(expected) Expected: < 1
- **D1-008** (medio/ux) · almacen · Inventario → Registrar compra (almacén): Toqué «Registrar compra» en Inventario con el puesto de almacén. Esperaba: Se abre el formulario de la compra, o el botón no se ofrece. Pasó: Me lleva a Compras, que dice «las compras y los gastos los registra la gerencia» y no deja registrar nada
- **D1-009** (medio/ui) · telefono_cocina · Teléfono de Parrilla: Tocar «Preparar». Esperaba: La comanda pasa a preparación.. Pasó: preparar (teléfono): el servidor rechazó «Preparar»
- **D1-013** (medio/rendimiento) · almacen · Almacén: registrar merma de Pan de prueba. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.3 s
- **D1-014** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 12 a la 14. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D1-017** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 12 a la 14. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D1-021** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.1 s
- **D1-022** (medio/ui) · mesero · Mesero · unir mesas: Unir la mesa 9 con la 11. Esperaba: Las dos mesas quedan unidas.. Pasó: unir mesas: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('region', { name: 'Unir mesas' }).getByRole('button', { name: 'Mesa 11', exact: true })[22m
- **D1-024** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 20 a la 19. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D1-030** (medio/ui) · telefono_cocina · Teléfono de Cocina: Tocar «Preparar». Esperaba: La comanda pasa a preparación.. Pasó: preparar (teléfono): locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: 'Preparar', exact: true })[22m
- **D1-031** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.1 s
- **D1-041** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 16 a la 15. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D1-042** (medio/rendimiento) · almacen · Almacén: registrar merma de Leche de prueba. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.4 s
- **D1-051** (medio/ui) · mesero · Mesero · mesa 14: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-054** (medio/rendimiento) · caja · Caja → Pendientes: abrir la cuenta pendiente. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.1 s
- **D1-056** (medio/ui) · mesero · Mesero · mesa 16: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /(?<!\d)(?<!con )(?<!, )(?<!y )16\s*(?:(?:Mesa \d+ · )?Unida con [\d ,y]+?\s*)?(Libre|Esperando orden|Pedido enviado|En preparación|Esperando entrega|Ocupada|Cuenta solicitada|Limpieza)/ }).or(locator(
- **D1-057** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.1 s
- **D1-058** (medio/ux) · estacion · Estación Cocina: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-060** (medio/ux) · caja · Sesión: Seguir cobrando. Esperaba: La sesión de la caja sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-061** (medio/rendimiento) · caja · Caja → Movimientos: registrar un retiro. Esperaba: Responder en menos de 3 s. Pasó: Tardó 4.2 s
- **D1-062** (medio/ux) · estacion · Estación Bebidas: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-063** (medio/ux) · estacion · Estación Parrilla: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-065** (medio/ux) · estacion · Estación Postres: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-066** (medio/ux) · estacion · Estación Pulques: Seguir en la estación. Esperaba: La sesión de la estación sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-068** (medio/ux) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-069** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-070** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-071** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-072** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-073** (medio/ux, repetición) · mesero · Sesión: Seguir trabajando. Esperaba: La sesión del mesero sigue vigente en la jornada.. Pasó: sesión vencida
- **D1-079** (medio/ui, repetición) · mesero · Mesero · mesa 14: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-081** (medio/ui) · mesero · Mesero · mesa 19: Entrar a la mesa 19. Esperaba: Abrir el diálogo de la mesa.. Pasó: entrar a la mesa: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /(?<!\d)(?<!con )(?<!, )(?<!y )19\s*(?:(?:Mesa \d+ · )?Unida con [\d ,y]+?\s*)?(Libre|Esperando orden|Pedido enviado|En preparación|Esperando entrega|Ocupada|Cuenta solicitada|Limpieza)/ }).or(locator(
- **D1-089** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 12 a la 14. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D1-090** (medio/ui, repetición) · mesero · Mesero · unir mesas: Unir la mesa 10 con la 11. Esperaba: Las dos mesas quedan unidas.. Pasó: unir mesas: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('region', { name: 'Unir mesas' }).getByRole('button', { name: 'Mesa 11', exact: true })[22m
- **D1-091** (medio/rendimiento) · almacen · Almacén: registrar merma de Tortilla de prueba. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.2 s
- **D1-095** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 2 a la 1. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D1-097** (medio/prueba) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D1-098** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D1-100** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D1-101** (medio/rendimiento) · almacen · Almacén: conteo físico de Leche de prueba con faltante. Esperaba: Responder en menos de 3 s. Pasó: Tardó 3.5 s
- **D1-103** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 2 a la 4. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D1-104** (medio/ui) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-105** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-106** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-107** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D1-108** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-109** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-110** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-111** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-112** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-113** (medio/ui, repetición) · mesero · Mesero · cambiar de mesa: Pasar la cuenta de la mesa 12 a la 14. Esperaba: La cuenta se va a la otra mesa.. Pasó: cambiar de mesa: locator.getAttribute: Timeout 45000ms exceeded. Call log: [2m - waiting for locator('a[href^="/restaurante/mesa-activa"]').first()[22m
- **D1-114** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-115** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D1-116** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-117** (medio/ui, repetición) · mesero · Mesero · mesa 12: Solicitar cuenta. Esperaba: La pre-cuenta con su código de caja y el total.. Pasó: pedir la cuenta: locator.click: Timeout 45000ms exceeded. Call log: [2m - waiting for getByRole('button', { name: /^Mesa abierta\b/ }).visible().last()[22m
- **D1-118** (medio/prueba, repetición) · caja · Caja: Un paso de la caja. Esperaba: El paso termina sin error. Pasó: Error: expect(locator).toBeVisible() failed Locator: getByText('¿Separar mesas o dejarlas unidas?').or(getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' })).first()
- **D1-119** (medio/rendimiento) · caja · Caja → Cierre diario: cerrar la caja. Esperaba: Responder en menos de 3 s. Pasó: Tardó 22.0 s
- **D1-120** (medio/rendimiento) · caja · Caja → Cierre diario: cerrar la caja. Esperaba: Responder en menos de 3 s. Pasó: Tardó 16.8 s
- **D1-001** (bajo/rendimiento) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-003** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-004** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-006** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-010** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-011** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-012** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-015** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-016** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-018** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-019** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-020** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-023** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-025** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-026** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-027** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-028** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-029** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-032** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-033** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-034** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-035** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-036** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-037** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-038** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-039** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-040** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-043** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-044** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-045** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-046** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-047** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-048** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-049** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-050** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-052** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-053** (bajo/rendimiento) · comensal · Portal del comensal: Pedir la cuenta con 10 % de propina. Esperaba: Responder en menos de 3 s.. Pasó: pedir la cuenta por el portal (lento)
- **D1-055** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-059** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-064** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-067** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-074** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-075** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-076** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-077** (bajo/rendimiento) · mesero · Mesero · mesa 19: Solicitar cuenta. Esperaba: Responder en menos de 3 s.. Pasó: pedir la cuenta (lento)
- **D1-078** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-080** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-082** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-083** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-084** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-085** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-086** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-087** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-088** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-092** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-093** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-094** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-096** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-099** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)
- **D1-102** (bajo/rendimiento, repetición) · comensal · Portal del comensal: Llamar a mi mesero para confirmar. Esperaba: Responder en menos de 3 s.. Pasó: llamar al mesero (lento)

## Tiempos por acción (segundos reales)

| Acción                                                 |   n |    p50 |    p95 |    máx |
| ------------------------------------------------------ | --: | -----: | -----: | -----: |
| abrir mesa                                             |  65 |  0.6 s |  0.7 s |  0.9 s |
| agregar al portal (porcion_contenedor)                 |   5 |  0.7 s |  1.0 s |  1.0 s |
| agregar al portal (precio_fijo)                        | 321 |  0.7 s |  1.5 s |  2.7 s |
| agregar al portal (variable_medida)                    |  40 |  0.7 s |  1.3 s |  1.6 s |
| agregar porcion_contenedor                             |   5 |  0.5 s |  0.5 s |  0.5 s |
| agregar precio_fijo                                    | 425 |  0.2 s |  1.1 s |  1.9 s |
| agregar variable_medida                                |  39 |  0.5 s |  0.7 s |  0.7 s |
| almacen:conteo físico de Leche de prueba con faltante  |   1 |  3.5 s |  3.5 s |  3.5 s |
| almacen:intentar comprar 40 pieza de Pan de prueba     |   1 |  1.5 s |  1.5 s |  1.5 s |
| almacen:registrar merma de Leche de prueba             |   1 |  3.4 s |  3.4 s |  3.4 s |
| almacen:registrar merma de Pan de prueba               |   1 |  3.3 s |  3.3 s |  3.3 s |
| almacen:registrar merma de Tortilla de prueba          |   1 |  3.2 s |  3.2 s |  3.2 s |
| atender ayuda                                          |  36 |  0.2 s |  0.2 s |  0.3 s |
| caja:abrir la caja                                     |   2 |  0.6 s |  0.6 s |  0.6 s |
| caja:abrir la cuenta pendiente                         | 114 |  2.7 s |  2.9 s |  3.1 s |
| caja:abrir una parte de la cuenta dividida             |  23 |  0.7 s |  1.0 s |  1.0 s |
| caja:aplicar un descuento con PIN                      |  41 |  1.1 s |  1.3 s |  1.4 s |
| caja:armar el pedido para llevar                       |  88 |  0.8 s |  1.1 s |  1.2 s |
| caja:cerrar la caja                                    |   2 | 16.8 s | 22.0 s | 22.0 s |
| caja:cobrar con Efectivo                               |  94 |  1.0 s |  1.2 s |  1.5 s |
| caja:cobrar con Mixto                                  |  39 |  1.1 s |  1.5 s |  1.8 s |
| caja:cobrar con Tarjeta                                |  52 |  1.0 s |  1.2 s |  1.3 s |
| caja:cobrar con Transferencia                          |  24 |  1.1 s |  1.2 s |  1.2 s |
| caja:dividir en 2 cuentas                              |   4 |  0.1 s |  0.2 s |  0.2 s |
| caja:dividir en 3 cuentas                              |   5 |  0.2 s |  0.3 s |  0.3 s |
| caja:registrar un retiro                               |   9 |  0.4 s |  4.2 s |  4.2 s |
| caja:registrar una entrada de cambio                   |   2 |  0.1 s |  0.4 s |  0.4 s |
| caja:traer la caja a este aparato                      |   1 |  0.3 s |  0.3 s |  0.3 s |
| cambiar de mesa                                        |  22 |  1.2 s |  1.6 s |  1.7 s |
| conectar teléfono                                      |   2 |  0.6 s |  0.8 s |  0.8 s |
| confirmar pedido del portal                            | 108 |  1.1 s |  1.3 s |  1.5 s |
| dueno:abrir el Tablero                                 |   1 |  1.4 s |  1.4 s |  1.4 s |
| entrar a la mesa                                       | 123 |  0.0 s |  0.2 s |  0.6 s |
| enviar a cocina                                        | 123 |  0.7 s |  0.8 s |  1.0 s |
| escanear el QR                                         | 147 |  0.5 s |  1.0 s |  1.4 s |
| gerente:comprar 10 litro de Pulque de prueba           |   1 |  2.4 s |  2.4 s |  2.4 s |
| gerente:comprar 200 pieza de Tortilla de prueba        |   1 |  2.7 s |  2.7 s |  2.7 s |
| gerente:comprar 8 kg de Carne de prueba                |   1 |  3.3 s |  3.3 s |  3.3 s |
| gerente:marcar agotado Flan de prueba                  |   1 |  2.1 s |  2.1 s |  2.1 s |
| gerente:registrar el gasto «Garrafones de agua»        |   1 |  1.8 s |  1.8 s |  1.8 s |
| gerente:registrar el gasto «Gas del día»               |   1 |  1.9 s |  1.9 s |  1.9 s |
| gerente:registrar el gasto «Servilletas y desechables» |   1 |  1.5 s |  1.5 s |  1.5 s |
| gerente:volver a surtir Flan de prueba                 |   1 |  2.0 s |  2.0 s |  2.0 s |
| listo                                                  | 406 |  0.1 s |  0.1 s |  0.3 s |
| listo (teléfono)                                       | 214 |  0.1 s |  0.1 s |  0.3 s |
| llamar al mesero                                       | 108 |  5.7 s |  6.3 s |  7.6 s |
| marcar agotado                                         |   1 |  0.6 s |  0.6 s |  0.6 s |
| marcar entregado                                       | 231 |  1.1 s |  1.3 s |  1.7 s |
| pedir ayuda                                            |  13 |  0.5 s |  0.6 s |  0.6 s |
| pedir la cuenta                                        |  65 |  2.2 s |  2.9 s |  3.5 s |
| pedir la cuenta por el portal                          |  51 |  1.5 s |  2.6 s |  3.2 s |
| preparar                                               | 537 |  0.1 s |  0.1 s |  0.4 s |
| preparar (teléfono)                                    | 120 |  0.1 s |  0.1 s |  0.2 s |
| quitar agotado                                         |   1 |  0.6 s |  0.6 s |  0.6 s |
| quitar platillo                                        |  19 |  1.2 s |  1.4 s |  1.4 s |
| unir mesas                                             |  13 |  0.6 s |  0.9 s |  0.9 s |
| vaciar el carrito                                      | 123 |  0.1 s |  0.2 s |  0.2 s |
