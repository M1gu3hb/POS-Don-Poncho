import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { describirAccion } from './describir-accion.ts';

describe('DP-15 · la auditoría en palabras', () => {
  it('el renombre de una caja, con el antes y el después', () => {
    expect(describirAccion('caja.nombrar_terminal', { antes: 'Caja 1', despues: 'Barra' })).toBe(
      'Cambió el nombre de una caja: «Caja 1» → «Barra»',
    );
  });

  it('el agotado y su vuelta, el PIN y los descuentos', () => {
    expect(describirAccion('catalogo.marcar_agotado', { nombre: 'Barbacoa', agotado: true })).toBe(
      'Marcó «Barbacoa» agotado por hoy',
    );
    expect(describirAccion('catalogo.marcar_agotado', { nombre: 'Barbacoa', agotado: false })).toBe(
      'Volvió a ofrecer «Barbacoa»',
    );
    expect(describirAccion('identidad.establecer_pin', { nombre: 'Mesero 1' })).toBe(
      'Cambió el PIN de Mesero 1',
    );
    expect(describirAccion('configuracion.permitir_descuentos', { permitir: false })).toBe(
      'Apagó los descuentos',
    );
  });

  it('lo desconocido sale con el nombre del comando, y un payload raro no rompe', () => {
    expect(describirAccion('venta.cobrar', { total: 10 })).toBe('venta.cobrar');
    expect(describirAccion('caja.nombrar_terminal', null)).toBe(
      'Cambió el nombre de una caja: «» → «»',
    );
  });
});

describe('DP-15 · la pestaña «Auditoría» de Registros', () => {
  it('existe sólo para quien manda y lee del comando de la auditoría', () => {
    const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
    const registros = readFileSync(
      join(raiz, 'heredado', 'pages', 'Registros.jsx'),
      'utf8',
    ).replace(/\s+/g, '');
    expect(registros).toContain('{esDeMando(miPuesto)&&(<TabsTriggervalue="auditoria"');
    expect(registros).toContain(
      '{esDeMando(miPuesto)&&(<TabsContentvalue="auditoria"className="mt-4"><AuditoriaReciente/>',
    );
    const pestana = readFileSync(join(raiz, 'src', 'registros', 'AuditoriaReciente.tsx'), 'utf8');
    expect(pestana).toContain("'/api/reportes/auditoria-reciente'");
    expect(pestana).toContain('describirAccion(r.accion, r.payload)');
  });
});
