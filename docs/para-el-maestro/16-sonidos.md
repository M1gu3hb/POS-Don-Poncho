# 16 · Los sonidos de la interfaz (DP-11.3)

## Qué hace y por qué

Cada toque responde también con sonido: corto, suave y de la misma familia. Viene de React Bits ·
Sound Lab, instalado **como código** (Web Audio): no hay archivos de audio y suena sin internet.

- Un solo gestor, `sonar(evento)`, con el perfil de **este aparato** (Apagado, Suave, Normal y el
  volumen) y lo del **negocio** (el sonido del teclado y si el portal del comensal suena).
- Un oyente único decide qué suena al tocar (botón, pestaña, menú, interruptor) y al aparecer algo
  (diálogo, aviso de error o de advertencia). Las pantallas sólo llaman a `sonar` para lo que el
  DOM no dice: agregar, cobrar, enviar a cocina, imprimir…
- Nunca se encima con la voz, no hace ráfagas (80 ms) y un toque suena una sola vez.
- Configuración → Sonidos: cada momento con su sonido y un botón para oírlo.

## Archivos

| Archivo                                            | Qué                                                         |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/src/sonidos/motor/*`                     | El motor de Sound Lab, partido en módulos (licencia aparte) |
| `apps/web/src/sonidos/recetas/*`                   | Las 25 recetas                                              |
| `apps/web/src/sonidos/mapa.ts`                     | Qué suena en cada momento                                   |
| `apps/web/src/sonidos/gestor.ts`                   | `sonar`, `oir`, `sonarAntesDeIrse`                          |
| `apps/web/src/sonidos/reglas-del-gestor.ts`        | Cuándo suena y cuándo calla (puro)                          |
| `apps/web/src/sonidos/perfil-del-aparato.ts`       | Apagado, Suave, Normal y volumen (`localStorage`)           |
| `apps/web/src/sonidos/evento-del-clic.ts`          | Qué suena al tocar (puro)                                   |
| `apps/web/src/sonidos/observador.ts`               | Diálogos y avisos que aparecen                              |
| `apps/web/src/sonidos/reproductor.ts`              | Carga cada receta cuando hace falta y la toca               |
| `apps/web/src/sonidos/ProveedorDeSonidos.tsx`      | Configura el gestor y pone el oyente único                  |
| `apps/web/src/configuracion/SonidoDelAparato.tsx`  | El panel de «Este aparato»                                  |
| `apps/web/src/configuracion/SonidosDelNegocio.tsx` | La pestaña «Sonidos»                                        |
| `apps/web/src/cliente/texto-del-aparato.ts`        | Lo guardado en el aparato, en vivo                          |
| `packages/app/src/configuracion/experiencia.ts`    | `tecla` y `sonidos_en_el_portal`                            |
| `licencias/react-bits-sound-lab.md`                | Origen y licencia                                           |
| `pruebas/e2e/sonidos.spec.ts`                      | Navegador, tres aparatos (`data-ultimo-sonido`)             |

## Migraciones

Ninguna.

## Genérico o de Don Poncho

Genérico. Lo de Don Poncho es dónde se llamó a `sonar` (sus pantallas del restaurante) y que
Cocina conserva su timbre y su voz.

## Cómo portarlo

Copiar `apps/web/src/sonidos/`, los dos paneles de configuración, `texto-del-aparato.ts`, la
licencia y las llaves de `experiencia.ts`. Montar `ProveedorDeSonidos` debajo del proveedor de la
experiencia. Marcar los teclados con `data-sonido="tecla"` y llamar a `sonar` en los momentos que
el DOM no dice, después del aviso o del comando que confirma el éxito (el contrato
`llamadas.contrato.test.ts` las exige ahí). Si el momento recarga la página (entrar, salir),
`await sonarAntesDeIrse(…)` va **antes** de cambiar la sesión: si no, la pantalla navega sola y la
recarga le cae encima. Para probarlo sin tarjeta de audio, leer `data-ultimo-sonido` del
documento.
