import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { textoDelCierre } from './otras-cajas-al-cerrar.ts';

describe('DP-15 · el cierre dice si queda otra caja abierta', () => {
  it('con la única caja abierta, es el cierre del día', () => {
    expect(textoDelCierre(1)).toEqual({
      titulo: '¿Cerrar la caja?',
      aviso: null,
      boton: 'Sí, cerrar el día',
    });
  });

  it('con otra abierta, avisa y el botón cierra «esta caja»', () => {
    const t = textoDelCierre(2);
    expect(t.boton).toBe('Sí, cerrar esta caja');
    expect(t.aviso).toContain('Hay otra caja abierta');
    expect(textoDelCierre(3).aviso).toContain('Hay 2 cajas abiertas más');
  });

  it('sin saber cuántas, dice lo seguro', () => {
    expect(textoDelCierre(null).boton).toBe('Sí, cerrar esta caja');
    expect(textoDelCierre(null).aviso).toContain('sólo la caja de este aparato');
  });

  it('las dos pantallas de cierre leen las cajas abiertas y usan el texto', () => {
    const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
    for (const ruta of [
      'src/restaurante/CierreDiario.tsx',
      'heredado/components/caja/CierreDiarioDialog.jsx',
    ]) {
      const c = readFileSync(join(raiz, ruta), 'utf8').replace(/\s+/g, '');
      expect(c, ruta).toContain("'/api/caja/cajas-simultaneas'");
      expect(c, ruta).toContain('textoDelCierre(');
    }
    const nueva = readFileSync(join(raiz, 'src/restaurante/CierreDiario.tsx'), 'utf8').replace(
      /\s+/g,
      '',
    );
    expect(nueva).toContain('setCajasAbiertas(cupo.abiertas);');
    expect(nueva).toContain("{enviando?'Cerrando…':textoDeCierre.boton}");
    const heredada = readFileSync(
      join(raiz, 'heredado/components/caja/CierreDiarioDialog.jsx'),
      'utf8',
    ).replace(/\s+/g, '');
    expect(heredada).toContain('setCajasAbiertas(Number(cupo?.abiertas)||1)');
    expect(heredada).toContain("textoDeCierre.aviso?'Cerrarestacaja'");
  });
});
