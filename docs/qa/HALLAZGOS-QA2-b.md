# Hallazgos de QA2-B · 7 de noviembre de 2026

Parte B (usuarios, mesas y portal), copia desechable de Don Poncho. Resultado: **ningún defecto bloqueante ni medio**; 36 escenas pasan (ver `JORNADA-2026-11-07-b.md`). Lo que sigue son observaciones, todas reproducidas dos veces o más.

## QA2-B1 · info · Dos toques casi simultáneos a platillos con opciones: sólo uno abre su diálogo

- **Cómo reproducirlo:** mesa abierta, tableta de Mesero 1; con `force` y sin esperar, dos clics concurrentes sobre «Quesadilla» y «Licuado» (`qa2-b-03-opciones-rapidas.spec.ts`, escena 2).
- **Se esperaba:** que ninguno de los dos se pierda.
- **Pasó:** se abrió sólo el diálogo del Licuado y la quesadilla no entró. Un dedo real tampoco puede tocar el segundo platillo, porque el velo del primer diálogo lo cubre, así que es un límite del gesto y no una pérdida de la aplicación. Cuando los dos toques llegan en la misma pasada del navegador SÍ se encolan: dos diálogos, uno tras otro, y los dos quedan en el pedido con su opción y su nota (escena 1). El mismo platillo dos veces tampoco se pierde y el segundo diálogo empieza limpio, sin opción ni nota (escena 3); un doble clic en la misma pasada agrega dos quesadillas (escena 4).
- **Evidencia:** `docs/qa/evidencia/qa2-b-opciones-dos-platillos.png`, `qa2-b-opciones-toques-rapidos.png`, `qa2-b-opciones-segundo-dialogo.png`.

## QA2-B2 · info · «Nueva mesa» no reutiliza el número de una mesa quitada del mapa

- **Cómo reproducirlo:** crear una mesa nueva (queda la 11), «Quitar del mapa», crear otra: nace con el 12, luego el 13 (`qa2-b-02-mesas.spec.ts`).
- **Se esperaba:** (a criterio) el número libre más bajo, o que la pantalla lo diga.
- **Pasó:** el siguiente número cuenta también las mesas quitadas, y la mesa quitada conserva a su mesero asignado (en la copia quedaron la 11, 12 y 13 inactivas con Mesero 3). No rompe nada hoy (una mesa inactiva no se ve), pero deja números saltados.
- **Evidencia:** `docs/qa/evidencia/qa2-b-mesera-entra-a-su-zona.png`.

## QA2-B3 · info · La pantalla no tiene dónde crear una zona, y el puente deja repetir el nombre

- **Cómo reproducirlo:** Configuración → Mesas sólo ofrece las zonas que ya existen; la prueba tuvo que crear «Barra QA» por `/api/datos/escribir` (entidad `Zona`). Crearla tres veces seguidas (con las anteriores apagadas) también se acepta.
- **Se esperaba:** una forma de dar de alta una zona en pantalla y, a lo sumo, un nombre único entre las activas.
- **Pasó:** sólo existe por el puente; hay tres «Barra QA» apagadas en la copia. No afecta lo probado (la mesera entra a la zona de SUS mesas).
- **Evidencia:** `docs/qa/evidencia/qa2-b-mesas-repartidas.png` (pestañas de zona en el mapa).

## QA2-B4 · info · La copia traía una caja abierta

- **Cómo reproducirlo:** `select id, estado, abierta_en from sesiones_caja` en `qa_dp14_b`: la sesión `17000000-0000-4000-8000-000000000002` está abierta desde las 13:27 del 7-11, y el encargo decía 0 abiertas. Ocupa un cupo de los dos; las escenas con caja abrieron y cerraron la suya sin problema.

## Lo que SÍ se verificó y funciona (sin hallazgo)

- **Usuarios, en teléfono 360 px y en tableta:** el dueño se edita (nombre y PIN) y entra con el nuevo; no puede cambiarse el puesto ni darse de baja (ni en el diálogo ni por la ruta: 422); renombrar a «Gerente» la deja gerente con su tope de 30 % o $2,000.00 y no le cierra la sesión de otro aparato; el PIN de otra persona se cambia desde la pantalla y se devuelve; se crean un mesero y un cajero y entran; desactivar pide confirmación, «Ver desactivados» y «Reactivar» funcionan y la persona desactivada sale de la pantalla de acceso; el dueño ve los siete puestos, un administrador sólo cinco y no edita dueños (ni en pantalla ni por la ruta); la gerente no ve lápices y la ruta le rechaza (403); el color no cambia al renombrar (ni el punto ni el guardado), aun cambiando su lugar en la lista.
- **Mesas con la asignación encendida:** «Repartir mesas» asigna varias de una vez; al desactivar a un mesero sus mesas quedan sin asignar y las ven los demás («Sin mesero»); un mesero sin mesas y sin mesas libres lee «Pide al dueño o al gerente que te asigne mesas»; la mesera entra a la zona de SUS mesas.
- **Portal:** el globo «Pedido listo para confirmar» de un carrito caducado se resuelve en el mapa del mesero sin que ningún teléfono sondee; «Tu pedido se borró…» lo lee el teléfono que tenía el pedido y no la familia nueva; una familia nueva se sienta en una mesa en limpieza, arma su pedido y lo envía abriendo la mesa.
- **`consultas-qa2.sql`:** 34 consultas de violación, 0 filas (`evidencia/qa2-b-consultas-qa2-salida.txt`).
