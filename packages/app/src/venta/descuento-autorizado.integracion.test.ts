import type { Ambito, Resultado } from '@morphiqpos/contracts';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion } from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { descontarCuenta } from '../restaurante/descuento-de-cuenta.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  pedirLaCuenta,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import { descuentoAutorizadoComando } from './descuento-autorizado.ts';

/**
 * DP-14 · ronda 2, medio 4 · EL COBRO DE LA CAJA DICE QUIÉN AUTORIZÓ EL DESCUENTO Y POR QUÉ.
 *
 * El cajero cobraba una cuenta con descuento viendo sólo un total más bajo. Ahora el cobro pinta el
 * subtotal en bruto, «Descuento −$X», quién tecleó su PIN y el motivo: lo que el corte ya decía
 * (`caja/corte/descuentos-del-corte.ts`), leído de la misma entrada de la auditoría, para UNA cuenta.
 */

const SECRETO = 'secreto_de_integracion_del_descuento_autorizado_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

const POR_COMANDOS = 120_000;

let salon: Salon;
let otro: Salon;
let gerenteId = '';

const cajera = (s: Salon = salon): Ambito => ambitoDeCaja(s);

async function cuentaPedida(s: Salon, mesa: number): Promise<string> {
  const { ordenId } = await sentarYPedir(s, mesa, [{ platillo: 'arrachera', cantidad: '2' }]);
  await pedirLaCuenta(s, ordenId);
  return ordenId;
}

const leer = (ordenId: string, ambito: Ambito = cajera()) =>
  comando(descuentoAutorizadoComando, { entrada: { ordenId }, ambito, idempotencyKey: clave() });

const fallo = <T>(r: Resultado<T>): string | null => (r.ok ? null : r.error.codigo);

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Restaurante del descuento leído', mesas: 3 });
  otro = await sembrarSalon({ nombre: 'Otro restaurante', mesas: 1 });
  gerenteId = await sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' });
  await abrirLasCajas(salon);
}, POR_COMANDOS);

describe('venta.descuento_autorizado', () => {
  it(
    'una cuenta con descuento: cuánto, quién lo autorizó con su PIN y por qué',
    { timeout: POR_COMANDOS },
    async () => {
      const ordenId = await cuentaPedida(salon, 0);
      const autorizacion = firmarAutorizacion(
        {
          org: salon.negocio.organizacionId,
          supervisor: gerenteId,
          rol: 'gerente',
          solicita: salon.negocio.empleoId,
          exp: Math.floor(Date.now() / 1000) + 120,
          n: clave(),
          cuenta: ordenId,
          para: 'descuento',
          monto: '5000',
        },
        SECRETO,
      );
      exigirOk(
        await comando(descontarCuenta, {
          entrada: { ordenId, descuentoCentavos: 5000, motivo: 'Cliente frecuente', autorizacion },
          ambito: cajera(),
          idempotencyKey: clave(),
        }),
        'descontar',
      );
      expect(exigirOk(await leer(ordenId), 'leer')).toEqual({
        montoCentavos: '5000',
        autorizo: 'La Gerente',
        motivo: 'Cliente frecuente',
      });
    },
  );

  it('una cuenta sin descuento: cero y nadie', { timeout: POR_COMANDOS }, async () => {
    const ordenId = await cuentaPedida(salon, 1);
    expect(exigirOk(await leer(ordenId), 'leer')).toEqual({
      montoCentavos: '0',
      autorizo: null,
      motivo: null,
    });
  });

  it('la cuenta de otro negocio no se lee', { timeout: POR_COMANDOS }, async () => {
    const ajena = await cuentaPedida(otro, 0);
    expect(fallo(await leer(ajena))).not.toBeNull();
  });
});
