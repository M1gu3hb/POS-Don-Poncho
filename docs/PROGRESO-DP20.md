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
  `3E:04:46:7E…`; `aapt2`: `mx.morphiq.pos.donponcho`, minSdk 23).
- **Publicado:** release `don-poncho-v1.0.0` (la de entrega: `.exe`, `.apk`, diagnóstico sin
  instalar y huellas; versionCode 2) y el canal `canal-don-poncho` en 1.0.0 (lo que leen las apps
  para actualizarse; responde sin token y el APK bajado del canal coincide con su huella). La
  `don-poncho-v0.1.0` fue la de diagnóstico. Copias en `..Apps.0.0`.
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

### Las pantallas (agente Sonnet, revisado e integrado)

- **Configuración → Impresión** (`pantallas/ImpresionDelAparato`): sin la app, el aviso de instalarla;
  con la app, el estado («Impresora lista ✓» y el perfil), «Página de prueba», «Abrir cajón», el modo
  ligero (Automático / Encendido / Apagado), la versión con «Buscar actualización» y «Diagnóstico».
- **Operación**, hasta abajo: «Copias de impresión» y «Hardware y pruebas de impresión» (la puerta
  con la contraseña del proveedor y el laboratorio: el aparato, las conexiones —las que la
  plataforma no puede, apagadas y con su razón—, el lenguaje y las medidas, el corte, el cajón, qué
  imprime el aparato, las pruebas, la vista previa de la imagen de 1 bit, los bytes en hexadecimal
  y el perfil: guardar, exportar, importar, quitar).
- En el laboratorio, con la impresora instalada en Windows: «Preguntar a Windows si la impresora
  está lista antes de imprimir» (se apaga si un driver dice «fuera de línea» sin estarlo).

### Lo que se comprobó, y cómo

| Qué | Cómo | Resultado |
| --- | --- | --- |
| El ticket que sale es el de la pantalla | `pnpm test:impresion`: el componente real en Chromium → 1 bit → ESC/POS → la impresora falsa | 13 de 13. Cero puntos de diferencia; contra la captura de la pantalla, 0 puntos fuera de lugar y ~0.4 % de puntos de borde |
| De punta a punta, con una app falsa | `pruebas/e2e/impresion-por-la-app.spec.ts` contra un servidor compilado y una base desechable (`dp20_e2e`) | 2 de 2: contraseña mala no entra, la buena sí; vista previa; el ticket de ejemplo llega a la app como imagen con su corte y sin pulso de cajón; perfil guardado → «Impresora lista ✓»; copias guardadas |
| Los comandos nuevos | Integración contra Postgres 18 local (`dp20_pruebas`) | 6 de 6 |
| Las pruebas unitarias del repo | `pnpm test:unit` | 5 898 en verde (las 2 que fallaron eran de ambiente: se repitieron en verde) |
| Mutaciones | Siete en el codificador, el emulador y la cola; cinco del agente en las pantallas | Todas mueren (una sobrevivía y destapó una prueba que faltaba: imprimir sin pedirlo no abre el cajón) |
| Las pantallas, a la vista | Capturas del recorrido en un navegador real | Revisadas: la pestaña, las copias, la puerta, el laboratorio completo |

Lo que cazaron las puertas del repo y se corrigió: la matriz de permisos, el registro de aspecto
(el ticket cambió de clases a estilo en línea), los tokens del sistema (la tinta y el papel viven
sólo en `termico/colores-del-papel.ts`), la adopción (superficies y estados del sistema), el
contrato de quién lee el documento de configuración y un componente huérfano.

### La contraseña del proveedor y la revisión de seguridad (15-11, madrugada)

- **La contraseña:** Miguel la dio en el chat. Su hash Argon2id (los parámetros de los PIN) quedó
  en Vercel, Production, como variable sensible `PROVEEDOR_CLAVE_HASH`, y una copia en
  `.._PRIVADOappsproveedor-clave-hash.txt`. La contraseña no se escribió en ningún archivo.
- **No está en lo publicado:** `scripts/verificar-clave-del-proveedor.mjs` no la encuentra en el
  build de la web (3 567 archivos), en la app de Windows desempaquetada, en el APK abierto ni en
  el código de las apps; `git grep` tampoco, ni a ella ni a su hash, en los dos repos.
- **Revisión de seguridad** (dos agentes, sólo lectura): nada crítico. Se corrigió que el permiso
  del proveedor iba atado sólo al negocio (ahora también a la persona de la sesión). Lo demás, en
  DP-D125.
- **La galería:** Configuración ganó la pestaña «Impresión», así que sus retratos se regeneraron
  con el flujo `actualizar_galeria` y viajan en esta rama.

## Falta

- **Con hardware, con Miguel:** la lista corta por POS de `INSTALAR.md` (entrar al laboratorio con
  la contraseña, elegir la conexión, «Página de prueba», «Ticket de ejemplo», cajón, guardar el
  perfil), la foto del ticket junto a la captura de la pantalla, y medir RAM y procesador con el
  Tablero, la Caja y la Cocina abiertos. Hasta que eso pase no hay «este POS funcionó con este
  modo».
- **La 1.0.1 de las apps:** los endurecimientos de DP-D125. Publicarla es además la prueba real de
  que la actualización llega sola a un POS.
- **La cuenta de GitHub con verificación en dos pasos:** de ella depende lo que se instala solo.
- El recorrido `impresion-por-la-app.spec.ts` corre en local; falta colgarlo de un trabajo de la CI
  (necesita el hash de una contraseña desechable en el entorno del servidor de la corrida).
- El encabezado de Configuración dice «Ajustes de Morphiq POS» (venía así): por el §6 del refuerzo
  debería decir POS Don Poncho. No es de esta rama; queda señalado.

## Cómo correr lo de esta etapa

```bash
pnpm test:impresion                      # el ticket, punto por punto (sin app ni base)
MORPHIQPOS_CHROMIUM="C:/Program Files/Google/Chrome/Application/chrome.exe" pnpm test:impresion
```

En la laptop no hay Docker: la integración corre contra el clúster local de pruebas (Postgres 18,
puerto 55433) con una base propia por etapa, y `verify` en dos tramos (`D:\mpos-tmp\dp20\`).

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
