# PLAN · DP-22 · La auditoría final y el QA definitivo

> Las fases del encargo, aterrizadas a lo que hay en el repo (`main` en `63977e1`). Se ejecuta sin
> pedir permiso. El avance vive en `ESTADO.md`; los hallazgos, en `HALLAZGOS.md`; lo nuevo, en
> `NUEVO.md`; la bitácora, en `docs/PROGRESO-DP22.md`.

## 0 · Reglas de esta sesión (resumen operativo)

- **Producción no se usa para probar.** Sólo: desplegar por PR con la CI en verde, leer por la
  conexión de sesión (5432, `leerEnSoloLectura`) y lo de la Parte 11. No se cobra.
- **Todo se prueba en local**: base desechable (`scripts/base-desechable.mjs`, 5437) para las e2e y
  copias con el catálogo real en el clúster 5460 (`qa_dp22_*`, armadas con `qa/simulador/copia.ts`).
- **Evidencia o no cuenta**: prueba que falló antes y pasa después, con su nombre y su commit.
- **Agentes**: Sonnet (arreglar, flujos) o Haiku (barridos), máximo 3, cada uno en su árbol y sin
  commit. La sesión principal revisa el diff, corre las pruebas y une.
- **Un PR por lote**, CI en verde → producción → humo sin cobrar → Vercel sin errores en la hora.
- **Lo que decide la sesión** se anota en `DECISIONES.md` (DP-D146 en adelante).

## 1 · Lo que ya existe y se reusa

| Pieza                                   | Dónde                                                                                                  | Para qué sirve aquí                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Base desechable y restaurante de prueba | `scripts/base-desechable.mjs`, `scripts/sembrar-pruebas.mjs`                                           | e2e destructivas                         |
| Sesiones por puesto y ayudantes         | `pruebas/e2e/ayudantes/sesion.ts`, `roles.ts`                                                          | entrar con cada puesto                   |
| Toque emulado y medidas                 | `pruebas/e2e/ayudantes/tacto.ts`, `barrido-medidas.ts`, `tactil-*.spec.ts`, `barrido-visual.spec.ts`   | semilla del arnés (Parte 3)              |
| Dos motores                             | `pruebas/e2e/ayudantes/dos-motores.ts`, `motor-viejo.spec.ts`                                          | modo compatible (Chromium 99 y 103)      |
| Emulador de impresora                   | `pruebas/impresion/`, `apps/web/src/impresion/emulador.ts`                                             | «el papel dice lo mismo que la pantalla» |
| Simulador de jornada                    | `qa/simulador/` (bots, libro, árbitro, reloj, copia, candado)                                          | Partes 5 y 10                            |
| Matriz de permisos                      | `pruebas/e2e/matriz-de-permisos.json` (124 comandos)                                                   | Parte 2 y permisos por puesto            |
| Mapa de la Configuración                | `apps/web/src/configuracion/secciones.ts`, `docs/CONFIGURACION-MAPA.md`                                | Partes 2 y 4                             |
| Guiones de producción                   | `scripts/dejar-en-ceros.mjs`, `renombrar-aparatos.mjs`, `operacion-real.mjs`, `lib/lectura-segura.mjs` | Parte 11                                 |

## 2 · Fases

### Fase A · Preparar (Parte 1)

1. `pnpm install` y `pnpm verify` en verde sobre `main` (dos tramos; ver `ESTADO.md`).
2. Skills: las de la cuenta se cargan al llegar a su fase; las externas (`webapp-testing`,
   `verification-before-completion`, `systematic-debugging`, `test-driven-development`,
   `browser-qa`) se clonaron con `git`, se leyeron completas y viven en `.claude/skills/` (fuera de
   git). Ninguna pide mandar datos fuera.
3. Herramientas con versión fija: `@axe-core/playwright`, `pict-node`, `fast-check`.
4. Agentes de Playwright (`init-agents --loop=claude`), en `model: sonnet`, con su semilla en el
   arnés táctil y su salida en `pruebas/e2e/qa-final/`.

### Fase B · El mapa total (Parte 2) → `MATRIZ.md`

Generado por `scripts/qa-final/generar-matriz.mjs` (nunca a mano), con `--verificar` para saber si
el mapa quedó viejo:

- **Pantallas**: `apps/web/app/**/page.tsx` + el enrutado de `heredado/` + la matriz de permisos →
  ruta, puestos que la ven, diálogos y paneles (por análisis del código), estados.
- **Ajustes**: `CLAVES_EDITABLES`, `PUBLICOS`, `SOLO_POR_COMANDO`, `secciones.ts`, «Este aparato» →
  qué cambia, quién lo lee (archivo:línea), la prueba que lo demuestra (o «falta»).
- **Flujos**: el catálogo del encargo como datos (`flujos.json`), cada uno con su prueba.
- **Comandos**: `scripts/generar-catalogo-comandos.mjs` + quién lo llama + con qué puesto; y cada
  `api.entidades.X` con su lectura por puesto.

### Fase C · El arnés fiel (Parte 3) → `pruebas/e2e/qa-final/`

- `arnes/aparatos.ts`: los perfiles (Windows táctil en 7 tamaños con la versión mayor de Chromium de
  Electron 45; iMin 1920×1080 con Chromium 99 y 103 y modo ligero; tableta 800×1280; teléfonos
  390×844 y 360×800), todos con `hasTouch` y `(any-pointer: coarse)`.
- `arnes/toque.ts`: toque, doble, pulsación larga (CDP, ≥ 600 ms), deslizar, arrastrar, pellizco;
  cada gesto comprueba que no hubo selección ni menú nativo; `contextmenu` en Windows.
- `arnes/teclado.ts`: recorta el `visualViewport` 40 % al enfocar un campo.
- `arnes/revisiones.ts`: la función que se llama en cada pantalla y estado (scroll horizontal,
  texto cortado, tocables encimados, tarjetas y campos alineados, 44 px por componente con
  excepciones justificadas, axe, consola, red, captura).
- `arnes/red.ts`, `arnes/reloj.ts`, `arnes/varios-aparatos.ts`.
- **El arnés se prueba contra sí mismo** (`arnes.autoprueba.spec.ts`): una página de calibración
  con cada defecto sembrado; cada revisión tiene que fallar ahí.
- Electron de verdad, si cabe en una hora; si no, Chromium de la misma versión mayor y se anota.

### Fase D · Cada configuración (Parte 4)

1. Una por una: una prueba por ajuste de la matriz (pantalla, papel o servidor).
2. En combinación: `pict-node` (pares para todo, ternas para dinero) sobre el flujo completo, con
   un cálculo independiente del dinero (`fast-check` para las propiedades) y el inventario al gramo.
3. A media operación: los 11 casos del encargo, cada uno con su regla escrita y su prueba.

### Fase E · Catálogo, inventario y recetas de cero (Parte 5)

Sobre una copia con el catálogo real, por pantallas y con toque: catálogo → inventario → compras →
recetas → vender por los cuatro canales → alertas → conteo y merma → valor y reportes contra el
árbitro.

### Fase F · Pantalla por pantalla (Parte 6) y lo que falta (Parte 7)

Barrido completo (pantalla × puesto × aparato × estado) con las revisiones automáticas; las capturas
se miran. Empieza por lo de servicio. La lista de la Parte 7 se revisa contra el código y la app;
lo chico o mediano se construye (decisión, prueba, mutante, ayuda); lo grande va a la lista.

### Fase G · Pendientes conocidos (Parte 9), en paralelo desde el principio

- Bloque 19 (H2, H3, A23, A5, A6, A10, A24, H5, devolución por peso, X4, X5).
- Bloque 18 (app 1.0.2: `archivos.guardar`, guardar al sellar, Registros, publicar y ver llegar la
  actualización en la laptop).
- La puerta de `heredado/*.jsx` (TS2304 y TS2552) en `verify` y en la CI.
- Lo que el anexo 012 dejó para Miguel, decidido con el criterio del encargo.
- La auditoría del 16-11: la cola de sincronización, quién anuncia las comandas,
  `silenciar_notificaciones_admin`.

### Fase H · El día de bots (Parte 10)

Sólo con lo anterior en verde. 08:00–19:00, 4 a 6 aparatos táctiles, bots con semilla y ponderados
por hora, caos programado, árbitro cada hora. Se repite con otra semilla hasta salir limpio.

### Fase I · Producción lista (Parte 11) y el informe (Parte 12)

`scripts/configurar-produccion.mjs` (idempotente, `--ensayo`, por comandos, con auditoría), dejar en
ceros con sus condiciones, primer folio 1001 y 101, renombrar aparatos, verificación de sólo
lectura, `pnpm dia-cero`, y `docs/reports/013-auditoria-final.md` con el sí o no.

## 3 · Lotes (un PR cada uno)

| Lote  | Qué lleva                                                         | Por qué primero                                |
| ----- | ----------------------------------------------------------------- | ---------------------------------------------- |
| 1     | Bloque 19 del servidor + la puerta de `heredado/`                 | dinero, datos y candados; ya está especificado |
| 2     | El arnés, la matriz y las herramientas de QA (sin cambiar la app) | hace creíble todo lo demás                     |
| 3     | Lo decidido del anexo 012 y de la auditoría del 16-11             | chico y de bajo riesgo                         |
| 4     | Bloque 18 (POS) + app 1.0.2 (repo de las apps)                    | necesita publicar y ver la actualización       |
| 5…    | Los hallazgos de las Fases D, E y F, por severidad                | crítico al momento; lo demás de 2 en 2         |
| final | Producción configurada y en ceros, `dia-cero`, informe 013        | después del día de bots limpio                 |

## 4 · Reparto

- **Sesión principal**: preparar, matriz, plan, configuraciones, revisión y unión de todo, producción.
- **Agente 1 (Sonnet, `.work\dp18-integrar`)**: Bloque 19 del servidor.
- **Agente 2 (Sonnet, `.work\dp20-lab`)**: el arnés táctil.
- **Agente 3 (Sonnet o Haiku, según la tarea)**: se abre cuando uno de los dos termine (Bloque 18,
  barridos de capturas, inventarios).
