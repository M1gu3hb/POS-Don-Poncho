/**
 * EL ALMACÉN (PC): compras que suben el inventario (insumos que ya existen), mermas y conteos que lo
 * bajan. Todo en unidad base al libro, que es contra lo que el árbitro compara cada insumo al gramo:
 * existencia = compras del día 0 + compras − mermas − lo que descuentan las recetas por lo vendido.
 */
import type { Bot, ContextoDelBot } from '../bot.ts';
import { INSUMOS } from '../dia0/datos.ts';
import { ajustarStock, irAInventario } from '../pantallas/inventario.ts';
import { abrirSesion, medido, registrarFallo } from './comun.ts';

const ALMACEN = 'Almacén';

export interface PlanDeAlmacen {
  readonly compras: readonly {
    readonly enMinuto: number;
    readonly insumo: string;
    readonly cantidad: number;
  }[];
  readonly mermas: readonly {
    readonly enMinuto: number;
    readonly insumo: string;
    readonly cantidadBase: number;
    readonly motivo: string;
  }[];
  /** Un conteo físico es una merma sin explicación: se resta y se dice. */
  readonly conteos: readonly {
    readonly enMinuto: number;
    readonly insumo: string;
    readonly faltanteBase: number;
  }[];
}

export function crearBotAlmacen(plan: PlanDeAlmacen): Bot {
  const bot: Bot = {
    nombre: 'Almacén',
    rol: 'almacen',
    aparato: 'pc-1920',
    async correr(ctx) {
      await jornada(ctx, bot, plan);
    },
  };
  return bot;
}

async function jornada(ctx: ContextoDelBot, bot: Bot, plan: PlanDeAlmacen): Promise<void> {
  const lugar = { bot, pantalla: 'Almacén' };
  const { contexto, pagina } = await abrirSesion(ctx, ALMACEN, 'pc-1920');
  const url = ctx.entorno.appUrl;
  const inicio = ctx.ahoraSim().getTime();
  const hecho = new Set<string>();
  const avisado = new Set<string>();
  const insumo = (nombre: string) => {
    const i = INSUMOS.find((x) => x.nombre === nombre);
    if (i === undefined) throw new Error(`El plan nombra un insumo que no existe: ${nombre}`);
    return i;
  };
  const paso = async (
    clave: string,
    enMinuto: number,
    minutos: number,
    dicho: string,
    accion: () => Promise<void>,
  ) => {
    if (hecho.has(clave) || minutos < enMinuto) return;
    hecho.add(clave);
    try {
      await medido(ctx, lugar, pagina, dicho, accion);
    } catch (error: unknown) {
      await registrarFallo(
        ctx,
        lugar,
        pagina,
        dicho,
        'El movimiento de inventario queda guardado',
        error,
      );
    }
  };
  while (!ctx.terminado()) {
    const minutos = (ctx.ahoraSim().getTime() - inicio) / 60_000;
    for (const [i, c] of plan.compras.entries()) {
      const x = insumo(c.insumo);
      await paso(
        `compra${String(i)}`,
        c.enMinuto,
        minutos,
        `intentar comprar ${String(c.cantidad)} ${x.unidadDeCompra} de ${x.nombre}`,
        async () => {
          // HALLAZGO: Inventario le ofrece «Registrar compra» a la bodeguera, pero el botón la lleva a Compras,
          // que dice «las compras y los gastos los registra la gerencia». Esas compras las hace la gerente.
          await irAInventario(pagina, url);
          await pagina
            .getByRole('button', { name: /^Registrar compra/ })
            .first()
            .click();
          const soloLectura = await pagina
            .getByText(/los registra la gerencia/)
            .waitFor({ state: 'visible', timeout: 15_000 })
            .then(
              () => true,
              () => false,
            );
          if (soloLectura && !avisado.has('compra')) {
            avisado.add('compra');
            await ctx.incidente(
              {
                pantalla: 'Inventario → Registrar compra (almacén)',
                hizo: 'Toqué «Registrar compra» en Inventario con el puesto de almacén',
                esperaba: 'Se abre el formulario de la compra, o el botón no se ofrece',
                paso: 'Me lleva a Compras, que dice «las compras y los gastos los registra la gerencia» y no deja registrar nada',
                gravedad: 'medio',
                clase: 'ux',
                reproducido: 'no intentado',
              },
              pagina,
            );
          }
        },
      );
    }
    for (const [i, m] of plan.mermas.entries()) {
      await paso(
        `merma${String(i)}`,
        m.enMinuto,
        minutos,
        `registrar merma de ${m.insumo}`,
        async () => {
          const x = insumo(m.insumo);
          await irAInventario(pagina, url);
          await ajustarStock(pagina, x.nombre, {
            tipo: 'Merma / producto perdido',
            metodo: 'diferencia',
            signo: 'restar',
            cantidad: m.cantidadBase,
            unidad: x.base,
            motivo: m.motivo,
          });
          ctx.libro.anotar(bot.nombre, {
            tipo: 'merma',
            insumo: x.nombre,
            cantidad: m.cantidadBase,
            unidad: x.base,
          });
        },
      );
    }
    for (const [i, c] of plan.conteos.entries()) {
      await paso(
        `conteo${String(i)}`,
        c.enMinuto,
        minutos,
        `conteo físico de ${c.insumo} con faltante`,
        async () => {
          const x = insumo(c.insumo);
          await irAInventario(pagina, url);
          await ajustarStock(pagina, x.nombre, {
            tipo: 'Corrección de conteo',
            metodo: 'diferencia',
            signo: 'restar',
            cantidad: c.faltanteBase,
            unidad: x.base,
            motivo: 'Conteo físico: falta producto',
          });
          ctx.libro.anotar(bot.nombre, {
            tipo: 'merma',
            insumo: x.nombre,
            cantidad: c.faltanteBase,
            unidad: x.base,
          });
        },
      );
    }
    await ctx.esperarSim(1);
  }
  await contexto.close();
}
