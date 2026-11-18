import { describe, expect, it } from 'vitest';

import { buildBrandPalette } from '../../heredado/lib/brandColors.js';
import { debeEscucharAudio } from '../../heredado/lib/asignacionMesas.js';
import { getMoneyBgClass, getMoneyTextClass } from '../../heredado/lib/moneyColors.js';
import { getPorcentajesSugeridos } from '../../heredado/utils/tipsUtils.js';
import { getUnidadesCompra } from '../../heredado/utils/unidadesMedida.js';

/**
 * DP-22 · EL EFECTO DE CADA AJUSTE QUE SE DECIDE EN UNA FUNCIÓN PURA.
 *
 * Cada `describe` lleva el nombre del ajuste de Configuración. Prueba lo que la persona espera al
 * cambiarlo —lo que ofrece la pantalla, lo que suena, el color que se pinta—, en los dos sentidos:
 * con el ajuste puesto y con el ajuste en su valor por omisión. Una lectura que ignore el ajuste
 * cae por el primer lado; una que lo vuelva obligatorio, por el segundo.
 *
 * La parte de «la pantalla llama a esta función con la configuración del negocio» la cubren las
 * specs de navegador (`pruebas/e2e/qa-final/ajustes.*.spec.ts`).
 */

describe('unidades_medida_lista', () => {
  it('las unidades que escribe el negocio se ofrecen primero, junto a las de siempre', () => {
    const unidades = getUnidadesCompra({ unidades_medida_lista: 'cubeta, bulto' });
    expect(unidades.slice(0, 2)).toEqual(['cubeta', 'bulto']);
    expect(unidades).toContain('kg');
    expect(unidades).toContain('litro');
  });

  it('sin lista, sólo las de siempre; y una repetida (aunque cambie la mayúscula) no se duplica', () => {
    const porOmision = getUnidadesCompra({});
    expect(porOmision[0]).toBe('kg');
    expect(porOmision).not.toContain('cubeta');
    const conRepetida = getUnidadesCompra({ unidades_medida_lista: 'KG, cubeta, Cubeta' });
    expect(conRepetida.filter((u) => u.toLowerCase() === 'kg')).toHaveLength(1);
    expect(conRepetida.filter((u) => u.toLowerCase() === 'cubeta')).toHaveLength(1);
  });
});

describe('silenciar_notificaciones_admin', () => {
  const admin = { id: 'a1', rol: 'administrador' };
  const mesero = { id: 'm1', rol: 'mesero' };

  it('encendido: el administrador no oye los avisos; los meseros sí', () => {
    const config = { silenciar_notificaciones_admin: true };
    expect(debeEscucharAudio(admin, config)).toBe(false);
    expect(debeEscucharAudio(mesero, config)).toBe(true);
  });

  it('apagado: el administrador también los oye', () => {
    const config = { silenciar_notificaciones_admin: false };
    expect(debeEscucharAudio(admin, config)).toBe(true);
    expect(debeEscucharAudio(mesero, config)).toBe(true);
  });

  it('sin sesión, nadie oye nada', () => {
    expect(debeEscucharAudio(null, { silenciar_notificaciones_admin: false })).toBe(false);
  });
});

describe('propina_porcentajes_sugeridos', () => {
  it('los porcentajes del negocio son los que se ofrecen, en el orden que los escribió', () => {
    expect(getPorcentajesSugeridos({ propina_porcentajes_sugeridos: '10,15' })).toEqual([10, 15]);
    expect(getPorcentajesSugeridos({ propina_porcentajes_sugeridos: '12, 8 ,20' })).toEqual([
      12, 8, 20,
    ]);
  });

  it('sin ajuste (o con basura) se ofrecen 5, 10, 15 y 20', () => {
    expect(getPorcentajesSugeridos({})).toEqual([5, 10, 15, 20]);
    expect(getPorcentajesSugeridos({ propina_porcentajes_sugeridos: 'nada' })).toEqual([
      5, 10, 15, 20,
    ]);
  });

  it('hasta seis, y nada fuera de 1 a 100', () => {
    expect(getPorcentajesSugeridos({ propina_porcentajes_sugeridos: '1,2,3,4,5,6,7,8' })).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(getPorcentajesSugeridos({ propina_porcentajes_sugeridos: '0,150,10' })).toEqual([10]);
  });
});

describe('colorear_importes_monetarios', () => {
  it('apagado: los importes salen en el color del texto, no en verde ni en rojo', () => {
    const config = { colorear_importes_monetarios: false };
    expect(getMoneyTextClass(config, 'text-exito')).toBe('text-foreground');
    expect(getMoneyBgClass(config, 'bg-exito')).not.toBe('bg-exito');
  });

  it('encendido o sin elegir: conservan su color', () => {
    expect(getMoneyTextClass({ colorear_importes_monetarios: true }, 'text-exito')).toBe(
      'text-exito',
    );
    expect(getMoneyTextClass({}, 'text-peligro')).toBe('text-peligro');
    expect(getMoneyBgClass({}, 'bg-exito')).toBe('bg-exito');
  });
});

describe('color_primario y color_acento', () => {
  it('los colores del negocio se vuelven las variables de marca que pinta todo el sistema', () => {
    const paleta = buildBrandPalette('#123456', '#abcdef');
    expect(paleta['--brand-primary']).toBe('#123456');
    expect(paleta['--brand-accent']).toBe('#abcdef');
  });

  it('el primario y el acento son independientes', () => {
    const a = buildBrandPalette('#123456', '#abcdef');
    const b = buildBrandPalette('#654321', '#abcdef');
    expect(b['--brand-primary']).not.toBe(a['--brand-primary']);
    expect(b['--brand-accent']).toBe(a['--brand-accent']);
  });

  it('sin color, o con uno ilegible, valen los de Don Poncho', () => {
    const porOmision = buildBrandPalette('', '');
    expect(porOmision['--brand-primary']).toBe('#83653f');
    expect(porOmision['--brand-accent']).toBe('#ac8a5f');
    expect(buildBrandPalette('rojo', 'azul')['--brand-primary']).toBe('#83653f');
  });
});
