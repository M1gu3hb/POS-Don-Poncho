import type { Ambito, Resultado } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { cerrarCaja } from './sesion.ts';
import { nombrarTerminal, terminalesDeLaSucursal } from './terminales.ts';

/**
 * DP-14 · ronda 2, medio 3 · LAS TERMINALES SE NOMBRAN EN CONFIGURACIÓN → CAJA.
 *
 * Con dos cajas, cada navegador se da de alta solo como «Caja N» y el aviso dice «Ya se cobró en
 * Caja 7»: nadie sabe cuál es. El dueño o el administrador las ve y las nombra («Caja 1», «Barra»)
 * desde la pantalla; queda en la auditoría con el nombre de antes y el de después. Un nombre que ya
 * tiene otra terminal de la sucursal no entra (el índice `terminales_nombre_unico` lo exige).
 */

const POR_COMANDOS = 120_000;

let salon: Salon;
let otro: Salon;
let duenoId = '';
let gerenteId = '';

const dueno = (s: Salon = salon): Ambito => ({
  ...ambitoDeCaja(s),
  rol: 'dueno',
  empleoId: duenoId,
});
const gerente = (): Ambito => ({ ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId });

const regla = <T>(r: Resultado<T>): string | null => {
  if (r.ok) return null;
  const d = (r.error.datos as { readonly regla?: unknown } | undefined)?.regla;
  return typeof d === 'string' ? d : r.error.codigo;
};

const nombrar = (terminalId: string, nombre: string, ambito: Ambito = dueno()) =>
  comando(nombrarTerminal, {
    entrada: { terminal: terminalId, nombre },
    ambito,
    idempotencyKey: clave(),
  });

const listar = (ambito: Ambito = dueno()) =>
  comando(terminalesDeLaSucursal, { entrada: {}, ambito, idempotencyKey: clave() });

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Restaurante de las terminales', mesas: 1, terminales: 3 });
  otro = await sembrarSalon({ nombre: 'Otro de las terminales', mesas: 1, terminales: 1 });
  duenoId = await sembrarCompanero(salon.negocio, { nombre: 'El Dueño', rol: 'dueno' });
  gerenteId = await sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' });
  await abrirCajaReal(ambitoDeCaja(salon, 0));
  // «Caja 2» abrió y cerró: también es caja. «Caja 3» nunca abrió (el teléfono de un mesero).
  await abrirCajaReal(ambitoDeCaja(salon, 1));
  exigirOk(
    await comando(cerrarCaja, {
      entrada: { efectivoContadoCentavos: 50_000 },
      ambito: ambitoDeCaja(salon, 1),
      idempotencyKey: clave(),
    }),
    'caja.cerrar',
  );
}, POR_COMANDOS);

describe('caja.terminales y caja.nombrar_terminal', () => {
  it(
    'el dueño ve sólo las que han abierto caja, con su nombre y cuál está abierta',
    { timeout: POR_COMANDOS },
    async () => {
      const { terminales } = exigirOk(await listar(), 'listar');
      expect(terminales.map((t) => [t.nombre, t.cajaAbierta])).toEqual([
        ['Caja 1', true],
        ['Caja 2', false],
      ]);
    },
  );

  it(
    'las nombra, y queda en la auditoría con el antes y el después',
    { timeout: POR_COMANDOS },
    async () => {
      const terminalId = salon.sucursal.terminales[1] ?? '';
      exigirOk(await nombrar(terminalId, '  Barra  '), 'nombrar');
      const { terminales } = exigirOk(await listar(), 'listar');
      // Por nombre, como se leen en la pantalla.
      expect(terminales.map((t) => t.nombre)).toEqual(['Barra', 'Caja 1']);
      const auditoria = await obtenerDb()
        .selectFrom('auditoria')
        .select('payload')
        .where('accion', '=', 'caja.nombrar_terminal')
        .where('entidad_id', '=', terminalId)
        .executeTakeFirstOrThrow();
      expect(auditoria.payload).toMatchObject({ antes: 'Caja 2', despues: 'Barra' });
    },
  );

  it(
    'un nombre que ya tiene otra terminal de la sucursal no entra',
    { timeout: POR_COMANDOS },
    async () => {
      const r = await nombrar(salon.sucursal.terminales[1] ?? '', 'caja 1');
      expect(regla(r)).toBe('TERMINAL_NOMBRE_REPETIDO');
    },
  );

  it('la gerente no las nombra ni las lista', { timeout: POR_COMANDOS }, async () => {
    expect(
      regla(await nombrar(salon.sucursal.terminales[0] ?? '', 'Mostrador', gerente())),
    ).not.toBeNull();
    expect(regla(await listar(gerente()))).not.toBeNull();
  });

  it('la terminal de otro negocio no se nombra', { timeout: POR_COMANDOS }, async () => {
    const ajena = otro.sucursal.terminales[0] ?? '';
    expect(regla(await nombrar(ajena, 'Mía'))).toBe('TERMINAL_NO_ENCONTRADA');
  });
});
