/**
 * EL COBRO POR LA CAJERA: abre la cuenta (de mesa, pedida; o para llevar, armada), decide propina,
 * a veces aplica un descuento con el PIN de la gerente, COMPARA el total de la pantalla contra lo que
 * el libro dice que debe ser y sólo entonces cobra. Si no cuadra: incidente de dinero. Anota el cobro
 * en el libro con lo que el servidor contestó (folio, propina, cambio).
 */
import type { Locator, Page } from '@playwright/test';

import type { Bot, ContextoDelBot } from '../bot.ts';
import { pinVigente } from '../entorno.ts';
import type { Metodo } from '../libro.ts';
import type { CuentaPorCobrar } from '../mundo.ts';
import {
  abrirLaCuenta,
  aplicarDescuento,
  cobrar,
  decidirLaPropina,
  totalEnPantalla,
  type Pago,
  type Propina,
  type VariacionDelCobro,
} from '../pantallas/caja.ts';
import {
  exigirUnSoloPago,
  interrumpirElCobro,
  variacionDelCobro,
  type CaosEnCobro,
} from './caos-cobro.ts';
import { dinero } from '../pantallas/comun.ts';
import { armarParaLlevar, type RenglonLlevar } from '../pantallas/para-llevar.ts';
import { GERENTE, medido } from './comun.ts';

/** Lo que el libro SABE que entró y salió del cajón de esta caja (para el corte). */
export interface CajonDelLibro {
  fondoCentavos: number;
  efectivoNetoCentavos: number;
  entradasCentavos: number;
  retirosCentavos: number;
  gastosCentavos: number;
}

export const cajonVacio = (fondoCentavos: number): CajonDelLibro => ({
  fondoCentavos,
  efectivoNetoCentavos: 0,
  entradasCentavos: 0,
  retirosCentavos: 0,
  gastosCentavos: 0,
});

export const esperadoDelCajon = (c: CajonDelLibro): number =>
  c.fondoCentavos +
  c.efectivoNetoCentavos +
  c.entradasCentavos -
  c.retirosCentavos -
  c.gastosCentavos;

const PROPINAS: readonly Propina[] = [5, 10, 15, 20, 'Sin propina', 'Sin propina'];

interface Eleccion {
  readonly pago: Pago;
  readonly efectivo: number;
  readonly tarjeta: number;
  readonly transferencia: number;
}

function elegirElPago(ctx: ContextoDelBot, venta: number): Eleccion {
  const dado = ctx.azar.real();
  if (dado < 0.4) {
    const recibido = Math.max(
      venta,
      Math.ceil(venta / 5000) * 5000 + (ctx.azar.probabilidad(0.3) ? 5000 : 0),
    );
    return {
      pago: { metodo: 'Efectivo', recibidoCentavos: recibido },
      efectivo: venta,
      tarjeta: 0,
      transferencia: 0,
    };
  }
  if (dado < 0.7)
    return { pago: { metodo: 'Tarjeta' }, efectivo: 0, tarjeta: venta, transferencia: 0 };
  if (dado < 0.85)
    return { pago: { metodo: 'Transferencia' }, efectivo: 0, tarjeta: 0, transferencia: venta };
  const efectivo = Math.floor(venta / 2 / 100) * 100;
  return {
    pago: {
      metodo: 'Mixto',
      efectivoCentavos: efectivo,
      tarjetaCentavos: venta - efectivo,
      transferenciaCentavos: 0,
    },
    efectivo,
    tarjeta: venta - efectivo,
    transferencia: 0,
  };
}

export interface CuentaACobrar {
  readonly cuenta: string;
  readonly canal: 'mesa' | 'llevar';
  readonly esperadoCentavos: number;
  readonly rotulo: string;
}

/** Con el diálogo de cobro ya abierto: descuento, comparación, pago y asiento. Devuelve el efectivo neto que quedó en el cajón. */
async function cobrarEnElDialogo(
  ctx: ContextoDelBot,
  bot: Bot,
  pagina: Page,
  caja: string,
  cobro: Locator,
  c: CuentaACobrar,
  variacion: VariacionDelCobro = {},
): Promise<number> {
  const lugar = { bot, pantalla: 'Caja → Cobrar' };
  let descuento = 0;
  if (ctx.azar.probabilidad(0.12)) {
    const porcentaje = ctx.azar.elegir([10, 10, 20]);
    descuento = Math.round((c.esperadoCentavos * porcentaje) / 100);
    await medido(ctx, lugar, pagina, 'aplicar un descuento con PIN', () =>
      aplicarDescuento(pagina, cobro, {
        tipo: 'porcentaje',
        valor: porcentaje,
        motivo: 'cliente frecuente',
        autoriza: { nombre: GERENTE, pin: pinVigente(ctx.entorno, GERENTE) },
      }),
    );
    ctx.libro.anotar(bot.nombre, {
      tipo: 'descuento',
      cuenta: c.cuenta,
      centavos: descuento,
      conPin: true,
    });
  }
  const esperado = c.esperadoCentavos - descuento;
  const enPantalla = await totalEnPantalla(cobro);
  if (enPantalla !== esperado) {
    await ctx.incidente(
      {
        pantalla: 'Caja → Cobrar',
        hizo: `Abrí ${c.rotulo} para cobrarla`,
        esperaba: `Total ${dinero(esperado)} (libro ${dinero(c.esperadoCentavos)} menos descuento ${dinero(descuento)})`,
        paso: `La pantalla dice ${dinero(enPantalla)}`,
        gravedad: 'critico',
        clase: 'dinero',
        reproducido: 'no intentado',
      },
      pagina,
    );
  }
  const { pago, efectivo, tarjeta, transferencia } = elegirElPago(ctx, enPantalla);
  // Con la red caída a propósito la espera es del guion, no del sistema: no se mide.
  const cobrarYa = () => cobrar(pagina, cobro, pago, variacion);
  const cobrado = await (
    variacion.sinRed === undefined
      ? medido(ctx, lugar, pagina, `cobrar con ${pago.metodo}`, cobrarYa)
      : cobrarYa()
  ).catch(async (error: unknown) => {
    if (String(error).includes('COBRO DOBLE')) {
      await ctx.incidente(
        {
          pantalla: 'Caja → Cobrar',
          hizo: `Cobré ${c.rotulo} con un doble toque`,
          esperaba: 'Un solo cobro',
          paso: String(error).slice(0, 300),
          gravedad: 'critico',
          clase: 'concurrencia',
          reproducido: 'no intentado',
        },
        pagina,
      );
    }
    throw error;
  });
  // Lo que se pagó de la VENTA por método (el cambio se devuelve del recibido; no cambia la venta).
  const pagos: Record<Metodo, number> = { efectivo, tarjeta, transferencia };
  ctx.libro.anotar(bot.nombre, {
    tipo: 'cobro',
    caja,
    cuenta: c.cuenta,
    folio: cobrado.folio,
    canal: c.canal,
    totalCentavos: esperado,
    propinaCentavos: cobrado.propinaCentavos,
    descuentoCentavos: descuento,
    pagos,
    cambioCentavos: cobrado.cambioCentavos,
  });
  // La propina viaja con el método de la venta; en mixto, en efectivo (lo que la cajera tecleó).
  const propinaEnEfectivo =
    pago.metodo === 'Efectivo' || pago.metodo === 'Mixto' ? cobrado.propinaCentavos : 0;
  return pagos.efectivo + propinaEnEfectivo;
}

/**
 * Cobra una cuenta de mesa que el mesero ya pidió, con o sin caos. Devuelve el efectivo neto que dejó
 * en el cajón y la página con la que se siguió (cerrar la pestaña obliga a abrir otra).
 */
export async function cobrarLaCuenta(
  ctx: ContextoDelBot,
  bot: Bot,
  pagina: Page,
  caja: string,
  cuenta: CuentaPorCobrar,
  caos?: CaosEnCobro,
): Promise<{ efectivo: number; pagina: Page }> {
  const propina = ctx.azar.elegir(PROPINAS);
  const titulo = `Mesa ${String(cuenta.mesa)}`;
  const rotulo = new RegExp(`Mesa ${String(cuenta.mesa)}\\b`);
  let actual = pagina;
  if (caos?.tipo === 'recargar' || caos?.tipo === 'cerrar-pestana') {
    await abrirLaCuenta(actual, rotulo, titulo, propina);
    actual = await interrumpirElCobro(ctx, actual, caos, cuenta);
  }
  const cobro = await medido(
    ctx,
    { bot, pantalla: 'Caja → Pendientes' },
    actual,
    'abrir la cuenta pendiente',
    () => abrirLaCuenta(actual, rotulo, titulo, propina),
  );
  const efectivo = await cobrarEnElDialogo(
    ctx,
    bot,
    actual,
    caja,
    cobro,
    {
      cuenta: cuenta.cuenta,
      canal: 'mesa',
      esperadoCentavos: cuenta.esperadoCentavos,
      rotulo: `la cuenta de la ${titulo}`,
    },
    variacionDelCobro(ctx, caos),
  );
  if (caos !== undefined) await exigirUnSoloPago(ctx, actual, caos, cuenta.cuenta);
  return { efectivo, pagina: actual };
}

/** Arma un pedido para llevar con platillos sencillos, lo cobra y anota sus líneas. Devuelve el efectivo neto. */
export async function cobrarParaLlevar(
  ctx: ContextoDelBot,
  bot: Bot,
  pagina: Page,
  caja: string,
  renglones: readonly (RenglonLlevar & {
    readonly precioCentavos: number;
    readonly estacion: string;
  })[],
): Promise<number> {
  const nombre = ctx.azar.elegir(['Doña Mary', 'Joaquín', 'Pedido 7', 'Lupita', '']);
  const { cobro, ordenId } = await medido(
    ctx,
    { bot, pantalla: 'Caja → Para llevar' },
    pagina,
    'armar el pedido para llevar',
    () => armarParaLlevar(pagina, nombre, renglones),
  );
  let esperado = 0;
  for (const r of renglones) {
    const importe = r.precioCentavos * r.veces;
    esperado += importe;
    ctx.libro.anotar(bot.nombre, {
      tipo: 'linea',
      cuenta: ordenId,
      producto: r.producto,
      cantidad: r.veces,
      opciones: [],
      importeCentavos: importe,
      estacion: r.estacion,
      canal: 'llevar',
    });
  }
  await decidirLaPropina(pagina, cobro, ctx.azar.elegir(PROPINAS));
  return cobrarEnElDialogo(ctx, bot, pagina, caja, cobro, {
    cuenta: ordenId,
    canal: 'llevar',
    esperadoCentavos: esperado,
    rotulo: 'el pedido para llevar',
  });
}
