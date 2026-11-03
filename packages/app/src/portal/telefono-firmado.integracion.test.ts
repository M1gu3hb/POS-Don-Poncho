import { createHmac, randomUUID } from 'node:crypto';

import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { quitarDelCarrito } from './carrito-comandos.ts';
import { resolverElTelefono } from './carrito-http.ts';
import { TOPE_DE_CONECTADOS } from './carrito.ts';
import { LIMITES_PORTAL } from './limite.ts';
import {
  mesaConPortal,
  PIMIENTA,
  TELEFONO_A,
  TELEFONO_B,
  telefonoNumero,
} from './pruebas/mesa-con-portal.ts';
import { emitirTelefono, telefonoFirmado } from './telefono.ts';

/**
 * DP-13.3 (punto 11) · EL ID DEL TELÉFONO LO EMITE EL SERVIDOR, FIRMADO, contra Postgres real.
 *
 * Lo que el navegador se inventaba (un id nuevo por cada «teléfono») inflaba las personas
 * conectadas, el «¿Ya pidieron todos?» y —con la mesa cerrada— las personas con las que se abría la
 * mesa. Ahora sólo cuenta como teléfono un id que el servidor firmó; emitir uno tiene límite por mesa
 * y por IP, y el conteo de conectados no pasa de un tope.
 */

const regla = (r: {
  readonly ok: boolean;
  readonly error?: { readonly datos?: Readonly<Record<string, unknown>> };
}) => (r.ok ? null : r.error?.datos?.['regla']);

const INVENTADO = 'inventado_0123456789abcdef';

async function filas(tabla: 'carrito_mesa_lineas' | 'dispositivos_mesa', mesaId: string) {
  const fila = await obtenerDb()
    .selectFrom(tabla)
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('mesa_id', '=', mesaId)
    .executeTakeFirstOrThrow();
  return Number(fila.n);
}

describe('un id que el servidor no firmó no es un teléfono', () => {
  it('no agrega, no quita, no envía, no llama y no late', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    expect(regla(await caso.agregar(INVENTADO, caso.taco))).toBe('QR_TELEFONO_NO_RECONOCIDO');
    expect(regla(await caso.enviar(INVENTADO, true))).toBe('QR_TELEFONO_NO_RECONOCIDO');
    expect(regla(await caso.llamar(INVENTADO))).toBe('QR_TELEFONO_NO_RECONOCIDO');
    const quitar = await caso.publico(quitarDelCarrito, {
      dispositivo: INVENTADO,
      lineaId: randomUUID(),
    });
    expect(regla(quitar)).toBe('QR_TELEFONO_NO_RECONOCIDO');
    await expect(caso.mirar(INVENTADO)).rejects.toMatchObject({
      codigo: 'QR_TELEFONO_NO_RECONOCIDO',
    });
    expect(await filas('carrito_mesa_lineas', caso.mesaId)).toBe(0);
    expect(await filas('dispositivos_mesa', caso.mesaId)).toBe(0);
  });

  it('tampoco el que cambió un carácter, o el firmado con otra pimienta', async () => {
    const caso = await mesaConPortal();
    const alterado = `${TELEFONO_A.slice(0, -1)}${TELEFONO_A.endsWith('0') ? '1' : '0'}`;
    const deOtraPimienta = emitirTelefono('otra-pimienta-de-otro-despliegue-0123');
    for (const id of [alterado, deOtraPimienta]) {
      expect(telefonoFirmado(PIMIENTA, id)).toBe(false);
      expect(regla(await caso.agregar(id, caso.taco))).toBe('QR_TELEFONO_NO_RECONOCIDO');
    }
    expect(await filas('carrito_mesa_lineas', caso.mesaId)).toBe(0);
  });

  it('el firmado por el servidor sí: agrega, late y se ve como suyo', async () => {
    const caso = await mesaConPortal();
    const id = emitirTelefono(PIMIENTA);
    const estado = await caso.agregar(id, caso.taco);
    expect(estado.ok).toBe(true);
    const visto = await caso.mirar(id);
    expect(visto?.lineas.map((l) => l.esMia)).toEqual([true]);
    expect(await filas('dispositivos_mesa', caso.mesaId)).toBe(1);
  });
});

describe('los conectados no se pueden inflar', () => {
  it('con ids inventados no sube ni uno; con firmados, no pasa del tope', async () => {
    const caso = await mesaConPortal();
    await caso.mirar(TELEFONO_A);
    for (let i = 0; i < 25; i++) {
      await expect(
        caso.mirar(`falso_${String(i).padStart(2, '0')}_0123456789abcdef`),
      ).rejects.toMatchObject({
        codigo: 'QR_TELEFONO_NO_RECONOCIDO',
      });
    }
    expect((await caso.mirar(TELEFONO_A))?.conectados).toBe(1);

    const firmados = TOPE_DE_CONECTADOS + 15;
    for (let i = 0; i < firmados; i++) await caso.mirar(telefonoNumero(i));
    // Los teléfonos están ahí, todos (con A, firmados + 1); lo que no pasa del tope es lo que se cuenta.
    expect(await filas('dispositivos_mesa', caso.mesaId)).toBe(firmados + 1);
    const visto = await caso.mirar(TELEFONO_B);
    expect(visto?.conectados).toBe(TOPE_DE_CONECTADOS);
  });
});

describe('emitir un teléfono nuevo tiene límite', () => {
  const contexto = { correlationId: 'prueba', organizacionId: 'sin-uso-en-la-prueba' };

  it('sin id, o con uno que no verifica, el servidor emite uno firmado', async () => {
    const ip = randomUUID();
    const sin = await resolverElTelefono({
      token: `mesa-${randomUUID()}`,
      ip,
      pimienta: PIMIENTA,
      dispositivo: undefined,
      contexto,
    });
    expect(sin).toMatchObject({ ok: true, emitido: true });
    const falso = await resolverElTelefono({
      token: `mesa-${randomUUID()}`,
      ip,
      pimienta: PIMIENTA,
      dispositivo: INVENTADO,
      contexto,
    });
    expect(falso).toMatchObject({ ok: true, emitido: true });
    for (const r of [sin, falso]) {
      expect(r.ok && telefonoFirmado(PIMIENTA, r.dispositivo)).toBe(true);
    }
    expect(sin.ok && falso.ok && sin.dispositivo !== falso.dispositivo).toBe(true);
  });

  it('uno que ya verifica pasa tal cual y no gasta cuota de emisión', async () => {
    const token = `mesa-${randomUUID()}`;
    const ip = randomUUID();
    for (let i = 0; i < LIMITES_PORTAL.telefono_nuevo_mesa.intentos + 5; i++) {
      const r = await resolverElTelefono({
        token,
        ip,
        pimienta: PIMIENTA,
        dispositivo: TELEFONO_A,
        contexto,
      });
      expect(r).toEqual({ ok: true, dispositivo: TELEFONO_A, emitido: false });
    }
  });

  /**
   * Deja el cubo de `accion` para `quien` a `faltan` intentos de agotarse, como si ya se hubieran
   * gastado: el límite se prueba en su borde exacto sin repetir cientos de llamadas a la base.
   */
  async function dejarAFaltan(
    accion: 'telefono_nuevo_mesa' | 'telefono_nuevo_ip',
    quien: string,
    faltan: number,
  ): Promise<void> {
    const clave = createHmac('sha256', PIMIENTA)
      .update(`portal:${accion}:${quien}`, 'utf8')
      .digest('hex');
    const gastados = LIMITES_PORTAL[accion].intentos - faltan;
    await sql`insert into limite_tasa (clave, ventana_en, intentos) values (${clave}, now(), ${gastados})`.execute(
      obtenerDb(),
    );
  }

  const pedir = (token: string, ip: string) =>
    resolverElTelefono({ token, ip, pimienta: PIMIENTA, dispositivo: undefined, contexto });

  it('por mesa: el último intento del límite pasa, el siguiente no; otra mesa sí', async () => {
    const token = `mesa-${randomUUID()}`;
    await dejarAFaltan('telefono_nuevo_mesa', token, 1);
    expect((await pedir(token, randomUUID())).ok).toBe(true);
    const negado = await pedir(token, randomUUID());
    expect(negado.ok).toBe(false);
    expect(!negado.ok && negado.esperaSegundos).toBeGreaterThan(0);
    expect((await pedir(`mesa-${randomUUID()}`, randomUUID())).ok).toBe(true);
  });

  it('por IP: el último intento del límite pasa, el siguiente no, en cualquier mesa; otra IP sí', async () => {
    const ip = randomUUID();
    await dejarAFaltan('telefono_nuevo_ip', ip, 1);
    expect((await pedir(`mesa-${randomUUID()}`, ip)).ok).toBe(true);
    expect((await pedir(`mesa-${randomUUID()}`, ip)).ok).toBe(false);
    expect((await pedir(`mesa-${randomUUID()}`, randomUUID())).ok).toBe(true);
  });
});
