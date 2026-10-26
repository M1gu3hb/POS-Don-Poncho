# 02 · El portal sin asignación de mesas y los globos de solicitud (DP-9.2)

## Qué hace y por qué

Miguel: «Don Poncho no asigna mesas; con el portal así, el comensal no puede pedir. Y quiero ver
sobre cada mesa lo que pidieron, no en una lista aparte».

- Con la asignación de mesas APAGADA el comensal abre su mesa desde el QR, pide y llama al
  mesero. Configuración deja encender «Permitir que el comensal envíe pedidos desde el QR» en los
  dos modos.
- Con la asignación ENCENDIDA nada cambia: una mesa sin mesero asignado sigue cerrada al QR.
- La cuenta que abre el comensal nace a nombre de quien ya tomó la mesa, o de nadie. El MESERO
  que atiende un aviso de esa mesa, o que la toma desde su pantalla, se queda con la mesa y con su
  cuenta (propina y corte). Nunca le quita la mesa a otro; un gerente o la caja no se la quedan.
- En la pantalla del mesero cada solicitud pendiente es un globo sobre su mesa (Ayuda, Cuenta,
  Ordenar), con icono, texto y tono; hasta tres apilados y «+N más». Tocarlo la atiende.

## Archivos

| Archivo                                                                            | Qué                                                         |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/app/src/portal/negocio.ts`                                               | `puedeOrdenarDesdeQR` sin la asignación; `faltaMesero`      |
| `packages/app/src/portal/mesa.ts`                                                  | Abrir sin mesero asignado; cuenta a nombre de quien la tomó |
| `packages/app/src/portal/consulta.ts`, `ambito.ts`                                 | `puede_abrir`/`puede_pedir` con `faltaMesero`               |
| `packages/app/src/restaurante/responsable-de-la-mesa.ts`                           | `quedarseConLaMesa`: mesa y cuenta, sólo si no tienen dueño |
| `packages/app/src/restaurante/solicitudes.ts`                                      | `atender_solicitud` y `asignar_mesero` la llaman            |
| `packages/app/src/portal/sin-asignacion.integracion.test.ts`                       | Nueve casos contra Postgres                                 |
| `apps/web/src/restaurante/globos-de-solicitud.ts` (+test), `GlobosDeSolicitud.tsx` | Los globos                                                  |
| `apps/web/heredado/components/mesas/MesaShape.jsx`                                 | Hueco `globos` en la mesa del plano                         |
| `apps/web/heredado/components/mesero/MesaGridMobile.jsx`                           | `globosDe` sobre la tarjeta del teléfono                    |
| `apps/web/heredado/pages/Mesero.jsx`                                               | Agrupa las solicitudes por mesa y pinta los globos          |
| `apps/web/heredado/pages/PortalCliente.jsx`                                        | `faltaMesero` sólo con la asignación encendida              |
| `apps/web/heredado/pages/Configuracion.jsx`                                        | El interruptor de pedidos ya no depende de la asignación    |
| `scripts/aspecto-permitido.json`, `scripts/verificar-adopcion.mjs`                 | Declaraciones de las pantallas heredadas tocadas            |
| `pruebas/e2e/portal-sin-asignacion.spec.ts`                                        | Navegador, en escritorio, tablet y teléfono                 |
| `pruebas/e2e/ayudantes/mesas-heredadas.ts`                                         | `prepararElPortalDelComensal` acepta `mesero: null`         |

## Migraciones

Ninguna. Usa columnas que ya existen (`mesas.empleado_atiende_id`, `ordenes.empleado_atiende_id`).

## Genérico o de Don Poncho

Todo genérico: el maestro tiene el mismo candado y la misma pantalla del mesero. Lo único de
Don Poncho es la configuración (asignación apagada, pedidos del comensal encendidos), que vive en
`configuracion.valores`.

## Cómo portarlo

1. Copiar `responsable-de-la-mesa.ts`, los dos archivos de globos y la prueba de integración.
2. Aplicar los cambios del portal (`negocio.ts`, `mesa.ts`, `consulta.ts`, `ambito.ts`) y de
   `solicitudes.ts`.
3. En las pantallas heredadas: el hueco de `MesaShape`, `globosDe` en `MesaGridMobile`, los
   globos en `Mesero.jsx`, `faltaMesero` en `PortalCliente.jsx` y el interruptor de
   Configuración.
4. Correr unidad, integración y la e2e (el ayudante del portal con `mesero: null`).
