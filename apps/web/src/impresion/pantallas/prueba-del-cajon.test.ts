import { describe, expect, it } from 'vitest';

import { cajonPorOmision, perfilPorOmision } from '../termico/perfil.ts';
import { formularioDesdePerfil, pulsoDelFormulario } from './formulario.ts';
import {
  conElCajonApagado,
  conElPulso,
  conLaRespuestaDelCajon,
  QUE_REVISAR_SI_NO_ABRIO,
} from './prueba-del-cajon.ts';

/**
 * DP-21 · Bloque 7 · EL LABORATORIO ENCIENDE EL INTERRUPTOR DEL CAJÓN sólo cuando la persona
 * confirma que se abrió tras el pulso de prueba.
 */

const apagado = formularioDesdePerfil(perfilPorOmision(80, { conexion: 'spooler' }));
const encendido = { ...apagado, tieneCajon: true };

describe('el pulso de prueba', () => {
  it('se arma con lo del formulario aunque el interruptor siga apagado', () => {
    const salida = pulsoDelFormulario({ ...apagado, cajonPin: 5, cajonEncendidoMs: '80' });
    expect(salida).toEqual({
      ok: true,
      cajon: { ...cajonPorOmision(), pin: 5, encendidoMs: 80 },
    });
  });

  it('con un tiempo fuera de rango dice qué campo', () => {
    const salida = pulsoDelFormulario({ ...apagado, cajonApagadoMs: '1' });
    expect(salida.ok).toBe(false);
    expect(!salida.ok && salida.errores.cajonApagadoMs).toBeTruthy();
  });
});

describe('«¿Se abrió el cajón?»', () => {
  it('Sí enciende el interruptor del perfil que se está armando', () => {
    const { formulario } = conLaRespuestaDelCajon(apagado, true);
    expect(formulario.tieneCajon).toBe(true);
  });

  it('No lo deja apagado y dice qué revisar', () => {
    const { formulario, mensaje } = conLaRespuestaDelCajon(apagado, false);
    expect(formulario.tieneCajon).toBe(false);
    expect(mensaje).toBe(QUE_REVISAR_SI_NO_ABRIO);
    expect(mensaje).toContain('pin');
  });

  it('No también apaga un interruptor que venía encendido', () => {
    expect(conLaRespuestaDelCajon(encendido, false).formulario.tieneCajon).toBe(false);
  });

  it('no toca nada más del formulario', () => {
    const { formulario } = conLaRespuestaDelCajon({ ...apagado, nombre: 'Caja 2' }, true);
    expect(formulario).toEqual({ ...apagado, nombre: 'Caja 2', tieneCajon: true });
  });
});

describe('lo confirmado era de ESE pulso', () => {
  it('cambiar el pin, el modo o los tiempos apaga el interruptor: hay que volver a probar', () => {
    expect(conElPulso(encendido, { cajonPin: 5 })).toMatchObject({
      cajonPin: 5,
      tieneCajon: false,
    });
    expect(conElPulso(encendido, { cajonModo: 'tiempo-real' }).tieneCajon).toBe(false);
    expect(conElPulso(encendido, { cajonEncendidoMs: '90' }).tieneCajon).toBe(false);
    expect(conElPulso(encendido, { cajonApagadoMs: '400' }).tieneCajon).toBe(false);
  });

  it('apagarlo a mano lo apaga y nada más', () => {
    expect(conElCajonApagado(encendido)).toEqual(apagado);
  });
});
