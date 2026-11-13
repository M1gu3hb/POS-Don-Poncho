/**
 * EL COBRO POR LA CAJERA: abre la cuenta (de mesa, pedida; o para llevar, armada), decide propina,
 * a veces aplica un descuento con el PIN de la gerente, COMPARA el total de la pantalla contra lo que
 * el libro dice que debe ser y sólo entonces cobra. Si no cuadra: incidente de dinero. Anota el cobro
 * en el libro con lo que el servidor contestó (folio, propina, cambio).
 */
import type { Locator, Page } from '@playwright/test';

import type { Bot, ContextoDelBot } from '../bot.ts';
import type { Metodo } from '../libro.ts';
import type { CuentaPorCobrar } from '../mundo.ts';
import {
  abrirLaCuenta,
  cobrar,
  decidirLaPropina,
  laCajaDecidioLaPropina,
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
import {
  armarParaLlevar,
  tomarBorradorSobrante,
  type RenglonLlevar,
} from '../pantallas/para-llevar.ts';
import { medido } from './comun.ts';
import { descuentosDelCobro, type RitmoDeCaja } from './caja-descuento.ts';
import { propinaDe } from './division-reparto.ts';

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

/** `propinaAcordada`: la propina que la mesa ya dejó dicha; el efectivo recibido tiene que alcanzar para venta y propina. */
function elegirElPago(ctx: ContextoDelBot, venta: number, propinaAcordada: number): Eleccion {
  const dado = ctx.azar.real();
  if (dado < 0.4) {
    const aCubrir = venta + propinaAcordada;
    const recibido = Math.max(
      aCubrir,
      Math.ceil(aCubrir / 5000) * 5000 + (ctx.azar.probabilidad(0.3) ? 5000 : 0),
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
  /**
   * La propina que la mesa dejó acordada al pedir la cuenta (por el portal o con el mesero): la
   * pantalla de cobro ya la suma al «TOTAL A COBRAR». 0 si no hay.
   */
  readonly propinaAcordadaCentavos?: number;
  /**
   * Si la propina se acordó como porcentaje: se calcula sobre lo que queda DESPUÉS del descuento,
   * como lo hace el servidor (y entonces manda sobre `propinaAcordadaCentavos`).
   */
  readonly propinaPorcentaje?: number;
}

/** Lo que el libro ya tiene descontado a una cuenta (de intentos de cobro anteriores). */
function descuentosAnotados(ctx: ContextoDelBot, cuenta: string): number {
  return ctx.libro
    .leer()
    .reduce(
      (s, f) =>
        f.asiento.tipo === 'descuento' && f.asiento.cuenta === cuenta ? s + f.asiento.centavos : s,
      0,
    );
}

/** Con el diálogo de cobro ya abierto: descuento, comparación, pago y asiento. Devuelve el efectivo neto que quedó en el cajón. */
export async function cobrarEnElDialogo(
  ctx: ContextoDelBot,
  bot: Bot,
  pagina: Page,
  caja: string,
  cobro: Locator,
  c: CuentaACobrar,
  variacion: VariacionDelCobro = {},
  /** Los descuentos que se intentan antes de cobrar; `null` = ninguno (las partes de una cuenta dividida no llevan). */
  ritmo: RitmoDeCaja | null = null,
): Promise<number> {
  const lugar = { bot, pantalla: 'Caja → Cobrar' };
  // Un intento anterior que falló después de descontar dejó el descuento en la cuenta (y en el
  // libro): se cuenta y no se descuenta otra vez (D1-027 y D1-028, críticos falsos).
  const yaDescontado = descuentosAnotados(ctx, c.cuenta);
  const descuento =
    ritmo === null || yaDescontado > 0
      ? yaDescontado
      : await descuentosDelCobro(ctx, bot, pagina, cobro, c.cuenta, c.esperadoCentavos, ritmo);
  const esperado = c.esperadoCentavos - descuento;
  const acordada =
    (c.propinaPorcentaje ?? 0) > 0
      ? Math.round((esperado * (c.propinaPorcentaje ?? 0)) / 100)
      : (c.propinaAcordadaCentavos ?? 0);
  const enPantalla = await totalEnPantalla(cobro);
  if (enPantalla !== esperado + acordada) {
    await ctx.incidente(
      {
        pantalla: 'Caja → Cobrar',
        hizo: `Abrí ${c.rotulo} para cobrarla`,
        esperaba: `Total ${dinero(esperado + acordada)} (libro ${dinero(c.esperadoCentavos)} menos descuento ${dinero(descuento)}${acordada > 0 ? ` más propina acordada ${dinero(acordada)}` : ''})`,
        paso: `La pantalla dice ${dinero(enPantalla)}`,
        gravedad: 'critico',
        clase: 'dinero',
        reproducido: 'no intentado',
      },
      pagina,
    );
  }
  const { pago, efectivo, tarjeta, transferencia } = elegirElPago(ctx, esperado, acordada);
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
  if (acordada > 0 && cobrado.propinaCentavos !== acordada) {
    await ctx.incidente(
      {
        pantalla: 'Caja → Cobrar',
        hizo: `Cobré ${c.rotulo}, con propina acordada de ${dinero(acordada)}`,
        esperaba: `El cobro lleva la propina acordada (${dinero(acordada)})`,
        paso: `El servidor cobró de propina ${dinero(cobrado.propinaCentavos)}`,
        gravedad: 'critico',
        clase: 'dinero',
        reproducido: 'no intentado',
      },
      pagina,
    );
  }
  // Lo que se pagó de la VENTA por método (el cambio se devuelve del recibido; no cambia la venta).
  const pagos: Record<Metodo, number> = { efectivo, tarjeta, transferencia };
  ctx.libro.anotar(bot.nombre, {
    tipo: 'cobro',
    caja,
    cuenta: c.cuenta,
    folio: cobrado.folio,
    canal: c.canal,
    totalCentavos: esperado,
    // Lo que el libro SABE: la propina que la mesa acordó (si no hubo, lo que la cajera eligió: lo da el cobro).
    propinaCentavos: acordada > 0 ? acordada : cobrado.propinaCentavos,
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
  caos: CaosEnCobro | undefined,
  ritmo: RitmoDeCaja,
  /** Si la mesa pide dividir: la cajera divide con el cobro abierto y cobra las partes (efectivo neto) o no pudo (`null`). */
  dividir?: {
    readonly alAbrir: (cobro: Locator, propina: Propina) => Promise<number | null>;
    /** Si la cuenta ya se dividió y falló a medias, cobra las partes que faltan (en vez de abrirla de nuevo). */
    readonly reanudar: (propina: Propina) => Promise<number | null>;
  },
): Promise<{ efectivo: number; pagina: Page }> {
  const propina = ctx.azar.elegir(PROPINAS);
  const titulo = `Mesa ${String(cuenta.mesa)}`;
  const rotulo = new RegExp(`Mesa ${String(cuenta.mesa)}\\b`);
  let actual = pagina;
  if (dividir !== undefined) {
    const restante = await dividir.reanudar(propina);
    if (restante !== null) return { efectivo: restante, pagina: actual };
  }
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
  // Una cuenta que ya trae descuento (de un intento anterior) no se divide: la app reparte el
  // descuento entre las partes y lo que la cajera espera de cada una ya no sale del libro (D1-057 a
  // D1-060, críticos falsos: la app lo repartió bien, $7.96 y $7.04 de $15).
  if (
    caos === undefined &&
    dividir !== undefined &&
    (cuenta.propinaCentavos ?? 0) === 0 &&
    descuentosAnotados(ctx, cuenta.cuenta) === 0 &&
    ctx.azar.probabilidad(ritmo.dividir)
  ) {
    const porPartes = await dividir.alAbrir(cobro, propina);
    if (porPartes !== null) return { efectivo: porPartes, pagina: actual };
  }
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
      // La que la mesa dejó dicha, o la que la cajera eligió si la pantalla se la preguntó; como
      // porcentaje, porque el servidor la recalcula si hay descuento.
      propinaAcordadaCentavos:
        (cuenta.propinaCentavos ?? 0) +
        (laCajaDecidioLaPropina(actual) ? propinaDe(cuenta.esperadoCentavos, propina) : 0),
      propinaPorcentaje:
        (cuenta.propinaPorcentaje ?? 0) > 0
          ? (cuenta.propinaPorcentaje ?? 0)
          : laCajaDecidioLaPropina(actual) && propina !== 'Sin propina'
            ? propina
            : 0,
    },
    variacionDelCobro(ctx, caos),
    ritmo,
  );
  if (caos !== undefined) {
    // La cuenta de mesa se conoce por el id de su llegada; en la base, por el folio que dejó el cobro.
    const cobro = [...ctx.libro.leer()]
      .reverse()
      .find((f) => f.asiento.tipo === 'cobro' && f.asiento.cuenta === cuenta.cuenta);
    const folio = cobro?.asiento.tipo === 'cobro' ? cobro.asiento.folio : undefined;
    if (folio !== undefined && folio !== '') await exigirUnSoloPago(ctx, actual, caos, folio);
  }
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
  ritmo: RitmoDeCaja,
): Promise<number> {
  const nombre = ctx.azar.elegir(['Doña Mary', 'Joaquín', 'Pedido 7', 'Lupita', '']);
  const { cobro, ordenId } = await medido(
    ctx,
    { bot, pantalla: 'Caja → Para llevar' },
    pagina,
    'armar el pedido para llevar',
    () => armarParaLlevar(pagina, nombre, renglones),
  );
  const sobrante = tomarBorradorSobrante(pagina);
  if (sobrante > 0) {
    await ctx.incidente(
      {
        pantalla: 'Caja → Para llevar',
        hizo: 'Abrí «Para llevar» para armar un pedido nuevo',
        esperaba: 'El pedido empieza vacío (el anterior ya se cobró o se descartó)',
        paso: `El pedido arrancó con ${dinero(sobrante)} de un pedido anterior: el borrador del aparato sobrevivió a una recarga a media venta`,
        gravedad: 'medio',
        clase: 'ux',
        reproducido: 'no intentado',
      },
      pagina,
    );
  }
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
  return cobrarEnElDialogo(
    ctx,
    bot,
    pagina,
    caja,
    cobro,
    {
      cuenta: ordenId,
      canal: 'llevar',
      esperadoCentavos: esperado,
      rotulo: 'el pedido para llevar',
    },
    {},
    ritmo,
  );
}
