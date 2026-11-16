import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { IDS_DE_CAMPOS } from '@morphiqpos/domain/venta';
import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 12 · «EL TICKET A TU GUSTO»: `PreCuentaTicket` NO PINTA NADA APAGADO.
 *
 * El papel es un componente heredado (el mismo HTML para la precuenta, el ticket y la imagen
 * ESC/POS), así que el contrato lee su texto y se valida mutándolo: quitar la guarda de un renglón,
 * leer el papel equivocado o poner una guarda a lo que nunca se quita hace fallar una de estas.
 * Lo que se VE (que apagado no salga, que lo de siempre sí) lo prueba, con el navegador de verdad,
 * `pruebas/impresion/ticket-identico.spec.ts`.
 */
const ticket = () =>
  readFileSync(
    join(__dirname, '..', '..', 'heredado', 'components', 'tickets', 'PreCuentaTicket.jsx'),
    'utf8',
  );

const veces = (texto: string, parte: string) => texto.split(parte).length - 1;

describe('PreCuentaTicket y el papel a tu gusto', () => {
  it('lee la elección del negocio y el papel que le toca: ticket si es el final, precuenta si no', () => {
    expect(ticket()).toMatch(
      /const enseña = \(campo\) =>\s*seEnsena\(config\?\.papel_a_tu_gusto, esFinal \? 'ticket' : 'precuenta', campo\);/,
    );
  });

  it.each([...IDS_DE_CAMPOS])('el renglón «%s» sólo se pinta si se enseña', (campo) => {
    expect(veces(ticket(), `enseña('${campo}')`), campo).toBeGreaterThanOrEqual(1);
  });

  it('cada guarda nombra un renglón que existe en la regla (ni uno inventado)', () => {
    const usados = [...ticket().matchAll(/enseña\('([a-z_]+)'\)/g)].map((m) => m[1]);
    expect(usados.length).toBeGreaterThan(0);
    for (const usado of usados) expect(IDS_DE_CAMPOS as readonly string[]).toContain(usado);
  });

  it('los platillos con su importe, el subtotal y el TOTAL no tienen guarda', () => {
    const texto = ticket();
    expect(texto).toMatch(/<Row label="Subtotal" value=\{formatCurrency\(papel\.renglones\)\} \/>/);
    expect(texto).toMatch(
      /<span>TOTAL<\/span>\s*<span>\{formatCurrency\(papel\.total \+ montoPropina\)\}<\/span>/,
    );
    expect(texto).toMatch(/\{formatCurrency\(d\?\.subtotal\)\}/);
    expect(texto).not.toMatch(/enseña\('(subtotal|total|platillos|iva)'\)/);
  });

  it('el IVA sigue mandándolo la tasa (seMencionaElIva), no un interruptor', () => {
    expect(ticket()).toMatch(/\{seMencionaElIva\(papel\.iva\) && \(/);
  });

  it('las copias y la reimpresión no se tocan: sus marcas no pasan por la regla', () => {
    const texto = ticket();
    expect(texto).toMatch(/\{reimpresion && \(\s*<div\s+data-reimpresion/);
    expect(texto).toMatch(/\{pie && \(\s*<p\s+data-pie-de-copia/);
  });
});
