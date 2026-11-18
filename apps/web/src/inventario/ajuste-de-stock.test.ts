import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { entradaAjustarStock } from '@morphiqpos/app/inventario';
import { describe, expect, it } from 'vitest';

import { MOTIVO_DE_LA_MERMA, cuerpoDelAjuste, puedeAjustarStock } from './ajuste-de-stock.ts';

/**
 * D.1 de la 2.4 · EL AJUSTE DE STOCK QUE MANDA LA PANTALLA, el que el servidor acepta.
 *
 * El diálogo mandaba una frase como `motivo` —la clave de `motivos_merma`— y todo ajuste
 * volvía rechazado; y el botón sólo lo veía el administrador aunque el almacén también
 * puede ajustar.
 */

const HEREDADO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'heredado');

describe('«Merma / producto perdido» (DP-D171)', () => {
  const base = {
    almacenId: '11111111-1111-4111-8111-111111111111',
    insumoId: '22222222-2222-4222-8222-222222222222',
    tipoLegible: 'Merma',
    texto: 'se cayó',
  };

  it('una merma que resta se manda como MERMA con su motivo del catálogo, y el servidor la acepta', () => {
    const cuerpo = cuerpoDelAjuste({ ...base, cantidad: '-2000', esMerma: true });
    expect(cuerpo).toMatchObject({ tipo: 'merma', motivo: 'dañado', nota: 'Merma: se cayó' });
    expect(MOTIVO_DE_LA_MERMA).toBe('dañado');
    expect(entradaAjustarStock.safeParse(cuerpo).success).toBe(true);
  });

  it('la corrección de conteo NO se manda como merma, ni una «merma» que suma', () => {
    expect(cuerpoDelAjuste({ ...base, cantidad: '-3', esMerma: false })).not.toHaveProperty('tipo');
    expect(cuerpoDelAjuste({ ...base, cantidad: '3', esMerma: true })).not.toHaveProperty('tipo');
    expect(cuerpoDelAjuste({ ...base, cantidad: '-3', esMerma: false }).motivo).toBe(
      'ajuste_conteo',
    );
  });

  it('el diálogo manda la merma como merma y lo dice en pantalla', () => {
    const dialogo = readFileSync(
      join(HEREDADO, 'components', 'inventario', 'AjustarStockDialog.jsx'),
      'utf8',
    );
    expect(dialogo).toContain("esMerma: tipoAjuste === 'merma'");
    expect(dialogo).toContain('ETIQUETA_DE_LA_MERMA');
  });

  it('una merma sobre una existencia ya negativa NO se frena en la pantalla (DP-D173)', () => {
    const dialogo = readFileSync(
      join(HEREDADO, 'components', 'inventario', 'AjustarStockDialog.jsx'),
      'utf8',
    );
    expect(dialogo).toMatch(
      /const esMermaSobreNegativo = tipoAjuste === 'merma' && cambio < 0 && stockActual < 0;/,
    );
    expect(dialogo).toMatch(
      /const stockQuedariaNegativo = stockNuevo < 0 && !esMermaSobreNegativo;/,
    );
  });
});

describe('el ajuste de stock', () => {
  it('manda la CLAVE del motivo y lo escrito como nota, y el servidor lo acepta', () => {
    const cuerpo = cuerpoDelAjuste({
      almacenId: '11111111-1111-4111-8111-111111111111',
      insumoId: '22222222-2222-4222-8222-222222222222',
      cantidad: '-1',
      tipoLegible: 'Corrección de conteo',
      texto: '  conteo del anaquel: falta uno ',
    });

    expect(cuerpo.motivo).toBe('ajuste_conteo');
    expect(cuerpo.nota).toBe('Corrección de conteo: conteo del anaquel: falta uno');
    // El esquema del comando de verdad: una frase de más de 60 letras en `motivo` lo rompe.
    expect(entradaAjustarStock.safeParse(cuerpo).success).toBe(true);
  });

  it('la nota no pasa del largo que el comando admite', () => {
    const cuerpo = cuerpoDelAjuste({
      almacenId: 'a',
      insumoId: 'b',
      cantidad: '1',
      tipoLegible: 'Otro ajuste',
      texto: 'x'.repeat(400),
    });
    expect(cuerpo.nota).toHaveLength(300);
  });

  it('«Ajustar» lo ven el administrador y el almacén, como el servidor', () => {
    expect(puedeAjustarStock('administrador')).toBe(true);
    expect(puedeAjustarStock('almacen')).toBe(true);
    expect(puedeAjustarStock('caja')).toBe(false);
    expect(puedeAjustarStock(undefined)).toBe(false);
  });

  it('el diálogo y el inventario heredados usan las dos', () => {
    const dialogo = readFileSync(
      join(HEREDADO, 'components', 'inventario', 'AjustarStockDialog.jsx'),
      'utf8',
    );
    expect(dialogo).toContain('cuerpoDelAjuste({');
    const inventario = readFileSync(join(HEREDADO, 'pages', 'Inventario.jsx'), 'utf8');
    expect(inventario).toMatch(/\{puedeAjustar && \(\s*<Button[\s\S]*?Ajustar<\/span>/);
  });
});
