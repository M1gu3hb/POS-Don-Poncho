/**
 * Quién puede mover lo que está en cocina: marcar un platillo (o una comanda) y entregar lo listo.
 * Una sola lista para los comandos del ciclo de preparación (DP-24 no amplía a nadie).
 */
export const ROLES_DE_COCINA = [
  'cocina',
  'mesero',
  'cajero',
  'gerente',
  'administrador',
  'dueno',
] as const;
