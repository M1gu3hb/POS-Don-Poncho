# Progreso DP-16 · para llevar, opciones con precio, cocina con volumen, teléfono de cocina, menú del comensal

> Si la sesión se corta o se compacta, **lo primero es releer este archivo** y seguir desde «Lo que
> sigue». Sin secretos ni PIN aquí: viven en `..\_PRIVADO\`.

- **Ramas:** `dp-16` (Parte 1, ya en `main` con el squash `8f271a2` del PR #17, que absorbió el #16)
  y `dp-16-2` (Parte 2, sale de `dp-16` y lo trae mezclado).
- **Fecha límite:** jueves 12-11-2026 en la noche en producción. Instalación: sábado 14-11.
- **Base de pruebas local:** clúster de desarrollo `127.0.0.1:55433`, base `dp16_pruebas` (migrada
  hasta la 192). La URL vive en `D:\mpos-tmp\dp16-url.txt` (sin secretos en el repo). La demo
  `dp16_demo` (servidor de desarrollo en el 3300) también va en la 192.
- **Skills:** code-review, testing-strategy, debug y morphiq-prs cargadas; «frontend-design» no
  existe con ese nombre: se usó `impeccable` (su equivalente).

## Estado por parte

| Parte | Qué | Estado |
| --- | --- | --- |
| 1.1 | Para llevar desde caja (migración 191, armar/descartar/entregar, número del día, cocina por canal, ticket, corte por canal, Registros y CSV) | hecho (`6c02c94`): integración 8/8, 7 mutantes, probado de punta a punta en el navegador |
| 1.2 | «Marcar entregado» del mesero | hecho (agente A, integrado; DP-D103): 360 y 412 px, botón 48 px a todo lo ancho |
| 1.3 | Animaciones de las ventanas | hecho (agente A, integrado; DP-D103): crece desde el toque, 200 ms |
| 1.4 | Retiros con PIN arriba de un monto | hecho (agente B, integrado; DP-D101) |
| 1.5 | Menores de la auditoría del 9-11 | hecho (agente B, integrado; DP-D102) |
| 1 · producción | PR #17, CI 10/10, la 191 en la propia, merge, `READY`, humo, ceros | hecho el 10-11: la 191 a las 03:46 (ensayo y luego en serio, por la de sesión), contrato 1752 columnas y RLS cerrado, merge `8f271a2`, `READY` 03:47, ceros 03:49, humo 03:53 (entrada y portal 200 sin desborde en 6 y 5 aparatos, 8 a la vez en 3.1 s); Vercel sin errores hasta las 04:49 |
| 2.1 | Opciones con precio y productos por peso | en curso en `dp-16-2`: servidor (`996688e`), pantalla del mesero, para llevar y carrito (`beeda85`); ticket, portal, «sólo presentaciones» y corte sin commit; editor de grupos con el agente D |
| 2.2 | Cocina con volumen | agente C (Sonnet) |
| 2.3 | Teléfono de cocina nuevo | pendiente |
| 3 | Menú del comensal: digital y a la carta | pendiente |
| 4 | QA final, producción y reporte 010 | pendiente |

## Lo que sigue

1. 2.1: terminar (tipos, lint, integración y mutantes de lo de hoy), integrar al agente D (editor de
   grupos en Productos), probar en el navegador el mesero, el portal, el ticket y el corte.
2. 2.2: integrar al agente C (cocina con volumen). 2.3: teléfono de cocina.
3. DECISIONES DP-D104+, ficha 38 (192), PR de la Parte 2, la 192 en la propia, merge y humo.
