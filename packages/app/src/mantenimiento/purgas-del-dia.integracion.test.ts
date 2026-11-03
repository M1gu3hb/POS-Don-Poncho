import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { purgarVentas, reiniciarPruebas, reiniciarTodo } from './comandos.ts';
import { MESAS_DEL_DIA, sembrarUnDia, type DiaSembrado } from './pruebas/dia-completo.ts';
import {
  conAlgo,
  fotografiaDe,
  huellaDe,
  type Fotografia,
  type Huella,
} from './pruebas/fotografia.ts';

/**
 * DP-13.3b · LAS PURGAS DE UN DÍA COMPLETO, contra Postgres real.
 *
 * `plataforma.integracion.test.ts` sólo purga un negocio vacío, y una base vacía no tiene con
 * qué chocar: las llaves foráneas `no action` de `movimientos_cuenta`, `uniones_mesa`,
 * `union_mesa_miembros` y `lista_espera` hacia `ordenes` y `mesas` no se enteran. Aquí un día
 * sembrado con los comandos de producción (cuenta dividida, cambio de mesa, anulación, unión con
 * gente, unión separada, dos uniones vivas, carrito del portal, avisos, lista de espera) se
 * purga y se LEE la base: cada tabla del día en cero para ESE negocio, las mesas libres y en su
 * lugar, y OTRO negocio con la misma jornada exactamente igual (fotografía de todas sus tablas).
 */

/** Todo lo que un día de ventas escribe y que la purga de ventas tiene que dejar en cero. */
const DEL_DIA = [
  'ordenes',
  'orden_lineas',
  'orden_linea_modificadores',
  'pagos',
  'comandas',
  'comanda_items',
  'movimientos_caja',
  'movimientos_cuenta',
  'uniones_mesa',
  'union_mesa_miembros',
  'carritos_mesa',
  'carrito_mesa_lineas',
  'dispositivos_mesa',
  'solicitudes_qr',
  'lista_espera',
  // Abrir, ocupar y liberar cada mesa: es del día, y sin su cuenta (que se borra) no dice nada.
  'eventos_mesa',
] as const;

let ajeno: DiaSembrado;
let fotoDelAjeno: Fotografia;
let huellaDelAjeno: Huella;

async function mesasDe(dia: DiaSembrado) {
  return obtenerDb()
    .selectFrom('mesas')
    .select([
      'id',
      'estado',
      'orden_activa_id',
      'unida_a_mesa_id',
      'personas_actuales',
      'ocupada_desde',
      'empleado_atiende_id',
      'cliente_temporal',
      'posicion_x',
      'posicion_y',
    ])
    .where('organizacion_id', '=', dia.salon.negocio.organizacionId)
    .execute();
}

/** Las mesas, libres y en el lugar del plano en que estaban antes de unir nada. */
function exigirMesasLibres(dia: DiaSembrado, mesas: Awaited<ReturnType<typeof mesasDe>>): void {
  expect(mesas).toHaveLength(MESAS_DEL_DIA);
  for (const m of mesas) {
    expect(
      {
        estado: m.estado,
        orden: m.orden_activa_id,
        unida: m.unida_a_mesa_id,
        personas: m.personas_actuales,
        desde: m.ocupada_desde,
        atiende: m.empleado_atiende_id,
        cliente: m.cliente_temporal,
        lugar: [m.posicion_x, m.posicion_y],
      },
      `la mesa ${m.id} quedó mal`,
    ).toEqual({
      estado: 'libre',
      orden: null,
      unida: null,
      personas: 0,
      desde: null,
      atiende: null,
      cliente: null,
      lugar: dia.posiciones.get(m.id),
    });
  }
}

beforeAll(async () => {
  ajeno = await sembrarUnDia('Fonda del vecino');
  fotoDelAjeno = await fotografiaDe(ajeno.salon.negocio.organizacionId);
  huellaDelAjeno = await huellaDe(ajeno.salon.negocio.organizacionId);
});

describe('el día sembrado tiene de todo (si no, la purga no se está probando)', () => {
  it('cada tabla del día tiene filas', () => {
    for (const tabla of DEL_DIA) {
      if (tabla === 'orden_linea_modificadores') continue; // el menú de la prueba no lleva modificadores
      expect(fotoDelAjeno[tabla], `el día no escribió «${tabla}»`).toBeGreaterThan(0);
    }
  });
});

describe('purgar las ventas de un día completo', () => {
  it('deja en cero lo del día, las mesas libres y en su lugar, y al vecino intacto', async () => {
    const dia = await sembrarUnDia('Fonda del día completo');
    const org = dia.salon.negocio.organizacionId;
    const antes = await fotografiaDe(org);
    expect(antes['ordenes']).toBeGreaterThan(0);

    const r = exigirOk(
      await comando(purgarVentas, {
        ambito: dia.plataforma,
        entrada: { confirmacionNombreNegocio: dia.nombre },
        idempotencyKey: clave(),
      }),
      'mantenimiento.purgar_ventas',
    );
    expect(r.borrado['uniones_mesa']).toBe(antes['uniones_mesa']);
    expect(r.borrado['movimientos_cuenta']).toBe(antes['movimientos_cuenta']);

    const despues = await fotografiaDe(org);
    for (const tabla of DEL_DIA) expect(despues[tabla], `«${tabla}» no quedó en cero`).toBe(0);
    exigirMesasLibres(dia, await mesasDe(dia));
    // Lo que NO es del día sigue: el equipo, el menú y las mesas mismas.
    expect(despues['mesas']).toBe(MESAS_DEL_DIA);
    expect(despues['productos']).toBe(antes['productos']);
    expect(despues['empleos']).toBe(antes['empleos']);

    expect(await huellaDe(ajeno.salon.negocio.organizacionId)).toEqual(huellaDelAjeno);
  });
});

describe('reiniciar el histórico y reiniciar todo de un día completo', () => {
  it('reiniciar pruebas vacía el día y deja el catálogo', async () => {
    const dia = await sembrarUnDia('Fonda de las pruebas');
    const org = dia.salon.negocio.organizacionId;
    const antes = await fotografiaDe(org);
    exigirOk(
      await comando(reiniciarPruebas, {
        ambito: dia.plataforma,
        entrada: { confirmacionNombreNegocio: dia.nombre },
        idempotencyKey: clave(),
      }),
      'mantenimiento.reiniciar_pruebas',
    );
    const despues = await fotografiaDe(org);
    for (const tabla of DEL_DIA) expect(despues[tabla], `«${tabla}» no quedó en cero`).toBe(0);
    exigirMesasLibres(dia, await mesasDe(dia));
    expect(despues['productos']).toBe(antes['productos']);
  });

  it('reiniciar todo también: ni las uniones ni la espera estorban al borrar las mesas', async () => {
    const dia = await sembrarUnDia('Fonda del reinicio');
    const org = dia.salon.negocio.organizacionId;
    const r = exigirOk(
      await comando(reiniciarTodo, {
        ambito: dia.plataforma,
        entrada: { confirmacionNombreNegocio: dia.nombre },
        idempotencyKey: clave(),
      }),
      'mantenimiento.reiniciar_todo',
    );
    const despues = await fotografiaDe(org);
    for (const tabla of DEL_DIA) expect(despues[tabla], `«${tabla}» no quedó en cero`).toBe(0);
    expect(despues['mesas']).toBe(0);
    // El conteo que va a la auditoría dice lo que HABÍA, no el cero de la segunda pasada.
    expect(r.borrado['solicitudes_qr']).toBeGreaterThan(0);
    expect(conAlgo(despues)).not.toContain('uniones_mesa');

    expect(await huellaDe(ajeno.salon.negocio.organizacionId)).toEqual(huellaDelAjeno);
  });
});
