# PROGRESO · DP-20 · Las apps de POS Don Poncho (.exe y .apk) y la impresión directa

Bitácora para retomar. Empezó el sábado 14-11-2026. Entrega: lunes 16.

## Dónde está cada cosa

| Qué | Dónde |
| --- | --- |
| El POS (esta rama) | worktree `..\.work\dp20`, rama `dp-20` (sale de `main` en `237e194`) |
| Las pantallas del laboratorio (agente) | worktree `..\.work\dp20-lab`, rama `dp-20-lab` |
| El repo de las apps | `..\morphiq-pos-apps` → <https://github.com/M1gu3hb/morphiq-pos-apps> (público) |
| Las llaves de Android | `..\_PRIVADO\apps\` (`pos-don-poncho.jks`, `firma.properties`) |
| Copias de los instaladores | `..\Apps\<versión>\` |

## Skills cargadas

`engineering:system-design`, `engineering:testing-strategy`, `engineering:debug` y `morphiq-prs`
(apareció como `anthropic-skills:morphiq-prs`). Ninguna faltó.

## Cómo quedó armado (lo que decide todo lo demás)

- **Las apps son transporte; la web arma los bytes.** El ticket se dibuja en la página, se
  convierte a 1 bit y se codifica a ESC/POS en la página; la app (Electron o Capacitor) sólo
  entrega los bytes a la impresora (spooler en crudo, red, USB, Bluetooth, serie) o imprime por el
  driver. Así un arreglo de impresión sale con un despliegue de Vercel, sin reinstalar nada.
- **Un mismo puente, `window.MorphiqApp`** (contrato v1 en `puente/contrato.d.ts` del repo de las
  apps; la copia que usa la página, en `apps/web/src/impresion/puente/contrato.ts`).
- **`printDocument` decide.** Las pantallas siguen llamando a `printDocument` como siempre
  (`heredado/lib/print.js`). Con la app y un perfil que imprime ese documento, el MISMO nodo que
  está en pantalla se dibuja al ancho de la impresora en puntos y sale directo; si no, el diálogo
  del navegador. El avance y los errores salen en una barra global (`BarraDeImpresion`).
- **El perfil de impresión vive en el aparato** (lo guarda la app). Lo deja listo el proveedor en
  el laboratorio; el personal sólo ve el estado.

## Hecho (y cómo se comprobó)

### El repo de las apps (`morphiq-pos-apps`)

- Contrato, ficha del cliente (`clientes/don-poncho.json`), pantallas compartidas (Diagnóstico,
  Sin internet, Acerca de) y `scripts/preparar-cliente.mjs`.
- **Windows (Electron 45.3.2):** agente Sonnet, revisado e integrado. 62 pruebas (`npm test`) y
  una prueba de humo con ventanas ocultas (8 pasos): Diagnóstico con datos reales, el POS de
  producción carga con el puente (contrato 1), `https://example.com` se bloquea, una página ajena
  no recibe el puente, Sin internet, y por red contra un servidor falso: página de prueba, cajón,
  copias, duplicado, progreso, último ticket y reimpresión. Instalador NSIS por usuario construido.
- **Android (Capacitor 7.6.10, minSdk 23):** agente Sonnet, revisado e integrado. 83 pruebas JVM y
  16 del guion del puente. APK firmado con la llave de `_PRIVADO` (`apksigner`: huella
  `3E:04:46:7E…`; `aapt2`: `mx.morphiq.pos.donponcho`, versionCode 1, minSdk 23).
- **Publicado:** release `don-poncho-v0.1.0` (diagnóstico) y el canal `canal-don-poncho` (lo que
  leen las apps para actualizarse; sus URL responden sin token).
- `INSTALAR.md` y `herramientas/diagnostico-windows.bat` (diagnóstico sin instalar; probado aquí).

### El POS (rama `dp-20`)

- `apps/web/src/impresion/termico/`: mapa de 1 bit, umbral para el texto y tramado para el logo,
  ESC/POS (imagen en franjas `GS v 0`, por columnas `ESC *`, avance, corte en sus variantes, cajón
  por pin 2/5 y en tiempo real, `DLE EOT`), **la impresora falsa** (`emulador.ts`) que lee los bytes
  de vuelta, el perfil del aparato (zod, exportar/importar) y el armado del trabajo.
- El ticket (`PreCuentaTicket.jsx`) con el **estilo térmico**, medido en puntos y achicado con
  `zoom` a su tamaño real; el mismo lienzo es el que se imprime.
- `printDocument` → app, con «REIMPRESIÓN» y el pie de cada copia; un trabajo a la vez por
  documento y reintento con el mismo id (`trabajos.ts`).
- Servidor: `venta.registrar_impresion`, `caja.cajon_por_cobro`, `caja.fijar_copias_de_impresion`
  y la contraseña del proveedor (`/api/proveedor/entrar|estado|salir`). La apertura manual del
  cajón reusa `caja.abrir_cajon` (F-984), que ya existía.
- La Caja: el cajón se abre solo al cobrar en efectivo; «Abrir cajón» con su motivo; aviso si la
  impresora está sin papel o desconectada.
- Pruebas unitarias: 67 de impresión + los contratos que tocan el ticket, los sonidos, las cookies
  y las llaves de consulta (337 en verde). `tsc` de `app` y `web` en cero; lint de lo nuevo en cero.

## En curso

- Agente (Sonnet) en `..\.work\dp20-lab`: Configuración → Impresión, las copias en Operación y el
  laboratorio «Hardware y pruebas de impresión».

## Falta

- La comparación pixel por pixel con navegador real (Playwright): HTML → 1 bit → ESC/POS →
  emulador → comparar, en 58 y 80, con y sin logo.
- Pruebas de integración (Postgres) de los tres comandos y de la contraseña del proveedor.
- El modo ligero en la web (la app avisa; la web quita blur, sombras y animaciones).
- `DECISIONES.md` (DP-D119 en adelante), `pnpm verify`, el PR y su CI.
- El hash de la contraseña del proveedor en Vercel (Production) y su copia en `_PRIVADO`: **falta
  que Miguel dé la contraseña en el chat**. Sin la variable, nadie entra al laboratorio.
- Con hardware, con Miguel: la lista corta por POS de `INSTALAR.md` y la foto del ticket junto a
  la captura de la pantalla.

## Lo que NO llega en esta entrega (se dice, no se instala a medias)

- **Texto ESC/POS por página de códigos** (el plan B) con su hoja de acentos, **Star**
  (Line/StarPRNT), **código de barras y QR nativos** y los **SDK de Sunmi/iMin**: el laboratorio
  los enseña apagados con su razón. La imagen (lo de siempre) y el driver de Windows sí están.
- **El corte y el Cierre del día al rollo:** siguen saliendo como hoy (carta/PDF por el navegador).
  El perfil ya trae sus casillas, pero esos documentos todavía no tienen su lienzo térmico.
- **Las comandas en impresora de estación.**
- **La variante de Windows 7/8** (Electron 22): queda el guion `construir:legado`, sin construir.

## Lo que hay que saber

- **Windows 7/8:** Electron 22 trae Chromium 108 y el POS usa Tailwind 4, que pide Chromium 111 o
  más nuevo: ahí el POS puede verse mal. Recomendación: pasar esos equipos a Windows 10.
- **Android viejo:** el WebView del sistema tiene que ser 111 o más nuevo; el Diagnóstico enseña su
  versión.
- **En Windows**, antes de imprimir se le pregunta al spooler si la impresora está lista; un driver
  que diga «fuera de línea» sin estarlo bloquearía la impresión (se apaga con el ajuste
  `verificarSpooler: false` de ese aparato).
- **El laboratorio se protege en la pantalla y en el servidor** (contraseña, límite, auditoría,
  permiso de 30 minutos), pero el puente de la app no puede comprobar ese permiso: por eso en las
  apps publicadas las herramientas de desarrollador están apagadas.
- La laptop de Miguel tiene instalada una impresora «POS-58» en `LPT1:` (la vio el Diagnóstico).
  No se le mandó nada.
- **Respaldar el keystore** (`..\_PRIVADO\apps\`) fuera de la laptop: si se pierde, la APK ya no
  se puede actualizar.
