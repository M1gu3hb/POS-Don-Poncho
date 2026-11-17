# QA final: el arnés fiel (DP-22)

Emula los aparatos de Don Poncho (toque de verdad, tamaños, motores, teclado, red, reloj) y se
**prueba contra sí mismo**: una revisión que no puede fallar no prueba nada. No toca la app.

## Cómo se corre

```bash
. "/d/MIS PROYECTOS/MORPHIQ POS/.work/env.sh"
export MORPHIQPOS_CHROMIUM_ELECTRON="D:/mpos-tmp/chromium-electron/156/chrome-win64/chrome.exe"
export MORPHIQPOS_CHROMIUM_VIEJO="D:/mpos-tmp/chromium-viejo"      # carpeta con 99/ y 103/

# sin servidor (calibración): perfiles, gestos y autoprueba
pnpm exec playwright test -c playwright.qa-final.config.ts arnes. --project=win-1920x1080-100

# contra la app: levantar ANTES `next start` (este config no construye nada) y esperar a que conteste
pnpm --filter @morphiqpos/web exec next start -p 3210 &
curl -s -o /dev/null -w "%{http_code}" http://localhost:3210/      # distinto de 000
MORPHIQPOS_PUERTO_E2E=3210 pnpm exec playwright test -c playwright.qa-final.config.ts humo-aparatos seed
```

- Un proyecto por aparato (`--project=<id>`; los ids están en `arnes/aparatos.ts`). `workers: 1`, sin reintentos.
- Variables: `MORPHIQPOS_PUERTO_E2E` (3200), `MORPHIQPOS_URL_DESPLIEGUE`, `MORPHIQPOS_CHROMIUM_ELECTRON`
  (el `chrome.exe` del Chrome for Testing 156; sin él cae al Chromium de Playwright y **lo dice**),
  `MORPHIQPOS_CHROMIUM_VIEJO` (sin él, o sin el binario, los perfiles del iMin se **saltan** con su motivo),
  `MORPHIQPOS_QA_CORRIDA` (nombre de la corrida en los informes), `MORPHIQPOS_QA_WORKERS`.
- Salidas (en `.gitignore`): `qa/qa-final/capturas/<pantalla>/<aparato>/<estado>.png`,
  `qa/qa-final/informes/<corrida>-<proceso>.json` y `autoprueba-<aparato>.json`.
- La CI de hoy no lo recoge: `playwright.config.ts` ignora `**/qa-final/**`.

## Qué hay

| Archivo                                      | Para qué                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `arnes/aparatos.ts`, `motores.ts`            | Los perfiles (Windows con escala, iMin ×2 escalas ×2 motores, tableta, teléfonos)                                              |
| `arnes/prueba.ts`                            | El `test` de todas las specs (fixtures `aparato` y `motor`; salta lo que no hay)                                               |
| `arnes/toque.ts`, `deslizar.ts`, `dedos.ts`  | Toque, doble, pulsación larga, menú contextual, deslizar, arrastrar, pellizco (CDP)                                            |
| `arnes/teclado.ts`                           | Teclado en pantalla (`encoge` y `tapa`), foco al abrir                                                                         |
| `arnes/varios-aparatos.ts`                   | Caja + mesero + cocina + portal a la vez, cada uno con su perfil y su sesión                                                   |
| `arnes/red.ts`, `arnes/reloj.ts`             | Cortes (`setOffline`), latencia de 800 ms (por `route`: por CDP cuelga el Chromium 99), recarga a media operación; reloj falso |
| `arnes/revisiones.ts`                        | `revisarPantalla(page, info, { pantalla, estado, modo, extras… })`                                                             |
| `arnes/excepciones-44.ts`, `explicados.ts`   | Excepciones al blanco de 44 px y errores explicados, cada uno con su razón                                                     |
| `arnes/calibracion/`                         | 13 defectos sembrados, con su variante limpia                                                                                  |
| `arnes.{aparatos,gestos,autoprueba}.spec.ts` | El arnés probado contra sí mismo                                                                                               |
| `seed.spec.ts`, `humo-aparatos.spec.ts`      | Semilla por puesto y humo de punta a punta en cada perfil                                                                      |

## Agregar una pantalla

En `seed.spec.ts`, una fila de `PUESTOS` (`rol`, `ruta`, `pantalla`). Para un estado (un diálogo, una
mesa abierta) se prepara con la app y se llama `revisarPantalla(page, info, { pantalla, estado, modo })`;
`extras` suma gestos o teclado: `extras: [() => revisarTeclado(page, { campo, modo: aparato.teclado })]`.
Pedir `vigilarPagina(page)` **antes** de navegar: lo que la consola dijo antes no se recupera.
Modo `estricto` (por omisión) lanza con la lista; `barrido` junta y sigue.

## Qué emula y qué NO

Emula: el motor (Chrome 156 de Electron; Chromium 99 y 103 del WebView; Chromium 153 en tabletas y
teléfonos), el viewport en px de CSS (físico ÷ escala), `devicePixelRatio`, `hasTouch`,
`(any-pointer: coarse)` y sin `(any-pointer: fine)`, el dedo por `Input.dispatchTouchEvent`, el
`<html data-ligero>` del iMin, el teclado en pantalla por su efecto sobre la página y el reloj de la página. La latencia por `route` retrasa cada petición (no WebSocket ni EventSource) y apaga el caché HTTP de la pestaña.

NO emula: la app de Electron ni la de Android (sin puente de impresión, cajón ni modo espera nativo); el
teclado táctil real de Windows ni el de Android (sin animación, sugerencias, ni el desplazamiento
propio del sistema); la GPU ni el rendimiento del iMin (un Chromium viejo en una laptop no es lento);
el WebView (sus particularidades de Android 7.1.2); un `contextmenu` o una selección **nativos**
de Windows/Android: el arnés los **modela** cuando el motor no los manda (`origen: 'simulado'` y
`'modelada'` en el resultado del gesto); la hora del servidor ni la de la base (`arnes/reloj.ts` dice
cómo combinarlo con `qa/simulador/reloj/`); las cookies caducan con el reloj real.
