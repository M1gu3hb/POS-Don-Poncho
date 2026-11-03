import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { vaciarElCarrito } from '../restaurante/carrito-del-mesero.ts';
import { SEGUNDOS_VACIADO_VIGENTE } from './carrito.ts';
import { ambitoDelPersonal, type CasoDeLaMesa } from './pruebas/personal-de-la-mesa.ts';
import {
  mesaConPortal,
  TELEFONO_A,
  TELEFONO_B,
  telefonoNumero,
} from './pruebas/mesa-con-portal.ts';

/**
 * DP-13.3 (punto 12) · EL COMENSAL SE ENTERA CUANDO EL MESERO BORRA SU PEDIDO, contra Postgres real.
 *
 * Antes el carrito se quedaba vacío sin explicación. Ahora el siguiente sondeo de cada teléfono que
 * estaba en la mesa dice que el mesero lo vació —UNA vez— y no vuelve a decirlo; el que llega
 * después, o el que ya no estaba, no oye nada. La marca vive en `carritos_mesa` (sin migración) y el
 * "una vez" lo lleva el último latido de cada teléfono.
 */

const hace = (segundos: number) => new Date(Date.now() - segundos * 1000);

async function vaciar(caso: CasoDeLaMesa) {
  const mesero = await ambitoDelPersonal(caso, 'mesero');
  return comando(vaciarElCarrito, {
    ambito: mesero,
    entrada: { mesaId: caso.mesaId },
    idempotencyKey: clave(),
  });
}

describe('el mesero borra el pedido y el comensal se entera', () => {
  it('el siguiente sondeo de cada teléfono lo dice, una sola vez', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    await caso.mirar(TELEFONO_A, hace(5));
    await caso.mirar(TELEFONO_B, hace(5));
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await vaciar(caso), 'vaciar');

    const primero = await caso.mirar(TELEFONO_A);
    expect(primero?.lineas).toEqual([]);
    expect(primero?.vaciadoPorElMesero?.en).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect((await caso.mirar(TELEFONO_A))?.vaciadoPorElMesero).toBeNull();
    expect((await caso.mirar(TELEFONO_A))?.vaciadoPorElMesero).toBeNull();

    // Y el otro teléfono de la mesa se entera por su cuenta, también una vez.
    expect((await caso.mirar(TELEFONO_B))?.vaciadoPorElMesero).not.toBeNull();
    expect((await caso.mirar(TELEFONO_B))?.vaciadoPorElMesero).toBeNull();
  });

  it('el teléfono cuyo último latido escrito es de hace 45 s (late cada 30) también lo oye', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    await caso.mirar(TELEFONO_A, hace(45));
    // Lo arma OTRO teléfono: si A agregara algo, su propio comando le pondría al día el latido.
    exigirOk(await caso.agregar(TELEFONO_B, caso.taco), 'agregar');
    exigirOk(await vaciar(caso), 'vaciar');
    expect((await caso.mirar(TELEFONO_A))?.vaciadoPorElMesero).not.toBeNull();
    expect((await caso.mirar(TELEFONO_A))?.vaciadoPorElMesero).toBeNull();
  });

  it('el teléfono que llega después, o el que llevaba rato sin sondear, no oye nada', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    await caso.mirar(TELEFONO_A, hace(5));
    await caso.mirar(TELEFONO_B, hace(10 * 60));
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await vaciar(caso), 'vaciar');

    expect((await caso.mirar(telefonoNumero(1)))?.vaciadoPorElMesero).toBeNull();
    expect((await caso.mirar(TELEFONO_B))?.vaciadoPorElMesero).toBeNull();
    expect((await caso.mirar(TELEFONO_A))?.vaciadoPorElMesero).not.toBeNull();
  });

  it('el aviso vence: pasado su plazo, un teléfono que no había sondeado ya no lo oye', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    await caso.mirar(TELEFONO_A, hace(5));
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await vaciar(caso), 'vaciar');
    const tarde = new Date(Date.now() + (SEGUNDOS_VACIADO_VIGENTE + 60) * 1000);
    expect((await caso.mirar(TELEFONO_A, tarde))?.vaciadoPorElMesero).toBeNull();
  });

  it('vaciar un carrito que ya estaba vacío no avisa a nadie', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    await caso.mirar(TELEFONO_A, hace(5));
    exigirOk(await vaciar(caso), 'vaciar');
    expect((await caso.mirar(TELEFONO_A))?.vaciadoPorElMesero).toBeNull();
  });

  it('no es un envío: la ronda no sube y no hay «último envío»', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    await caso.mirar(TELEFONO_A, hace(5));
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await vaciar(caso), 'vaciar');
    const visto = await caso.mirar(TELEFONO_A);
    expect(visto).toMatchObject({ ronda: 0, ultimoEnvio: null });
    const fila = await obtenerDb()
      .selectFrom('carritos_mesa')
      .select('ronda')
      .where('mesa_id', '=', caso.mesaId)
      .executeTakeFirstOrThrow();
    expect(fila.ronda).toBe(0);
  });

  it('un envío posterior lo reemplaza: el teléfono ve el envío, no un vaciado viejo', async () => {
    const caso = await mesaConPortal({ envian: 'comensales' });
    await caso.abrir(1);
    await caso.mirar(TELEFONO_B, hace(5));
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await vaciar(caso), 'vaciar');
    exigirOk(await caso.agregar(TELEFONO_A, caso.agua), 'agregar otra');
    exigirOk(await caso.enviar(TELEFONO_A, true), 'enviar');
    const visto = await caso.mirar(TELEFONO_B);
    expect(visto?.vaciadoPorElMesero).toBeNull();
    expect(visto).toMatchObject({ ronda: 1, ultimoEnvio: { porEsteTelefono: false } });
  });
});
