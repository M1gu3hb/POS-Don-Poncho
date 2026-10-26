import { describe, expect, it } from 'vitest';

import {
  NOMBRE_DEL_NEGOCIO,
  NOMBRE_DEL_SISTEMA,
  marcaVisibleDePlataforma,
  nombreVisibleDelNegocio,
  nombreVisibleDelSistema,
} from './nombre-visible';

describe('nombreVisibleDelNegocio', () => {
  it('quita el prefijo de demostración con que nace cada demo', () => {
    expect(nombreVisibleDelNegocio('Demo del acople · restaurante')).toBe('Restaurante');
    expect(nombreVisibleDelNegocio('Demo del acople · tienda')).toBe('Tienda');
  });

  it('devuelve el acento que el alta automática no puso', () => {
    expect(nombreVisibleDelNegocio('Demo del acople · cafeteria')).toBe('Cafetería');
    expect(nombreVisibleDelNegocio('Demo del acople · ferreteria')).toBe('Ferretería');
    expect(nombreVisibleDelNegocio('Demo del acople · estetica')).toBe('Estética');
  });

  it('tolera otros separadores y mayúsculas en el prefijo', () => {
    expect(nombreVisibleDelNegocio('DEMO DEL ACOPLE - tienda')).toBe('Tienda');
    expect(nombreVisibleDelNegocio('  demo del acople:  tienda ')).toBe('Tienda');
    expect(nombreVisibleDelNegocio('Demo del acople — Mi café')).toBe('Mi café');
  });

  it('con un resto que no es un giro, sólo le pone la mayúscula inicial', () => {
    expect(nombreVisibleDelNegocio('Demo del acople · taquería el güero')).toBe(
      'Taquería el güero',
    );
  });

  it('no retoca un nombre que escribió una persona', () => {
    expect(nombreVisibleDelNegocio('iStore Tijuana')).toBe('iStore Tijuana');
    expect(nombreVisibleDelNegocio('Restaurante MH')).toBe('Restaurante MH');
    expect(nombreVisibleDelNegocio('café jacaranda')).toBe('café jacaranda');
  });

  it('sólo quita «Demo del acople» al inicio y como palabra completa', () => {
    expect(nombreVisibleDelNegocio('Mi demo del acople · x')).toBe('Mi demo del acople · x');
    expect(nombreVisibleDelNegocio('Demo del acoplexyz')).toBe('Demo del acoplexyz');
  });

  it('cae al nombre de la casa cuando no queda nada que mostrar', () => {
    expect(NOMBRE_DEL_NEGOCIO).toBe('Don Poncho');
    expect(nombreVisibleDelNegocio('')).toBe(NOMBRE_DEL_NEGOCIO);
    expect(nombreVisibleDelNegocio('   ')).toBe(NOMBRE_DEL_NEGOCIO);
    expect(nombreVisibleDelNegocio('Demo del acople')).toBe(NOMBRE_DEL_NEGOCIO);
    expect(nombreVisibleDelNegocio('Demo del acople · ')).toBe(NOMBRE_DEL_NEGOCIO);
  });

  it('el nombre de la plataforma no es el del negocio: un valor por omisión que quedó se lee Don Poncho', () => {
    // «MH Astral Systems» era el `nombre_negocio` por omisión del maestro, y «Morphiq» su
    // marca. Un ticket de Don Poncho con cualquiera de los dos sería un ticket ajeno.
    for (const ajeno of [
      'MH Astral Systems',
      'mh-astral-systems',
      'Morphiq',
      'Morphiq POS',
      'MorphiqPOS',
    ]) {
      expect(nombreVisibleDelNegocio(ajeno), ajeno).toBe('Don Poncho');
    }
  });

  it('nunca lanza, venga lo que venga', () => {
    expect(nombreVisibleDelNegocio(null)).toBe(NOMBRE_DEL_NEGOCIO);
    expect(nombreVisibleDelNegocio(undefined)).toBe(NOMBRE_DEL_NEGOCIO);
    expect(nombreVisibleDelNegocio(42)).toBe(NOMBRE_DEL_NEGOCIO);
    expect(nombreVisibleDelNegocio({})).toBe(NOMBRE_DEL_NEGOCIO);
  });

  it('es idempotente: aplicarla dos veces da lo mismo que una', () => {
    const entradas = [
      'Demo del acople · restaurante',
      'Demo del acople · Demo del acople · tienda',
      'MH Astral Systems',
      'Café Jacaranda',
      '',
      'Demo del acople',
    ];
    for (const entrada of entradas) {
      const una = nombreVisibleDelNegocio(entrada);
      expect(nombreVisibleDelNegocio(una)).toBe(una);
    }
  });
});

describe('marcaVisibleDePlataforma', () => {
  it('la firma del sistema en la barra y en el corte es POS Don Poncho', () => {
    expect(marcaVisibleDePlataforma('')).toBe('POS Don Poncho');
    expect(marcaVisibleDePlataforma(undefined)).toBe('POS Don Poncho');
    expect(marcaVisibleDePlataforma('MH Astral Systems')).toBe('POS Don Poncho');
  });

  it('respeta una firma que el negocio escribió a propósito', () => {
    expect(marcaVisibleDePlataforma('Agencia Aurora')).toBe('Agencia Aurora');
  });

  it('Morphiq no firma documentos: su marca y su nombre de código se leen POS Don Poncho', () => {
    // Morphiq firma una sola vez, en el acceso («Sistema por Morphiq», `./contenido.ts`).
    for (const morphiq of ['Morphiq', 'MorphiqPOS', 'Morphiq POS']) {
      expect(marcaVisibleDePlataforma(morphiq), morphiq).toBe('POS Don Poncho');
    }
  });

  it('es idempotente', () => {
    for (const entrada of ['', 'MH Astral Systems', 'MorphiqPOS', 'Agencia Aurora']) {
      const una = marcaVisibleDePlataforma(entrada);
      expect(marcaVisibleDePlataforma(una)).toBe(una);
    }
  });
});

describe('nombreVisibleDelSistema', () => {
  it('el nombre de una plataforma anterior se lee POS Don Poncho', () => {
    expect(nombreVisibleDelSistema('MH Astral POS')).toBe('POS Don Poncho');
    expect(nombreVisibleDelSistema('MH Astral Systems POS')).toBe('POS Don Poncho');
    expect(nombreVisibleDelSistema('MH-Astral-Systems')).toBe('POS Don Poncho');
    expect(nombreVisibleDelSistema('Morphiq POS')).toBe('POS Don Poncho');
  });

  it('con el campo vacío dice POS Don Poncho', () => {
    expect(NOMBRE_DEL_SISTEMA).toBe('POS Don Poncho');
    expect(nombreVisibleDelSistema(null)).toBe(NOMBRE_DEL_SISTEMA);
    expect(nombreVisibleDelSistema('  ')).toBe('POS Don Poncho');
  });

  it('respeta un nombre escrito a mano', () => {
    expect(nombreVisibleDelSistema('Caja del Jacaranda')).toBe('Caja del Jacaranda');
  });

  it('el nombre de código del maestro («MorphiqPOS») tampoco se cuela', () => {
    expect(nombreVisibleDelSistema('MorphiqPOS')).toBe('POS Don Poncho');
  });
});
