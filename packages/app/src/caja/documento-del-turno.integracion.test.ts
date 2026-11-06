import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk } from '../pruebas/negocio-real.ts';
import {
  PRECIO_ARRACHERA,
  ambitoDeCaja,
  cobrarExacto,
  sembrarSalon,
  sentarYPedir,
} from '../restaurante/pruebas/salon-real.ts';
import { documentoDeCorte } from './documento.ts';
import { corteDeTurno } from './turno.ts';

/**
 * QA2-008 (DP-13.5) · EL DOCUMENTO DEL CORTE DE TURNO DICE LO MISMO QUE EL CORTE.
 *
 * Al cortar, el esperado es lo que debe haber en el cajón en ese momento: todos los movimientos de
 * la sesión hasta ahí, la apertura (el fondo) incluida. El documento (el PDF) lo rehacía como
 * fondo + movimientos del tramo − retirado, y el tramo del primer turno YA trae la apertura: el
 * fondo contaba dos veces y una cajera que cuadró al centavo salía con «faltan $1,500». Ahora el
 * documento usa la misma cuenta que el corte.
 */

describe('el documento de cada corte de turno', () => {
  it('cuadra igual que el corte: el primero y el segundo, sin el fondo dos veces', async () => {
    const salon = await sembrarSalon({ nombre: 'Fonda de los turnos', mesas: 2, terminales: 1 });
    const caja = ambitoDeCaja(salon);
    await abrirCajaReal(caja, 150_000);
    const total = Number(PRECIO_ARRACHERA);

    const primera = await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '1' }]);
    exigirOk(await cobrarExacto(caja, primera.ordenId, total), 'venta.cobrar');
    const turnoUno = exigirOk(
      await comando(corteDeTurno, {
        entrada: { efectivoContadoCentavos: 150_000 + total, notas: null },
        ambito: caja,
        idempotencyKey: clave(),
      }),
      'caja.corte_turno',
    );
    expect(turnoUno.diferenciaCentavos).toBe('0');

    const segunda = await sentarYPedir(salon, 1, [{ platillo: 'arrachera', cantidad: '1' }]);
    exigirOk(await cobrarExacto(caja, segunda.ordenId, total), 'venta.cobrar');
    const turnoDos = exigirOk(
      await comando(corteDeTurno, {
        entrada: { efectivoContadoCentavos: 150_000 + 2 * total, notas: null },
        ambito: caja,
        idempotencyKey: clave(),
      }),
      'caja.corte_turno',
    );
    expect(turnoDos.diferenciaCentavos).toBe('0');

    for (const turno of [turnoUno, turnoDos]) {
      const documento = exigirOk(
        await comando(documentoDeCorte, {
          entrada: { corteId: turno.corteTurnoId },
          // El documento lo lee la gerencia (Registros → Cortes).
          ambito: { ...caja, rol: 'gerente' },
          idempotencyKey: clave(),
        }),
        'caja.documento_corte',
      );
      expect(documento.efectivoEsperadoCentavos).toBe(turno.efectivoEsperadoCentavos);
      expect(documento.diferenciaCentavos).toBe('0');
    }
  });
});
