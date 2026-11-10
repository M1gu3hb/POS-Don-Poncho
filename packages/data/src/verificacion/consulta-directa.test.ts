import { describe, expect, it } from 'vitest';

import { consultarEn, exigirQueNoSeaElPooler } from './consulta-directa.ts';

/**
 * DP-16 (1.5) · `consultarEn` no entra por el pooler de transacción (6543), igual que
 * `exigirConexionDirecta` de `scripts/lib/lectura-segura.mjs` (DP-D92).
 */
describe('consultarEn y el pooler de transacción', () => {
  it('rechaza una cadena del puerto 6543 sin llegar a conectarse', async () => {
    await expect(
      consultarEn('postgresql://usuario:clave@aws-0.pooler.supabase.com:6543/postgres', 'select 1'),
    ).rejects.toThrow(/6543/);
  });

  it('la conexión directa o de sesión (5432) pasa la guarda', () => {
    expect(() => {
      exigirQueNoSeaElPooler('postgresql://usuario:clave@db.ejemplo.supabase.co:5432/postgres');
    }).not.toThrow();
    expect(() => {
      exigirQueNoSeaElPooler('postgresql://u:p@localhost:5438/mpos');
    }).not.toThrow();
  });

  it('sólo el puerto cuenta: un 6543 en la contraseña o en la ruta no es el pooler', () => {
    expect(() => {
      exigirQueNoSeaElPooler('postgresql://u:p6543@h:5432/db6543');
    }).not.toThrow();
  });
});
