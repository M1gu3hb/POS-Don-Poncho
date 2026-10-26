import { describe, expect, it } from 'vitest';

import {
  NEGOCIO_DON_PONCHO,
  NEGOCIOS_AJENOS,
  NEGOCIOS_DE_PRUEBA,
  NEGOCIOS_REALES,
  NoEsUnNegocioDePrueba,
  esDeUnProyectoIntocable,
  negocioAjeno,
  exigirNegocioDePrueba,
  negocioDePruebaPorSlug,
  negocioReal,
} from './index.ts';

/**
 * La guarda de todo lo que prueba, siembra o resetea (bloque B de la 2.4, reducida en DP-2).
 *
 * Lo que fija: la regla es POSITIVA —sólo los restaurantes de prueba pasan, y sólo existen en
 * bases desechables—. Don Poncho es el único negocio real de este sistema, y los negocios que
 * conviven con él en la base compartida de la Fase A son ajenos: tampoco se tocan.
 */
describe('las tres listas', () => {
  it('Don Poncho es el único negocio real, con su ID fijo', () => {
    expect(NEGOCIOS_REALES).toEqual([NEGOCIO_DON_PONCHO]);
    expect(NEGOCIO_DON_PONCHO.slug).toBe('don-poncho');
    expect(NEGOCIO_DON_PONCHO.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/);
  });

  it('los de prueba no comparten ni un ID ni un slug con los reales ni con los ajenos', () => {
    const protegidos = new Set(
      [...NEGOCIOS_REALES, ...NEGOCIOS_AJENOS].flatMap((n) => [n.id, n.slug]),
    );
    for (const prueba of NEGOCIOS_DE_PRUEBA) {
      expect(protegidos.has(prueba.id)).toBe(false);
      expect(protegidos.has(prueba.slug)).toBe(false);
    }
  });

  it('hay dos restaurantes de prueba: la jornada usa uno y el aislamiento pide el otro', () => {
    expect(NEGOCIOS_DE_PRUEBA.map((n) => n.slug)).toEqual([
      'prueba-restaurante',
      'prueba-restaurante-dos',
    ]);
    expect(NEGOCIOS_DE_PRUEBA.every((n) => n.giro === 'restaurante')).toBe(true);
    // Ningún nombre de demostración a la vista (DP-2).
    for (const n of NEGOCIOS_DE_PRUEBA) expect(n.nombre).not.toMatch(/demo|MH|Morphiq/i);
  });

  it('los ajenos incluyen las demostraciones del maestro que viven en la base compartida', () => {
    const slugs = NEGOCIOS_AJENOS.map((n) => n.slug);
    for (const slug of [
      'mh-restaurante',
      'demo-acople-restaurante',
      'demo-acople-tienda',
      'demo-cafe-jacaranda',
    ]) {
      expect(slugs).toContain(slug);
    }
  });
});

describe('exigirNegocioDePrueba', () => {
  it('deja pasar a un restaurante de prueba, por ID y por slug', () => {
    const prueba = negocioDePruebaPorSlug('prueba-restaurante');
    expect(prueba).not.toBeNull();
    expect(exigirNegocioDePrueba({ id: prueba?.id ?? '' }, 'x').slug).toBe('prueba-restaurante');
    expect(exigirNegocioDePrueba({ slug: 'prueba-restaurante' }, 'x').id).toBe(prueba?.id);
    expect(
      exigirNegocioDePrueba({ id: prueba?.id ?? '', slug: 'prueba-restaurante' }, 'x').slug,
    ).toBe('prueba-restaurante');
  });

  it('para a Don Poncho, por ID y por slug, y dice quién es', () => {
    expect(() => exigirNegocioDePrueba({ id: NEGOCIO_DON_PONCHO.id }, 'resetear')).toThrow(
      NoEsUnNegocioDePrueba,
    );
    expect(() => exigirNegocioDePrueba({ slug: 'don-poncho' }, 'resetear')).toThrow(
      NoEsUnNegocioDePrueba,
    );
    expect(() => exigirNegocioDePrueba({ id: NEGOCIO_DON_PONCHO.id }, 'resetear')).toThrow(
      NEGOCIO_DON_PONCHO.nombre,
    );
  });

  it('para a CADA negocio ajeno de la base compartida, aunque su slug diga demo', () => {
    for (const ajeno of NEGOCIOS_AJENOS) {
      expect(() => exigirNegocioDePrueba({ id: ajeno.id }, 'resetear')).toThrow(
        NoEsUnNegocioDePrueba,
      );
      expect(() => exigirNegocioDePrueba({ slug: ajeno.slug }, 'resetear')).toThrow(
        NoEsUnNegocioDePrueba,
      );
    }
  });

  it('para a un negocio que no está en ninguna lista: la regla es positiva', () => {
    expect(() =>
      exigirNegocioDePrueba({ id: '99999999-0000-4000-8000-000000000000' }, 'sembrar'),
    ).toThrow(NoEsUnNegocioDePrueba);
    expect(() => exigirNegocioDePrueba({ slug: 'prueba-cafeteria' }, 'sembrar')).toThrow(
      NoEsUnNegocioDePrueba,
    );
    expect(() => exigirNegocioDePrueba({}, 'sembrar')).toThrow(NoEsUnNegocioDePrueba);
    expect(() => exigirNegocioDePrueba({ id: '', slug: '' }, 'sembrar')).toThrow(
      NoEsUnNegocioDePrueba,
    );
  });

  it('para un slug de prueba con el ID de un negocio real', () => {
    expect(() =>
      exigirNegocioDePrueba({ id: NEGOCIO_DON_PONCHO.id, slug: 'prueba-restaurante' }, 'x'),
    ).toThrow(NoEsUnNegocioDePrueba);
  });
});

describe('negocioReal', () => {
  it('reconoce a Don Poncho y a los ajenos, que nunca se dan de alta ni se tocan', () => {
    expect(negocioReal('don-poncho')?.id).toBe(NEGOCIO_DON_PONCHO.id);
    expect(negocioReal(NEGOCIOS_AJENOS[0]?.id)).not.toBeNull();
    expect(negocioReal('prueba-restaurante')).toBeNull();
  });
});

describe('negocioAjeno', () => {
  it('reconoce a los ajenos de la base compartida, y NO a Don Poncho ni a los de prueba', () => {
    for (const ajeno of NEGOCIOS_AJENOS) {
      expect(negocioAjeno(ajeno.id)?.slug).toBe(ajeno.slug);
      expect(negocioAjeno(ajeno.slug)?.id).toBe(ajeno.id);
    }
    // Don Poncho no es ajeno: su alta y su primer acceso sí proceden (una vez).
    expect(negocioAjeno('don-poncho')).toBeNull();
    expect(negocioAjeno(NEGOCIO_DON_PONCHO.id)).toBeNull();
    expect(negocioAjeno('prueba-restaurante')).toBeNull();
  });
});

describe('esDeUnProyectoIntocable', () => {
  it('reconoce el proyecto de producción por su referencia, en URL directa y del pooler', () => {
    expect(
      esDeUnProyectoIntocable(
        'postgresql://postgres:x@db.wyqmzhliurwyxuyxznpb.supabase.co:5432/postgres',
      ),
    ).toBe(true);
    expect(
      esDeUnProyectoIntocable(
        'postgresql://postgres.wyqmzhliurwyxuyxznpb:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
      ),
    ).toBe(true);
    expect(esDeUnProyectoIntocable('postgresql://postgres:postgres@localhost:5432/prueba')).toBe(
      false,
    );
  });

  it('el usuario CODIFICADO no esconde el proyecto: el driver lo decodifica y se conecta igual', () => {
    expect(
      esDeUnProyectoIntocable(
        'postgresql://postgres.%77yqmzhliurwyxuyxznpb:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
      ),
    ).toBe(true);
  });

  it('una codificación rota no se puede leer, y lo que no se lee es intocable', () => {
    expect(esDeUnProyectoIntocable('postgresql://postgres.%E0%A4%A:x@localhost:5432/p')).toBe(true);
  });
});
