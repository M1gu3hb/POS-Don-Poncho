import { describe, expect, it } from 'vitest';

import { documentoDelCorte } from './giros.ts';
import type { Celda, ExtrasDelServidor, HojaDelServidor, Seccion } from './hoja.ts';

/**
 * C.6 de la etapa 2.4 · EL CORTE DEL RESTAURANTE, con SU contenido y en SU orden.
 *
 * Lo que se vigila es lo que su `02-DINERO-Y-CAJA.md` §9.3 dice que no se negocia:
 * ninguna sección en cero, los costos sólo para quien los ve, el dinero dejado en caja
 * como campo, la diferencia de apertura contra lo que se esperaba AL ABRIR, y el orden
 * de las secciones. Los cortes de los otros cuatro giros se fueron con ellos (DP-2).
 */

function hoja(extras: ExtrasDelServidor, cambios: Partial<HojaDelServidor> = {}): HojaDelServidor {
  return {
    verCostos: true,
    negocio: {
      nombre: 'Demo',
      direccion: null,
      telefono: null,
      correo: null,
      rfc: null,
      logoUrl: null,
      marca: 'MorphiqPOS',
      pie: null,
      descargarAlCerrar: true,
      comisionTerminalBp: null,
    },
    sesion: {
      id: 's-1',
      serie: 'CC',
      folio: '7',
      estado: 'cerrada',
      turno: null,
      abiertaEn: '2026-09-25T14:00:00.000Z',
      cerradaEn: '2026-09-26T03:00:00.000Z',
      notasApertura: null,
      notasCierre: null,
      fondoInicialCentavos: '95000',
      fondoEsperadoCentavos: '160000',
      fondoMonedasCentavos: '95000',
      fondoChicosCentavos: '0',
      fondoGrandesCentavos: '0',
      contadoCentavos: '480000',
      retiradoCentavos: '380000',
      esperadoCentavos: '480000',
      diferenciaCentavos: '0',
      boteContadoCentavos: null,
      saldoRecargasAperturaCentavos: '0',
      saldoRecargasCierreCentavos: null,
      terminal: 'Caja 1',
      sucursal: 'Matriz',
      abrio: 'Ana',
      cerro: 'Luis',
    },
    movimientos: [
      { tipo: 'apertura', montoCentavos: '95000', cuantos: 1 },
      { tipo: 'entrada_cambio', montoCentavos: '60000', cuantos: 1 },
      { tipo: 'venta', montoCentavos: '325000', cuantos: 4 },
    ],
    conteo: [],
    metodos: [{ metodo: 'efectivo', ventasCentavos: '325000', propinasCentavos: '0', pagos: 4 }],
    resumen: {
      tickets: 4,
      totalCentavos: '325000',
      descuentoCentavos: '0',
      impuestosCentavos: '0',
      costoCentavos: '120000',
    },
    ventas: [],
    productos: [
      {
        nombre: 'Latte',
        categoria: 'Café',
        lineas: 3,
        cantidad: '3',
        unidad: 'pieza',
        totalCentavos: '225000',
        costoCentavos: '80000',
        esServicio: false,
        familia: 'bebida',
        linea: null,
        margenObjetivoBp: null,
        vendio: null,
      },
    ],
    porPersona: [],
    gastos: [],
    cancelaciones: [],
    devoluciones: [],
    descuentosPorUsuario: [],
    alertas: [],
    insumos: [],
    salidasSinVenta: [],
    extras,
    ...cambios,
  };
}

const RESTAURANTE: ExtrasDelServidor = { plantilla: 'restaurante', propinasPorMesero: [] };
const titulos = (secciones: readonly Seccion[]): string[] => secciones.map((s) => s.titulo);
function celda(
  secciones: readonly Seccion[],
  seccion: string,
  etiqueta: string,
): Celda | undefined {
  const encontrada = secciones.find((s) => s.titulo === seccion);
  return encontrada?.tipo === 'celdas'
    ? encontrada.celdas.find((c) => c.etiqueta === etiqueta)
    : undefined;
}

describe('las reglas del corte', () => {
  it('ninguna sección en cero: sin gastos, cancelaciones ni propinas, no aparecen', () => {
    const doc = documentoDelCorte(hoja(RESTAURANTE));
    expect(titulos(doc.secciones)).not.toContain('Gastos operativos');
    expect(titulos(doc.secciones)).not.toContain('Cancelaciones');
    expect(titulos(doc.secciones)).not.toContain('Propinas');
    expect(titulos(doc.secciones)).not.toContain('Métodos de pago · ventas, propinas y total');
  });

  it('el dinero dejado en caja es contado − retirado, y en negritas', () => {
    const doc = documentoDelCorte(hoja(RESTAURANTE));
    const dejado = celda(doc.secciones, 'Apertura y fondo', 'Dinero dejado en caja');
    expect(dejado?.valor).toEqual({ tipo: 'dinero', centavos: 100_000 });
    expect(dejado?.fuerte).toBe(true);
  });

  it('sin decir cuánto se dejó, el documento no inventa un cero', () => {
    const base = hoja(RESTAURANTE);
    const doc = documentoDelCorte({ ...base, sesion: { ...base.sesion, retiradoCentavos: null } });
    expect(celda(doc.secciones, 'Apertura y fondo', 'Dinero dejado en caja')?.valor).toEqual({
      tipo: 'nada',
    });
  });

  it('la diferencia de apertura se mide contra lo esperado AL ABRIR, sin las entradas de cambio', () => {
    // fondo esperado 1,600 = 1,000 que dejó anoche + 600 de cambio a media mañana.
    const doc = documentoDelCorte(hoja(RESTAURANTE));
    expect(celda(doc.secciones, 'Apertura y fondo', 'Fondo esperado')?.valor).toEqual({
      tipo: 'dinero',
      centavos: 100_000,
    });
    expect(celda(doc.secciones, 'Apertura y fondo', 'Diferencia de apertura')?.valor).toEqual({
      tipo: 'dinero',
      centavos: -5_000,
    });
  });

  it('sin permiso de costos: ni utilidad, ni insumos, ni columna de costo', () => {
    const doc = documentoDelCorte(
      hoja(RESTAURANTE, {
        verCostos: false,
        insumos: null,
        resumen: { ...hoja(RESTAURANTE).resumen, costoCentavos: null },
      }),
    );
    expect(
      celda(doc.secciones, 'Resumen financiero (sin propinas)', 'Utilidad bruta'),
    ).toBeUndefined();
    expect(titulos(doc.secciones).some((t) => t.startsWith('Ingredientes'))).toBe(false);
    const productos = doc.secciones.find((s) => s.titulo === 'Productos vendidos');
    expect(productos?.tipo === 'tabla' && productos.columnas.map((c) => c.titulo)).not.toContain(
      'Costo',
    );
  });

  it('con costos, la utilidad neta resta el costo y los gastos', () => {
    const doc = documentoDelCorte(
      hoja(RESTAURANTE, {
        gastos: [
          { categoria: 'Gas', descripcion: 'Tanque', metodo: 'efectivo', montoCentavos: '5000' },
        ],
      }),
    );
    expect(
      celda(doc.secciones, 'Resumen financiero (sin propinas)', 'Utilidad neta estimada')?.valor,
    ).toEqual({ tipo: 'dinero', centavos: 325_000 - 120_000 - 5_000 });
  });

  // La devolución resta de la venta del día en que se hace (178, 182): el total se dice
  // bruto, después lo devuelto y la venta neta; el costo de lo que REGRESÓ al almacén deja
  // de ser costo de ventas, y lo que no regresó (ya preparado, dañado) sigue siéndolo.
  it('con devoluciones: total bruto, lo devuelto, la venta neta y la utilidad sobre la neta', () => {
    const doc = documentoDelCorte(
      hoja(RESTAURANTE, {
        devoluciones: [
          {
            folio: 'A-7',
            devueltaEn: '2026-10-19T18:00:00.000Z',
            metodo: 'efectivo',
            montoCentavos: '20000',
            motivo: 'Llegó frío',
            quien: 'Beatriz',
            regresoAlInventario: false,
            costoDevueltoCentavos: '0',
          },
          {
            folio: 'A-3',
            devueltaEn: '2026-10-19T19:00:00.000Z',
            metodo: 'credito',
            montoCentavos: '5000',
            motivo: 'Sobró de la obra',
            quien: 'Beatriz',
            regresoAlInventario: true,
            costoDevueltoCentavos: '2000',
          },
        ],
      }),
    );
    const resumen = 'Resumen financiero (sin propinas)';
    expect(celda(doc.secciones, resumen, 'Total ventas')?.valor).toEqual({
      tipo: 'dinero',
      centavos: 325_000,
    });
    expect(celda(doc.secciones, resumen, 'Devoluciones')?.valor).toEqual({
      tipo: 'dinero',
      centavos: -25_000,
    });
    expect(celda(doc.secciones, resumen, 'Venta neta')?.valor).toEqual({
      tipo: 'dinero',
      centavos: 300_000,
    });
    // Costo 120,000 menos los 2,000 de lo que regresó al almacén.
    expect(celda(doc.secciones, resumen, 'Utilidad bruta')?.valor).toEqual({
      tipo: 'dinero',
      centavos: 300_000 - 118_000,
    });
    const tabla = doc.secciones.find((s) => s.titulo === 'Devoluciones');
    expect(tabla?.tipo === 'tabla' && tabla.filas.map((f) => f[2])).toEqual([
      { tipo: 'texto', texto: 'Efectivo, del cajón' },
      { tipo: 'texto', texto: 'Crédito: baja su saldo' },
    ]);
  });

  it('sin devoluciones, ni la sección ni la venta neta: el total es la venta', () => {
    const doc = documentoDelCorte(hoja(RESTAURANTE));
    expect(titulos(doc.secciones)).not.toContain('Devoluciones');
    expect(celda(doc.secciones, 'Resumen financiero (sin propinas)', 'Venta neta')).toBeUndefined();
  });
});

describe('el documento del restaurante', () => {
  it('restaurante: la propina y su tabla por mesero aparecen cuando hubo propina', () => {
    const base = hoja({
      plantilla: 'restaurante',
      propinasPorMesero: [{ mesero: 'Beto', propinaCentavos: '4000', cuentas: 2 }],
    });
    const doc = documentoDelCorte({
      ...base,
      metodos: [
        { metodo: 'tarjeta', ventasCentavos: '325000', propinasCentavos: '4000', pagos: 2 },
      ],
    });
    expect(doc.titulo).toBe('CORTE DE CAJA');
    expect(titulos(doc.secciones)).toEqual(
      expect.arrayContaining([
        'Propinas',
        'Propinas por mesero',
        'Métodos de pago · ventas, propinas y total',
      ]),
    );
    expect(titulos(doc.secciones).indexOf('Propinas')).toBeGreaterThan(
      titulos(doc.secciones).indexOf('Resumen financiero (sin propinas)'),
    );
  });

  it('el nombre del archivo no lleva acentos ni espacios', () => {
    expect(documentoDelCorte(hoja(RESTAURANTE)).nombreDeArchivo).toBe(
      'Demo-CORTE-DE-CAJA-CC-7.pdf',
    );
  });
});
