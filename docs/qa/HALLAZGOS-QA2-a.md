# HALLAZGOS QA2-a · caja, dinero y cocina · jornada del 07-11-2026 (DP-14, ronda 2)

**Qué es esto.** Lo que encontró QA-A al simular un día de caja en la COPIA desechable `qa_dp14` (app compilada del commit `2c0f5ad` en el 3261; exportación de producción del 7-11 de `don-poncho`). QA-A no arregla código: mide y reporta. Se escribió sólo en la copia y por la aplicación (la única lectura directa fue SQL de sólo lectura y `docs/qa/consultas-qa2.sql`). La bitácora completa, con el «debería mostrar» de cada acción, está en `docs/qa/JORNADA-2026-11-07-a.md`; las specs, en `pruebas/e2e/qa/qa2-a-*.spec.ts`.

**Resultado.** Ningún hallazgo dinerario, de seguridad ni de integridad: **cero bloqueantes, cero medios, tres bajos y dos informativos.** Las diez escenas del encargo corrieron; los cortes de las dos cajas, el Cierre del día, Ventas y la base cuadraron al centavo (21 comparaciones, 0 diferencias) y las 34 consultas de «VIOLACIÓN» de `consultas-qa2.sql` dieron 0 filas.

## Hallazgos

### QA2-A1 · baja · «Quitar un platillo» dice el peso como «0.25 ×», no «¼ kg»

- **Cómo reproducirlo.** Mesero 1 (tableta), mesa 5: agrega ¼ kg de «Barbacoa de horno» (peso 0.25) y otros platillos, manda a cocina; toca la mesa → «Quitar un platillo».
- **Se esperaba.** El peso con su fracción, como lo dicen la cocina, el cobro, el ticket y Ventas (DP-D73): «¼ kg × Barbacoa de horno».
- **Pasó.** La lista dice «Quitar 0.25 × Barbacoa de horno» (el botón y su `aria-label`). Un platillo por pieza dice «2 × Tlacoyo de frijol». Es la única pantalla donde el peso sale como número crudo (`descripcionDelRenglon` en `cancelar-del-mesero.ts` no usa el formateador de peso). Reproducido dos veces (una sonda y la escena 5).
- **Evidencia.** `docs/qa/evidencia/qa2-a-5-2-lista-quitar-con-peso.png`, `qa2-a-5-2-lista-quitar.png`, `qa2-a-5-2-quitar-barbacoa.png`.

### QA2-A2 · baja · Cobrar las partes de una cuenta dividida deja la mesa en «Limpieza» y eso NIEGA el cierre

- **Cómo reproducirlo.** Mesa 3 con 2 Mole, guacamole, 2 Coca y pastel, todo servido; la Caja la divide en 3 partes, cancela la parte 3 (con el PIN de la gerente) y cobra las partes 1 y 2. Revisa la mesa y toca «Cierre diario» en /caja.
- **Se esperaba.** Que la mesa vuelva al servicio como pasa con una cuenta sin dividir (la mesa 3, cobrada entera en la escena de descuentos, se pudo abrir de nuevo en la escena siguiente), o que el cierre no se niegue por ella.
- **Pasó.** La mesa queda en «limpieza» (se miró 10 s y varios minutos después). El «Cierre diario» responde «No puedes cerrar caja · Hay mesas pendientes… Mesa 3 · Estado: Limpieza · [Marcar libre] [Entendido]». Con «Marcar libre» sigue sin problema. Visto en dos corridas del cierre. Es fricción, no pérdida de dinero.
- **Evidencia.** `docs/qa/evidencia/qa2-a-10-cierre-negado-por-limpieza.png`, `qa2-a-6-5-despues-de-cobrar-las-partes.png`.

### QA2-A3 · baja · Aplicar un descuento deja la propina «pendiente» con un texto que no es: «Cliente no eligió propina en QR»

- **Cómo reproducirlo.** Mesa de salón con la cuenta pedida por el mesero; en la Caja se abre el cobro y se contesta «¿Desean agregar propina?» (10 % o «Sin propina»); se toca «Descuento», se autoriza con el PIN de la gerente y se aplica; luego se intenta «Cobrar».
- **Se esperaba.** Que la propina ya decidida siga decidida (recalculada sobre el nuevo total, como se ve al final), o que el aviso diga la verdad.
- **Pasó.** Tras el descuento, el cobro muestra un aviso ámbar «Cliente no eligió propina en QR — toca para definirla» (la cuenta no vino del QR; la propina sí se había decidido) y «Cobrar» no manda el cobro hasta definirla otra vez (sale «Define la propina antes de cobrar»). Una vez definida, la propina SÍ queda sobre lo descontado (10 % de $291.60 = $29.16, y el ticket suma). Reproducido en las mesas 2, 3 y 4. El dinero sale bien; lo malo es el texto y la repetición.
- **Evidencia.** `docs/qa/evidencia/qa2-a-4b-1-cobro-con-descuento.png`.

### QA2-A4 · info · El renombrado de una caja no aparece en Registros

- **Cómo reproducirlo.** Configuración → Caja (dueño): renombra una caja; abre Registros.
- **Se esperaba.** (Brief: «queda en Registros/auditoría».)
- **Pasó.** Sí queda en la auditoría de la base (`caja.nombrar_terminal`, con `antes: "Caja 10"` y `despues: "Mostrador QA"`), pero ninguna pestaña de Registros (Cortes, Ventas, Cancelaciones, Propinas, Compras, Movimientos, Gastos) lo muestra. Sólo se leyó en la base.
- **Evidencia.** `docs/qa/evidencia/qa2-a-2-5-registros.png`.

### QA2-A5 · info · Registros dice «9 ventas» arriba y «Ventas (13)» en la pestaña

- **Cómo reproducirlo.** Después de la jornada (9 cobradas, 3 canceladas, 1 dividida), Registros → periodo «Hoy».
- **Pasó.** El resumen dice «9 ventas» y $3,295.80; la pestaña «Ventas (13)» cuenta también las canceladas y la dividida. Puede ser a propósito; se anota porque dos números distintos para «ventas» en la misma pantalla confunden. SIN CONFIRMAR como defecto (una sola observación, no se buscó el criterio del conteo).
- **Evidencia.** `docs/qa/evidencia/qa2-a-10-registros-cortes.png`.

## Lo que SÍ funcionó (10 escenas, 64 chequeos de pantalla en SÍ en su última corrida)

1. **Dos cajas (cupo 2)** · 8 chequeos: «Caja» abre en la PC y «Gerente» en la tableta; el aparato sin caja y con cupo lee «No hay caja abierta en este aparato · Abrir caja» (también el de la gerente aunque la otra caja ya estaba abierta, sin «Traer»); el dueño, tercero, lee EN PANTALLA «Ya hay 2 cajas abiertas: cierra una» y «Traer esta caja aquí» con «Sí, traerla» / «No»; «No» no movió nada y su «Abrir caja» no mandó ninguna apertura.
2. **Configuración → Caja** · 8: el dueño ve la pestaña, nombra cada caja («Mostrador QA», «Barra QA»), un nombre repetido se rechaza con aviso, queda en la auditoría con antes y después y el banner del tercero ya dice «La caja está abierta en «…»»; el gerente NO ve «Caja» ni «Descuentos» y el servidor le contesta 403 al nombrar y al fijar el cupo.
3. **Barbacoa por kilo** · 7: ½ kg y 1.5 kg se guardaron exactos ($397.50 y $1,192.50), la comanda dice «½ kg» y «1.5 kg», y lo mismo el cobro de la Caja, el ticket, la reimpresión y el Detalle de Ventas; cobro de $1,684.00 + propina $168.40, cambio $147.60.
4. **Descuentos** · 10: apagados no hay botón; encendidos, Configuración → Descuentos dice los topes REALES (gerente 30 % o $2,000.00 · administrador 50 % o $5,000.00 · dueño 100 % o $1,000,000.00; la copia no trae filas, rige el respaldo del sistema); 10 % con el PIN de la gerente: Subtotal $324.00, «Descuento −$32.40», «Autorizó Gerente · Cliente frecuente QA», total $291.60, ticket y reimpresión suman; 40 % → «Autoriza hasta 30 %» y no deja aplicar; PIN firmado para $30 usado para $40 → 422, el diálogo borra la autorización y pide el PIN otra vez; el mismo PIN gastado dos veces → rechazo; reemplazo → «Reemplaza el descuento de $30.00», el «Autorizó» pasa a «Dueño Don Poncho» y el descuento a −$45.00 (cobro y ticket de $255.00).
5. **Quitar un platillo** · 5: lo quitado no se cobra (cobro y ticket sólo traen lo cobrado, $68.00) y sale «Quitado» con su peso en el Detalle de Ventas; el Cierre del día lo cuenta como cancelación con pérdida porque ya había salido de cocina.
6. **Dividir y cancelar UNA parte** · 6: 3 partes ($132.00, $155.00, $67.00) que suman la cuenta; las 3 salen en «Pendientes» de las dos cajas; la parte 3 se cancela con el PIN de la gerente (primero lo rechaza sin PIN); las partes 1 y 2 se cobraron, una desde cada caja; el corte y el Cierre lo dicen.
7. **Cancelar con la cocina sin respuesta** · 4: el mesero (teléfono de 360 px) debe pedir el PIN de un gerente; la gerente teclea SU propio PIN (aparece primero en «Quién autoriza») y cancela; ambas quedan como pérdida completa en el Cierre del día.
8. **Otra caja ya cobró** · 3: el servidor rechaza el segundo cobro («Ya se cobró en Mostrador QA.», HTTP 422), el diálogo se cierra, «Pendientes» se relee, y hay UN pago.
9. **Red caída a medias** · 7: cortada antes de llegar, no hay nada en la base y la pantalla no dice «enviado»; cortada DESPUÉS de llegar, la pantalla avisa «No llegó la respuesta del servidor y puede que sí se haya hecho. Vuelve a tocar el mismo botón: si ya estaba hecho, no se repite», y al reintentar no se duplica (3 líneas, no 6); el cobro con la respuesta perdida cobró una vez y el reintento devolvió el mismo folio con 200, sin segundo pago.
10. **Cierre del día** · 21 comparaciones, 0 diferencias: cortes de las dos cajas (tickets, ventas, efectivo, tarjeta, propinas, efectivo esperado en el cajón), diferencia 0 y +$20.00, alcance «dia», 4 cancelaciones por $430.75 de pérdida, «Cobrado» de Ventas $3,295.80; `consultas-qa2.sql`: **34 de 34 «violaciones» sin filas** (salida en `docs/qa/evidencia/qa2-a-consultas-qa2-salida.txt`, con `aud0 = 4554`).

## Cosas que se midieron y no son hallazgos

- Un platillo quitado DESPUÉS de que la cocina lo dejó listo cuenta como pérdida en el Cierre del día (cuarta fila, tipo «línea»): es lo que dice la regla y la pantalla avisa «Ya salió de cocina».
- Recargar la página del mesero con el carrito sin enviar vacía el carrito (vive en el aparato): no es defecto, pero quien recarga a medias pierde lo armado.
- Una mesa pedida con «Sin propina» al abrir el cobro y vuelta a abrir (Escape) no vuelve a hacer la pregunta sola; sale el aviso ámbar. Es el mismo comportamiento de QA2-A3.

## Lo que no se probó

Ver la sección 5 de `docs/qa/JORNADA-2026-11-07-a.md` (el «Sí, traerla» llevado hasta el final; el tope por monto; descuentos en tableta y teléfono; pagos mixtos y por transferencia; impresoras y sonido; una caída real del servidor).
