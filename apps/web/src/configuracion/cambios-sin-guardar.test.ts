import { beforeEach, describe, expect, it } from 'vitest';

import {
  PREGUNTA_DE_SALIR,
  hayCambiosSinGuardar,
  marcarSucia,
  olvidarTodas,
  puedoSalir,
  tarjetasSinGuardar,
} from './cambios-sin-guardar.ts';

/** DP-21 · Bloque 21 · «salir con cambios sin guardar avisa». */
describe('cambios sin guardar', () => {
  beforeEach(olvidarTodas);

  it('sin nada sucio se sale sin preguntar', () => {
    let preguntas = 0;
    const sale = puedoSalir(() => {
      preguntas += 1;
      return false;
    });
    expect(sale).toBe(true);
    expect(preguntas).toBe(0);
  });

  it('con una tarjeta sucia pregunta; si no se confirma, no sale y no olvida nada', () => {
    marcarSucia('iva', true);
    expect(hayCambiosSinGuardar()).toBe(true);
    let texto = '';
    const sale = puedoSalir((t) => {
      texto = t;
      return false;
    });
    expect(sale).toBe(false);
    expect(texto).toBe(PREGUNTA_DE_SALIR);
    expect(tarjetasSinGuardar()).toEqual(['iva']);
  });

  it('si se confirma, sale y se olvida lo que quedó sin guardar', () => {
    marcarSucia('iva', true);
    marcarSucia('folios', true);
    expect(puedoSalir(() => true)).toBe(true);
    expect(hayCambiosSinGuardar()).toBe(false);
  });

  it('guardar (o limpiar la tarjeta) la quita; las demás siguen', () => {
    marcarSucia('iva', true);
    marcarSucia('folios', true);
    marcarSucia('iva', false);
    expect(tarjetasSinGuardar()).toEqual(['folios']);
  });
});
