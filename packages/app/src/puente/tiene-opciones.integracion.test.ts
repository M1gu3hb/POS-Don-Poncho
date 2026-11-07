import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { consultar } from './consultar.ts';

/**
 * DP-14.1 (punto 4) · EL PRODUCTO DICE SI TIENE OPCIONES, EN LA MISMA LECTURA, contra Postgres.
 *
 * El mesero sabe qué platillo pide su opción obligatoria por la lectura de opciones
 * (`restaurante.opciones_de_los_platillos`). Si esa lectura falla en una tableta que nunca la tuvo,
 * no sabía qué agregar al instante y qué no: todo esperaba. Ahora `ProductoTerminado` trae
 * `tiene_opciones` (algún grupo de opciones ligado al platillo), de la MISMA lectura de productos
 * con la que el mesero pinta la carta: lo que no tiene se agrega siempre, al instante.
 */

const POR_COMANDOS = 120_000;

let salon: Salon;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Restaurante de las opciones', mesas: 1 });
  const db = obtenerDb();
  const grupo = await db
    .insertInto('modificadores')
    .values({ organizacion_id: salon.negocio.organizacionId, nombre: 'Término', obligatorio: true })
    .returning('id')
    .executeTakeFirstOrThrow();
  await db
    .insertInto('producto_modificadores')
    .values({
      organizacion_id: salon.negocio.organizacionId,
      producto_id: salon.platillos.arrachera,
      modificador_id: grupo.id,
    })
    .execute();
}, POR_COMANDOS);

describe('ProductoTerminado.tiene_opciones', () => {
  it(
    'la arrachera con su grupo de opciones dice que sí; el guacamole y la cerveza, que no',
    { timeout: POR_COMANDOS },
    async () => {
      const filas = await consultar(
        {
          organizacionId: salon.negocio.organizacionId,
          rol: 'mesero',
          empleoId: salon.negocio.empleoId,
          sucursalId: salon.sucursal.sucursalId,
        },
        { entidad: 'ProductoTerminado', operacion: 'list', limite: 50 },
      );
      const porId = new Map(filas.map((f) => [f['id'], f['tiene_opciones']]));
      expect(porId.get(salon.platillos.arrachera)).toBe(true);
      expect(porId.get(salon.platillos.guacamole)).toBe(false);
      expect(porId.get(salon.platillos.cerveza)).toBe(false);
    },
  );
});
