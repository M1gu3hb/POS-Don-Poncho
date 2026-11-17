# PROGRESO · DP-22 · La auditoría final y el QA definitivo

> Si la sesión se corta o se compacta, **lo primero es leer `docs/qa-final/ESTADO.md`** y seguir
> desde ahí. Ésta es la bitácora larga: qué pasó y en qué orden. Sin secretos ni PIN aquí: viven
> en `..\_PRIVADO\`.

Empezó el lunes 16-11-2026 hacia las 20:50 (CDMX). Sin reloj fijo: la fecha de instalación se está
definiendo. Se trabaja en orden de importancia y se despliega cada lote en cuanto está en verde.

## Dónde está cada cosa

| Qué | Dónde |
| --- | --- |
| El estado para retomar | `docs/qa-final/ESTADO.md` |
| El plan | `docs/qa-final/PLAN.md` |
| El mapa total (generado) | `docs/qa-final/MATRIZ.md` y `qa/qa-final/datos/` |
| Los hallazgos | `docs/qa-final/HALLAZGOS.md` |
| Lo nuevo | `docs/qa-final/NUEVO.md` |
| Guiones y registros de la etapa | `D:\mpos-tmp\dp22\` (fuera del repo) |
| La copia con el catálogo real | clúster 5460, base `qa_dp22_base` (PIN de prueba en `D:\mpos-tmp\qa-dp22-base\`) |

## Arranque (16-11, 20:50 a 21:50)

- **Lectura:** `REGLAS.md`, `CONTEXTO.md`, `apps/web/AGENTS.md`, `DECISIONES.md` desde DP-D100, el
  informe 012 y su anexo, `PROGRESO-DP21.md`, `CONFIGURACION-MAPA.md`, el informe 011, el README del
  simulador, el RUNBOOK y el README de las apps. No hay `CLAUDE.md` ni `AGENTS.md` en la raíz (sólo
  los de `apps/web`), igual que en DP-21.
- **Repos:** el POS en `63977e1` y las apps en `d2d94ed`, los dos al día.
- **`pnpm install`:** el primer intento falló a medias (`ERR_PNPM_PACKAGE_MANAGER_REMOVE_MODULES_DIR`)
  por correrlo sin el entorno de cachés (`.work/env.sh`): pnpm cambió de almacén y quiso rehacer
  `node_modules`. Con el entorno cargado, en verde en 16 minutos. No es un defecto del repo: es una
  trampa de la laptop, ya anotada en `ESTADO.md`.
- **Producción, sólo leyendo** (conexión de sesión 5432, una transacción `read only` con `rollback`):
  9 cuentas pagadas (A-1 a A-9, $3,050.80), 1 caja cerrada, 0 abiertas, 35 terminales «Caja N»,
  cupo 1, 0 almacenes, 0 insumos, 0 recetas, 107 productos, 10 mesas libres, 10 personas, `impuesto`
  vacío, migraciones hasta la 193. Coincide con lo que dice el encargo.
- **La copia con el catálogo real:** exportación de sólo lectura de producción
  (`scripts/exportar-negocio.mjs --sin-archivos`, a `..\_PRIVADO\mudanza\`) e importación a
  `qa_dp22_base` en el clúster local con `qa/simulador/copia.ts`: 135 tablas y 1,873 filas idénticas
  al origen (filas y md5), con 10 PIN de prueba fuera del repo.
- **Skills:** de la cuenta, cargadas `morphiq-prs`, `contratos-por-mutacion`,
  `supabase-vercel-produccion` y `engineering:testing-strategy`; las demás se cargan al llegar a su
  fase. Externas (clonadas con `git`, leídas completas, en `.claude/skills/`, fuera de git):
  `webapp-testing` (anthropics/skills `e4bb5d9`), `verification-before-completion`,
  `systematic-debugging` y `test-driven-development` (obra/superpowers `22f0b46`) y `browser-qa`
  (affaan-m/ecc `8abdf32`). Ninguna pide mandar datos fuera ni correr código raro. `webapp-testing`
  es de Python: se usa su método (reconocer y luego actuar), no sus guiones. Ya estaban instaladas
  `dispatching-parallel-agents`, `subagent-driven-development` y `using-git-worktrees`.
- **El motor de los POS:** Electron 45.3.2 trae Chrome 156.0.8078.100 (leído del binario, sin
  ejecutarlo); Playwright 1.63 trae Chromium 153. El arnés usa Chrome for Testing 156.
- **Agentes (Sonnet, sin commit, cada uno en su árbol):** el 1, Bloque 19 A (H2, A24, la devolución
  por peso, X4); el 2, Bloque 19 B (H3, A23, A5, A6, A10, X5); el 3, el arnés táctil.
- **El mapa total:** `scripts/qa-final/generar-matriz.mjs` saca del código 34 pantallas (28 con
  sesión) con 107 ventanas, 78 ajustes del negocio y 18 de este aparato, 104 flujos, 124 comandos
  (32 sin pantalla, lo mismo que contó el anexo 012) y 26 entidades del puente. Los puestos de cada
  ruta se le preguntan a la misma función que usa el armazón de la app.

### Lo que el encargo dice y el repo no (gana el repo)

- `pnpm verify` completo no corre en la laptop (sin Docker): va por puertas, sin `verify:esquema`,
  `verify:rls` ni `verify:acople` (leen la base compartida; la CI tampoco los corre).
- El encargo pide instalar las skills externas con `npx skills add`: se clonaron con `git` (el
  propio encargo lo da como alternativa) para leerlas antes de que nada se ejecute.
- «1920×1080 a su escala real» del iMin: no hay dato de su densidad; se prueban las dos probables.

## Línea base

_(Se llena cuando termine `verify` sobre `main`.)_

## Lotes

_(Cada lote: qué lleva, su PR, la CI, el despliegue, el humo y los errores de Vercel en la hora
siguiente.)_
