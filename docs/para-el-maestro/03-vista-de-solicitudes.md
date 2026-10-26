# 03 · La vista «Solicitudes» dentro de Mesas (DP-9.3)

## Qué hace y por qué

Miguel: «quiero una pantalla que sólo enseñe las solicitudes, para dejar una tablet ahí; y que
la voz no hable en todas las pantallas». Además: la caja no tiene por qué verlas.

- Arriba de las zonas de Mesas, un selector Mesas / Solicitudes. «Solicitudes» es la pantalla
  entera: mesa, tipo, hace cuánto y «Atender». El aparato recuerda la vista: sirve de estación.
- La voz de las solicitudes suena sólo en esa vista. Antes la soltaba `SolicitudesQRWatcher`
  (global, en `AppLayout`) en cualquier pantalla del mesero y del dueño/gerente que no la
  silenciara; ahora ese vigilante sólo enseña el aviso visual.
- La caja ya no lee ni atiende las solicitudes en el servidor (puente y comandos). La cocina
  tampoco las lee.

## Archivos

| Archivo                                                                 | Qué                                                        |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/web/src/restaurante/vista-de-solicitudes.ts` (+test)              | Hace cuánto, orden, qué anunciar, vista del aparato        |
| `apps/web/src/restaurante/VistaDeSolicitudes.tsx`                       | La lista, con la voz sólo ahí                              |
| `apps/web/src/restaurante/SelectorDeVista.tsx`                          | Mesas / Solicitudes                                        |
| `apps/web/src/restaurante/IconoDeSolicitud.tsx`, `atender-solicitud.ts` | Compartidos con los globos de DP-9.2                       |
| `apps/web/heredado/pages/Mesero.jsx`                                    | Selector, vista y anuncio en voz; sale el botón y el modal |
| `apps/web/heredado/components/common/SolicitudesQRWatcher.jsx`          | Sin sonido ni voz                                          |
| `apps/web/heredado/components/mesero/SolicitudesQRPanel.jsx`            | Borrado                                                    |
| `packages/app/src/restaurante/solicitudes.ts`                           | `ROLES_DE_SOLICITUDES` (sin caja)                          |
| `packages/app/src/puente/mapa.ts`                                       | `SolicitudQR` la leen dirección y mesero                   |
| `packages/app/src/restaurante/solicitudes-sin-caja.integracion.test.ts` | La caja negada en el servidor                              |
| `pruebas/e2e/vista-de-solicitudes.spec.ts`                              | Navegador, con la voz espiada                              |
| `pruebas/e2e/matriz-de-permisos.json`, `aislamiento.json`               | Regenerados                                                |
| `scripts/aspecto-permitido.json`, `scripts/verificar-adopcion.mjs`      | Declaraciones                                              |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Todo genérico. Si en el maestro algún giro necesita que la caja vea las solicitudes (una cafetería
sin meseros donde la caja atiende), se decide allá con un rol o una bandera; aquí la caja no.

## Cómo portarlo

1. Copiar los archivos de `src/restaurante` y la prueba de integración.
2. Cambiar los roles del puente y de los dos comandos; regenerar la matriz y el aislamiento.
3. En `Mesero.jsx`: selector arriba de las zonas, la vista y `anunciarSolicitudes`; quitar el
   botón y el modal. En `SolicitudesQRWatcher.jsx`: quitar el sonido y la voz.
4. Correr unidad, integración y la e2e.
