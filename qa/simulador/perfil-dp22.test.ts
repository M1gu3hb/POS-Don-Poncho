import { describe, expect, it } from 'vitest';

import { IDS_QUE_SABE_HACER } from './bots/caos-dp22.ts';
import { generarHorario } from './horario.ts';
import {
  CAJA_DOS,
  CAOS_DEL_DIA,
  ENTRA_LA_CAJA_DOS,
  ESTACIONES_DEL_DIA,
  LLEGADAS_DEL_DIA_DE_BOTS,
  MESEROS_DEL_DIA,
  SUSTITUTOS_DEL_DIA,
} from './perfil-dp22.ts';
import { crearAzar } from './semilla.ts';

describe('el perfil dp22 (el día de bots)', () => {
  it('cada paso del caos tiene un id único y cae dentro del día (8:00 a 19:00)', () => {
    const ids = CAOS_DEL_DIA.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of CAOS_DEL_DIA) {
      expect(p.enMinuto).toBeGreaterThanOrEqual(0);
      expect(p.enMinuto).toBeLessThan(11 * 60);
    }
  });

  it('todo lo que hace la dueña tiene su guion, y el guion no sabe pasos que nadie pide', () => {
    const suyos = CAOS_DEL_DIA.filter((p) => p.quien === 'dueno').map((p) => p.id);
    expect([...IDS_QUE_SABE_HACER].sort()).toEqual([...suyos].sort());
  });

  it('cambia 6 o más configuraciones a media operación y las regresa', () => {
    const cambios = CAOS_DEL_DIA.filter(
      (p) => p.preparacion !== true && /^[CS]\d+$/.test(p.id) && p.tipo !== 'salon',
    );
    const conRegreso = cambios.filter((p) => CAOS_DEL_DIA.some((q) => q.id === `${p.id}r`));
    expect(conRegreso.length).toBeGreaterThanOrEqual(6);
    for (const p of conRegreso) {
      const vuelta = CAOS_DEL_DIA.find((q) => q.id === `${p.id}r`);
      expect(vuelta?.enMinuto).toBeGreaterThan(p.enMinuto);
    }
  });

  it('la categoría y la estación nuevas son a las 11:00 y la reasignación a las 14:00', () => {
    expect(CAOS_DEL_DIA.find((p) => p.id === 'K1')?.enMinuto).toBe(3 * 60);
    expect(CAOS_DEL_DIA.find((p) => p.id === 'K2')?.enMinuto).toBe(6 * 60);
  });

  it('los meseros entran en orden y el nuevo espera su alta', () => {
    const nuevos = MESEROS_DEL_DIA.filter((m) => m.nuevoACadaMediaJornada === true);
    expect(nuevos.map((m) => m.persona)).toEqual(['Mesero 7']);
    expect(MESEROS_DEL_DIA.length).toBeGreaterThanOrEqual(3);
  });

  it('todos los aparatos de la semana se sustituyen por uno táctil del arnés y hay 5 estaciones', () => {
    for (const viejo of [
      'pc-1920',
      'tableta-1024',
      'tableta-768',
      'android-412',
      'iphone',
      'android-360',
    ] as const)
      expect(SUSTITUTOS_DEL_DIA[viejo]).toBeDefined();
    expect(ESTACIONES_DEL_DIA).toHaveLength(5);
  });

  it('misma semilla, mismo día: las llegadas no cambian', () => {
    const a = generarHorario(crearAzar('2211-dp22').hijo('horario'), LLEGADAS_DEL_DIA_DE_BOTS, 'B');
    const b = generarHorario(crearAzar('2211-dp22').hijo('horario'), LLEGADAS_DEL_DIA_DE_BOTS, 'B');
    const c = generarHorario(crearAzar('2212-dp22').hijo('horario'), LLEGADAS_DEL_DIA_DE_BOTS, 'B');
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(LLEGADAS_DEL_DIA_DE_BOTS.cuentas);
  });

  it('la comida fuerte (13:00 a 16:00) recibe más gente que cualquier otras tres horas de la mañana', () => {
    const l = generarHorario(
      crearAzar('2211-dp22').hijo('horario'),
      { ...LLEGADAS_DEL_DIA_DE_BOTS, cuentas: 600 },
      'B',
    );
    const entre = (a: number, b: number): number =>
      l.filter((x) => x.horaSim >= a * 60 && x.horaSim < b * 60).length;
    expect(entre(13, 16)).toBeGreaterThan(entre(8, 11) * 1.5);
  });

  it('el traslado de la Caja 2 cae cuando dice R1 (15:00), contando desde que ELLA abre y no desde las 8:00', () => {
    // El bot de la caja cuenta sus minutos desde su apertura: la Caja 2 abre a las 12:40, y con el 420 del
    // día el traslado caía a las 19:40 y no pasaba nunca (R1 «no ejecutado» en los días 2212 y 2213).
    const r1 = CAOS_DEL_DIA.find((p) => p.id === 'R1');
    expect(CAJA_DOS.traslado?.enMinuto).toBeDefined();
    expect(ENTRA_LA_CAJA_DOS + (CAJA_DOS.traslado?.enMinuto ?? 0)).toBe(r1?.enMinuto);
  });
});
