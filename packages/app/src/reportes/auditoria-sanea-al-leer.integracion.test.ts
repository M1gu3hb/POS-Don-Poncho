import { conTransaccion } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarSucursal,
} from '../pruebas/negocio-real.ts';
import { auditoriaReciente } from './auditoria-reciente.ts';

/**
 * DP-16 (1.5) · La auditoría vuelve a sanear AL LEER: un renglón guardado con un correo, un
 * teléfono o un PIN en claro (por un camino viejo o que no aplicó el saneado) no sale tal cual.
 */
describe('la auditoría sanea al leer', () => {
  it('tapa correo, teléfono y PIN de un renglón guardado en claro, y deja el resto', async () => {
    const negocio = await sembrarNegocio({
      nombre: 'Fonda de lo guardado en claro',
      rol: 'dueno',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
    const ambito = ambitoDe(negocio, sucursal.sucursalId, sucursal.terminales[0] ?? null);
    await conTransaccion(async (tx) => {
      await tx
        .insertInto('auditoria')
        .values({
          organizacion_id: negocio.organizacionId,
          identidad_id: negocio.identidadId,
          accion: 'prueba.dato_en_claro',
          entidad: 'prueba',
          payload: JSON.stringify({
            motivo: 'cambio de datos de contacto',
            correo: 'cliente@ejemplo.com',
            contacto: { telefono: '5512345678' },
            pin: '4321',
          }),
        })
        .execute();
    });
    const { renglones } = exigirOk(
      await comando(auditoriaReciente, { ambito, entrada: {}, idempotencyKey: clave() }),
      'leer la auditoría',
    );
    const leido = renglones.find((r) => r.accion === 'prueba.dato_en_claro');
    expect(leido).toBeDefined();
    const texto = JSON.stringify(leido?.payload);
    expect(texto).not.toContain('cliente@ejemplo.com');
    expect(texto).not.toContain('5512345678');
    expect(texto).not.toContain('4321');
    expect(leido?.payload).toMatchObject({ motivo: 'cambio de datos de contacto' });
  });
});
