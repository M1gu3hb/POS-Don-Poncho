/**
 * LA GERENTE (tableta): gastos operativos, agotados a media jornada, y cambios en vivo (un precio, el
 * modo del menú). Autoriza descuentos y retiros grandes con su PIN, que teclean las cajeras en su
 * pantalla (eso lo anota la caja). Todo lo que cambia lo anota en el libro y en el mundo.
 */
import type { NombreDeAparato } from '../aparatos.ts';
import type { Bot, ContextoDelBot } from '../bot.ts';
import { BASE_POR_COMPRA, INSUMOS } from '../dia0/datos.ts';
import { irACompras, registrarCompra } from '../pantallas/inventario.ts';
import { cambiarOpcionActiva } from '../pantallas/opciones.ts';
import {
  cambiarElModoDelMenu,
  cambiarPrecio,
  marcarAgotado,
  registrarGastoOperativo,
} from '../pantallas/gerencia.ts';
import { abrirSesion, medido, registrarFallo, GERENTE } from './comun.ts';
import { asegurarSesion } from '../sesion.ts';

export interface PlanDeGerente {
  readonly aparato: NombreDeAparato;
  readonly gastos: readonly {
    readonly enMinuto: number;
    readonly pesos: number;
    readonly descripcion: string;
    readonly metodo: 'Tarjeta' | 'Transferencia';
  }[];
  /** Compras de insumos que ya existen (las registra la gerencia, no el almacén). */
  readonly compras?: readonly {
    readonly enMinuto: number;
    readonly insumo: string;
    readonly cantidad: number;
  }[];
  readonly agotado?: {
    readonly producto: string;
    readonly desdeMinuto: number;
    readonly hastaMinuto: number;
  };
  /** Apaga una opción de un grupo (p. ej. «Tocino» de «Extras») y la vuelve a prender más tarde. */
  readonly opciones?: {
    readonly producto: string;
    readonly grupo: string;
    readonly opcion: string;
    readonly apagaEnMinuto: number;
    readonly prendeEnMinuto: number;
  };
  readonly precio?: {
    readonly producto: string;
    readonly enMinuto: number;
    readonly antesPesos: number;
    readonly despuesPesos: number;
  };
  readonly modoDelMenu?: { readonly enMinuto: number; readonly vuelveEnMinuto: number };
}

export function crearBotGerente(plan: PlanDeGerente): Bot {
  const bot: Bot = {
    nombre: 'Gerente',
    rol: 'gerente',
    aparato: plan.aparato,
    async correr(ctx) {
      await jornada(ctx, bot, plan);
    },
  };
  return bot;
}

async function jornada(ctx: ContextoDelBot, bot: Bot, plan: PlanDeGerente): Promise<void> {
  const lugar = { bot, pantalla: 'Gerencia' };
  const { contexto, pagina } = await abrirSesion(ctx, GERENTE, plan.aparato);
  const url = ctx.entorno.appUrl;
  const inicio = ctx.ahoraSim().getTime();
  const hecho = new Set<string>();
  const paso = async (
    clave: string,
    enMinuto: number,
    minutos: number,
    accion: () => Promise<void>,
    dicho: string,
  ) => {
    if (hecho.has(clave) || minutos < enMinuto) return;
    hecho.add(clave);
    try {
      // La sesión dura 8 h y la jornada 11: a media tarde se vuelve a entrar (quinta corrida del día 1).
      await asegurarSesion(pagina, ctx.entorno, GERENTE);
      await medido(ctx, lugar, pagina, dicho, accion);
    } catch (error: unknown) {
      await registrarFallo(ctx, lugar, pagina, dicho, 'El cambio queda guardado', error);
    }
  };
  while (!ctx.terminado()) {
    const minutos = (ctx.ahoraSim().getTime() - inicio) / 60_000;
    for (const [i, g] of plan.gastos.entries()) {
      await paso(
        `gasto${String(i)}`,
        g.enMinuto,
        minutos,
        async () => {
          await registrarGastoOperativo(pagina, url, g.pesos, g.descripcion, g.metodo);
          ctx.libro.anotar(bot.nombre, {
            tipo: 'gasto',
            centavos: Math.round(g.pesos * 100),
            metodo: g.metodo.toLowerCase(),
            descripcion: g.descripcion,
          });
        },
        `registrar el gasto «${g.descripcion}»`,
      );
    }
    for (const [i, c] of (plan.compras ?? []).entries()) {
      const x = INSUMOS.find((n) => n.nombre === c.insumo);
      if (x === undefined) continue;
      await paso(
        `compra${String(i)}`,
        c.enMinuto,
        minutos,
        async () => {
          const costo = Math.round((x.costoTotalPesos / x.compra) * c.cantidad);
          await irACompras(pagina, url);
          await registrarCompra(pagina, {
            nombre: x.nombre,
            cantidad: c.cantidad,
            unidadDeCompra: x.unidadDeCompra,
            costoTotalPesos: costo,
            pago: 'Transferencia',
          });
          ctx.libro.anotar(bot.nombre, {
            tipo: 'compra',
            insumo: x.nombre,
            cantidad: c.cantidad * BASE_POR_COMPRA[x.unidadDeCompra],
            unidad: x.base,
            costoCentavos: costo * 100,
          });
        },
        `comprar ${String(c.cantidad)} ${x.unidadDeCompra} de ${x.nombre}`,
      );
    }
    const a = plan.agotado;
    if (a !== undefined) {
      await paso(
        'agota',
        a.desdeMinuto,
        minutos,
        async () => {
          await marcarAgotado(pagina, url, a.producto, true);
          ctx.mundo.agotados.add(a.producto);
          ctx.libro.anotar(bot.nombre, {
            tipo: 'cambio_en_vivo',
            que: `agotado: ${a.producto}`,
            antes: 'disponible',
            despues: 'agotado',
          });
        },
        `marcar agotado ${a.producto}`,
      );
      await paso(
        'repone',
        a.hastaMinuto,
        minutos,
        async () => {
          await marcarAgotado(pagina, url, a.producto, false);
          ctx.mundo.agotados.delete(a.producto);
          ctx.libro.anotar(bot.nombre, {
            tipo: 'cambio_en_vivo',
            que: `agotado: ${a.producto}`,
            antes: 'agotado',
            despues: 'disponible',
          });
        },
        `volver a surtir ${a.producto}`,
      );
    }
    const p = plan.precio;
    if (p !== undefined) {
      await paso(
        'precio',
        p.enMinuto,
        minutos,
        async () => {
          const { editarExpuestoConElRenglonCerrado } = await cambiarPrecio(
            pagina,
            url,
            p.producto,
            p.despuesPesos,
          );
          if (editarExpuestoConElRenglonCerrado) {
            await ctx.incidente(
              {
                pantalla: 'Recetas',
                hizo: `Busqué «Editar receta» de ${p.producto} con su renglón cerrado`,
                esperaba:
                  'El contenido cerrado no se ve ni se puede tocar (o «Editar receta» está a la vista)',
                paso: 'Con el renglón cerrado «Editar receta» seguía a la vista y el encabezado le interceptaba los clics: tocarlo directo agota el tiempo (45 s)',
                gravedad: 'bajo',
                clase: 'ux',
                reproducido: '1/3',
              },
              pagina,
            );
          }
          const id = ctx.mundo.catalogo.find((c) => c.nombre === p.producto)?.id ?? p.producto;
          const despues = Math.round(p.despuesPesos * 100);
          ctx.mundo.cambiosDePrecio.set(id, {
            antes: Math.round(p.antesPesos * 100),
            despues,
            horaSim: ctx.ahoraSim().getTime(),
          });
          // Lo que se pida desde ahora va al precio nuevo: los meseros y el portal planean con el
          // catálogo del mundo, y el día 4 seguían anotando $60 un pulque que la app ya cobraba a $62
          // (D4-116/117, críticos falsos). Lo ya pedido conserva su importe en el libro.
          ctx.mundo.catalogo = ctx.mundo.catalogo.map((c) =>
            c.id === id ? { ...c, precioCentavos: despues } : c,
          );
          ctx.libro.anotar(bot.nombre, {
            tipo: 'cambio_en_vivo',
            que: `precio: ${p.producto}`,
            antes: String(p.antesPesos),
            despues: String(p.despuesPesos),
          });
        },
        `cambiar el precio de ${p.producto}`,
      );
    }
    const o = plan.opciones;
    if (o !== undefined) {
      for (const [clave, enMinuto, activa] of [
        ['opcion-apaga', o.apagaEnMinuto, false],
        ['opcion-prende', o.prendeEnMinuto, true],
      ] as const) {
        const que = `${activa ? 'volver a prender' : 'apagar'} la opción «${o.opcion}» de ${o.grupo} en ${o.producto}`;
        await paso(
          clave,
          enMinuto,
          minutos,
          async () => {
            const quedo = await cambiarOpcionActiva(
              pagina,
              url,
              o.producto,
              o.grupo,
              o.opcion,
              activa,
            );
            const llave = `${o.producto}/${o.grupo}/${o.opcion}`;
            if (activa) ctx.mundo.opcionesApagadas.delete(llave);
            else ctx.mundo.opcionesApagadas.add(llave);
            ctx.libro.anotar(bot.nombre, {
              tipo: 'cambio_en_vivo',
              que: `opción: ${llave}`,
              antes: activa ? 'apagada' : 'activa',
              despues: activa ? 'activa' : 'apagada',
            });
            if (quedo !== activa) {
              await ctx.incidente(
                {
                  pantalla: 'Platillos → Opciones',
                  hizo: `Guardé el platillo después de ${que}`,
                  esperaba: `Al volver a abrirlo la opción sigue ${activa ? 'activa' : 'apagada'}`,
                  paso: `La pantalla enseña la opción ${quedo ? 'activa' : 'apagada'}`,
                  gravedad: 'alto',
                  clase: 'ui',
                  reproducido: 'no intentado',
                },
                pagina,
              );
            }
          },
          que,
        );
      }
    }
    const m = plan.modoDelMenu;
    if (m !== undefined) {
      await paso(
        'menu-a',
        m.enMinuto,
        minutos,
        async () => {
          await cambiarElModoDelMenu(pagina, url, 'A la carta');
          ctx.libro.anotar(bot.nombre, {
            tipo: 'cambio_en_vivo',
            que: 'modo del menú',
            antes: 'Menú digital',
            despues: 'A la carta',
          });
        },
        'cambiar el menú a «A la carta»',
      );
      await paso(
        'menu-b',
        m.vuelveEnMinuto,
        minutos,
        async () => {
          await cambiarElModoDelMenu(pagina, url, 'Menú digital');
          ctx.libro.anotar(bot.nombre, {
            tipo: 'cambio_en_vivo',
            que: 'modo del menú',
            antes: 'A la carta',
            despues: 'Menú digital',
          });
        },
        'devolver el menú a «Menú digital»',
      );
    }
    await ctx.esperarSim(1);
  }
  await contexto.close();
}
