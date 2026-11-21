import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { agregarALaUnionComando, type ResultadoAgregado } from './agregar-a-la-union.ts';
import { entregarPedidos, transicionarPedido } from './preparacion.ts';
import {
  PRECIO_ARRACHERA,
  PRECIO_CERVEZA,
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  fotoDeLaCocina,
  mesaPersistida,
  ordenPersistida,
  pagosDe,
  pedirLaCuenta,
  sentarYPedir,
  type Salon,
} from './pruebas/salon-real.ts';
import { LADO, mesa, posicion, salonEnFila, unir } from './pruebas/union-en-el-plano.ts';
import { separarMesasComando } from './union-de-mesas.ts';

/**
 * DP-24 · P5 · UNIR MESAS POCO A POCO, contra Postgres.
 *
 * Tres uniones seguidas sobre el MISMO grupo, con comandas en todos los estados repartidas en las
 * mesas, por los comandos de producción:
 *
 *   1. la 4 y la 5 se juntan (4 principal)  → un grupo aparte, con su cuenta;
 *   2. la 1 y la 2 se juntan (1 principal)  → el grupo de la PRIMERA unión;
 *   3. se le agrega la 3                    → una mesa suelta con cuenta;
 *   4. se le agrega la 4                    → la principal de OTRO grupo: entra con la 5 y su cuenta;
 *   5. se le agrega la 6                    → una mesa libre, sin cuenta.
 *
 * Se afirma: UNA sola cuenta viva (la de la 1) con todos los renglones y el total exacto, las
 * comandas siguen vivas, cada una en su estado, y cuelgan de esa cuenta; las mesas están
 * ocupadas por el grupo. Después, separar y cobrar.
 */

const PEDIDOS = {
  uno: [{ platillo: 'arrachera', cantidad: '1' }],
  dos: [{ platillo: 'cerveza', cantidad: '2' }],
  tres: [{ platillo: 'arrachera', cantidad: '1' }],
  cuatro: [{ platillo: 'cerveza', cantidad: '1' }],
  cinco: [{ platillo: 'arrachera', cantidad: '1' }],
} as const;

const TOTAL_DEL_GRUPO = Number(3n * PRECIO_ARRACHERA + 2n * PRECIO_CERVEZA + 1n * PRECIO_CERVEZA);
/** Hilera de mesas medianas redondas de 80 en el plano: la i-ésima toca a la anterior. */
const EN_HILERA = (i: number) => 100 + i * LADO;

interface Cuentas {
  readonly uno: string;
  readonly dos: string;
  readonly tres: string;
  readonly cuatro: string;
  readonly cinco: string;
}

interface GrupoPorPartes {
  readonly salon: Salon;
  readonly cuentas: Cuentas;
  readonly unionId: string;
  readonly comandasAntes: ReadonlyMap<string, string>;
  readonly cocinaAntes: { readonly comandas: number; readonly items: number };
  readonly pasos: {
    readonly sueltaConCuenta: ResultadoAgregado;
    readonly principalDeOtro: ResultadoAgregado;
    readonly libre: ResultadoAgregado;
  };
}

function agregar(
  salon: Salon,
  unionId: string,
  indices: readonly number[],
  posiciones: readonly { i: number; x: number }[],
) {
  return comando(agregarALaUnionComando, {
    entrada: {
      unionId,
      mesaIds: indices.map((i) => mesa(salon, i)),
      posiciones: posiciones.map((p) => ({ mesaId: mesa(salon, p.i), x: p.x, y: 100 })),
    },
    ambito: ambitoDeCaja(salon),
    idempotencyKey: clave(),
  });
}

async function marcar(salon: Salon, comandaId: string, estado: 'en_preparacion' | 'listo') {
  exigirOk(
    await comando(transicionarPedido, {
      entrada: { comandaId, estado },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.transicionar_pedido',
  );
}

async function comandasDe(ordenId: string) {
  return obtenerDb()
    .selectFrom('comandas')
    .select(['id', 'estado', 'orden_id'])
    .where('orden_id', '=', ordenId)
    .execute();
}

/** Cada mesa pide y su comanda queda en un estado distinto: nuevo, en preparación, lista, entregada. */
async function pedirEnTodosLosEstados(salon: Salon): Promise<Cuentas> {
  const uno = await sentarYPedir(salon, 0, PEDIDOS.uno); // nuevo
  const dos = await sentarYPedir(salon, 1, PEDIDOS.dos);
  const tres = await sentarYPedir(salon, 2, PEDIDOS.tres);
  const cuatro = await sentarYPedir(salon, 3, PEDIDOS.cuatro);
  const cinco = await sentarYPedir(salon, 4, PEDIDOS.cinco); // nuevo
  for (const c of await comandasDe(dos.ordenId)) await marcar(salon, c.id, 'en_preparacion');
  for (const c of await comandasDe(tres.ordenId)) await marcar(salon, c.id, 'listo');
  for (const c of await comandasDe(cuatro.ordenId)) await marcar(salon, c.id, 'listo');
  exigirOk(
    await comando(entregarPedidos, {
      entrada: { ordenId: cuatro.ordenId },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.entregar_pedidos',
  );
  return {
    uno: uno.ordenId,
    dos: dos.ordenId,
    tres: tres.ordenId,
    cuatro: cuatro.ordenId,
    cinco: cinco.ordenId,
  };
}

async function estadosDeLasComandas(ordenIds: readonly string[]) {
  const filas = await obtenerDb()
    .selectFrom('comandas')
    .select(['id', 'estado'])
    .where('orden_id', 'in', [...ordenIds])
    .execute();
  return new Map(filas.map((f) => [f.id, f.estado]));
}

async function armarElGrupo(nombre: string): Promise<GrupoPorPartes> {
  const salon = await salonEnFila(nombre, 7);
  await abrirLasCajas(salon);
  const cuentas = await pedirEnTodosLosEstados(salon);
  const todas = Object.values(cuentas);
  const comandasAntes = await estadosDeLasComandas(todas);
  const cocinaAntes = await fotoDeLaCocina(todas);

  // El otro grupo: la 4 (principal) y la 5, juntas en su lugar.
  // La 4 se corre 20 al unirse: al separar todo el grupo, vuelve a donde estaba ANTES de esa unión.
  exigirOk(
    await unir(
      salon,
      3,
      [4],
      [
        { i: 3, x: 720, y: 100 },
        { i: 4, x: 720 + LADO, y: 100 },
      ],
    ),
    'unir la 4 y la 5',
  );
  // El grupo de la PRIMERA unión: la 1 (principal) y la 2.
  const primera = exigirOk(
    await unir(salon, 0, [1], [{ i: 1, x: EN_HILERA(0) + LADO, y: 100 }]),
    'unir la 1 y la 2',
  );
  const sueltaConCuenta = exigirOk(
    await agregar(salon, primera.unionId, [2], [{ i: 2, x: EN_HILERA(0) + 2 * LADO }]),
    'agregar la 3',
  );
  // La 4 con la 5 se corren pegadas al final de la hilera: la 4 en el cuarto lugar, la 5 en el quinto.
  const principalDeOtro = exigirOk(
    await agregar(
      salon,
      primera.unionId,
      [3],
      [
        { i: 3, x: EN_HILERA(0) + 3 * LADO },
        { i: 4, x: EN_HILERA(0) + 4 * LADO },
      ],
    ),
    'agregar la 4 (principal de otro grupo)',
  );
  const libre = exigirOk(
    await agregar(salon, primera.unionId, [5], [{ i: 5, x: EN_HILERA(0) + 5 * LADO }]),
    'agregar la 6 (libre)',
  );
  return {
    salon,
    cuentas,
    unionId: primera.unionId,
    comandasAntes,
    cocinaAntes,
    pasos: { sueltaConCuenta, principalDeOtro, libre },
  };
}

describe('tres uniones seguidas sobre el mismo grupo', () => {
  let g: GrupoPorPartes;
  beforeAll(async () => {
    g = await armarElGrupo('Salón que se junta poco a poco');
  }, 300_000);

  it('cada paso mueve sólo lo suyo: la suelta, el grupo ajeno con su cuenta, y la libre sin consumo', () => {
    expect(g.pasos.sueltaConCuenta).toMatchObject({
      mesasAgregadas: 1,
      cuentasAbsorbidas: 1,
      lineasMovidas: 1,
      gruposAbsorbidos: 0,
    });
    // La 4 trae su renglón y el de la 5 (que ya se le había unido): una cuenta, dos renglones.
    expect(g.pasos.principalDeOtro).toMatchObject({
      mesasAgregadas: 1,
      cuentasAbsorbidas: 1,
      lineasMovidas: 2,
      gruposAbsorbidos: 1,
    });
    expect(g.pasos.libre).toMatchObject({
      mesasAgregadas: 1,
      cuentasAbsorbidas: 0,
      lineasMovidas: 0,
    });
    expect(g.pasos.libre.totalCentavos).toBe(String(TOTAL_DEL_GRUPO));
  });

  it('una sola cuenta viva —la de la primera principal— con todos los renglones y el total exacto', async () => {
    expect(await ordenPersistida(g.cuentas.uno)).toMatchObject({
      estado: expect.stringMatching(/confirmada|en_preparacion|lista/) as unknown,
      total_centavos: BigInt(TOTAL_DEL_GRUPO),
    });
    for (const ajena of [g.cuentas.dos, g.cuentas.tres, g.cuentas.cuatro, g.cuentas.cinco]) {
      expect(await ordenPersistida(ajena)).toMatchObject({
        estado: 'absorbida',
        total_centavos: 0n,
      });
    }
    const lineas = await obtenerDb()
      .selectFrom('orden_lineas')
      .select(['orden_id'])
      .where('orden_id', 'in', Object.values(g.cuentas))
      .execute();
    // 5 renglones, ninguno duplicado, todos en la cuenta de la primera principal.
    expect(lineas).toHaveLength(5);
    expect(new Set(lineas.map((l) => l.orden_id))).toEqual(new Set([g.cuentas.uno]));
    // Todas las cuentas del grupo —también la de la 5, que venía en el otro grupo— dicen de cuál son.
    const delGrupo = await obtenerDb()
      .selectFrom('ordenes')
      .select(['id', 'union_id'])
      .where('id', 'in', Object.values(g.cuentas))
      .execute();
    expect(new Set(delGrupo.map((o) => o.union_id))).toEqual(new Set([g.unionId]));
    const vivas = await obtenerDb()
      .selectFrom('ordenes')
      .select('id')
      .where('id', 'in', Object.values(g.cuentas))
      .where('estado', 'not in', ['absorbida'])
      .execute();
    expect(vivas.map((v) => v.id)).toEqual([g.cuentas.uno]);
  });

  it('todas las comandas siguen vivas, cada una en su estado, y cuelgan del grupo; cocina no pierde ni duplica', async () => {
    expect(g.comandasAntes.size).toBe(5);
    expect([...g.comandasAntes.values()].sort()).toEqual([
      'en_preparacion',
      'entregado',
      'listo',
      'nuevo',
      'nuevo',
    ]);
    const despues = await comandasDe(g.cuentas.uno);
    expect(despues).toHaveLength(5);
    expect(new Map(despues.map((c) => [c.id, c.estado]))).toEqual(g.comandasAntes);
    expect(await fotoDeLaCocina(Object.values(g.cuentas))).toEqual(g.cocinaAntes);
    for (const ajena of [g.cuentas.dos, g.cuentas.tres, g.cuentas.cuatro, g.cuentas.cinco]) {
      expect(await comandasDe(ajena)).toEqual([]);
    }
  });

  it('las mesas quedan ocupadas por el grupo: la principal con la cuenta, las demás sin cuenta y ocultas', async () => {
    const principal = await mesaPersistida(mesa(g.salon, 0));
    expect(principal.orden_activa_id).toBe(g.cuentas.uno);
    const detalle = await obtenerDb()
      .selectFrom('mesas')
      .select(['personas_actuales'])
      .where('id', '=', mesa(g.salon, 0))
      .executeTakeFirstOrThrow();
    // 4 + 4 + 4 + (4 + 4 de la 4 con la 5) y la 6 libre sin gente.
    expect(detalle.personas_actuales).toBe(20);
    for (const i of [1, 2, 3, 4, 5]) {
      expect(await mesaPersistida(mesa(g.salon, i)), `la mesa ${String(i + 1)}`).toMatchObject({
        orden_activa_id: null,
        unida_a_mesa_id: mesa(g.salon, 0),
        estado: principal.estado,
      });
    }
  });

  it('un solo grupo vivo: el de la 4 se cerró sin separar a nadie y sus mesas son del grupo de la 1', async () => {
    const uniones = await obtenerDb()
      .selectFrom('uniones_mesa')
      .select(['id', 'mesa_principal_id', 'orden_id', 'cerrada_en'])
      .where('mesa_principal_id', 'in', [mesa(g.salon, 0), mesa(g.salon, 3)])
      .execute();
    const vivas = uniones.filter((u) => u.cerrada_en === null);
    expect(vivas).toHaveLength(1);
    expect(vivas[0]).toMatchObject({ id: g.unionId, orden_id: g.cuentas.uno });
    const miembros = await obtenerDb()
      .selectFrom('union_mesa_miembros')
      .select(['mesa_id', 'union_abierta'])
      .where('union_id', '=', g.unionId)
      .execute();
    expect(new Set(miembros.map((m) => m.mesa_id))).toEqual(
      new Set([1, 2, 3, 4, 5].map((i) => mesa(g.salon, i))),
    );
    expect(miembros.every((m) => m.union_abierta)).toBe(true);
  });

  it('las reglas de siempre: ya en el grupo, otro grupo, y una mesa de otro negocio se rechazan', async () => {
    const yaEsta = await agregar(g.salon, g.unionId, [2], [{ i: 2, x: 360 }]);
    expect(yaEsta.ok ? null : yaEsta.error.mensaje).toMatch(/ya está en este grupo/);
    const absorbida = await agregar(g.salon, g.unionId, [4], []);
    expect(absorbida.ok ? null : absorbida.error.mensaje).toMatch(/ya está en este grupo/);
    const laPrincipal = await agregar(g.salon, g.unionId, [0], []);
    expect(laPrincipal.ok ? null : laPrincipal.error.mensaje).toMatch(/principal de este grupo/);
    const ajeno = await salonEnFila('Salón de al lado', 1);
    const deOtro = await comando(agregarALaUnionComando, {
      entrada: { unionId: g.unionId, mesaIds: [mesa(ajeno, 0)] },
      ambito: ambitoDeCaja(g.salon),
      idempotencyKey: clave(),
    });
    expect(deOtro.ok).toBe(false);
  });
});

describe('separar tras agregar poco a poco', () => {
  let g: GrupoPorPartes;
  beforeAll(async () => {
    g = await armarElGrupo('Salón que se junta y se separa');
    exigirOk(
      await comando(separarMesasComando, {
        entrada: { unionId: g.unionId },
        ambito: ambitoDeCaja(g.salon),
        idempotencyKey: clave(),
      }),
      'separar el grupo',
    );
  }, 300_000);

  it('cada mesa vuelve libre, sin cuenta, a su lugar de antes; la cuenta se queda en la principal', async () => {
    for (const i of [1, 2, 3, 4, 5]) {
      expect(await mesaPersistida(mesa(g.salon, i)), `la mesa ${String(i + 1)}`).toMatchObject({
        estado: 'libre',
        orden_activa_id: null,
        unida_a_mesa_id: null,
      });
      // Su lugar del salón: 100 + i · 200 (incluidas la 4 y la 5, que habían viajado dos veces).
      expect(await posicion(mesa(g.salon, i)), `lugar de la mesa ${String(i + 1)}`).toEqual([
        100 + i * 200,
        100,
      ]);
    }
    expect(await posicion(mesa(g.salon, 0))).toEqual([100, 100]);
    const principal = await mesaPersistida(mesa(g.salon, 0));
    expect(principal.orden_activa_id).toBe(g.cuentas.uno);
    const cuenta = await obtenerDb()
      .selectFrom('ordenes')
      .select(['union_id', 'total_centavos'])
      .where('id', '=', g.cuentas.uno)
      .executeTakeFirstOrThrow();
    expect(cuenta).toEqual({ union_id: null, total_centavos: BigInt(TOTAL_DEL_GRUPO) });
    // La cuenta y sus comandas no se reparten: siguen en la principal.
    expect(await comandasDe(g.cuentas.uno)).toHaveLength(5);
    const abiertas = await obtenerDb()
      .selectFrom('uniones_mesa')
      .select('id')
      .where('mesa_principal_id', 'in', g.salon.mesas)
      .where('cerrada_en', 'is', null)
      .execute();
    expect(abiertas).toEqual([]);
  });
});

describe('cobrar el grupo armado por partes', () => {
  let g: GrupoPorPartes;
  beforeAll(async () => {
    g = await armarElGrupo('Salón que se junta y cobra');
    await pedirLaCuenta(g.salon, g.cuentas.uno, 1_000);
    exigirOk(
      await cobrarExacto(ambitoDeCaja(g.salon), g.cuentas.uno, TOTAL_DEL_GRUPO),
      'venta.cobrar (el grupo)',
    );
  }, 300_000);

  it('se cobra UNA vez por el total exacto; las absorbidas no tienen pagos', async () => {
    const pagos = await pagosDe(Object.values(g.cuentas));
    expect(pagos).toHaveLength(1);
    expect(pagos[0]).toMatchObject({
      orden_id: g.cuentas.uno,
      monto_centavos: BigInt(TOTAL_DEL_GRUPO),
    });
    expect(await ordenPersistida(g.cuentas.uno)).toMatchObject({
      estado: 'pagada',
      total_centavos: BigInt(TOTAL_DEL_GRUPO),
    });
  });

  it('la principal pasa a limpieza como siempre; la cocina no se duplica', async () => {
    expect(await mesaPersistida(mesa(g.salon, 0))).toMatchObject({
      estado: 'limpieza',
      orden_activa_id: g.cuentas.uno,
    });
    expect(await fotoDeLaCocina(Object.values(g.cuentas))).toEqual(g.cocinaAntes);
  });

  it('un grupo ya cobrado no recibe más mesas: la principal está en limpieza', async () => {
    const r = await agregar(g.salon, g.unionId, [6], [{ i: 6, x: EN_HILERA(0) + 6 * LADO }]);
    expect(r.ok ? null : r.error.mensaje).toMatch(/limpieza/);
  });
});

describe('qué cuentas entran', () => {
  it('una mesa con la cuenta ya pedida entra; una ya cobrada (en limpieza) se rechaza', async () => {
    const salon = await salonEnFila('Salón de las cuentas pedidas', 4);
    await abrirLasCajas(salon);
    const a = await sentarYPedir(salon, 0, PEDIDOS.uno);
    await sentarYPedir(salon, 1, PEDIDOS.dos);
    const pedida = await sentarYPedir(salon, 2, PEDIDOS.tres);
    const cobrada = await sentarYPedir(salon, 3, PEDIDOS.cuatro);
    const primera = exigirOk(
      await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]),
      'unir la 1 y la 2',
    );
    await pedirLaCuenta(salon, pedida.ordenId, 1_000);
    await pedirLaCuenta(salon, cobrada.ordenId, 1_000);
    exigirOk(
      await cobrarExacto(ambitoDeCaja(salon), cobrada.ordenId, Number(PRECIO_CERVEZA)),
      'cobrar la 4',
    );

    const rechazada = await agregar(salon, primera.unionId, [3], [{ i: 3, x: 100 + 3 * LADO }]);
    expect(rechazada.ok ? null : rechazada.error.mensaje).toMatch(/limpieza/);

    const aceptada = exigirOk(
      await agregar(salon, primera.unionId, [2], [{ i: 2, x: 100 + 2 * LADO }]),
      'agregar la 3 con la cuenta pedida',
    );
    expect(aceptada).toMatchObject({ cuentasAbsorbidas: 1, lineasMovidas: 1 });
    expect(aceptada.totalCentavos).toBe(String(PRECIO_ARRACHERA * 2n + 2n * PRECIO_CERVEZA));
    expect((await ordenPersistida(a.ordenId)).estado).not.toBe('absorbida');
  }, 300_000);
});

describe('un grupo que todavía no tiene cuenta', () => {
  it('una mesa suelta con cuenta se la lleva a la principal, y la unión la toma', async () => {
    const salon = await salonEnFila('Salón del grupo sin cuenta', 4);
    await abrirLasCajas(salon);
    const primera = exigirOk(
      await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]),
      'unir la 1 y la 2 (libres)',
    );
    expect(primera.ordenPrincipalId).toBeNull();
    const tres = await sentarYPedir(salon, 2, PEDIDOS.tres);

    const r = exigirOk(
      await agregar(salon, primera.unionId, [2], [{ i: 2, x: 100 + 2 * LADO }]),
      'agregar la 3 con cuenta',
    );
    expect(r.ordenPrincipalId).toBe(tres.ordenId);
    expect(r.totalCentavos).toBe(String(PRECIO_ARRACHERA));
    expect(await mesaPersistida(mesa(salon, 0))).toMatchObject({ orden_activa_id: tres.ordenId });
    expect(await mesaPersistida(mesa(salon, 2))).toMatchObject({
      orden_activa_id: null,
      unida_a_mesa_id: mesa(salon, 0),
    });
    const union = await obtenerDb()
      .selectFrom('uniones_mesa')
      .select('orden_id')
      .where('id', '=', primera.unionId)
      .executeTakeFirstOrThrow();
    expect(union.orden_id).toBe(tres.ordenId);
    expect((await ordenPersistida(tres.ordenId)).estado).not.toBe('absorbida');
  }, 300_000);

  it('el grupo ajeno que trae la cuenta también se la lleva: su unión se cierra y nadie se separa', async () => {
    const salon = await salonEnFila('Salón del grupo ajeno con cuenta', 4);
    await abrirLasCajas(salon);
    const primera = exigirOk(
      await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]),
      'unir la 1 y la 2 (libres)',
    );
    const tres = await sentarYPedir(salon, 2, PEDIDOS.tres);
    exigirOk(await unir(salon, 2, [3], [{ i: 3, x: 500 + LADO, y: 100 }]), 'unir la 3 y la 4');

    const r = exigirOk(
      await agregar(
        salon,
        primera.unionId,
        [2],
        [
          { i: 2, x: 100 + 2 * LADO },
          { i: 3, x: 100 + 3 * LADO },
        ],
      ),
      'agregar la 3 (principal de otro grupo, con la cuenta)',
    );
    expect(r).toMatchObject({ gruposAbsorbidos: 1, ordenPrincipalId: tres.ordenId });
    for (const i of [1, 2, 3]) {
      expect(await mesaPersistida(mesa(salon, i)), `mesa ${String(i + 1)}`).toMatchObject({
        orden_activa_id: null,
        unida_a_mesa_id: mesa(salon, 0),
      });
    }
    const vivas = await obtenerDb()
      .selectFrom('uniones_mesa')
      .select(['id', 'orden_id'])
      .where('mesa_principal_id', 'in', salon.mesas)
      .where('cerrada_en', 'is', null)
      .execute();
    expect(vivas).toEqual([{ id: primera.unionId, orden_id: tres.ordenId }]);
  }, 300_000);
});
