import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { MOTIVOS_ANULACION } from '@morphiqpos/domain/venta';
import { sql } from 'kysely';

import { comando } from '../../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../../pruebas/negocio-real.ts';
import { agregarAlCarrito } from '../../portal/carrito-comandos.ts';
import { leerElCarrito } from '../../portal/carrito-http.ts';
import { ejecutarComandoPublico } from '../../portal/comando-publico.ts';
import { PIMIENTA, TELEFONO_A, TELEFONO_B } from '../../portal/pruebas/mesa-con-portal.ts';
import { crearSolicitudQR } from '../../portal/solicitudes.ts';
import { anularLineaComando } from '../../restaurante/anulacion-linea.ts';
import { cambiarEnElCarrito } from '../../restaurante/carrito-del-mesero.ts';
import { cambiarMesaComando } from '../../restaurante/cambio-de-mesa.ts';
import { registrarEspera, sentarEspera } from '../../restaurante/espera.ts';
import { rotarQr } from '../../restaurante/qr.ts';
import {
  ambitoDeCaja,
  abrirLasCajas,
  cobrarExacto,
  dividirEn,
  lineasDe,
  mesaDe,
  pedirLaCuenta,
  sentarYPedir,
  type Salon,
} from '../../restaurante/pruebas/salon-real.ts';
import { LADO, salonEnFila, unir } from '../../restaurante/pruebas/union-en-el-plano.ts';
import { separarMesasComando } from '../../restaurante/union-de-mesas.ts';
import { marcarPlataforma } from '../plataforma.ts';

/**
 * UN DÍA COMPLETO DE RESTAURANTE, sembrado con los comandos de producción (DP-13.3b), para
 * probar las purgas contra Postgres real y no contra una base falsa que no valida llaves.
 *
 * Cada mesa deja un rastro distinto, y juntas tocan todas las tablas que un día escribe:
 *
 *   0  · cuenta dividida en tres, la primera cobrada, y un aviso de ayuda del comensal
 *   1→2 · cambio de mesa, y una anulación de platillo
 *   3+4 · unión con gente, y luego separadas (unión cerrada)
 *   5+6 · unión viva SIN cuenta (la absorbida oculta, movida de lugar)
 *   7+8 · unión viva CON cuenta (la llave circular `ordenes.union_id` ↔ `uniones_mesa.orden_id`)
 *   9   · carrito del portal con líneas de dos teléfonos y un aviso pendiente
 *   10  · una familia de la lista de espera sentada, y otra todavía esperando
 */

export const MESAS_DEL_DIA = 11;
export const PLATAFORMA_NOMBRE = 'Dueño de plataforma';

export interface DiaSembrado {
  readonly salon: Salon;
  readonly nombre: string;
  /** Un dueño marcado como usuario de plataforma: el único que ejecuta las purgas. */
  readonly plataforma: Ambito;
  /** Dónde estaba cada mesa en el plano antes de unir nada. */
  readonly posiciones: ReadonlyMap<string, readonly [number, number]>;
}

async function dueñoDePlataforma(salon: Salon): Promise<Ambito> {
  const empleoId = await sembrarCompanero(salon.negocio, {
    nombre: PLATAFORMA_NOMBRE,
    rol: 'dueno',
  });
  const { persona_id } = await obtenerDb()
    .selectFrom('empleos')
    .select('persona_id')
    .where('id', '=', empleoId)
    .executeTakeFirstOrThrow();
  const { id: identidadId } = await obtenerDb()
    .insertInto('identidades')
    .values({ persona_id })
    .returning('id')
    .executeTakeFirstOrThrow();
  const ambito: Ambito = { ...ambitoDeCaja(salon), rol: 'dueno', empleoId, identidadId };
  exigirOk(
    await comando(marcarPlataforma, { ambito, entrada: {}, idempotencyKey: clave() }),
    'marcar plataforma',
  );
  return ambito;
}

/** El portal abierto para pedir y pedir ayuda, y el arrachera visible en el menú digital. */
async function abrirElPortal(salon: Salon): Promise<void> {
  const banderas = {
    portal_qr_activo: true,
    portal_qr_permitir_pedidos_cliente: true,
    portal_qr_permitir_ayuda: true,
  };
  await conTransaccion(async (tx) => {
    await sql`
      insert into configuracion (organizacion_id, valores)
      values (${salon.negocio.organizacionId}, ${JSON.stringify(banderas)}::jsonb)
      on conflict (organizacion_id) do update set valores = configuracion.valores || excluded.valores
    `.execute(tx);
    await tx
      .updateTable('productos')
      .set({ visible_en_menu_digital: true, area_preparacion: 'cocina' })
      .where('id', '=', salon.platillos.arrachera)
      .execute();
  });
}

async function tokenDeLaMesa(dia: { salon: Salon; plataforma: Ambito }, i: number) {
  const { qrToken } = exigirOk(
    await comando(rotarQr, {
      entrada: { mesaId: mesaDe(dia.salon, i) },
      ambito: dia.plataforma,
      idempotencyKey: clave(),
    }),
    'restaurante.rotar_qr',
  );
  return qrToken;
}

const publico = (salon: Salon, token: string) => ({
  token,
  organizacionId: salon.negocio.organizacionId,
  pimienta: PIMIENTA,
});

async function pedirAyuda(salon: Salon, token: string): Promise<void> {
  exigirOk(
    await ejecutarComandoPublico(crearSolicitudQR, {
      ...publico(salon, token),
      entrada: { tipo: 'ayuda' },
      idempotencyKey: clave(),
    }),
    'portal.crear_solicitud',
  );
}

async function armarElCarrito(salon: Salon, token: string, mesero: Ambito): Promise<void> {
  for (const dispositivo of [TELEFONO_A, TELEFONO_B]) {
    exigirOk(
      await ejecutarComandoPublico(agregarAlCarrito, {
        ...publico(salon, token),
        entrada: {
          dispositivo,
          item: { productoId: salon.platillos.arrachera, cantidad: '2', notas: '' },
        },
        idempotencyKey: clave(),
      }),
      'portal.agregar_al_carrito',
    );
    // El latido del teléfono: es lo que escribe `dispositivos_mesa`.
    await leerElCarrito({ ...publico(salon, token), dispositivo, ahora: new Date() });
  }
  // El mesero cambia una cantidad: es lo que toma la fila de `carritos_mesa` (la ronda).
  const linea = await obtenerDb()
    .selectFrom('carrito_mesa_lineas')
    .select('id')
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .executeTakeFirstOrThrow();
  exigirOk(
    await comando(cambiarEnElCarrito, {
      entrada: { mesaId: mesaDe(salon, 9), lineaId: linea.id, cantidad: '3' },
      ambito: mesero,
      idempotencyKey: clave(),
    }),
    'restaurante.carrito_cambiar',
  );
}

/**
 * Junta dos mesas en el plano MOVIENDO a las dos (la principal también): separar o purgar tiene
 * que devolver a cada una a su lugar, y una principal que no se movió no probaría que vuelve.
 */
const juntas = (salon: Salon, principal: number, otra: number) => {
  const x = 100 + principal * 200 + 40;
  return unir(
    salon,
    principal,
    [otra],
    [
      { i: principal, x, y: 160 },
      { i: otra, x: x + LADO, y: 160 },
    ],
  );
};

export async function sembrarUnDia(nombre: string): Promise<DiaSembrado> {
  const salon = await salonEnFila(nombre, MESAS_DEL_DIA);
  const plataforma = await dueñoDePlataforma(salon);
  await abrirLasCajas(salon);
  await abrirElPortal(salon);
  const caja = ambitoDeCaja(salon);
  const mesas = await obtenerDb()
    .selectFrom('mesas')
    .select(['id', 'posicion_x', 'posicion_y'])
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .execute();
  const posiciones = new Map(mesas.map((m) => [m.id, [m.posicion_x, m.posicion_y] as const]));
  const pedido = [
    { platillo: 'arrachera', cantidad: '2' },
    { platillo: 'cerveza', cantidad: '1' },
  ] as const;

  // 0 · dividida en tres, la primera cobrada, y un aviso de ayuda con cuenta abierta.
  const m0 = await sentarYPedir(salon, 0, [
    { platillo: 'cerveza', cantidad: '1' },
    { platillo: 'arrachera', cantidad: '1' },
    { platillo: 'guacamole', cantidad: '1' },
  ]);
  await pedirLaCuenta(salon, m0.ordenId);
  const division = await dividirEn(salon, m0.ordenId, [
    [{ platillo: 'cerveza', cantidad: 1 }],
    [{ platillo: 'arrachera', cantidad: 1 }],
    [{ platillo: 'guacamole', cantidad: 1 }],
  ]);
  const primera = division.hijas[0];
  if (primera === undefined) throw new Error('La división debía dar partes.');
  exigirOk(await cobrarExacto(caja, primera.ordenId, 5_555), 'cobrar la primera parte');
  await pedirAyuda(salon, await tokenDeLaMesa({ salon, plataforma }, 0));

  // 1→2 · cambio de mesa y una anulación de platillo ya enviado.
  const m1 = await sentarYPedir(salon, 1, pedido);
  exigirOk(
    await comando(cambiarMesaComando, {
      entrada: { ordenId: m1.ordenId, mesaDestinoId: mesaDe(salon, 2) },
      ambito: caja,
      idempotencyKey: clave(),
    }),
    'restaurante.cambiar_mesa',
  );
  const arrachera = (await lineasDe(m1.ordenId)).get('Arrachera al carbón')?.[0];
  if (arrachera === undefined) throw new Error('La cuenta de la mesa 1 no tiene arrachera.');
  exigirOk(
    await comando(anularLineaComando, {
      entrada: {
        ordenId: m1.ordenId,
        lineaId: arrachera,
        cantidad: '1',
        motivo: MOTIVOS_ANULACION[0],
      },
      ambito: caja,
      idempotencyKey: clave(),
    }),
    'restaurante.anular_linea',
  );

  // 3+4 · unión con gente y luego separadas: queda una unión cerrada y su historia.
  await sentarYPedir(salon, 3, pedido);
  await sentarYPedir(salon, 4, pedido);
  const { unionId } = exigirOk(await juntas(salon, 3, 4), 'unir 3 y 4');
  exigirOk(
    await comando(separarMesasComando, {
      entrada: { unionId },
      ambito: caja,
      idempotencyKey: clave(),
    }),
    'separar 3 y 4',
  );

  // 5+6 · unión viva sin cuenta. 7+8 · unión viva con cuenta.
  exigirOk(await juntas(salon, 5, 6), 'unir 5 y 6');
  await sentarYPedir(salon, 7, pedido);
  await sentarYPedir(salon, 8, pedido);
  exigirOk(await juntas(salon, 7, 8), 'unir 7 y 8');

  // 9 · carrito del portal con la mesa cerrada, y un aviso pendiente.
  const token9 = await tokenDeLaMesa({ salon, plataforma }, 9);
  await armarElCarrito(salon, token9, plataforma);
  await pedirAyuda(salon, token9);

  // 10 · lista de espera: una familia sentada (apunta a mesa y cuenta), otra esperando.
  const sentada = exigirOk(
    await comando(registrarEspera, {
      entrada: { nombre: 'Familia Rojas', personas: 4 },
      ambito: caja,
      idempotencyKey: clave(),
    }),
    'restaurante.registrar_espera',
  );
  exigirOk(
    await comando(registrarEspera, {
      entrada: { nombre: 'Familia Pérez', personas: 2 },
      ambito: caja,
      idempotencyKey: clave(),
    }),
    'restaurante.registrar_espera (la que sigue esperando)',
  );
  exigirOk(
    await comando(sentarEspera, {
      entrada: { esperaId: sentada.esperaId, mesaId: mesaDe(salon, 10) },
      ambito: caja,
      idempotencyKey: clave(),
    }),
    'restaurante.sentar_espera',
  );

  return { salon, nombre, plataforma, posiciones };
}
