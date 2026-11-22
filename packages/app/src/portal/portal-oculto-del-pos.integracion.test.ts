import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { exigirOk } from '../pruebas/negocio-real.ts';
import { payloadDelPortal } from './consulta.ts';
import { PIMIENTA, TELEFONO_A, mesaConPortal } from './pruebas/mesa-con-portal.ts';

/**
 * DP-25 · Parte 8 · DP-D227 (revierte DP-D174) · EL PORTAL Y EL POS SE OCULTAN POR SEPARADO.
 *
 * Antes (DP-D174) `visible_en_pos = false` también quitaba el platillo del portal. Ahora quien
 * administra el menú elige DÓNDE oculta cada platillo: lo oculto del POS sigue en el portal QR
 * (se ve y se pide) y lo oculto del portal sale de él aunque siga en el POS.
 */

const poner = (
  productoId: string,
  cambio: { visible_en_pos?: boolean; visible_en_menu_digital?: boolean },
) => obtenerDb().updateTable('productos').set(cambio).where('id', '=', productoId).execute();

const nombresDelMenu = async (organizacionId: string, token: string): Promise<string[]> =>
  (await payloadDelPortal(organizacionId, token, PIMIENTA)).productos.map((p) => p.nombre);

describe('un platillo oculto del POS en el portal del comensal', () => {
  it('sigue en el menú del portal aunque esté oculto del POS', async () => {
    const caso = await mesaConPortal();
    const org = caso.negocio.organizacionId;
    await poner(caso.taco, { visible_en_pos: false });
    expect(await nombresDelMenu(org, caso.qrToken)).toContain('Taco de barbacoa');
  });

  it('el servidor lo deja pedir desde el portal aunque esté oculto del POS', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(1);
    await poner(caso.taco, { visible_en_pos: false });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'oculto del POS, pedible en el portal');
  });

  it('oculto del portal sale del menú y no se deja pedir, aunque siga en el POS', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(1);
    await poner(caso.taco, { visible_en_menu_digital: false });
    const menu = await nombresDelMenu(caso.negocio.organizacionId, caso.qrToken);
    expect(menu).not.toContain('Taco de barbacoa');
    expect(menu).toContain('Agua de jamaica');
    expect((await caso.agregar(TELEFONO_A, caso.taco)).ok).toBe(false);
  });
});
