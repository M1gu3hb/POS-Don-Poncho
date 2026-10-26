import {
  ErrorDominio,
  PLANTILLA_POR_GIRO,
  PAQUETES_RESTAURANTE,
  validarEntorno,
} from '@morphiqpos/contracts';
import {
  esDeUnProyectoIntocable,
  negocioDePruebaPorId,
  type NegocioDePrueba,
} from '@morphiqpos/contracts/negocios';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
import { Rechazo } from '../fallos.ts';
import { recalcularCostosRecetas } from '../inventario/recetas.ts';
import { sembrarArranque, type ResumenArranque } from './arranque.ts';
import {
  APARIENCIA_DE_PRUEBA,
  CAJAS_SIMULTANEAS_DE_PRUEBA,
  IMPUESTO_DE_PRUEBA,
  PIN_DEL_DUENO_DE_PRUEBA,
  TOPES_DE_DESCUENTO,
} from './como-nueva.ts';
import { semillaDePrueba } from './datos.ts';
import { equipoDelGiro, reponerPin, sembrarEquipo } from './equipo.ts';
import { sembrarSala, type ResumenSala } from './sala.ts';
import { CICLOS, ORDEN_DE_LIMPIEZA } from './tablas-del-reseteo.ts';

/**
 * EL RESETEO DEL RESTAURANTE DE PRUEBA: lo devuelve a su punto de partida en una base
 * desechable, para que cada corrida de navegador empiece igual.
 *
 * POS Don Poncho (DP-2) no tiene demostraciones: esto existe sólo para las pruebas. Se niega
 * por ID fuera de `NEGOCIOS_DE_PRUEBA` y se niega si `DATABASE_URL` apunta a un proyecto
 * intocable (la base compartida de la Fase A). Las dos guardas van ANTES de leer nada.
 */
export const entradaResetearNegocioDePrueba = z.object({
  confirmacion: z.literal('RESETEAR'),
});

/**
 * LA CONFIGURACIÓN DEL RESTAURANTE DE PRUEBA, escrita entera (bloque B.2 de la 2.4): IVA
 * general incluido en el precio y su apariencia. Nada de lo que dejó la corrida anterior.
 */
async function reponerConfiguracion(tx: Transaccion, organizacionId: string): Promise<void> {
  const fila = await tx
    .selectFrom('configuracion')
    .select(['id', 'version'])
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  const valores = {
    impuesto: { ...IMPUESTO_DE_PRUEBA },
    apariencia: { ...APARIENCIA_DE_PRUEBA },
  };

  if (fila === undefined) {
    await tx
      .insertInto('configuracion')
      .values({ organizacion_id: organizacionId, valores: JSON.stringify(valores), version: 1 })
      .execute();
    return;
  }
  // La versión SUBE aunque el contenido se reescriba: una pantalla abierta con la
  // configuración de antes tiene que chocar al guardar, no pisar la recién repuesta.
  await tx
    .updateTable('configuracion')
    .set({ valores: JSON.stringify(valores), version: fila.version + 1 })
    .where('id', '=', fila.id)
    .execute();
}

/**
 * EL EQUIPO, repuesto: cada persona sembrada con su PIN (lo hace `sembrarEquipo`), el
 * dueño con el suyo, y cualquiera que una prueba haya dado de alta, desactivado.
 *
 * Al dueño no se le toca el rol ni se le desactiva: es quien resetea. Sólo se le repone su
 * PIN de prueba y se le desbloquea.
 */
async function reponerDueno(tx: Transaccion, organizacionId: string, pimienta: string) {
  const duenos = await tx
    .selectFrom('empleos')
    .select(['id', 'persona_id as personaId'])
    .where('organizacion_id', '=', organizacionId)
    .where('rol', '=', 'dueno')
    .execute();
  for (const dueno of duenos) {
    await tx.updateTable('empleos').set({ activo: true }).where('id', '=', dueno.id).execute();
    await reponerPin(tx, dueno.personaId, PIN_DEL_DUENO_DE_PRUEBA, pimienta);
  }
  return duenos.map((d) => d.id);
}

async function desactivarLoQueSobra(
  tx: Transaccion,
  organizacionId: string,
  seQuedan: readonly string[],
): Promise<void> {
  if (seQuedan.length === 0) return;
  await tx
    .updateTable('empleos')
    .set({ activo: false })
    .where('organizacion_id', '=', organizacionId)
    .where('id', 'not in', [...seQuedan])
    .execute();
}

/**
 * LAS DOS GUARDAS · el reseteo sólo corre sobre un restaurante de prueba, y nunca contra la
 * base compartida (bloque B.1 de la 2.4, endurecido en DP-2).
 *
 * La regla es POSITIVA y por ID: la organización del ámbito tiene que estar en
 * `NEGOCIOS_DE_PRUEBA` (`packages/contracts/src/negocios`). Y aunque lo esté, si el proceso
 * habla con un proyecto intocable —la base de la Fase A, donde vive Don Poncho— se niega:
 * los negocios de prueba sólo existen en bases desechables. Van antes de leer nada y, sobre
 * todo, antes de `limpiar`. Contestan 403 y dejan su rastro de «denegado».
 */
export function exigirRestauranteDePrueba(organizacionId: string): NegocioDePrueba {
  const prueba = negocioDePruebaPorId(organizacionId);
  if (prueba === null || esDeUnProyectoIntocable(process.env['DATABASE_URL'] ?? '')) {
    throw new Rechazo('SIN_PERMISO', 'denegado', {
      codigo: 'SIN_PERMISO',
      mensaje: 'Sólo un restaurante de prueba, en una base desechable, se puede resetear.',
    });
  }
  return prueba;
}

export const resetearNegocioDePrueba = definirComando<
  Transaccion,
  typeof entradaResetearNegocioDePrueba,
  {
    readonly productos: number;
    readonly insumos: number;
    readonly empleados: number;
    readonly sala: ResumenSala;
    readonly arranque: ResumenArranque;
  }
>({
  nombre: 'configuracion.resetear_negocio_de_prueba',
  entidad: 'organizacion',
  escribe: true,
  roles: ['dueno', 'administrador'],
  paquetes: PAQUETES_RESTAURANTE,
  entrada: entradaResetearNegocioDePrueba,
  async ejecutar(ctx) {
    const prueba = exigirRestauranteDePrueba(ctx.ambito.organizacionId);
    const organizacion = await ctx.tx
      .selectFrom('organizaciones')
      .select('giro')
      .where('id', '=', ctx.ambito.organizacionId)
      .executeTakeFirst();
    if (organizacion?.giro !== 'restaurante') {
      throw new ErrorDominio(
        'CONFIGURACION_INVALIDA',
        'El negocio de prueba tiene que ser un restaurante.',
      );
    }
    const giro = organizacion.giro;
    const sucursalId = ctx.ambito.sucursalId;
    if (sucursalId === null)
      throw new ErrorDominio(
        'CONFIGURACION_INVALIDA',
        'Selecciona una sucursal para sembrar el restaurante de prueba.',
      );
    const semilla = semillaDePrueba();
    await ctx.paso('limpiar_prueba', () =>
      limpiar(ctx.tx, ctx.ambito.organizacionId, ctx.ambito.terminalId),
    );
    // El negocio vuelve a su nombre y a la plantilla de su giro.
    await ctx.tx
      .updateTable('organizaciones')
      .set({ nombre: prueba.nombre, paquete: PLANTILLA_POR_GIRO[giro] })
      .where('id', '=', ctx.ambito.organizacionId)
      .execute();
    // Los topes de descuento: un tope que no existe se lee como cero.
    await ctx.tx
      .insertInto('topes_descuento')
      .values(
        TOPES_DE_DESCUENTO.map((t) => ({
          organizacion_id: ctx.ambito.organizacionId,
          rol: t.rol,
          tope_centavos: t.topeCentavos,
          tope_bp: t.topeBp,
        })),
      )
      .execute();
    const almacen = await ctx.tx
      .insertInto('almacenes')
      .values({
        organizacion_id: ctx.ambito.organizacionId,
        sucursal_id: sucursalId,
        nombre: 'Almacén principal',
        principal: true,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const categorias = new Map<string, string>();
    for (const [orden, nombre] of semilla.categorias.entries()) {
      const fila = await ctx.tx
        .insertInto('categorias')
        .values({ organizacion_id: ctx.ambito.organizacionId, tipo: 'producto', nombre, orden })
        .returning('id')
        .executeTakeFirstOrThrow();
      categorias.set(nombre, fila.id);
    }
    let productos = 0;
    let insumos = 0;
    for (const dato of semilla.productos) {
      const producto = await ctx.tx
        .insertInto('productos')
        .values({
          organizacion_id: ctx.ambito.organizacionId,
          categoria_id: categorias.get(dato.categoria) ?? null,
          nombre: dato.nombre,
          sku: dato.sku,
          codigo_barras: dato.codigoBarras ?? null,
          precio_venta_centavos: dato.precioCentavos,
          costo_unitario_centavos: dato.costoCentavos,
          estrategia_consumo: 'sku',
          stock_minimo: '2',
          // En qué se vende. El insumo se da de alta en la MISMA unidad, así que
          // `sku` descuenta uno a uno y no hace falta un factor de conversión.
          unidad_venta: dato.unidadVenta ?? 'pieza',
          // Sin area de preparacion la cocina no recibe NADA: no se crea
          // ninguna comanda y la mesa anuncia «pedido enviado» con la pantalla
          // de Cocina vacia. Una botella va a la barra, un plato a la cocina.
          area_preparacion: dato.area ?? 'ninguno',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const insumo = await ctx.tx
        .insertInto('insumos')
        .values({
          organizacion_id: ctx.ambito.organizacionId,
          producto_id: producto.id,
          nombre: dato.nombre,
          unidad_base: dato.unidadVenta ?? 'pieza',
          costo_unitario_centavos: dato.costoCentavos,
          stock_minimo: '2',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await entradaInicial(
        ctx.tx,
        ctx.ambito.organizacionId,
        almacen.id,
        insumo.id,
        dato.stock,
        dato.unidadVenta ?? 'pieza',
        dato.costoCentavos,
      );

      productos += 1;
      insumos += 1;
    }
    const insumosDeReceta = new Map<string, { id: string; unidad: string }>();
    for (const dato of semilla.insumos) {
      const insumo = await ctx.tx
        .insertInto('insumos')
        .values({
          organizacion_id: ctx.ambito.organizacionId,
          nombre: dato.nombre,
          unidad_base: dato.unidad,
          costo_unitario_centavos: dato.costoCentavos,
          stock_minimo: '5',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await entradaInicial(
        ctx.tx,
        ctx.ambito.organizacionId,
        almacen.id,
        insumo.id,
        dato.stock,
        dato.unidad,
        dato.costoCentavos,
      );
      insumosDeReceta.set(dato.clave, { id: insumo.id, unidad: dato.unidad });
      insumos += 1;
    }
    for (const dato of semilla.recetas) {
      const producto = await ctx.tx
        .insertInto('productos')
        .values({
          organizacion_id: ctx.ambito.organizacionId,
          categoria_id: categorias.get(dato.categoria) ?? null,
          nombre: dato.nombre,
          precio_venta_centavos: dato.precioCentavos,
          estrategia_consumo: 'receta',
          permite_venta_sin_stock: false,
          area_preparacion: dato.area ?? 'ninguno',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      for (const ingrediente of dato.ingredientes) {
        const insumo = insumosDeReceta.get(ingrediente.clave);
        if (insumo === undefined)
          throw new ErrorDominio('INVENTARIO_INVALIDO', 'La semilla tiene un insumo desconocido.');
        await sql`insert into recetas (organizacion_id, producto_id, insumo_id, cantidad, unidad, merma_bp)
          values (${ctx.ambito.organizacionId}, ${producto.id}, ${insumo.id}, ${ingrediente.cantidad}, ${insumo.unidad}, 0)`.execute(
          ctx.tx,
        );
      }
      productos += 1;
    }
    await recalcularCostosRecetas(ctx.tx, ctx.ambito.organizacionId);

    // EL EQUIPO · una persona por cada rol que opera. Con un solo empleado —el dueño que crea
    // `bootstrap`— los permisos por rol no se distinguen y el corte no sabe quién cobró.
    const pimienta = validarEntorno(process.env).PIN_PEPPER;
    const empleos = await ctx.paso('sembrar_equipo', () =>
      sembrarEquipo(ctx.tx, ctx.ambito.organizacionId, sucursalId, giro, pimienta),
    );
    const duenos = await ctx.paso('reponer_dueno', () =>
      reponerDueno(ctx.tx, ctx.ambito.organizacionId, pimienta),
    );
    // Quien no es del equipo sembrado ni dueño, lo dio de alta una prueba: se desactiva
    // (no se borra: sus ventas ya no existen, pero su rastro en la auditoría sí).
    await ctx.paso('desactivar_lo_que_sobra', () =>
      desactivarLoQueSobra(ctx.tx, ctx.ambito.organizacionId, [...empleos.values(), ...duenos]),
    );
    if (empleos.size !== equipoDelGiro(giro).length) {
      throw new ErrorDominio(
        'CONFIGURACION_INVALIDA',
        'El equipo del restaurante de prueba quedó incompleto.',
      );
    }

    // LA SALA: mesas, zonas y estaciones. Sin ella, Mesero y Cocina abren vacías.
    const sala = await ctx.paso('sembrar_sala', () =>
      sembrarSala(ctx.tx, ctx.ambito.organizacionId, sucursalId),
    );

    // LOS DATOS DE ARRANQUE · el proveedor. La caja queda CERRADA.
    //
    // Antes la semilla la abria «para que la demo este lista para cobrar», y
    // conseguia lo contrario: la sesion quedaba en una terminal que nadie vuelve
    // a usar, y como la base permite UNA sesion abierta por sucursal, desde
    // cualquier navegador nuevo no se podia ni cobrar —la abierta no es de esta
    // terminal— ni abrir la propia —la sucursal ya tiene una—. La abre el primer
    // cajero que entra, que es lo que pasa al empezar el turno. Ver
    // `sembrarArranque`.
    // No se le pasa a `sembrarArranque` —la semilla ya no abre la caja— pero la
    // comprobación se queda: es mejor decirlo al sembrar que al cobrar.
    const abre = empleos.values().next().value ?? null;
    if (abre === null) {
      throw new ErrorDominio(
        'CONFIGURACION_INVALIDA',
        'El restaurante de prueba no tiene a nadie que pueda abrir la caja.',
      );
    }
    const arranque = await ctx.paso('sembrar_arranque', () =>
      sembrarArranque(ctx.tx, ctx.ambito.organizacionId, sucursalId, semilla),
    );

    // Y LA CONFIGURACIÓN: IVA y apariencia.
    await ctx.paso('reponer_configuracion', () =>
      reponerConfiguracion(ctx.tx, ctx.ambito.organizacionId),
    );
    // Y SU CUPO DE CAJAS (F-235): el restaurante tiene un cajón.
    await ctx.paso('reponer_cupo_de_cajas', () =>
      ctx.tx
        .updateTable('sucursales')
        .set({ cajas_simultaneas: CAJAS_SIMULTANEAS_DE_PRUEBA })
        .where('organizacion_id', '=', ctx.ambito.organizacionId)
        .where('id', '=', sucursalId)
        .execute(),
    );

    const empleados = empleos.size;
    ctx.auditar({
      entidadId: ctx.ambito.organizacionId,
      payload: {
        productos,
        insumos,
        empleados,
        giro,
        proveedor: arranque.proveedor,
        ...sala,
      },
    });
    return { productos, insumos, empleados, sala, arranque };
  },
});

/**
 * Borra los datos del restaurante de prueba: TODO lo que no está en
 * `CONSERVADAS` (bloque B.2 de la 2.4).
 *
 * ── Por qué ya no es una lista escrita a mano ────────────────────────────
 * Lo era, y se quedaba atrás con cada migración: el 24-09-2026 dejaba 70 tablas con
 * `organizacion_id` sin tocar —cotizaciones, anticipos, lealtad, pedidos anticipados,
 * tomas y traspasos…—. Ahora borra en el orden que `generar-limpieza-de-demo.mjs`
 * calcula del esquema: hijo antes que padre, así que una llave `restrict` nueva no
 * puede volver a abortar el reseteo entero (ya pasó con `remisiones → ordenes` y con
 * `comisiones_causadas → cita_servicios`).
 *
 * ── Por qué se borra también la OPERACIÓN, y no sólo el catálogo ──────────
 * El reseteo devuelve el negocio de prueba a su punto de partida: eso incluye las ventas y
 * el folio. Es destructivo a conciencia — por eso pide la palabra `RESETEAR`, sólo lo puede
 * hacer un dueño o un administrador, sólo sobre un restaurante de prueba y nunca en la base
 * compartida.
 *
 * Los CLIENTES también se borran: nada los siembra, así que lo que hubiera lo dejó una
 * prueba. Por eso ya no hace falta deshacer a mano el saldo que sube una remisión y
 * baja un pago —el cliente entero se va—.
 */
async function limpiar(
  tx: Transaccion,
  organizacionId: string,
  terminalQueSeQueda: string | null,
): Promise<void> {
  // 1 · Los ciclos de llaves, rotos poniendo su columna en nulo.
  for (const { tabla, columna } of CICLOS) {
    await sql`update ${sql.table(tabla)} set ${sql.ref(columna)} = null
      where organizacion_id = ${organizacionId} and ${sql.ref(columna)} is not null`.execute(tx);
  }

  // 2 · Todo lo demás, hijo antes que padre.
  for (const paso of ORDEN_DE_LIMPIEZA) {
    if (paso.via === null) {
      await sql`delete from ${sql.table(paso.tabla)} where organizacion_id = ${organizacionId}`.execute(
        tx,
      );
    } else {
      await sql`delete from ${sql.table(paso.tabla)} where ${sql.ref(paso.via.columna)} in (
        select ${sql.ref(paso.via.referida)} from ${sql.table(paso.via.padre)}
        where organizacion_id = ${organizacionId}
      )`.execute(tx);
    }
  }

  // 3 · Las terminales, menos la de quien resetea. Cada corrida de Playwright con una
  //     cookie de dispositivo nueva deja una, y la lista crecía sin fin. La de quien
  //     pide el reseteo se queda: su sesión está abierta en ella. Un navegador cuya
  //     terminal se borró vuelve a tener una en cuanto alguien teclea su PIN.
  if (terminalQueSeQueda === null) {
    await sql`delete from terminales where organizacion_id = ${organizacionId}`.execute(tx);
  } else {
    await sql`delete from terminales
      where organizacion_id = ${organizacionId} and id <> ${terminalQueSeQueda}`.execute(tx);
  }
}

async function entradaInicial(
  tx: Transaccion,
  org: string,
  almacen: string,
  insumo: string,
  cantidad: string,
  unidad: string,
  costo: bigint,
): Promise<void> {
  await tx
    .insertInto('existencias')
    .values({ organizacion_id: org, almacen_id: almacen, insumo_id: insumo, cantidad })
    .execute();
  await tx
    .insertInto('movimientos_stock')
    .values({
      organizacion_id: org,
      almacen_id: almacen,
      insumo_id: insumo,
      tipo: 'inventario_inicial',
      cantidad,
      unidad,
      costo_unitario_centavos: costo,
      referencia_tipo: 'manual',
    })
    .execute();
}
