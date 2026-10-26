import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CREDITO_DE_LA_PLATAFORMA, ESTILO_DEL_CREDITO } from './contenido';
import { LOGO_POR_OMISION, RUTA_DEL_LOGO, RUTA_DEL_LOGO_IMPRIMIBLE } from './logo';

/**
 * LA MARCA DE POS DON PONCHO (DP-3).
 *
 * El logo de la casa en todas partes, y Morphiq UNA vez: «Sistema por Morphiq», discreto, en
 * la pantalla de acceso. Nada de Morphiq en el ticket del comensal, el corte ni el portal QR.
 *
 * Se prueba contra los archivos reales: el componente del crédito no se transforma aquí (las
 * pruebas de `apps/web` no compilan JSX), así que lo que se comprueba es QUIÉN lo importa y qué
 * texto llevan las pantallas que se imprimen.
 */

const WEB = join(__dirname, '..', '..');
const PUBLICO = join(WEB, 'public');

function fuentes(carpeta: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) salida.push(...fuentes(ruta));
    else if (/\.(jsx|tsx|ts)$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
      salida.push(ruta);
    }
  }
  return salida;
}

const TODAS = [
  ...fuentes(join(WEB, 'heredado')),
  ...fuentes(join(WEB, 'src')),
  ...fuentes(join(WEB, 'app')),
];
const leer = (ruta: string): string => readFileSync(ruta, 'utf8');
const relativa = (ruta: string): string => relative(WEB, ruta).replaceAll('\\', '/');

describe('el logo de la casa', () => {
  it('es el de Don Poncho, en vector para la pantalla y en PNG para lo que se imprime', () => {
    expect(RUTA_DEL_LOGO).toBe('/marca/don-poncho.svg');
    expect(RUTA_DEL_LOGO_IMPRIMIBLE).toBe('/marca/don-poncho.png');
    expect(LOGO_POR_OMISION).toBe(RUTA_DEL_LOGO);
  });

  it('los archivos existen en public/, que es lo que la CSP deja servir', () => {
    for (const ruta of [RUTA_DEL_LOGO, RUTA_DEL_LOGO_IMPRIMIBLE]) {
      expect(existsSync(join(PUBLICO, ruta)), ruta).toBe(true);
    }
  });

  it('el logo de Morphiq ya no está en el repositorio', () => {
    expect(readdirSync(join(PUBLICO, 'marca')).filter((f) => /morphiq/i.test(f))).toEqual([]);
  });
});

describe('el crédito de la plataforma', () => {
  it('dice «Sistema por Morphiq» y nada más', () => {
    expect(CREDITO_DE_LA_PLATAFORMA).toBe('Sistema por Morphiq');
  });

  it('se pinta con tokens del sistema, sin color ni tamaño literal', () => {
    expect(ESTILO_DEL_CREDITO).not.toMatch(
      /#[0-9a-f]{3,8}\b|\[\d+px\]|\b(?:bg|text)-(?:white|black)\b/i,
    );
    expect(ESTILO_DEL_CREDITO).toContain('text-lateral-texto');
  });

  it('sólo lo pinta la pantalla de acceso', () => {
    const quienes = TODAS.filter((ruta) => /<CreditoDeMorphiq\b/.test(leer(ruta))).map(relativa);
    expect(quienes).toEqual(['heredado/pages/POSLogin.jsx']);
  });

  it('ninguna pantalla importa ya la firma vieja de Morphiq', () => {
    expect(TODAS.filter((ruta) => /\bMarcaMorphiq\b/.test(leer(ruta))).map(relativa)).toEqual([]);
  });
});

describe('lo que ve el comensal no dice Morphiq', () => {
  it.each(['heredado/components/tickets/PreCuentaTicket.jsx', 'heredado/pages/PortalCliente.jsx'])(
    '%s no nombra a la plataforma',
    (archivo) => {
      const codigo = leer(join(WEB, archivo));
      expect(codigo).not.toMatch(/Morphiq|MARCA_DE_PLATAFORMA|platform_brand/);
    },
  );
});
