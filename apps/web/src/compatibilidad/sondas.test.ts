import { describe, expect, it } from 'vitest';

import {
  AVISO_DEL_NIVEL,
  chromiumDe,
  LARGO_MAXIMO_DEL_UA,
  motorParaLaAuditoria,
  probarCompatibilidad,
  SONDAS,
  type VentanaSondeable,
} from './sondas.ts';

/**
 * DP-20.1 · «PROBAR COMPATIBILIDAD»: qué entiende el motor del aparato y en qué nivel lo deja.
 *
 * Las ventanas de aquí son de mentira y dicen lo que diría cada motor: un Chromium 99 (el del
 * iMin), uno actual y uno anterior a las capas de CSS.
 */

const UA_DEL_IMIN =
  'Mozilla/5.0 (Linux; Android 7.1.2; D4-503 Build/NHG47K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/101.0.4951.61 Safari/537.36';

/** Lo que `CSS.supports` contesta en un Chromium 99–103. */
const ENTIENDE_EL_99 = new Set([
  'aspect-ratio|1 / 1',
  'inset|0',
  'backdrop-filter|blur(1px)',
  'selector(:focus-visible)',
]);

/** Hace de `CSSLayerBlockRule`, `ResizeObserver`…: a las sondas les basta con que exista. */
function Falsa(): undefined {
  return undefined;
}

function ventana(opciones: {
  readonly ua?: string;
  readonly entiende?: (pregunta: string) => boolean;
  readonly sinCapas?: boolean;
  readonly moderna?: boolean;
}): VentanaSondeable {
  const moderna = opciones.moderna === true;
  const prototipo = moderna ? { at: 1, findLast: 1, toSorted: 1 } : { at: 1, findLast: 1 };
  return {
    navigator: { userAgent: opciones.ua ?? UA_DEL_IMIN, ...(moderna ? { wakeLock: {} } : {}) },
    CSS: {
      supports: (...partes: string[]) => (opciones.entiende ?? (() => false))(partes.join('|')),
    },
    ...(opciones.sinCapas === true ? {} : { CSSLayerBlockRule: Falsa }),
    CSSPropertyRule: Falsa,
    HTMLDialogElement: Falsa,
    HTMLElement: { prototype: moderna ? { inert: false, popover: null } : {} },
    Array: { prototype: prototipo },
    Object: moderna ? { hasOwn: () => true, groupBy: () => ({}) } : { hasOwn: () => true },
    structuredClone: () => null,
    ResizeObserver: Falsa,
  };
}

describe('el nivel del motor', () => {
  it('un Chromium 99–103 (el iMin) queda en modo compatible, y dice qué le falta', () => {
    const resultado = probarCompatibilidad(ventana({ entiende: (p) => ENTIENDE_EL_99.has(p) }));
    expect(resultado.nivel).toBe('compatible');
    expect(resultado.chromium).toBe('101.0.4951.61');
    expect(resultado.mayor).toBe(101);
    const falla = (id: string): boolean =>
      resultado.sondas.find((s) => s.id === id)?.pasa === false;
    for (const id of ['color-mix', 'translate', 'has', 'dvh', 'container', 'inert', 'to-sorted'])
      expect(falla(id)).toBe(true);
    for (const id of ['layer', 'property', 'aspect-ratio', 'inset', 'array-at', 'dialog'])
      expect(falla(id)).toBe(false);
    expect(AVISO_DEL_NIVEL[resultado.nivel]).toBe(
      'Este aparato usa un motor antiguo: el POS trabaja en modo compatible.',
    );
  });

  it('un motor actual es moderno y no avisa de nada', () => {
    const resultado = probarCompatibilidad(ventana({ entiende: () => true, moderna: true }));
    expect(resultado.nivel).toBe('moderno');
    expect(AVISO_DEL_NIVEL[resultado.nivel]).toBeNull();
  });

  it('con UNA de las cinco que faltan ya es compatible, no moderno', () => {
    const resultado = probarCompatibilidad(
      ventana({ entiende: (p) => p !== 'height|1dvh', moderna: true }),
    );
    expect(resultado.nivel).toBe('compatible');
  });

  it('sin capas de CSS el aparato es demasiado viejo, entienda lo que entienda', () => {
    const resultado = probarCompatibilidad(ventana({ entiende: () => true, sinCapas: true }));
    expect(resultado.nivel).toBe('demasiado-viejo');
    expect(AVISO_DEL_NIVEL[resultado.nivel]).toBe(
      'Este aparato es demasiado viejo para el POS. Pide ayuda a tu proveedor.',
    );
  });

  it('una sonda que revienta cuenta como «falla» y no tumba las demás', () => {
    const resultado = probarCompatibilidad(
      ventana({
        entiende: () => {
          throw new Error('este motor no sabe preguntar');
        },
      }),
    );
    expect(resultado.sondas).toHaveLength(SONDAS.length);
    expect(resultado.sondas.find((s) => s.id === 'color-mix')?.pasa).toBe(false);
    expect(resultado.sondas.find((s) => s.id === 'layer')?.pasa).toBe(true);
  });

  it('una ventana vacía no lanza: todo falla', () => {
    const resultado = probarCompatibilidad({});
    expect(resultado.ua).toBe('');
    expect(resultado.chromium).toBeNull();
    expect(resultado.sondas.every((s) => !s.pasa)).toBe(true);
    expect(resultado.nivel).toBe('demasiado-viejo');
  });
});

describe('la versión del motor', () => {
  it('sale del agente de usuario, también en el WebView y en el navegador sin ventana', () => {
    expect(chromiumDe(UA_DEL_IMIN)).toBe('101.0.4951.61');
    expect(chromiumDe('Mozilla/5.0 (X11) HeadlessChrome/99.0.4844.0 Safari/537.36')).toBe(
      '99.0.4844.0',
    );
    expect(
      chromiumDe('Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0'),
    ).toBe(null);
  });
});

describe('lo que se guarda en la auditoría', () => {
  it('es corto: el agente recortado, la versión, el nivel y los id de lo que falla', () => {
    const largo = `${UA_DEL_IMIN} ${'x'.repeat(600)}`;
    const resultado = probarCompatibilidad(
      ventana({ ua: largo, entiende: (p) => ENTIENDE_EL_99.has(p) }),
    );
    const motor = motorParaLaAuditoria(resultado);
    expect(motor.ua).toHaveLength(LARGO_MAXIMO_DEL_UA);
    expect(motor.mayor).toBe(101);
    expect(motor.nivel).toBe('compatible');
    expect(motor.fallan).toContain('color-mix');
    expect(motor.fallan).not.toContain('layer');
    expect(Object.keys(motor).sort()).toEqual(['fallan', 'mayor', 'nivel', 'ua']);
  });

  it('los id son los que acepta el servidor, únicos, y los mismos que usa la app', () => {
    const ids = SONDAS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,40}$/);
    // La lista de `compartido/pantallas/compatibilidad.js` (morphiq-pos-apps): mismos id.
    expect([...ids].sort()).toEqual([
      'abort-timeout',
      'array-at',
      'aspect-ratio',
      'backdrop-filter',
      'broadcast-channel',
      'color-mix',
      'container',
      'create-image-bitmap',
      'crypto-uuid',
      'dialog',
      'dvh',
      'field-sizing',
      'find-last',
      'focus-visible',
      'gap-flex',
      'has',
      'inert',
      'inset',
      'intersection-observer',
      'intl-segmenter',
      'layer',
      'nesting',
      'object-group-by',
      'object-has-own',
      'offscreen-canvas',
      'popover',
      'promise-with-resolvers',
      'property',
      'resize-observer',
      'structured-clone',
      'text-wrap',
      'to-sorted',
      'translate',
      'view-transitions',
      'wake-lock',
    ]);
  });
});
