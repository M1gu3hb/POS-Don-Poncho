import { describe, expect, it } from 'vitest';

import { TITULO_DE_CANCELACIONES, TITULO_DE_PERDIDAS } from './cancelaciones.ts';
import type { DescuentosLeidos } from '~/corte-heredado/descuentos-del-corte';

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
      fondoEsperadoCentavos: '100000',
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
      ventaConCostoCentavos: '325000',
      costoConocidoCentavos: '120000',
      ventasSinReceta: 0,
      ventasRecetaIncompleta: 0,
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
        lineasSinCosto: 0,
        lineasSinReceta: 0,
        esServicio: false,
        familia: 'bebida',
        linea: null,
        margenObjetivoBp: null,
        vendio: null,
      },
    ],
    porPersona: [],
    gastos: [],
    ajustes: [],
    cancelaciones: [],
    corteHasta: '2026-09-26T03:00:00.000Z',
    parcial: false,
    alcanceDeCancelaciones: 'caja',
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

  it('la diferencia de apertura se mide contra lo que se dejó anoche; las entradas de cambio no lo tocan', () => {
    // DP-15 (QA, J-H7): el fondo esperado de apertura es lo que se dejó anoche (1,000); los 600 de
    // cambio a media mañana entran al efectivo esperado por su movimiento, no a este número.
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

  it('el Cierre del día dice las ventas de TODAS las cajas, y el resumen dice que es de esta caja (QA, J-H6)', () => {
    const doc = documentoDelCorte(
      hoja(RESTAURANTE, {
        ventasDelDia: {
          cajas: 2,
          tickets: 14,
          totalCentavos: '407715',
          propinasCentavos: '32751',
          metodos: [
            { metodo: 'efectivo', ventasCentavos: '300000', propinasCentavos: '20000', pagos: 10 },
            { metodo: 'tarjeta', ventasCentavos: '107715', propinasCentavos: '12751', pagos: 4 },
          ],
        },
      }),
    );
    const delDia = 'Ventas del día · todas las cajas';
    expect(celda(doc.secciones, delDia, 'Total ventas')?.valor).toEqual({
      tipo: 'dinero',
      centavos: 407_715,
    });
    expect(celda(doc.secciones, delDia, 'Cajas')?.valor).toEqual({ tipo: 'texto', texto: '2' });
    expect(celda(doc.secciones, delDia, 'Nº de tickets')?.valor).toEqual({
      tipo: 'texto',
      texto: '14',
    });
    expect(celda(doc.secciones, delDia, 'Tarjeta')?.valor).toEqual({
      tipo: 'dinero',
      centavos: 107_715,
    });
    expect(celda(doc.secciones, delDia, 'Propinas')?.valor).toEqual({
      tipo: 'dinero',
      centavos: 32_751,
    });
    expect(doc.secciones.some((s) => s.titulo === 'Resumen de esta caja (sin propinas)')).toBe(
      true,
    );
  });

  it('el corte de una caja que no cierra el día no trae «Ventas del día»', () => {
    const doc = documentoDelCorte(hoja(RESTAURANTE, { ventasDelDia: null }));
    expect(doc.secciones.some((s) => s.titulo === 'Ventas del día · todas las cajas')).toBe(false);
    expect(doc.secciones.some((s) => s.titulo === 'Resumen financiero (sin propinas)')).toBe(true);
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

// DP-12.4 · Cancelar ya no es sólo de caja: el mesero cancela una cuenta o quita un platillo. El
// papel tiene que separar lo que no costó comida de lo que sí.
describe('las cancelaciones del corte', () => {
  type Fila = HojaDelServidor['cancelaciones'][number];
  const ANTES_DE_PREPARAR: Fila = {
    tipo: 'linea',
    folio: null,
    hora: '2026-09-25T20:10:00.000Z',
    usuario: 'Lupita',
    motivo: 'Error del mesero al tomar la orden',
    producto: 'Sopa de fideo',
    montoCentavos: '8000',
    mesa: 'Mesa 5',
    perdidaCentavos: '0',
    perdida: false,
  };
  const YA_PREPARADA: Fila = {
    tipo: 'orden',
    folio: 'POS-9',
    hora: '2026-09-25T21:40:00.000Z',
    usuario: 'Beto',
    motivo: 'Se fueron sin pagar',
    producto: null,
    montoCentavos: '45000',
    mesa: 'Mesa 6',
    perdidaCentavos: '45000',
    perdida: true,
  };
  const tabla = (doc: ReturnType<typeof documentoDelCorte>, titulo: string) => {
    const seccion = doc.secciones.find((s) => s.titulo === titulo);
    return seccion?.tipo === 'tabla' ? seccion : undefined;
  };

  it('lo que ya estaba preparado o entregado sale APARTE, resaltado, con quién, cuándo, por qué y cuánto', () => {
    const doc = documentoDelCorte(
      hoja(RESTAURANTE, { cancelaciones: [ANTES_DE_PREPARAR, YA_PREPARADA] }),
    );
    const perdidas = tabla(doc, TITULO_DE_PERDIDAS);
    expect(perdidas, 'La pérdida no salió en su propia sección.').toBeDefined();
    expect(perdidas?.tono).toBe('perdida');
    expect(perdidas?.columnas.map((c) => c.titulo)).toEqual([
      'Cuenta',
      'Hora',
      'Qué',
      'Quién canceló',
      'Motivo',
      'Importe',
    ]);
    expect(perdidas?.filas).toHaveLength(1);
    const [cuenta, , que, quien, motivo, importe] = perdidas?.filas[0] ?? [];
    expect(cuenta).toEqual({ tipo: 'texto', texto: 'Mesa 6 · POS-9' });
    expect(que).toEqual({ tipo: 'texto', texto: 'Cuenta completa' });
    expect(quien).toEqual({ tipo: 'texto', texto: 'Beto' });
    expect(motivo).toEqual({ tipo: 'texto', texto: 'Se fueron sin pagar' });
    expect(importe).toEqual({ tipo: 'dinero', centavos: 45_000 });
    expect(perdidas?.total?.at(-1)).toEqual({ tipo: 'dinero', centavos: 45_000 });
  });

  it('lo cancelado antes de prepararse queda registrado, sin resaltar y SIN la pérdida', () => {
    const doc = documentoDelCorte(
      hoja(RESTAURANTE, { cancelaciones: [ANTES_DE_PREPARAR, YA_PREPARADA] }),
    );
    const sinCosto = tabla(doc, TITULO_DE_CANCELACIONES);
    expect(sinCosto?.tono).toBeUndefined();
    expect(sinCosto?.filas).toHaveLength(1);
    const [cuenta, , que, quien, motivo, importe] = sinCosto?.filas[0] ?? [];
    expect(cuenta).toEqual({ tipo: 'texto', texto: 'Mesa 5' });
    expect(que).toEqual({ tipo: 'texto', texto: 'Sopa de fideo' });
    expect(quien).toEqual({ tipo: 'texto', texto: 'Lupita' });
    expect(motivo).toEqual({ tipo: 'texto', texto: 'Error del mesero al tomar la orden' });
    expect(importe).toEqual({ tipo: 'dinero', centavos: 8_000 });
    // La pérdida va primero: es lo que se ve aunque nadie lea el resto.
    expect(titulos(doc.secciones).indexOf(TITULO_DE_PERDIDAS)).toBeLessThan(
      titulos(doc.secciones).indexOf(TITULO_DE_CANCELACIONES),
    );
  });

  it('sin pérdidas no hay sección de pérdidas, y sin cancelaciones no aparece ninguna', () => {
    const soloAntes = documentoDelCorte(hoja(RESTAURANTE, { cancelaciones: [ANTES_DE_PREPARAR] }));
    expect(titulos(soloAntes.secciones)).not.toContain(TITULO_DE_PERDIDAS);
    expect(titulos(soloAntes.secciones)).toContain(TITULO_DE_CANCELACIONES);
    const soloPerdida = documentoDelCorte(hoja(RESTAURANTE, { cancelaciones: [YA_PREPARADA] }));
    expect(titulos(soloPerdida.secciones)).toContain(TITULO_DE_PERDIDAS);
    expect(titulos(soloPerdida.secciones)).not.toContain(TITULO_DE_CANCELACIONES);
    const ninguna = documentoDelCorte(hoja(RESTAURANTE));
    expect(titulos(ninguna.secciones)).not.toContain(TITULO_DE_PERDIDAS);
    expect(titulos(ninguna.secciones)).not.toContain(TITULO_DE_CANCELACIONES);
  });

  it('DP-13.2 · una cuenta con un platillo listo y otro no: la pérdida es sólo el listo, y el resto va sin costo', () => {
    const MIXTA: Fila = {
      ...YA_PREPARADA,
      montoCentavos: '65800',
      perdidaCentavos: '32900',
    };
    const doc = documentoDelCorte(hoja(RESTAURANTE, { cancelaciones: [MIXTA] }));
    const perdidas = tabla(doc, TITULO_DE_PERDIDAS);
    const sinCosto = tabla(doc, TITULO_DE_CANCELACIONES);
    const [, , queSePerdio, , , perdido] = perdidas?.filas[0] ?? [];
    const [, , queNo, , , noCosto] = sinCosto?.filas[0] ?? [];
    expect(perdido).toEqual({ tipo: 'dinero', centavos: 32_900 });
    expect(queSePerdio).toEqual({ tipo: 'texto', texto: 'Cuenta completa · lo ya preparado' });
    expect(noCosto).toEqual({ tipo: 'dinero', centavos: 32_900 });
    expect(queNo).toEqual({ tipo: 'texto', texto: 'Cuenta completa · lo que no se preparó' });
    expect(perdidas?.total?.at(-1)).toEqual({ tipo: 'dinero', centavos: 32_900 });
  });

  it('DP-13.2 · el corte dice de qué cancelaciones habla: las de esta caja, o todas las del día', () => {
    const notas = (alcance: 'caja' | 'dia') =>
      documentoDelCorte(
        hoja(RESTAURANTE, {
          cancelaciones: [ANTES_DE_PREPARAR, YA_PREPARADA],
          alcanceDeCancelaciones: alcance,
        }),
      )
        .secciones.filter((s) => s.tipo === 'tabla' && s.titulo.includes('ancelaci'))
        .map((s) => (s.tipo === 'tabla' ? (s.nota ?? '') : ''));
    for (const nota of notas('caja')) expect(nota).toMatch(/cuentas de esta caja/);
    for (const nota of notas('dia')) expect(nota).toMatch(/todas las de la sucursal/);
  });
});

describe('DP-13.2 · el margen del corte sale sólo de lo que tiene costo completo', () => {
  const RESUMEN = 'Resumen financiero (sin propinas)';
  const conFuera = (cambios: Partial<HojaDelServidor['resumen']>) =>
    documentoDelCorte(hoja(RESTAURANTE, { resumen: { ...hoja(RESTAURANTE).resumen, ...cambios } }));

  it('con ventas sin receta o de receta incompleta: el margen es el de las completas, y dice cuántas quedaron fuera', () => {
    const doc = conFuera({
      ventaConCostoCentavos: '200000',
      costoConocidoCentavos: '80000',
      ventasSinReceta: 1,
      ventasRecetaIncompleta: 1,
    });
    expect(celda(doc.secciones, RESUMEN, 'Costo de ventas (con costo)')?.valor).toEqual({
      tipo: 'dinero',
      centavos: 80_000,
    });
    expect(celda(doc.secciones, RESUMEN, 'Utilidad bruta (con costo)')?.valor).toEqual({
      tipo: 'dinero',
      centavos: 120_000,
    });
    expect(celda(doc.secciones, RESUMEN, 'Margen (con costo)')?.valor).toEqual({
      tipo: 'porcentaje',
      puntosBase: 6_000,
    });
    expect(celda(doc.secciones, RESUMEN, 'Fuera del margen')?.valor).toEqual({
      tipo: 'texto',
      texto: '1 venta sin receta · 1 venta con receta incompleta',
    });
    // Ninguna cifra «de todo» que finja un margen sobre lo que no tiene costo.
    expect(celda(doc.secciones, RESUMEN, 'Margen')).toBeUndefined();
  });

  it('sin ninguna venta de costo completo: ni utilidad ni margen, dice «sin receta»', () => {
    const doc = conFuera({
      ventaConCostoCentavos: '0',
      costoConocidoCentavos: '0',
      ventasSinReceta: 4,
    });
    expect(celda(doc.secciones, RESUMEN, 'Margen')?.valor).toEqual({
      tipo: 'texto',
      texto: '—, sin receta',
    });
    expect(celda(doc.secciones, RESUMEN, 'Utilidad bruta')?.valor).toEqual({
      tipo: 'texto',
      texto: '—, sin receta',
    });
  });

  it('un producto vendido sin costo no tiene costo ni utilidad: «sin receta» o «receta incompleta»', () => {
    const base = hoja(RESTAURANTE).productos[0];
    if (base === undefined) throw new Error('falta el producto de la hoja de prueba');
    const doc = documentoDelCorte(
      hoja(RESTAURANTE, {
        productos: [
          {
            ...base,
            nombre: 'Agua',
            lineas: 2,
            lineasSinCosto: 2,
            lineasSinReceta: 2,
            costoCentavos: '0',
          },
          {
            ...base,
            nombre: 'Combo',
            lineas: 3,
            lineasSinCosto: 1,
            lineasSinReceta: 1,
            costoCentavos: '10000',
          },
          // Con receta pero un insumo en cero: receta incompleta, aunque TODAS sus líneas cuenten.
          {
            ...base,
            nombre: 'Sopa',
            lineas: 2,
            lineasSinCosto: 2,
            lineasSinReceta: 0,
            costoCentavos: '4000',
          },
        ],
      }),
    );
    const tabla = doc.secciones.find((s) => s.titulo === 'Productos vendidos');
    const filas = tabla?.tipo === 'tabla' ? tabla.filas : [];
    expect(filas[0]?.slice(4)).toEqual([
      { tipo: 'texto', texto: '—, sin receta' },
      { tipo: 'texto', texto: '—, sin receta' },
    ]);
    expect(filas[1]?.slice(4)).toEqual([
      { tipo: 'texto', texto: '—, receta incompleta' },
      { tipo: 'texto', texto: '—, receta incompleta' },
    ]);
    expect(filas[2]?.slice(4)).toEqual([
      { tipo: 'texto', texto: '—, receta incompleta' },
      { tipo: 'texto', texto: '—, receta incompleta' },
    ]);
  });
});

describe('DP-13.2 · el corte de una caja abierta dice hasta qué hora cuenta', () => {
  it('abierta: «Corte parcial» con la hora en que se leyó; cerrada, no', () => {
    const parcial = documentoDelCorte(
      hoja(RESTAURANTE, { parcial: true, corteHasta: '2026-09-25T22:15:00.000Z' }),
    );
    expect(celda(parcial.secciones, 'Datos del corte', 'Corte parcial · hasta')).toBeDefined();
    const cerrada = documentoDelCorte(hoja(RESTAURANTE));
    expect(celda(cerrada.secciones, 'Datos del corte', 'Corte parcial · hasta')).toBeUndefined();
  });
});

/**
 * DP-15 · F2 (auditoría 1, M5) · EL DOCUMENTO DEL CIERRE DICE LO MISMO QUE EL VISOR DE REGISTROS.
 *
 * Al cerrar, el detalle decía «1 kg × Barbacoa de horno» para una venta de ½ kg ($397.50), no
 * traía las pérdidas por cancelación y los descuentos eran sólo «$20.00», sin quién ni por qué.
 * El visor (Registros → Ver PDF) decía «½ kg», las pérdidas y «Mesa 4 · $20.00 · Gerente · Cliente
 * frecuente». Ahora el peso sale con el formateador único y los descuentos con su detalle.
 */
describe('DP-15 · el documento del cierre dice lo que el visor', () => {
  const VENTA_DE_MEDIO_KILO: HojaDelServidor['ventas'][number] = {
    folio: 'A-1',
    cobradaEn: '2026-11-08T18:06:13.000Z',
    mesa: 'Mesa 1',
    nombrePedido: null,
    cliente: null,
    canal: 'aqui',
    // Lo que armaba el servidor con la cantidad de la línea y su unidad.
    productos: '1 kg × Barbacoa de horno',
    lineas: [
      {
        nombre: 'Barbacoa de horno',
        cantidad: '1',
        unidad: 'kg',
        tipoVenta: 'variable_medida',
        cantidadVariable: '0.5',
        unidadVariable: 'kg',
      },
      {
        nombre: 'Arrachera',
        cantidad: '2',
        unidad: 'pieza',
        tipoVenta: 'precio_fijo',
        cantidadVariable: null,
        unidadVariable: null,
      },
    ],
    totalCentavos: '39750',
    pago: 'efectivo',
    atendio: 'Mesero 1',
  };

  const detalle = (doc: ReturnType<typeof documentoDelCorte>): string => {
    const seccion = doc.secciones.find((s) => s.titulo.startsWith('Detalle de ventas'));
    if (seccion?.tipo !== 'tabla') throw new Error('falta el detalle de ventas');
    const celdaDeProductos = seccion.filas[0]?.[3];
    return celdaDeProductos?.tipo === 'texto' ? celdaDeProductos.texto : '';
  };

  it('el peso se dice «½ kg» con el formateador único, no «1 kg ×»', () => {
    const doc = documentoDelCorte(hoja(RESTAURANTE, { ventas: [VENTA_DE_MEDIO_KILO] }));
    expect(detalle(doc)).toBe('Barbacoa de horno — ½ kg, Arrachera ×2');
  });

  it('sin líneas estructuradas (servidor viejo) cae al texto que mandó', () => {
    const sinLineas = { ...VENTA_DE_MEDIO_KILO, lineas: null };
    const doc = documentoDelCorte(hoja(RESTAURANTE, { ventas: [sinLineas] }));
    expect(detalle(doc)).toBe('1 kg × Barbacoa de horno');
  });

  it('trae las pérdidas por cancelación', () => {
    const doc = documentoDelCorte(
      hoja(RESTAURANTE, {
        cancelaciones: [
          {
            tipo: 'linea',
            folio: null,
            hora: '2026-11-08T18:30:00.000Z',
            usuario: 'Mesero 1',
            motivo: 'Cliente se fue',
            producto: 'Jugo',
            montoCentavos: '3800',
            mesa: 'Mesa 5',
            perdidaCentavos: '3800',
            perdida: true,
          },
        ],
      }),
    );
    expect(titulos(doc.secciones)).toContain(TITULO_DE_PERDIDAS);
  });

  const DESCUENTOS: DescuentosLeidos = {
    filas: [
      {
        ordenId: 'o-4',
        folio: 'A-4',
        mesa: 4,
        montoCentavos: '2000',
        autorizo: 'Gerente',
        motivo: 'Cliente frecuente',
        cuando: '2026-11-08T18:20:00.000Z',
      },
    ],
    cuantos: 1,
    totalCentavos: 2000,
    alcance: 'dia',
    noSePudieronLeer: false,
  };

  it('los descuentos traen cuenta, monto, quién autorizó y por qué', () => {
    const doc = documentoDelCorte(hoja(RESTAURANTE), DESCUENTOS);
    const seccion = doc.secciones.find((s) => s.titulo === 'Descuentos del día');
    if (seccion?.tipo !== 'tabla') throw new Error('falta la sección de descuentos');
    expect(seccion.filas).toEqual([
      [
        { tipo: 'texto', texto: 'Mesa 4 · folio A-4' },
        { tipo: 'dinero', centavos: 2000 },
        { tipo: 'texto', texto: 'Gerente' },
        { tipo: 'texto', texto: 'Cliente frecuente' },
      ],
    ]);
  });

  it('si no se pudieron leer, la sección lo dice (no parece «sin descuentos»)', () => {
    const doc = documentoDelCorte(hoja(RESTAURANTE), {
      filas: [],
      cuantos: 0,
      totalCentavos: 0,
      alcance: null,
      noSePudieronLeer: true,
    });
    expect(titulos(doc.secciones)).toContain('Descuentos');
  });

  it('sin descuentos leídos o sin ninguno, la sección no aparece', () => {
    expect(titulos(documentoDelCorte(hoja(RESTAURANTE)).secciones)).not.toContain('Descuentos');
    const vacios: DescuentosLeidos = { ...DESCUENTOS, filas: [], cuantos: 0, totalCentavos: 0 };
    const doc = documentoDelCorte(hoja(RESTAURANTE), vacios);
    expect(titulos(doc.secciones)).not.toContain('Descuentos del día');
  });
});

describe('DP-15.1 · los ajustes de caja no se esconden en el esperado', () => {
  const AJUSTES: HojaDelServidor['ajustes'] = [
    {
      movimientoId: 'a1',
      montoCentavos: '7500',
      motivo: 'sobró de ayer, ya contado',
      quien: 'Rosa Gerente',
      registradoEn: '2026-09-25T20:00:00.000Z',
    },
    {
      movimientoId: 'a2',
      montoCentavos: '-2000',
      motivo: null,
      quien: null,
      registradoEn: '2026-09-25T21:00:00.000Z',
    },
  ];

  it('sin ajustes, ni renglón en el arqueo ni sección', () => {
    const doc = documentoDelCorte(hoja(RESTAURANTE));
    expect(celda(doc.secciones, 'Apertura y fondo', 'Ajustes de caja')).toBeUndefined();
    expect(titulos(doc.secciones)).not.toContain('Ajustes de caja · quién y por qué');
  });

  it('con ajustes, el arqueo dice cuánto pesan en el esperado y la sección los lista uno por uno', () => {
    const doc = documentoDelCorte(hoja(RESTAURANTE, { ajustes: AJUSTES }));
    expect(celda(doc.secciones, 'Apertura y fondo', 'Ajustes de caja')?.valor).toEqual({
      tipo: 'dinero',
      centavos: 5_500,
    });
    const seccion = doc.secciones.find((s) => s.titulo === 'Ajustes de caja · quién y por qué');
    if (seccion?.tipo !== 'tabla') throw new Error('falta la sección de ajustes');
    expect(seccion.filas.map((f) => f.slice(1))).toEqual([
      [
        { tipo: 'texto', texto: 'Rosa Gerente' },
        { tipo: 'texto', texto: 'sobró de ayer, ya contado' },
        { tipo: 'dinero', centavos: 7_500 },
      ],
      // Un ajuste viejo sin motivo no se maquilla: se dice.
      [
        { tipo: 'texto', texto: 'Sin registrar' },
        { tipo: 'texto', texto: 'SIN MOTIVO' },
        { tipo: 'dinero', centavos: -2_000 },
      ],
    ]);
    expect(seccion.total?.at(-1)).toEqual({ tipo: 'dinero', centavos: 5_500 });
  });

  it('el «cajón abierto sin venta» (un ajuste de cero) sale en la lista, pero no ensucia el arqueo', () => {
    const doc = documentoDelCorte(
      hoja(RESTAURANTE, {
        ajustes: [
          {
            movimientoId: 'c1',
            montoCentavos: '0',
            motivo: 'cajón abierto sin venta: dar_cambio',
            quien: 'Lupe Cajera',
            registradoEn: '2026-09-25T20:00:00.000Z',
          },
        ],
      }),
    );
    expect(celda(doc.secciones, 'Apertura y fondo', 'Ajustes de caja')).toBeUndefined();
    expect(titulos(doc.secciones)).toContain('Ajustes de caja · quién y por qué');
  });

  it('el arqueo trae el ajuste ANTES del efectivo esperado, para leerlo de corrido', () => {
    const doc = documentoDelCorte(hoja(RESTAURANTE, { ajustes: AJUSTES }));
    const arqueo = doc.secciones.find((s) => s.titulo === 'Apertura y fondo');
    if (arqueo?.tipo !== 'celdas') throw new Error('falta el arqueo');
    const etiquetas = arqueo.celdas.map((c) => c.etiqueta);
    expect(etiquetas.indexOf('Ajustes de caja')).toBeGreaterThan(-1);
    expect(etiquetas.indexOf('Ajustes de caja')).toBeLessThan(
      etiquetas.indexOf('Efectivo esperado'),
    );
  });
});
