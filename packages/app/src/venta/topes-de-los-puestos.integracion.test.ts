import type { Ambito, Resultado } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { topesDeLosPuestos } from './topes-de-los-puestos.ts';

/**
 * DP-14 · ronda 2, menor · CONFIGURACIÓN → DESCUENTOS DICE LOS TOPES REALES.
 *
 * El texto decía «gerente 30 %, administrador 50 %, dueño 100 %» fijo, aunque el negocio hubiera
 * escrito otros en `topes_descuento`. Ahora la pantalla lee lo que de verdad autoriza cada puesto:
 * la fila del negocio o, si no la escribió, la del sistema (`topeDe`, el respaldo por puesto).
 */

const POR_COMANDOS = 120_000;

let salon: Salon;
let duenoId = '';
let gerenteId = '';

const dueno = (): Ambito => ({ ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId });
const gerente = (): Ambito => ({ ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId });
const leer = (ambito: Ambito = dueno()) =>
  comando(topesDeLosPuestos, { entrada: {}, ambito, idempotencyKey: clave() });
const fallo = <T>(r: Resultado<T>): string | null => (r.ok ? null : r.error.codigo);

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Restaurante de los topes', mesas: 1 });
  duenoId = await sembrarCompanero(salon.negocio, { nombre: 'El Dueño', rol: 'dueno' });
  gerenteId = await sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' });
}, POR_COMANDOS);

describe('venta.topes_de_los_puestos', () => {
  it('sin filas del negocio, los del sistema', { timeout: POR_COMANDOS }, async () => {
    expect(exigirOk(await leer(), 'leer').topes).toEqual([
      { rol: 'gerente', topeBp: 3_000, topeCentavos: '200000' },
      { rol: 'administrador', topeBp: 5_000, topeCentavos: '500000' },
      { rol: 'dueno', topeBp: 10_000, topeCentavos: '100000000' },
    ]);
  });

  it(
    'la fila que escribió el negocio manda para ese puesto',
    { timeout: POR_COMANDOS },
    async () => {
      await obtenerDb()
        .insertInto('topes_descuento')
        .values({
          organizacion_id: salon.negocio.organizacionId,
          rol: 'gerente',
          tope_bp: 2_000,
          tope_centavos: 100_000n,
        })
        .execute();
      const { topes } = exigirOk(await leer(), 'leer');
      expect(topes[0]).toEqual({ rol: 'gerente', topeBp: 2_000, topeCentavos: '100000' });
      expect(topes[1]).toMatchObject({ rol: 'administrador', topeBp: 5_000 });
    },
  );

  it(
    'la gerente no lo lee (la pestaña es del dueño y del administrador)',
    { timeout: POR_COMANDOS },
    async () => {
      expect(fallo(await leer(gerente()))).not.toBeNull();
    },
  );
});
