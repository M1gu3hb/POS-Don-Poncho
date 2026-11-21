import { describe, expect, it } from 'vitest';

import {
  COBRO_INICIAL,
  MAXIMO_DE_TARJETAS,
  agregarTarjeta,
  dividirEnTarjetas,
  elegirModo,
  escribir,
  leerElCobro,
  quitarTarjeta,
  restoParaLaTarjeta,
  teclear,
  textoDeCentavos,
  trasLaTecla,
  type CobroEnPantalla,
} from './cobro-en-pantalla.ts';

/** DP-24 · Lo que la cajera teclea en la tarjeta de cobro, y la cuenta que sale de ahí. */
const DIEZ = { tipo: 'porcentaje', puntosBase: 1000 } as const;
const SIN = { tipo: 'sin_propina' } as const;

describe('el teclado de la tarjeta', () => {
  it('arma importes bien formados: sin ceros de más, un solo punto y dos centavos', () => {
    expect(trasLaTecla('', '5')).toBe('5');
    expect(trasLaTecla('0', '5')).toBe('5');
    expect(trasLaTecla('5', '00')).toBe('500');
    expect(trasLaTecla('', '00')).toBe('0');
    expect(trasLaTecla('', '.')).toBe('0.');
    expect(trasLaTecla('12', '.')).toBe('12.');
    expect(trasLaTecla('12.', '.')).toBe('12.');
    expect(trasLaTecla('12.5', '0')).toBe('12.50');
    expect(trasLaTecla('12.50', '9')).toBe('12.50');
    expect(trasLaTecla('12.5', '00')).toBe('12.5');
  });

  it('no pasa de siete cifras de pesos, borra de una en una y limpia todo', () => {
    expect(trasLaTecla('1234567', '8')).toBe('1234567');
    expect(trasLaTecla('1,500', '0')).toBe('15000');
    expect(trasLaTecla('12.5', 'borrar')).toBe('12.');
    expect(trasLaTecla('', 'borrar')).toBe('');
    expect(trasLaTecla('999.99', 'limpiar')).toBe('');
  });

  it('escribe en el campo activo; sin campo activo no hace nada', () => {
    const conRecibido = teclear(teclear(COBRO_INICIAL, '5'), '00');
    expect(conRecibido.recibido).toBe('500');
    const sinCampo: CobroEnPantalla = { ...COBRO_INICIAL, campoActivo: null };
    expect(teclear(sinCampo, '5')).toBe(sinCampo);
  });

  it('un importe se escribe como se lee: «506» o «506.50»', () => {
    expect(textoDeCentavos(50_600)).toBe('506');
    expect(textoDeCentavos(50_650)).toBe('506.50');
    expect(textoDeCentavos(5)).toBe('0.05');
  });
});

describe('las formas de pago', () => {
  it('tarjeta y transferencia no piden teclear nada; mixto abre la primera tarjeta', () => {
    expect(elegirModo(COBRO_INICIAL, 'tarjeta')).toMatchObject({
      modo: 'tarjeta',
      dividida: false,
      tarjetas: [],
      campoActivo: null,
    });
    expect(elegirModo(COBRO_INICIAL, 'transferencia').campoActivo).toBeNull();
    expect(elegirModo(COBRO_INICIAL, 'mixto')).toMatchObject({
      modo: 'mixto',
      tarjetas: [''],
      campoActivo: 'tarjeta-0',
    });
  });

  it('«Dividir en tarjetas» abre dos; se agregan hasta el tope y con menos de dos vuelve a una', () => {
    let estado = dividirEnTarjetas(elegirModo(COBRO_INICIAL, 'tarjeta'));
    expect(estado).toMatchObject({ dividida: true, tarjetas: ['', ''], campoActivo: 'tarjeta-0' });
    for (let i = 0; i < 20; i += 1) estado = agregarTarjeta(estado);
    expect(estado.tarjetas).toHaveLength(MAXIMO_DE_TARJETAS);
    const dos = dividirEnTarjetas(COBRO_INICIAL);
    expect(quitarTarjeta(dos, 1)).toMatchObject({ modo: 'tarjeta', dividida: false, tarjetas: [] });
  });

  it('cambiar de forma de pago apaga «dejar el cambio» y «la propina se pagó con»', () => {
    const conCambio: CobroEnPantalla = {
      ...COBRO_INICIAL,
      recibido: '600',
      cambioComoPropina: true,
      propinaCon: 'tarjeta',
    };
    expect(elegirModo(conCambio, 'mixto')).toMatchObject({
      cambioComoPropina: false,
      propinaCon: null,
    });
  });

  it('tocar un importe deshace «dejar el cambio como propina»: era para otro cambio', () => {
    const conCambio: CobroEnPantalla = {
      ...COBRO_INICIAL,
      recibido: '600',
      cambioComoPropina: true,
    };
    expect(escribir(conCambio, 'recibido', '700').cambioComoPropina).toBe(false);
    // El «otro monto» de la propina no es un pago: no lo toca.
    expect(escribir(conCambio, 'otro-monto', '30').cambioComoPropina).toBe(true);
  });
});

describe('leerElCobro', () => {
  it('«Recibido» vacío es exacto; un cero tecleado NO lo es', () => {
    const exacto = leerElCobro(COBRO_INICIAL, 46_000, DIEZ);
    expect(exacto.cuenta.tropiezo).toBeNull();
    expect(exacto.cuenta.pagos).toEqual([
      { metodo: 'efectivo', montoCentavos: 46_000, propinaCentavos: 4_600 },
    ]);
    const cero = leerElCobro({ ...COBRO_INICIAL, recibido: '0' }, 46_000, DIEZ);
    expect(cero.cuenta.tropiezo).toBe('Faltan $506.00 en efectivo.');
    expect(cero.cuenta.pagos).toEqual([]);
  });

  it('RECIBIDO MENOR AL TOTAL, tecleado: no hay pagos que mandar', () => {
    const corto = leerElCobro({ ...COBRO_INICIAL, recibido: '500' }, 46_000, DIEZ);
    expect(corto.cuenta.tropiezo).toBe('Faltan $6.00 en efectivo.');
    expect(corto.cuenta.pagos).toEqual([]);
  });

  it('un importe que no se entiende detiene el cobro (no cuenta como cero)', () => {
    const raro = leerElCobro({ ...COBRO_INICIAL, recibido: '5OO' }, 46_000, SIN);
    expect(raro.ilegible).toBe(true);
    expect(raro.cuenta.tropiezo).toContain('no se entiende');
    expect(raro.cuenta.pagos).toEqual([]);
    const coma = leerElCobro(
      { ...dividirEnTarjetas(COBRO_INICIAL), tarjetas: ['1,5', '458.50'] },
      46_000,
      SIN,
    );
    expect(coma.ilegible).toBe(true);
    expect(coma.cuenta.pagos).toEqual([]);
  });

  it('lo tecleado en un modo no se cuela en otro', () => {
    // Venía de mixto con tarjetas y transferencia; ahora paga todo en efectivo.
    const estado: CobroEnPantalla = {
      ...COBRO_INICIAL,
      modo: 'efectivo',
      tarjetas: ['300'],
      transferencia: '100',
    };
    expect(leerElCobro(estado, 46_000, SIN).cuenta.pagos).toEqual([
      { metodo: 'efectivo', montoCentavos: 46_000 },
    ]);
  });

  it('dividida y mixto leen sus tarjetas; «con qué se pagó la propina» viaja', () => {
    const mixto: CobroEnPantalla = {
      ...elegirModo(COBRO_INICIAL, 'mixto'),
      tarjetas: ['400', '300'],
      propinaCon: 'tarjeta',
    };
    expect(leerElCobro(mixto, 100_000, DIEZ).cuenta.pagos).toEqual([
      { metodo: 'efectivo', montoCentavos: 40_000 },
      { metodo: 'tarjeta', montoCentavos: 40_000 },
      { metodo: 'tarjeta', montoCentavos: 20_000, propinaCentavos: 10_000 },
    ]);
  });
});

describe('restoParaLaTarjeta', () => {
  it('lo que falta para cuadrar, sin contar la tarjeta que se llena', () => {
    const dividida: CobroEnPantalla = {
      ...dividirEnTarjetas(COBRO_INICIAL),
      tarjetas: ['400', '50'],
    };
    expect(restoParaLaTarjeta(dividida, 1, 110_000)).toBe(70_000);
    const mixto: CobroEnPantalla = {
      ...elegirModo(COBRO_INICIAL, 'mixto'),
      tarjetas: ['', '300'],
      transferencia: '200',
    };
    expect(restoParaLaTarjeta(mixto, 0, 110_000)).toBe(60_000);
    // Si ya se pasaron, el resto es cero, no negativo.
    expect(restoParaLaTarjeta({ ...dividida, tarjetas: ['2000', ''] }, 1, 110_000)).toBe(0);
  });
});
