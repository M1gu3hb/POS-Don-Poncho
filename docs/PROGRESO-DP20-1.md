# DP-20.1 · «Modo compatible» para los POS con motor viejo, y la 1.0.1 de las apps

Bitácora de la etapa. Empezó el 15-11-2026, el día que llegaron los POS.

## Qué pasó en el POS real

iMin D4-503 (Android 7.1.2, 32 bits, RK3288, sin servicios de Google). Con la APK 1.0.0 instala,
abre producción, entra con PIN, **imprime en la impresora integrada y abre el cajón**. Lo que
fallaba era cómo se veía: teclas del PIN crema y sin número, fondos y bordes translúcidos pintados
sólidos, diálogos corridos hacia abajo a la derecha. Instalar «Android System WebView» y Chrome no
lo cambió: ese aparato no deja actualizar su motor.

## El motor

- **Reproducido en la laptop** con el Chromium 99.0.4844.0 oficial (snapshot r961656): mismas
  teclas crema sin número. `CSS.supports` ahí: sin `color-mix`, sin `translate` suelto, sin
  `:has()`, sin `dvh`, sin `@container`, sin `inert`; con capas de CSS (`@layer`).
- El otro extremo del rango, Chromium 103.0.5060.0 (r1002885): igual, salvo que ya trae `inert`.
- Por debajo, Chromium 97.0.4692.0 (r938561): sin capas de CSS. Ahí sale el aviso de «aparato
  demasiado viejo».
- **El motor exacto del iMin lo dirá su Diagnóstico** (línea del WebView) y, desde esta etapa,
  «Probar compatibilidad» en el laboratorio; la lista queda en la auditoría de la entrada
  (`proveedor.entrar`, campo `motor`).

## Dónde está cada cosa

| Qué | Dónde |
| --- | --- |
| El plugin de PostCSS | `scripts/modo-compatible/` (`plugin.mjs`, `colores.mjs`, `transformaciones.mjs`, `unidades.mjs`) |
| El contrato de la CI | `scripts/modo-compatible/contrato.mjs`, `api-nuevas.mjs` y `scripts/verificar-modo-compatible.mjs` (`pnpm verify:modo-compatible`) |
| Dónde engancha | `apps/web/postcss.config.mjs`, después de `@tailwindcss/postcss` |
| Rellenos de JavaScript | `apps/web/src/compatibilidad/rellenos.ts` (en línea, en el `<head>`) |
| Aviso de aparato demasiado viejo | `apps/web/src/compatibilidad/AvisoDeAparatoViejo.tsx` y las dos reglas del final de `app/globals.css` |
| «Probar compatibilidad» | `apps/web/src/compatibilidad/sondas.ts` y `src/impresion/pantallas/LabMotor.tsx` |
| `inert` sin `inert` | `apps/web/src/sistema/apagar-el-resto.ts` |
| La impresora de red, sólo en la red local | `apps/web/src/impresion/termico/direccion-local.ts` |
| Las pruebas con el motor viejo | `pruebas/e2e/motor-viejo.spec.ts` y `pruebas/e2e/ayudantes/{recorrido-compatible,dos-motores}.ts` |
| La decisión | `DECISIONES.md` · DP-D126 |

## Cómo correr lo de esta etapa

```bash
pnpm exec vitest run scripts/modo-compatible apps/web/src/compatibilidad   # el plugin, el contrato, las sondas, los rellenos
pnpm build && pnpm verify:modo-compatible                                  # el contrato sobre el CSS y el JS del build

# Con el motor viejo (no va en la CI: son navegadores de 180 MB sin parches, sólo contra localhost)
MORPHIQPOS_CHROMIUM_VIEJO="D:/mpos-tmp/chromium-viejo/99/chrome-win/chrome.exe" \
MORPHIQPOS_CAPTURAS="D:/mpos-tmp/dp20/capturas-recorrido" \
pnpm exec playwright test pruebas/e2e/motor-viejo.spec.ts --project=escritorio
```

Los tres Chromium viejos se bajan del depósito oficial de snapshots
(`chromium-browser-snapshots/Win_x64/<revisión>/chrome-win.zip`): 938561 (97), 961656 (99) y
1002885 (103). **Nunca `chrome.exe --version` en Windows** (abre una ventana y se cuelga).

## Lo que hay que saber

- **El Chromium 99.0.4844.0 de prueba se cuelga tras entrar con PIN si su caché HTTP está
  encendida** (el renderer deja de contestar en `/`). No es del POS ni de esta etapa: con la hoja
  de antes pasa igual, con la caché apagada no pasa y el 103 no se cuelga. La prueba instala una
  ruta que no cambia nada (Playwright apaga la caché cuando hay una). En el iMin real no se ha
  visto; si la app se quedara congelada al abrirla por segunda vez, es lo primero que hay que mirar.
- El plugin corre también en `next dev`, pero ahí Tailwind deja el CSS anidado y sin minificar: lo
  que se garantiza y se revisa es el build de producción.
- Tailwind escanea clases desde `apps/web`: los comentarios y pruebas de `scripts/modo-compatible`
  que nombran clases (`bg-acento/10`) no generan CSS.

## Lo que encontró la prueba con el motor viejo (y no la revisión)

La prueba (`pruebas/e2e/motor-viejo.spec.ts`) anda 14 paradas en el Chrome de hoy y en el Chromium
99 contra la misma base y compara, parada por parada: errores de consola, zonas lisas por pixeles,
la caja de cada elemento y el color calculado de su texto, su fondo y su borde. Cada hallazgo de
abajo salió de ahí:

1. **El aviso de «aparato demasiado viejo» tapaba el POS en el Chromium 99.** La primera versión lo
   decidía la hoja (una regla sin capa lo enseñaba y otra en `@layer` lo ocultaba, con
   `!important`). Con la hoja real el 99.0.4844.0 resolvió ese cruce al revés. Ahora lo enseña un
   guion de una línea que pregunta por `CSSLayerBlockRule`: donde hay capas no puede salir.
2. **El armazón no llenaba la pantalla.** Su alto iba en un `style` en línea (`minHeight: 100dvh`),
   que el plugin no alcanza. Pasó a la clase `min-h-dvh`.
3. **Los degradados no se pintaban.** `bg-gradient-to-*` (las utilidades heredadas de Tailwind 3)
   escribe la dirección «in oklab» sin respaldo. El plugin la repite sin el espacio de color.
4. **`toSorted` y `URL.canParse`** no existen en esos motores (el mapa de mesas ordena con
   `toSorted` las solicitudes del QR): rellenos en línea.
5. **El botón del sistema con icono queda hasta 10 px más ancho** (no hay `:has()`). Es la única
   diferencia de acomodo que se acepta; la prueba la cuenta aparte.
6. **La vista previa del ticket usa `zoom`:** se pinta igual en los dos motores, pero hasta
   Chromium 127 la caja de lo que va dentro se informa sin el zoom. La prueba no compara esas cajas
   (los pixeles, sí).

Con la hoja de antes, sólo en la pantalla de inicio el motor viejo tenía 51 elementos de otro color.
