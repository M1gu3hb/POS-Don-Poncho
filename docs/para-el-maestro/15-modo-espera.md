# 15 · El modo espera (DP-11.2)

## Qué hace y por qué

Una tableta de caja o de cocina pasa horas encendida con la misma pantalla: se quema, gasta
batería y deja a la vista las cuentas. Tras unos minutos sin tocar se pone una capa casi negra con
la hora del negocio, la fecha, el logo y Morfi dormido. Al tocar, Morfi despierta y la pantalla
vuelve **tal cual estaba** (es una capa: lo de abajo nunca se desmonta).

- Caja, Tablero y administración a los 3 minutos; Cocina a los 2. Nunca el mesero, el mapa, la
  mesa activa, el portal del comensal ni el teléfono de cocina.
- La despierta sola una comanda nueva (Cocina) o una cuenta pedida o un cobro (Caja). Cocina con
  comandas por preparar no se duerme.
- Por aparato, en Configuración → Este aparato: encendido y minutos.
- Por negocio, en Configuración → Apariencia: «Pedir PIN al despertar» (apagado por omisión).
- Pide Wake Lock para que el sistema no apague la pantalla antes.

## Archivos

| Archivo                                                                        | Qué                                                       |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `apps/web/src/espera/reglas.ts`                                                | Qué ruta es qué puesto, sus minutos y cuándo dormir       |
| `apps/web/src/espera/preferencia-del-aparato.ts`                               | Encendido y minutos de este aparato (`localStorage`)      |
| `apps/web/src/espera/despertador.ts`                                           | Lo que despierta y lo que mantiene despierta la pantalla  |
| `apps/web/src/espera/cambios-de-la-lista.ts`                                   | Qué cuentas llegaron y cuáles se fueron entre lecturas    |
| `apps/web/src/espera/reloj.ts`                                                 | La hora en la zona del negocio y el paseo contra quemado  |
| `apps/web/src/espera/use-modo-espera.ts`                                       | Cuenta la actividad, duerme, despierta, pide Wake Lock    |
| `apps/web/src/espera/use-despertador-de-caja.ts`                               | La Caja despierta con la lectura que ya hace              |
| `apps/web/src/espera/candado-del-pin.ts`                                       | El candado del PIN, en el aparato (sobrevive a recargar)  |
| `apps/web/src/espera/CapaModal.tsx`                                            | `<dialog>` modal: capa superior, lo de abajo inerte       |
| `apps/web/src/espera/ModoEspera.tsx`                                           | La capa: dormida, PIN o nada                              |
| `apps/web/src/espera/PantallaDeEspera.tsx`                                     | La hora, el logo y Morfi                                  |
| `apps/web/src/espera/PedirPinAlDespertar.tsx`                                  | El teclado del PIN, sin recargar                          |
| `apps/web/src/configuracion/ModoEsperaDelAparato.tsx`                          | La pestaña «Este aparato»                                 |
| `apps/web/src/configuracion/ExperienciaDelNegocio.tsx`                         | «Pedir PIN al despertar», junto a «Mascota Morfi»         |
| `packages/app/src/configuracion/experiencia.ts`                                | `pin_al_despertar` en `configuracion.valores`             |
| `packages/app/src/puente/configuracion.ts`                                     | Mezcla la experiencia interruptor por interruptor         |
| `packages/ui/src/estilos/base.css`, `apps/web/app/globals.css`                 | `--espera-fondo` y `--espera-texto`, iguales en todo      |
| `apps/web/heredado/components/common/AppLayout.jsx`                            | Monta `<ModoEspera ruta={pathname} />`                    |
| `apps/web/heredado/lib/POSAuthContext.jsx`, `src/restaurante/AccesoPorPin.tsx` | Quitan el candado al entrar con PIN y al cerrar la sesión |
| `apps/web/heredado/pages/Cocina.jsx`, `CocinaNuevoPedidoWatcher.jsx`           | Mantiene despierta y despierta la Cocina                  |
| `pruebas/e2e/modo-espera.spec.ts`                                              | Navegador con el reloj de Playwright, tres aparatos       |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico, salvo dos cosas: la zona de la hora (`ZONA_DEL_NEGOCIO` en `ModoEspera.tsx`, la de la
Ciudad de México; en el maestro debe salir del negocio) y las rutas de `reglas.ts`, que son las de
un restaurante. Otro giro suma las suyas.

## Cómo portarlo

Copiar `apps/web/src/espera/` y los dos componentes de configuración; añadir `pin_al_despertar` a
`experiencia.ts`; montar `<ModoEspera ruta={pathname} />` en el marco interno; en cada pantalla
que deba despertar o quedarse despierta, llamar a `despertarLaPantalla(motivo)` o
`mantenerDespierta(clave, si)`. El modo espera no conoce a las pantallas: ellas avisan. No la
hagas con un `div` y `z-index`: un diálogo de Radix abierto debajo se queda con los toques y el
foco, y se cierra si ve fuera de él el foco, un toque o Escape; usa la capa superior (`CapaModal`:
`<dialog>` con `showModal`, en un portal al `<body>`, que no deja salir foco, toques ni teclas). Para probarlo, abrir la pantalla con `page.clock.install()`, **esperar a que esté pintada** y entonces
adelantar el reloj; si no, empieza a contar después del salto y un «no se durmió» pasa por eso.
