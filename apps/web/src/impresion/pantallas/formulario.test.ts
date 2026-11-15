import { describe, expect, it } from 'vitest';

import { CORTES } from '../termico/escpos.ts';
import {
  cajonPorOmision,
  esquemaDelPerfil,
  perfilPorOmision,
  type Destino,
  type PerfilDeImpresion,
} from '../termico/perfil.ts';
import { conConexion, conImpresoraElegida, conPapel } from './cambios-del-formulario.ts';
import {
  formularioDesdePerfil,
  formularioInicial,
  perfilDesdeFormulario,
  type FormularioDelPerfil,
} from './formulario.ts';
import { RANGOS, entero } from './rangos.ts';

/**
 * DP-20 · DEL FORMULARIO AL PERFIL VÁLIDO Y DE VUELTA: lo que se teclea se vuelve un perfil que
 * el esquema acepta, o un mensaje en español por campo. Nada fuera de rango llega al aparato.
 */

const RED: Destino = { conexion: 'red', host: '192.168.1.50', puerto: 9100 };
const SERIE: Destino = { conexion: 'serial', puertoSerie: 'COM3', baudios: 19_200 };
const USB: Destino = { conexion: 'usb', vendorId: 1208, productId: 514, nombre: 'EPSON TM-T20' };

function completo(destino: Destino): PerfilDeImpresion {
  return {
    ...perfilPorOmision(58, destino),
    nombre: 'Mostrador',
    umbral: 170,
    franjaFilas: 32,
    bloqueBytes: 2048,
    pausaMs: 20,
    lineasAntesDelCorte: 6,
    corte: 'completo-con-avance',
    cajon: { ...cajonPorOmision(), pin: 5, modo: 'tiempo-real', alCobrarEnEfectivo: false },
    imprime: { ticket: true, precuenta: false, corte: true, cierre: false, estacion: 'Cocina' },
  };
}

function conCampos(parche: Partial<FormularioDelPerfil>): FormularioDelPerfil {
  const base = formularioDesdePerfil(completo(RED));
  return { ...base, ...parche };
}

describe('del perfil al formulario y de vuelta', () => {
  it.each([
    ['red', RED],
    ['serie', SERIE],
    ['usb', USB],
    ['spooler', { conexion: 'spooler', nombre: 'POS-80' } as const],
  ])('el perfil de %s vuelve idéntico', (_nombre, destino) => {
    const perfil = completo(destino);
    const resultado = perfilDesdeFormulario(formularioDesdePerfil(perfil));
    expect(resultado).toEqual({ ok: true, perfil });
  });

  it('un perfil sin cajón vuelve sin cajón', () => {
    const perfil = { ...completo(RED), cajon: null };
    expect(perfilDesdeFormulario(formularioDesdePerfil(perfil))).toEqual({ ok: true, perfil });
  });

  it('lo que sale siempre pasa el esquema del perfil', () => {
    const resultado = perfilDesdeFormulario(formularioDesdePerfil(completo(SERIE)));
    expect(resultado.ok && esquemaDelPerfil.safeParse(resultado.perfil).success).toBe(true);
  });
});

describe('el destino armado', () => {
  it('«red» lleva host y puerto; sin puerto vale 9100', () => {
    const resultado = perfilDesdeFormulario(conCampos({ host: ' 10.0.0.9 ', puerto: '' }));
    expect(resultado.ok && resultado.perfil.destino).toEqual({
      conexion: 'red',
      host: '10.0.0.9',
      puerto: 9100,
    });
  });

  it('«red» sin host dice qué falta', () => {
    const resultado = perfilDesdeFormulario(conCampos({ host: '   ' }));
    expect(resultado).toMatchObject({
      ok: false,
      errores: { host: 'Escribe la dirección IP de la impresora.' },
    });
  });

  it('«red» sólo acepta una dirección IP de la red local (DP-D125): ni nombres ni internet', () => {
    expect(perfilDesdeFormulario(conCampos({ host: 'impresora-cocina' }))).toMatchObject({
      ok: false,
      errores: {
        host: 'Escribe la dirección IP completa de la impresora (por ejemplo 192.168.1.50), no su nombre.',
      },
    });
    expect(perfilDesdeFormulario(conCampos({ host: '8.8.8.8' }))).toMatchObject({
      ok: false,
      errores: {
        host: 'Sólo se imprime en red hacia direcciones de tu red local (como 192.168.x.x o 10.x.x.x).',
      },
    });
    expect(perfilDesdeFormulario(conCampos({ host: '192.168.1.50' })).ok).toBe(true);
  });

  it('«serie» lleva COM y baudios; el COM se normaliza y el baudio vacío vale 9600', () => {
    const resultado = perfilDesdeFormulario(
      conCampos({ conexion: 'serial', puertoSerie: ' com4 ', baudios: '' }),
    );
    expect(resultado.ok && resultado.perfil.destino).toEqual({
      conexion: 'serial',
      puertoSerie: 'COM4',
      baudios: 9600,
    });
  });

  it.each(['COM', 'tty0', 'COM1234', ''])('«serie» rechaza el puerto «%s»', (puertoSerie) => {
    const resultado = perfilDesdeFormulario(conCampos({ conexion: 'serial', puertoSerie }));
    expect(resultado).toMatchObject({
      ok: false,
      errores: { puertoSerie: 'El puerto serie se escribe así: COM3.' },
    });
  });

  it('una conexión de lista sin impresora elegida pide elegirla', () => {
    const resultado = perfilDesdeFormulario(conCampos({ conexion: 'usb', elegida: null }));
    expect(resultado).toMatchObject({
      ok: false,
      errores: { elegida: 'Elige una impresora de la lista.' },
    });
  });

  it('una impresora de otra conexión no vale', () => {
    const resultado = perfilDesdeFormulario(conCampos({ conexion: 'usb', elegida: SERIE }));
    expect(resultado.ok).toBe(false);
  });

  it('para la vista previa no se exige impresora', () => {
    const resultado = perfilDesdeFormulario(formularioInicial(), { sinDestino: true });
    expect(resultado.ok && resultado.perfil.puntos).toBe(576);
  });
});

describe('los valores fuera de rango se rechazan con su mensaje', () => {
  it.each([
    ['puntos', '199', 'puntos', 'Puntos: escribe un número entero entre 200 y 1200.'],
    ['puntos', '1201', 'puntos', 'Puntos: escribe un número entero entre 200 y 1200.'],
    ['umbral', '0', 'umbral', 'Umbral: escribe un número entero entre 1 y 254.'],
    ['umbral', '255', 'umbral', 'Umbral: escribe un número entero entre 1 y 254.'],
    [
      'franjaFilas',
      '0',
      'franjaFilas',
      'Filas por franja: escribe un número entero entre 1 y 1024.',
    ],
    ['bloqueBytes', '63', 'bloqueBytes', 'Bloque: escribe un número entero entre 64 y 65536.'],
    ['pausaMs', '2001', 'pausaMs', 'Pausa: escribe un número entero entre 0 y 2000.'],
    [
      'lineasAntesDelCorte',
      '21',
      'lineasAntesDelCorte',
      'Líneas antes del corte: escribe un número entero entre 0 y 20.',
    ],
  ] as const)('%s = «%s»', (campo, valor, clave, mensaje) => {
    const resultado = perfilDesdeFormulario(conCampos({ [campo]: valor }));
    expect(resultado).toMatchObject({ ok: false, errores: { [clave]: mensaje } });
  });

  it.each(['', 'abc', '12.5', '-5', '1e3', ' '])('«%s» no es un entero', (valor) => {
    const resultado = perfilDesdeFormulario(conCampos({ puntos: valor }));
    expect(resultado.ok).toBe(false);
  });

  it('los extremos del rango sí pasan', () => {
    const resultado = perfilDesdeFormulario(
      conCampos({ puntos: '200', umbral: '254', pausaMs: '0', bloqueBytes: '65536' }),
    );
    expect(resultado.ok).toBe(true);
  });

  it('los pulsos del cajón fuera de 2–510 ms se rechazan', () => {
    const resultado = perfilDesdeFormulario(conCampos({ cajonEncendidoMs: '1' }));
    expect(resultado).toMatchObject({
      ok: false,
      errores: { cajonEncendidoMs: 'Pulso encendido: escribe un número entero entre 2 y 510.' },
    });
  });

  it('un nombre vacío o de más de 60 caracteres se rechaza', () => {
    expect(perfilDesdeFormulario(conCampos({ nombre: '  ' })).ok).toBe(false);
    expect(perfilDesdeFormulario(conCampos({ nombre: 'x'.repeat(61) })).ok).toBe(false);
  });

  it('el texto ESC/POS todavía no se puede elegir', () => {
    const resultado = perfilDesdeFormulario(conCampos({ lenguaje: 'escpos-texto' }));
    expect(resultado).toMatchObject({
      ok: false,
      errores: { lenguaje: 'El texto ESC/POS por página de códigos todavía no está disponible.' },
    });
  });

  it('`entero` usa los rangos del formulario', () => {
    expect(entero('9100', 'Puerto', RANGOS.puerto)).toEqual({ ok: true, valor: 9100 });
    expect(entero('65536', 'Puerto', RANGOS.puerto).ok).toBe(false);
  });
});

describe('los cambios del formulario', () => {
  it('cambiar el rollo pone los puntos de siempre de ese rollo', () => {
    expect(conPapel(formularioInicial(), 58).puntos).toBe('384');
    expect(conPapel(conPapel(formularioInicial(), 58), 80).puntos).toBe('576');
  });

  it('elegir «driver» fija el lenguaje del driver y salir de él vuelve a la imagen', () => {
    const driver = conConexion(formularioInicial(), 'driver');
    expect(driver.lenguaje).toBe('driver');
    expect(conConexion(driver, 'red').lenguaje).toBe('escpos-imagen');
  });

  it('cambiar de conexión suelta la impresora elegida de otra', () => {
    const conUsb = { ...formularioInicial(), conexion: 'usb' as const, elegida: USB };
    expect(conConexion(conUsb, 'bluetooth').elegida).toBeNull();
    expect(conConexion(conUsb, 'usb').elegida).toEqual(USB);
  });

  it('elegir una impresora toma su nombre sólo si el nombre era el de fábrica', () => {
    const inicial = formularioInicial();
    expect(conImpresoraElegida(inicial, USB, 'EPSON TM-T20').nombre).toBe('EPSON TM-T20');
    const propio = { ...inicial, nombre: 'Barra' };
    expect(conImpresoraElegida(propio, USB, 'EPSON TM-T20').nombre).toBe('Barra');
  });

  it('el formulario inicial no tiene impresora elegida y no es un perfil completo', () => {
    expect(formularioInicial().elegida).toBeNull();
    expect(perfilDesdeFormulario(formularioInicial()).ok).toBe(false);
  });

  it('las opciones de corte del formulario son las del esquema', () => {
    for (const corte of CORTES) {
      const resultado = perfilDesdeFormulario(conCampos({ corte }));
      expect(resultado.ok && resultado.perfil.corte).toBe(corte);
    }
  });
});
