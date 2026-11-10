# Progreso DP-16 · para llevar, opciones con precio, cocina con volumen, teléfono de cocina, menú del comensal

> Si la sesión se corta o se compacta, **lo primero es releer este archivo** y seguir desde «Lo que
> sigue». Sin secretos ni PIN aquí: viven en `..\_PRIVADO\`.

- **Rama:** `dp-16` (sale de `origin/dp-15-1-cierre`, `e979da2`: `main` + el cierre de DP-15.1 del PR #16).
- **Fecha límite:** jueves 12-11-2026 en la noche en producción. Instalación: sábado 14-11.
- **Base de pruebas local:** clúster de desarrollo `127.0.0.1:55433`, base `dp16_pruebas` (migrada
  hasta la 191). La URL vive en `D:\mpos-tmp\dp16-url.txt` (sin secretos en el repo).
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
| 2.1 | Opciones con precio y productos por peso | pendiente |
| 2.2 | Cocina con volumen | agente C (Sonnet) |
| 2.3 | Teléfono de cocina nuevo | pendiente |
| 3 | Menú del comensal: digital y a la carta | pendiente |
| 4 | QA final, producción y reporte 010 | pendiente |

## Lo que sigue

1. Integrar los parches de los agentes A y B (revisar, sus pruebas aquí, sus mutantes).
2. 1.1 en el navegador: la Caja con «Para llevar», cobrar, cocina, «listo», aviso y «Entregado».
3. DECISIONES DP-D98 en adelante, ficha 37 (migración 191), bitácora, PR de la Parte 1.
