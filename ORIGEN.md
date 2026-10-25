# ORIGEN · de dónde sale POS Don Poncho

|                       |                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Repositorio de origen | `M1gu3hb/MorphiqPOS` (el maestro, sólo lectura)                                                                           |
| Commit de origen      | `5f4534ca987a407cd39ddd02ce8bab0d8ac38b25` — merge del PR #18 (`claude/cortes-y-conexiones`), `origin/main` el 25-10-2026 |
| Autorización          | A-52 / R3 del maestro: se permite extraer, copiar y adaptar el maestro a un repositorio por cliente                       |
| Fecha de la copia     | 25 de octubre de 2026                                                                                                     |
| Método                | `git archive 5f4534c` (sólo archivos versionados) extraído en este repositorio                                            |
| Historia              | Nueva. No se trae la historia del maestro; este archivo es el vínculo con ella                                            |

## Qué se copió

Los 2,730 archivos versionados de `5f4534c`, tal cual: `apps/`, `packages/`, `pruebas/`, `scripts/`,
`infra/`, `docs/`, la configuración del monorepo y `.github/`. El repositorio no usa Git LFS (no hay
filtro `lfs` en `.gitattributes`), así que no hubo nada que materializar.

## Qué NO se copió

| Qué                                                         | Por qué                                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `.env` y cualquier `.env.*` salvo `.env.example`            | Secretos (R31). No están versionados                                                         |
| `historico/` (salvo su `README.md`, que sí está versionado) | Evidencia de sistemas de terceros; no se versiona ni en el maestro                           |
| `.work/`                                                    | Cadena local de la máquina de Miguel (Postgres, cachés, Playwright); vive fuera de los repos |
| `.claude/worktrees/`                                        | Siete worktrees con trabajo sin integrar del maestro; no son parte de `5f4534c`              |
| `coverage/`, `node_modules/`, `.next/`, `.turbo/`           | Artefactos de construcción                                                                   |

## Cómo rastrear correcciones

Una corrección genérica que nazca aquí y deba volver al maestro se describe con su commit de este
repositorio y se lleva a mano (rama propia en el maestro). Una del maestro que convenga traer se
compara contra `5f4534c`: `git -C <maestro> diff 5f4534c <sha> -- <ruta>`.
