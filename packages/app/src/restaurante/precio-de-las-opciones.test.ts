import { centavos } from '@morphiqpos/domain/dinero';
import { describe, expect, it } from 'vitest';

import {
  opcionConSuPrecio,
  precioConLasOpciones,
  sumaDeLasOpciones,
} from './precio-de-las-opciones.ts';

describe('DP-16 · cada opción dice su precio en la cuenta y el ticket', () => {
  it('suma, resta o nada', () => {
    expect(opcionConSuPrecio('Flor de calabaza', 1_500n)).toBe('Flor de calabaza (+$15.00)');
    expect(opcionConSuPrecio('Sin crema', -500n)).toBe('Sin crema (−$5.00)');
    expect(opcionConSuPrecio('Queso', 0n)).toBe('Queso');
    expect(opcionConSuPrecio('Kilo extra', 123_456n)).toBe('Kilo extra (+$1,234.56)');
  });
});

const precio = (unitario: number, subtotal: number) => ({
  precioUnitarioCentavos: centavos(unitario),
  subtotalCentavos: centavos(subtotal),
  esMayoreo: false,
});

describe('DP-16 · el precio de las opciones lo pone el servidor', () => {
  it('suma lo de cada opción elegida, también las que restan', () => {
    expect(
      sumaDeLasOpciones([
        { deltaCentavos: 1_500n },
        { deltaCentavos: -500n },
        { deltaCentavos: 0n },
      ]),
    ).toBe(1_000n);
  });

  it('en una pieza va por unidad: 2 tacos con +$15 de queso suman $30', () => {
    const r = precioConLasOpciones('precio_fijo', '2', precio(3_000, 6_000), [
      { deltaCentavos: 1_500n },
    ]);
    expect(r.precioUnitarioCentavos).toBe(4_500n);
    expect(r.subtotalCentavos).toBe(9_000n);
  });

  it('en lo que va por peso va por renglón: ½ kg de barbacoa + $20 de tortillas', () => {
    const r = precioConLasOpciones('variable_medida', '0.5', precio(79_500, 39_750), [
      { deltaCentavos: 2_000n },
    ]);
    // El precio por kilo no cambia; el renglón sube lo de la opción una vez.
    expect(r.precioUnitarioCentavos).toBe(79_500n);
    expect(r.subtotalCentavos).toBe(41_750n);
  });

  it('una opción que resta abarata, pero nunca por debajo de cero', () => {
    expect(
      precioConLasOpciones('precio_fijo', '1', precio(3_000, 3_000), [{ deltaCentavos: -500n }])
        .subtotalCentavos,
    ).toBe(2_500n);
    const gratis = precioConLasOpciones('precio_fijo', '3', precio(1_000, 3_000), [
      { deltaCentavos: -5_000n },
    ]);
    expect(gratis.precioUnitarioCentavos).toBe(0n);
    expect(gratis.subtotalCentavos).toBe(0n);
  });

  it('sin opciones con precio el renglón queda idéntico', () => {
    const p = precio(3_000, 6_000);
    expect(precioConLasOpciones('precio_fijo', '2', p, [])).toBe(p);
    expect(precioConLasOpciones('precio_fijo', '2', p, [{ deltaCentavos: 0n }])).toBe(p);
  });
});
