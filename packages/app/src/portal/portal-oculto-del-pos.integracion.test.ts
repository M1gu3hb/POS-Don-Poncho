import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { exigirOk } from '../pruebas/negocio-real.ts';
import { payloadDelPortal } from './consulta.ts';
import { PIMIENTA, TELEFONO_A, mesaConPortal } from './pruebas/mesa-con-portal.ts';

/**
 * DP-22 · DP-D174 · UN PLATILLO OCULTO DEL POS («Visible en POS» apagado en Recetas) NO SE VE NI SE PIDE EN EL PORTAL.
 *
 * El portal sólo miraba `activo` y `visible_en_menu_digital` (que ninguna pantalla cambia): el platillo
 * que la dueña ocultaba del POS seguía en el menú del QR y se podía pedir desde el teléfono. Ahora
 * `visible_en_pos = false` lo quita del menú del portal y de lo que el portal acepta pedir.
 */

const ocultarDelPos = (productoId: string, visible: boolean) =>
  obtenerDb()
    .updateTable('productos')
    .set({ visible_en_pos: visible })
    .where('id', '=', productoId)
    .execute();

const nombresDelMenu = async (organizacionId: string, token: string): Promise<string[]> =>
  (await payloadDelPortal(organizacionId, token, PIMIENTA)).productos.map((p) => p.nombre);

describe('un platillo oculto del POS en el portal del comensal', () => {
  it('sale en el menú mientras es visible, deja de salir al ocultarlo y vuelve al mostrarlo', async () => {
    const caso = await mesaConPortal();
    const org = caso.negocio.organizacionId;
    expect(await nombresDelMenu(org, caso.qrToken)).toContain('Taco de barbacoa');

    await ocultarDelPos(caso.taco, false);
    const oculto = await nombresDelMenu(org, caso.qrToken);
    expect(oculto).not.toContain('Taco de barbacoa');
    expect(oculto).toContain('Agua de jamaica');

    await ocultarDelPos(caso.taco, true);
    expect(await nombresDelMenu(org, caso.qrToken)).toContain('Taco de barbacoa');
  });

  it('el servidor tampoco deja pedirlo: la línea no entra al carrito', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(1);
    await ocultarDelPos(caso.taco, false);
    const r = await caso.agregar(TELEFONO_A, caso.taco);
    expect(r.ok).toBe(false);
    exigirOk(await caso.agregar(TELEFONO_A, caso.agua), 'lo demás sí se puede pedir');
  });
});
