import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LeyendaDeEstados } from './LeyendaDeEstados';
import { PlanoDelSalon, type SalonProps } from './PlanoDelSalon';
import { RejillaDeMesas } from './RejillaDeMesas';
import type { MesaDelSalon } from './tipos-del-salon';
import { AvisoSinMesasAsignadas, ZonasDelSalon } from './ZonasDelSalon';

/**
 * EL SALÓN COMPLETO: el plano, la rejilla, las zonas y la leyenda.
 *
 * Cubre lo que cada pieza dice cuando no hay mesas (leyendo, sin poder leer, vacía) —los tres
 * estados del sistema— y los marcadores con que las pruebas de navegador encuentran la leyenda
 * (`[data-leyenda="estados"] [data-estado-de-la-leyenda]`) y los botones de zona (`^Interior\b`).
 */

const mesa = (numero: number, cambios: Partial<MesaDelSalon> = {}): MesaDelSalon => ({
  id: `m-${String(numero)}`,
  numero,
  estado: 'libre',
  zona: 'Interior',
  forma: 'redonda',
  tamano: 'mediana',
  posicion_x: numero * 10,
  posicion_y: 120,
  ...cambios,
});

const base: SalonProps = {
  mesas: [],
  zona: 'Interior',
  oscuro: false,
  mesaActivaId: null,
  cargando: false,
  sinLeer: false,
  sinMesasAsignadas: false,
  responsableDe: () => null,
  solicitudesDeCadaMesa: new Map(),
  alTocar: () => undefined,
  alAtender: () => undefined,
  alReintentar: () => undefined,
};

const plano = (cambios: Partial<SalonProps> = {}): string =>
  renderToStaticMarkup(<PlanoDelSalon {...base} {...cambios} />);
const rejilla = (cambios: Partial<SalonProps> = {}): string =>
  renderToStaticMarkup(<RejillaDeMesas {...base} {...cambios} />);

describe('el plano', () => {
  it('pinta una tesela por mesa, sobre un suelo sólido de 600 px', () => {
    const html = plano({ mesas: [mesa(1), mesa(2), mesa(3)] });
    expect(html.match(/cursor-pointer/g)).toHaveLength(3);
    expect(html).toContain('height:600px');
    expect(html).toContain('bg-fondo-sutil');
    expect(html).not.toMatch(/gradient|radial|dotPattern|background-size/);
  });

  it('la mesa abierta es la única activa', () => {
    const html = plano({ mesas: [mesa(1), mesa(2)], mesaActivaId: 'm-2' });
    expect(html.match(/data-activa/g)).toHaveLength(1);
  });

  it('sin mesas en la zona, lo dice con su nombre y dónde configurarlas', () => {
    const html = plano({ zona: 'Terraza' });
    expect(html).toContain('No hay mesas en Terraza.');
    expect(html).toContain('Configúralas en Configuración → Mapa de mesas.');
  });

  it('un mesero sin mesas asignadas no ve el «no hay mesas»: ya lo dice el aviso de arriba', () => {
    expect(plano({ sinMesasAsignadas: true })).not.toContain('No hay mesas');
  });

  it('mientras lee, un esqueleto del sistema (y no el «no hay mesas»)', () => {
    const html = plano({ cargando: true });
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('No hay mesas');
  });

  it('si la lectura falló, un error con salida — no un mapa vacío que manda a Configuración', () => {
    const html = plano({ sinLeer: true });
    expect(html).toContain('role="alert"');
    expect(html).toContain('No se pudo leer el mapa de mesas.');
    expect(html).toContain('Volver a intentar');
    expect(html).not.toContain('Configúralas');
  });

  it('con mesas ya leídas, un error de relectura no tapa el mapa', () => {
    const html = plano({ mesas: [mesa(1)], sinLeer: true });
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('cursor-pointer');
  });

  it('las mesas de arriba (y < 80) llevan los globos debajo; las demás, encima', () => {
    const globo = [{ id: 's1', mesa_id: 'm-1', tipo: 'ayuda', created_date: null }];
    const alto = plano({
      mesas: [mesa(1, { posicion_y: 20 })],
      solicitudesDeCadaMesa: new Map([['m-1', globo]]),
    });
    expect(alto).toContain('top-full');
    const bajo = plano({
      mesas: [mesa(1, { posicion_y: 200 })],
      solicitudesDeCadaMesa: new Map([['m-1', globo]]),
    });
    expect(bajo).toContain('bottom-full');
  });

  it('a cada mesa le llega SU responsable', () => {
    const html = plano({
      mesas: [mesa(1), mesa(2)],
      responsableDe: (m) => (m.id === 'm-2' ? { nombre: 'Lucía', color: '#123456' } : null),
    });
    expect(html.match(/Lucía/g)).toHaveLength(2); // pastilla y título
    expect(html).toContain('background:#123456');
  });
});

describe('la rejilla', () => {
  it('ordena por orden y, a igualdad, por número', () => {
    const html = rejilla({
      mesas: [mesa(7, { orden: 2 }), mesa(3, { orden: 1 }), mesa(2, { orden: 1 }), mesa(9)],
    });
    const numeros = [...html.matchAll(/font-black">(\d+)</g)].map((m) => m[1]);
    expect(numeros).toEqual(['9', '2', '3', '7']);
  });

  it('no usa posiciones: nada de left/top en las mesas', () => {
    expect(rejilla({ mesas: [mesa(1)] })).not.toMatch(/left:\d+px/);
  });

  it('vacía dice «No hay mesas en esta zona», sin mandar a Configuración', () => {
    const html = rejilla();
    expect(html).toContain('No hay mesas en esta zona');
    expect(html).not.toContain('Configúralas');
  });

  it('leyendo y sin poder leer, igual que el plano', () => {
    expect(rejilla({ cargando: true })).toContain('role="status"');
    expect(rejilla({ sinLeer: true })).toContain('role="alert"');
  });

  it('con mesas leídas y alguna con globos, el globo va sobre la tarjeta, en línea', () => {
    const html = rejilla({
      mesas: [mesa(1)],
      solicitudesDeCadaMesa: new Map([
        ['m-1', [{ id: 's1', mesa_id: 'm-1', tipo: 'ordenar', created_date: null }]],
      ]),
    });
    expect(html).toContain('Quiere ordenar');
  });
});

describe('las zonas', () => {
  const zonas = [
    { zona: 'Interior', count: 7 },
    { zona: 'Terraza', count: 3 },
  ];
  const html = (activa: string): string =>
    renderToStaticMarkup(
      <ZonasDelSalon zonas={zonas} zonaActiva={activa} alElegir={() => undefined} />,
    );

  it('con una sola zona no se pintan', () => {
    expect(
      renderToStaticMarkup(
        <ZonasDelSalon
          zonas={zonas.slice(0, 1)}
          zonaActiva="Interior"
          alElegir={() => undefined}
        />,
      ),
    ).toBe('');
  });

  it('cada zona es un botón cuyo nombre EMPIEZA por la zona y lleva su cuenta', () => {
    const marcado = html('Interior');
    expect(marcado).toMatch(/<button[^>]*>Interior <span[^>]*>\(7\)<\/span><\/button>/);
    expect(marcado).toMatch(/<button[^>]*>Terraza <span[^>]*>\(3\)<\/span><\/button>/);
  });

  it('la elegida lo dice con aria-pressed, no sólo con el color', () => {
    const marcado = html('Terraza');
    expect(marcado.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(marcado).toMatch(/aria-pressed="true"[^>]*>Terraza/);
    expect(marcado).toMatch(/aria-pressed="false"[^>]*>Interior/);
  });

  it('el aviso de un mesero sin mesas asignadas dice qué hacer', () => {
    const marcado = renderToStaticMarkup(<AvisoSinMesasAsignadas />);
    expect(marcado).toContain('No tienes mesas asignadas');
    expect(marcado).toContain(
      'Pide al administrador que te asigne mesas desde Configuración → Mesas.',
    );
  });
});

describe('la leyenda', () => {
  const html = renderToStaticMarkup(<LeyendaDeEstados />);

  it('el contenedor y cada uno de sus ocho chips llevan la marca que busca la prueba', () => {
    expect(html).toMatch(/^<div data-leyenda="estados"/);
    expect(html.match(/data-estado-de-la-leyenda="/g)).toHaveLength(8);
  });

  it('dice la palabra de los ocho estados, y ni «Pagada» ni «Cancelada»', () => {
    for (const palabra of [
      'Libre',
      'Esperando orden',
      'Pedido enviado',
      'En preparación',
      'Esperando entrega',
      'Ocupada',
      'Cuenta solicitada',
      'Limpieza',
    ]) {
      expect(html).toContain(`>${palabra}<`);
    }
    expect(html).not.toContain('Pagada');
    expect(html).not.toContain('Cancelada');
  });

  it('cada muestra de color es decorativa: la palabra es la señal', () => {
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(8);
  });
});
