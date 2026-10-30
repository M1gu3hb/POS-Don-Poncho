import { describe, expect, it } from 'vitest';

import {
  BILLETES_DE_COBRO,
  cambioDelCobro,
  importeExacto,
  limpiarImporte,
  ponerBillete,
  teclearImporte,
  type TeclaDeCobro,
} from './teclado-de-cobro.ts';

/**
 * EL TECLADO DE COBRO, sin pantalla: lo que cada tecla le hace al texto de «Recibido».
 *
 * El texto es el mismo que el campo: dígitos y a lo sumo un punto, como lo dejaba `NumericInput`.
 * Aquí se fija lo que el dedo espera de una caja registradora: el cero de la izquierda no se
 * acumula, el «00» son dos ceros de verdad, el punto no se repite y el billete FIJA lo recibido
 * (no lo suma: el cliente pone UN billete en la mano, no otro encima del anterior).
 */

/** Aplica varias teclas seguidas, como un cajero. */
function teclear(inicio: string, ...teclas: readonly TeclaDeCobro[]): string {
  return teclas.reduce(teclearImporte, inicio);
}

describe('los dígitos', () => {
  it('se van agregando a la derecha', () => {
    expect(teclear('', '1', '2', '3')).toBe('123');
    expect(teclear('50', '7')).toBe('507');
  });

  it('un cero a la izquierda no se acumula: el siguiente dígito lo reemplaza', () => {
    expect(teclear('', '0')).toBe('0');
    expect(teclear('0', '5')).toBe('5');
    expect(teclear('', '0', '0', '7')).toBe('7');
  });

  it('hasta siete cifras de pesos, como el resto de la caja', () => {
    expect(teclear('1234567', '8')).toBe('1234567');
    expect(teclear('123456', '7')).toBe('1234567');
  });

  it('con punto, hasta dos decimales', () => {
    expect(teclear('5.1', '2')).toBe('5.12');
    expect(teclear('5.12', '3')).toBe('5.12');
  });
});

describe('el «00»', () => {
  it('agrega DOS ceros: «5» pasa a «500»', () => {
    expect(teclear('5', '00')).toBe('500');
    expect(teclear('12', '00')).toBe('1200');
  });

  it('sobre un texto vacío o un cero se queda en un solo cero', () => {
    expect(teclear('', '00')).toBe('0');
    expect(teclear('0', '00')).toBe('0');
  });

  it('no pasa de siete cifras ni de dos decimales: agrega los que caben', () => {
    expect(teclear('123456', '00')).toBe('1234560');
    expect(teclear('5.1', '00')).toBe('5.10');
    expect(teclear('5.12', '00')).toBe('5.12');
  });
});

describe('el punto', () => {
  it('sobre un texto vacío empieza en «0.»', () => {
    expect(teclear('', '.')).toBe('0.');
  });

  it('va después de los pesos y no se repite', () => {
    expect(teclear('5', '.')).toBe('5.');
    expect(teclear('5.', '.')).toBe('5.');
    expect(teclear('5.5', '.')).toBe('5.5');
  });
});

describe('borrar', () => {
  it('quita el último carácter, el punto incluido', () => {
    expect(teclear('123', 'borrar')).toBe('12');
    expect(teclear('5.', 'borrar')).toBe('5');
    expect(teclear('5.25', 'borrar', 'borrar')).toBe('5.');
  });

  it('sobre un texto vacío no hace nada', () => {
    expect(teclear('', 'borrar')).toBe('');
  });
});

describe('el atajo de billete', () => {
  it('son los cuatro de siempre', () => {
    expect(BILLETES_DE_COBRO).toEqual([50, 100, 200, 500]);
  });

  it('es lo recibido tal cual, en pesos enteros', () => {
    expect(ponerBillete(500)).toBe('500');
    expect(ponerBillete(50)).toBe('50');
    // El texto que deja es uno que el campo acepta.
    for (const billete of BILLETES_DE_COBRO) {
      expect(limpiarImporte(ponerBillete(billete))).toBe(String(billete));
    }
  });
});

describe('«Exacto»', () => {
  it('es el total en pesos con dos decimales, sin pasar por coma flotante', () => {
    expect(importeExacto(85_050)).toBe('850.50');
    expect(importeExacto(85_000)).toBe('850.00');
    expect(importeExacto(5)).toBe('0.05');
    expect(importeExacto(1_999_999)).toBe('19999.99');
  });

  it('un total que no se puede cobrar queda en cero', () => {
    expect(importeExacto(0)).toBe('0.00');
    expect(importeExacto(-300)).toBe('0.00');
  });
});

describe('el filtro del campo, el mismo que tenía NumericInput', () => {
  it('la coma es el punto', () => {
    expect(limpiarImporte('1,5')).toBe('1.5');
  });

  it('acepta lo que se escribe a medias', () => {
    expect(limpiarImporte('')).toBe('');
    expect(limpiarImporte('0.')).toBe('0.');
    expect(limpiarImporte('.5')).toBe('.5');
  });

  it('rechaza lo que no es un importe: letras, dos puntos, ocho cifras, tres decimales', () => {
    expect(limpiarImporte('12a')).toBeNull();
    expect(limpiarImporte('1.2.3')).toBeNull();
    expect(limpiarImporte('12345678')).toBeNull();
    expect(limpiarImporte('1.234')).toBeNull();
  });
});

describe('el cambio', () => {
  it('es lo recibido menos el total, en centavos', () => {
    expect(cambioDelCobro('500', 35_050)).toBe(14_950);
    expect(cambioDelCobro('350.50', 35_050)).toBe(0);
  });

  it('nunca es negativo: si no alcanza, es cero', () => {
    expect(cambioDelCobro('100', 35_050)).toBe(0);
  });

  it('sin recibido, o con un texto a medias, se lee como se escribió', () => {
    expect(cambioDelCobro('', 35_050)).toBe(0);
    expect(cambioDelCobro('400.', 35_050)).toBe(4_950);
    expect(cambioDelCobro('400.5', 35_050)).toBe(5_000);
    expect(cambioDelCobro('.5', 0)).toBe(50);
  });

  it('el texto que dejó el campo del mixto (sin tope de decimales) se lee hasta los centavos', () => {
    expect(cambioDelCobro('400.129', 35_050)).toBe(4_962);
    expect(cambioDelCobro('12345678', 0)).toBe(1_234_567_800);
  });

  it('un texto que no es un número vale cero', () => {
    expect(cambioDelCobro('abc', 0)).toBe(0);
    expect(cambioDelCobro('1.2.3', 0)).toBe(0);
  });
});
