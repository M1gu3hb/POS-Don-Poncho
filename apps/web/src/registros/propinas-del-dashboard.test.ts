import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  peticionesDelDashboard,
  resumenDelDashboard,
  type RespuestasDelDashboard,
} from './propinas-del-dashboard.ts';
import type { PropinasDelServidor } from './propinas-del-servidor.ts';

/**
 * Sobra del lote 1 · La tarjeta de propinas del Dashboard suma en el SERVIDOR.
 *
 * Leía las últimas 2 000 ventas pagadas del puente y sumaba en el navegador: pasado el tope las
 * propinas viejas desaparecían sin aviso (lo mismo que A23 arregló en Registros). Ahora pide tres
 * rangos a `propinas.del_rango` (hoy, la semana y el último año) y sólo pinta lo que contesta.
 */

const respuesta = (parcial: Partial<PropinasDelServidor> = {}): PropinasDelServidor => ({
  desde: '',
  hasta: '',
  estado: 'todas',
  meseroId: null,
  totalCentavos: '0',
  pendientesCentavos: '0',
  liquidadasCentavos: '0',
  numeroVentas: 0,
  meseros: [],
  ventas: [],
  hayMasVentas: false,
  ...parcial,
});

describe('los tres rangos que se piden', () => {
  // Martes 17 de noviembre de 2026, 15:30 hora local.
  const AHORA = new Date(2026, 10, 17, 15, 30);
  const p = peticionesDelDashboard(AHORA);

  it('hoy es de las 00:00 a las 23:59 de hoy', () => {
    expect(new Date(p.hoy.desde)).toEqual(new Date(2026, 10, 17, 0, 0, 0, 0));
    expect(new Date(p.hoy.hasta).getDate()).toBe(17);
    expect(new Date(p.hoy.hasta).getHours()).toBe(23);
  });

  it('la semana son los últimos siete días contando hoy (como siempre en el Dashboard)', () => {
    expect(new Date(p.semana.desde)).toEqual(new Date(2026, 10, 11, 0, 0, 0, 0));
  });

  it('el año cabe en el tope del servidor (366 días, con margen para el cambio de horario) y termina hoy', () => {
    const dias = (new Date(p.anio.hasta).getTime() - new Date(p.anio.desde).getTime()) / 86_400_000;
    expect(dias).toBeLessThanOrEqual(365);
    expect(dias).toBeGreaterThan(360);
    expect(new Date(p.anio.hasta).getDate()).toBe(17);
  });

  it('las tres piden todas las propinas de todos los meseros y sólo un renglón de detalle', () => {
    for (const peticion of [p.hoy, p.semana, p.anio]) {
      expect(peticion).toMatchObject({ estado: 'todas', meseroId: null, limite: 1 });
    }
  });
});

describe('lo que se pinta sale de lo que contestó el servidor', () => {
  const respuestas: RespuestasDelDashboard = {
    hoy: respuesta({ totalCentavos: '12050' }),
    semana: respuesta({
      totalCentavos: '99999',
      meseros: [
        { meseroId: 'a', meseroNombre: 'Ana', propinaCentavos: '60000', numeroVentas: 7 },
        { meseroId: 'b', meseroNombre: 'Beto', propinaCentavos: '39999', numeroVentas: 5 },
      ],
    }),
    anio: respuesta({
      numeroVentas: 400,
      totalCentavos: '500000',
      pendientesCentavos: '123456',
      liquidadasCentavos: '376544',
    }),
  };

  it('hoy, semana, pendientes y liquidadas, en pesos', () => {
    expect(resumenDelDashboard(respuestas)).toMatchObject({
      hayPropinas: true,
      propinasHoy: 120.5,
      propinasSemana: 999.99,
      totalPendientes: 1234.56,
      totalLiquidadas: 3765.44,
    });
  });

  it('el mesero de la semana es el primero que dice el servidor, con su total', () => {
    expect(resumenDelDashboard(respuestas).topMesero).toEqual({
      mesero_nombre: 'Ana',
      total: 600,
    });
  });

  it('sin propinas en la semana no hay mesero destacado', () => {
    expect(resumenDelDashboard({ ...respuestas, semana: respuesta() }).topMesero).toBeNull();
  });

  it('sin una sola propina en el año la tarjeta no se pinta', () => {
    const vacio = { hoy: respuesta(), semana: respuesta(), anio: respuesta() };
    expect(resumenDelDashboard(vacio).hayPropinas).toBe(false);
  });

  it('suma centavos enteros: nada de coma flotante del lado del navegador', () => {
    const r = resumenDelDashboard({
      ...respuestas,
      anio: respuesta({ numeroVentas: 1, pendientesCentavos: '10', liquidadasCentavos: '20' }),
    });
    expect(r.totalPendientes).toBe(0.1);
    expect(r.totalLiquidadas).toBe(0.2);
  });
});

describe('la tarjeta del Dashboard', () => {
  const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
  const tarjeta = readFileSync(
    join(RAIZ, 'heredado', 'components', 'propinas', 'PropinasDashboardSection.jsx'),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');

  it('pide los rangos al servidor y ya no baja ventas ni suma propinas en el navegador', () => {
    // Cada cifra pide SU rango, en el orden en que se reparte.
    expect(tarjeta).toContain(
      "const [hoy, semana, anio] = await Promise.all([ invocarComando('/api/propinas/del-rango', peticiones.hoy, { signal }), invocarComando('/api/propinas/del-rango', peticiones.semana, { signal }), invocarComando('/api/propinas/del-rango', peticiones.anio, { signal }), ]); return { hoy, semana, anio };",
    );
    expect(tarjeta).not.toContain('api.entidades.Venta');
    expect(tarjeta).not.toMatch(/sumarPropinas|agruparPropinasPorMesero|filtrarVentasConPropina/);
    expect(tarjeta).not.toMatch(/filtrarVentasEnRango/);
    expect(tarjeta).toContain('resumenDelDashboard(');
  });

  it('conserva la clave de consulta que Caja y la liquidación invalidan', () => {
    expect(tarjeta).toContain("queryKey: ['propinas_dashboard_ventas', peticiones]");
  });

  it('si el servidor no contesta no pinta ceros ni se esconde: dice que no pudo', () => {
    expect(tarjeta).toContain('isError');
    expect(tarjeta).toContain('No se pudieron leer las propinas');
  });
});
