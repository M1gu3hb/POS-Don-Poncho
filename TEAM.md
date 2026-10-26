# TEAM.md — Quién hace qué en POS Don Poncho

**Lee esto antes de escribir una sola línea.**

## 1. Quiénes

| Quién | Papel |
| --- | --- |
| **Miguel** (`M1gu3hb`) | Dueño del producto. Dirige y decide lo comercial y lo irreversible (dominio y DNS, proveedores, promoción a producción, lo que toca dinero). Todos los commits van a su nombre. |
| **Claude Code** (la sesión de desarrollo) | Hace el desarrollo y toma las decisiones técnicas del encargo: código, migraciones por el proceso del repositorio, pruebas, CI, documentación y reporte. Responde por lo que entrega. |
| Subagentes (Sonnet o Haiku) | Encargos acotados que la sesión delega, revisa e integra. Máximo dos a la vez, en worktree, sin commit propio. |

## 2. Identidad de los commits

```bash
git config user.name "M1gu3hb"
git config user.email "118588634+M1gu3hb@users.noreply.github.com"
```

- Después de CADA commit: `git log -1 --format='%an <%ae>%n%b'` → autor `M1gu3hb` y sin coautoría.
- **Cero** `Co-Authored-By` de Claude o de Anthropic y cero «Generated with Claude Code», ni en
  commits ni en PR. `.claude/settings.json` lo deja apagado (`attribution` vacío e
  `includeCoAuthoredBy: false`).
- Si uno sale mal y NO está publicado, se corrige con `--amend`. Nunca `push --force` sobre lo
  publicado ni rebase de `main`.
- Se sube con la cuenta de Miguel (`gh auth status` → `M1gu3hb`).
- Mensajes `DP-<etapa>: …`. Durante el arranque se trabaja directo en `main`.

## 3. Cómo se trabaja una entrega

1. **Primero se entiende**: documentación, código, historial, pruebas y despliegue. Un «terminado»
   escrito no es evidencia; se comprueba ejecutándolo.
2. **La prueba antes que el código, y después la mutación**: se quita la corrección, la prueba se
   pone roja, se restaura (desde una copia, no con `git checkout`, que devuelve lo del commit).
3. **`pnpm verify` es la definición de terminado.** La suite de navegador completa se corre al
   cerrar una etapa; durante ella, lo que se toca.
4. **El esquema se cambia sólo por migración** del repositorio, ensayada en una base desechable. En
   la base compartida de la Fase A **no se aplica DDL**: se escribe la migración, se prueba en base
   desechable y se le avisa a Miguel.
5. **Bitácora al día** (`docs/BITACORA.md`) para que otra sesión retome si se corta el uso, y un
   reporte por entrega (`docs/reports/NNN-…`).

## 4. Reglas que no cambian

1. Ningún archivo nuevo de aplicación supera 300 líneas.
2. Cero `any`, cero `@ts-ignore`, cero `catch` vacío ni `.catch(() => null)` que esconda un fallo.
3. Los secretos van en `.env` (ignorado) o en el entorno del despliegue. **El repositorio es
   público**: nunca un PIN, una llave o una contraseña en código, documentos o commits.
4. Nunca se toca el proyecto `Pasteleria Confetti` de Supabase (`ivqcxdpqxwjxfohiswqb`).
5. Nada destructivo fuera de una base desechable. Las guardas por ID viven en
   `packages/contracts/src/negocios`.
6. Dominio y DNS los resuelve Miguel.

## 5. Qué NO hace nadie

- Cambiar o borrar migraciones, falsificar el ledger o corregir la base con SQL suelto.
- `push --force`, rebase de `main` o reescribir historia publicada.
- Declarar terminado algo sin su prueba y su mutación, o algo que no se verificó ejecutando.
- Esconder un fallo con `skip`, reintentos, umbrales relajados o expectativas debilitadas.
