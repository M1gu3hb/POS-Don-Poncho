# Progreso DP-16 · para llevar, opciones con precio, cocina con volumen, teléfono de cocina, menú del comensal

> Si la sesión se corta o se compacta, **lo primero es releer este archivo** y seguir desde «Lo que
> sigue». Sin secretos ni PIN aquí: viven en `..\_PRIVADO\`.

- **Ramas:** `dp-16` (Parte 1, en `main` con el squash `8f271a2` del PR #17, que absorbió el #16),
  `dp-16-2` (Parte 2, en `main` con el squash `2e8da35` del #18) y `dp-16-3` (Parte 3).
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
| 2.1 | Opciones con precio y productos por peso | hecho en `dp-16-2`: servidor (`996688e`), pantalla (`beeda85`, `367e8cc`) y el editor de grupos del agente D (`706d98c`); integración 8/8 + 5/5, en el navegador la Caja (para llevar con barbacoa «sólo presentaciones» + tortillas de harina y quesadilla con queso: $457.50, ticket con cada opción y su precio), el portal a 360 px y el editor del dueño |
| 2.2 | Cocina con volumen | hecho (agente C, `d0fb765`, DP-D105): de 967 KB a 62 KB por refresco; en el navegador a 1080p |
| 2.3 | Teléfono de cocina nuevo | hecho (agente E, `8d5d522`, DP-D106); en el navegador en Android 360 y 412 y en iPhone (WebKit): sin desborde, botones de 62 px, tira, carrusel y opciones aparte de la nota |
| 2 · producción | PR #18, CI 10/10, la 192 en la propia, merge, `READY`, humo, ceros | hecho el 10-11: la 192 a las 07:05, merge `2e8da35`, `READY`, ceros y humo 07:07; Vercel una hora después: pendiente (08:07) |
| 3 | Menú del comensal: digital y a la carta | hecho en `dp-16-3` (DP-D107): el menú digital, «a la carta», el modo en Configuración → QR y el fondo de la tarjeta; 8 mutantes muertos; capturas en Android 360, iPhone y tableta, con y sin fotos, sin desborde ni objetivos de menos de 44 px (`D:\mpos-tmp\dp16\laminas\`, fuera del repositorio), enviadas a Miguel; sin migración (la columna venía en la 192). Falta el PR y producción |
| 4 | QA final, producción y reporte 010 | pendiente |

## Lo que sigue

1. Parte 3: `verify` completo, PR, CI, merge, `READY`, humo, ceros y Vercel una hora; comprobar que
   Don Poncho sigue en «Páginas subidas» en producción.
2. Parte 4: QA con dos agentes Sonnet en copias de la propia de hoy (`qa_dp16_j` y `qa_dp16_d` en
   el 5460, exportación `_PRIVADO\mudanza6-11-10-dp16-propia-qa`; guiones y encargos en
   `D:\mpos-tmp\dp16\qa\`; la app compilada desde el worktree `dp15-codigo`); jornada cuadrada al
   centavo en `docs/qa/JORNADA-2026-11-10.md`; arreglos con prueba y mutante; humo final y reporte
   `docs/reports/010-para-llevar-cocina-menu.md`.
