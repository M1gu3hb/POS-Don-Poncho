import { describe, expect, it } from 'vitest';

import {
  SECCIONES_EN_EL_DOCK,
  esLaSeccionActual,
  rotuloCorto,
  seccionesDelDock,
  type EntradaDeNavegacion,
} from './secciones-del-dock';

/**
 * DP-11.4 · EL DOCK DE LA TABLETA Y EL TELÉFONO. Las secciones son las del puesto, en el orden
 * del día de trabajo que manda el servidor (`navegacionParaRolYPlantilla`): las cuatro primeras,
 * con un rótulo que cabe debajo de un ícono. Lo demás, en «Más» (el menú de siempre).
 */

const entrada = (ruta: string, etiqueta: string): EntradaDeNavegacion => ({
  ruta,
  etiqueta,
  icono: 'Tag',
});

const DEL_DUENO: readonly EntradaDeNavegacion[] = [
  entrada('/', 'Dashboard'),
  entrada('/mesero', 'Mesas y pedidos'),
  entrada('/cocina', 'Cocina'),
  entrada('/caja', 'Caja'),
  entrada('/ventas', 'Ventas'),
  entrada('/recetas', 'Recetas'),
  entrada('/configuracion', 'Configuración'),
];

describe('seccionesDelDock', () => {
  it('las cuatro primeras del puesto, en su orden; lo demás va en «Más»', () => {
    const secciones = seccionesDelDock(DEL_DUENO);
    expect(SECCIONES_EN_EL_DOCK).toBe(4);
    expect(secciones.map((s) => s.ruta)).toEqual(['/', '/mesero', '/cocina', '/caja']);
    expect(secciones.map((s) => s.corta)).toEqual(['Inicio', 'Mesas', 'Cocina', 'Caja']);
  });

  it('un puesto con menos secciones tiene menos: la mesera, sólo sus mesas', () => {
    expect(seccionesDelDock([entrada('/mesero', 'Mesas y pedidos')]).map((s) => s.corta)).toEqual([
      'Mesas',
    ]);
    const deLaCaja = [
      entrada('/caja', 'Caja'),
      entrada('/ventas', 'Ventas'),
      entrada('/restaurante/cierre-diario-y-arqueo', 'Cierre del día'),
    ];
    expect(seccionesDelDock(deLaCaja).map((s) => s.corta)).toEqual(['Caja', 'Ventas', 'Cierre']);
  });

  it('conserva la etiqueta completa: es la que se lee en el menú y en el título', () => {
    expect(seccionesDelDock(DEL_DUENO)[1]?.etiqueta).toBe('Mesas y pedidos');
  });
});

describe('rotuloCorto', () => {
  it('las rutas conocidas tienen su palabra', () => {
    expect(rotuloCorto('/productos', 'Platillos')).toBe('Platillos');
    expect(rotuloCorto('/configuracion', 'Configuración')).toBe('Ajustes');
    expect(rotuloCorto('/portal-qr', 'Portal QR')).toBe('Portal QR');
  });

  it('una ruta que no conoce usa la primera palabra de su etiqueta, sin pasar de diez letras', () => {
    expect(rotuloCorto('/restaurante/algo-nuevo', 'Reservaciones del salón')).toBe('Reservacio');
    expect(rotuloCorto('/otra', 'Agenda')).toBe('Agenda');
  });
});

describe('esLaSeccionActual', () => {
  it('el inicio sólo en el inicio', () => {
    expect(esLaSeccionActual('/', '/')).toBe(true);
    expect(esLaSeccionActual('/', '/caja')).toBe(false);
  });

  it('una sección también en sus pantallas de adentro, pero no en otra que empiece igual', () => {
    expect(esLaSeccionActual('/caja', '/caja')).toBe(true);
    expect(esLaSeccionActual('/caja', '/caja/corte')).toBe(true);
    expect(esLaSeccionActual('/caja', '/cajas-viejas')).toBe(false);
  });
});
