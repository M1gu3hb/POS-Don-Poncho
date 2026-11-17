# Planes de prueba

Aquí escribe sus planes el agente `playwright-test-planner` (uno por zona: `caja.md`,
`salon.md`, `cocina.md`…). El `playwright-test-generator` los convierte en pruebas dentro de
`pruebas/e2e/qa-final/` partiendo de la semilla `seed.spec.ts`, y el `playwright-test-healer`
repara las que se rompen por un cambio de la pantalla (nunca tapa un defecto de la app).

Los tres son subagentes de Claude Code (`.claude/agents/`), con `model: sonnet`, y hablan con
el corredor de pruebas por el servidor MCP declarado en `.mcp.json`.
