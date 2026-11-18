/**
 * EL DÍA DE BOTS (perfil `dp22`): UN día completo de 8:00 a 19:00 con pocos aparatos TÁCTILES a la vez,
 * bots con semilla que deciden al azar (ponderados por la hora), caos programado y el árbitro CADA
 * HORA. Ver `perfil-dp22.ts` para el reparto de aparatos y el calendario del caos.
 *
 *   node --conditions=react-server qa/simulador/correr-dp22.ts --dia 22 \
 *     --app http://localhost:3210 --base postgres://morphiqpos@localhost:5460/qa_dp22_bots_2211 \
 *     --pines D:/mpos-tmp/qa-dp22-bots-2211/pines.json --reloj D:/mpos-tmp/dp22/bots/reloj-2211.json \
 *     --salida D:/mpos-tmp/dp22/bots/salida-2211 --semilla 2211 [--hasta 60] [--factor 4] [--arbitro-cada 60]
 *
 * Pasa por el candado (`leerEntorno`): app local, base local `qa_…`, fuera de Vercel. Sólo el árbitro
 * lee la base; los bots trabajan por pantallas y con el dedo. Con `--hasta N` es un ensayo: a los N
 * minutos ya no llega nadie y el día cierra como uno de verdad.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { arbitrar } from './arbitro/index.ts';
import { arbitrarLaHora, leerLaLineaBase, type RevisionDeLaHora } from './arbitro/hora.ts';
import { guardarLineaBase } from './arbitro/invariantes.ts';
import { carpetaDelDia, rutaDelLibro } from './arbitro/salida.ts';
import type { Bot } from './bot.ts';
import { crearBotAlmacen } from './bots/almacen.ts';
import { crearBotCaja } from './bots/caja.ts';
import { crearBotCaos } from './bots/caos.ts';
import { crearBotCaosDp22, type ResultadoDelPaso } from './bots/caos-dp22.ts';
import { crearBotDisputa } from './bots/caos-disputa.ts';
import { crearComensales } from './bots/comensal.ts';
import { crearBotDueno } from './bots/dueno.ts';
import { crearEstacion } from './bots/estacion.ts';
import { crearBotGerente } from './bots/gerente.ts';
import { crearMesero } from './bots/mesero.ts';
import { abrirCliente, leerCatalogo } from './catalogo.ts';
import { contextoPara, lectorDelReloj, type BaseDelDia } from './contexto-de-bots.ts';
import { CUENTA_DE_TOQUES } from './dedo.ts';
import { leerEntorno, type Entorno } from './entorno.ts';
import { diaTerminado, minutosDesdeLaMedianoche } from './fin-del-dia.ts';
import {
  APERTURA_MIN,
  CIERRE_MIN,
  generarHorario,
  horarioDeEnsayo,
  quienesSeVan,
} from './horario.ts';
import { abrirRegistro, hechosVigilados, type Incidente } from './incidentes.ts';
import { redactarIncidentes } from './informe-incidentes.ts';
import { redactarElDiaDeBots } from './informe-dp22.ts';
import { abrirLibro } from './libro.ts';
import { contar, mundoVacio } from './mundo.ts';
import { crearNavegadores } from './navegadores.ts';
import {
  ALMACEN_DEL_DIA,
  APARATOS_DEL_DIA,
  CAJA_DOS,
  CAJA_UNO,
  DIA_DE_BOTS,
  ENTRA_LA_CAJA_DOS,
  ESTACIONES_DEL_DIA,
  FACTOR_DEL_DIA_DE_BOTS,
  FECHA_DEL_DIA_DE_BOTS,
  GERENTE_DEL_DIA,
  HORAS_DEL_ARBITRO,
  LLEGADAS_DEL_DIA_DE_BOTS,
  MESEROS_DEL_DIA,
  SUSTITUTOS_DEL_DIA,
} from './perfil-dp22.ts';
import { fijarElReloj } from './reloj/fijar.ts';
import { horaSimulada } from './reloj/formula.ts';
import { crearAzar } from './semilla.ts';
import { abrirNavegador } from './sesion.ts';
import { crearTiempos } from './tiempos.ts';

const TOPE_DURO_MIN = 20 * 60 + 30;
const ESPERA_DE_SALIDA_MS = 25 * 60_000;
const MAXIMO_DE_TELEFONOS = 8;

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

interface Turno {
  readonly bot: Bot;
  readonly entra: number;
  readonly hastaQueCierrenLasCajas?: true;
  /** Espera (además de la hora) a que esto sea cierto: la persona o la caja todavía no existen. */
  readonly espera?: (() => boolean) | undefined;
}

/** El mismo bot con el aparato que de verdad usa el día de bots (para que los incidentes lo digan bien). */
function conSuAparato(bot: Bot): Bot {
  const aparato = SUSTITUTOS_DEL_DIA[bot.aparato] ?? bot.aparato;
  return aparato === bot.aparato ? bot : { ...bot, aparato };
}

function elPersonal(archivoDelCaos: string, hubo: (clave: string) => boolean): Turno[] {
  const estaciones: Turno[] = ESTACIONES_DEL_DIA.map((e, i) => ({
    bot: crearEstacion({
      persona: e.persona,
      estacion: e.estacion,
      marcaAgotados: e.estacion === 'Cocina',
      aparato: APARATOS_DEL_DIA.cocina,
    }),
    entra: i * 2,
    hastaQueCierrenLasCajas: true,
  }));
  const meseros: Turno[] = MESEROS_DEL_DIA.map((m, i) => ({
    bot: crearMesero({
      numero: i + 1,
      persona: m.persona,
      aparato: m.aparato,
      quienAutoriza: 'Gerente',
    }),
    entra: m.entra,
    espera: m.nuevoACadaMediaJornada === true ? () => hubo('mesero_nuevo_dado_de_alta') : undefined,
  }));
  const caos = crearBotCaos({ enMinuto: 200 });
  const caosDeEntrada: Bot = {
    ...caos,
    async correr(ctx) {
      await caos.correr(ctx);
      contar(ctx.mundo, 'caos_de_entrada');
    },
  };
  return [
    ...estaciones,
    { bot: crearBotCaja(CAJA_UNO), entra: 1 },
    {
      bot: crearBotCaja(CAJA_DOS),
      entra: ENTRA_LA_CAJA_DOS,
      espera: () => hubo('cupo_de_dos_cajas'),
    },
    ...meseros,
    { bot: crearBotGerente(GERENTE_DEL_DIA), entra: 34 },
    { bot: crearBotAlmacen(ALMACEN_DEL_DIA), entra: 37 },
    { bot: crearComensales({ maximoDeTelefonos: MAXIMO_DE_TELEFONOS }), entra: 30 },
    { bot: crearBotCaosDp22(archivoDelCaos), entra: 0 },
    { bot: crearBotDueno({ cajas: 2 }), entra: 40 },
    { bot: caosDeEntrada, entra: 42 },
    { bot: crearBotDisputa({ enMinuto: 350 }), entra: 44 },
  ].map((t) => ({ ...t, bot: conSuAparato(t.bot) }));
}

async function fijarLaHora(entorno: Entorno, factor: number): Promise<void> {
  const cliente = abrirCliente(entorno.baseUrl);
  await cliente.connect();
  try {
    await fijarElReloj(
      cliente,
      entorno.archivoReloj,
      new Date(`${FECHA_DEL_DIA_DE_BOTS}T08:00:00-06:00`),
      factor,
    );
  } finally {
    await cliente.end();
  }
}

function avisarCritico(i: Incidente): void {
  console.log(
    `CRÍTICO ${i.id} · ${i.horaSim} · ${i.bot} (${i.rol}, ${i.aparato}) · ${i.pantalla}: ${i.hizo} → ${i.paso.slice(0, 300)}`,
  );
}

async function main(): Promise<void> {
  const entorno = leerEntorno();
  if (entorno.dia !== DIA_DE_BOTS)
    throw new Error(`El día de bots es el ${String(DIA_DE_BOTS)} (--dia ${String(DIA_DE_BOTS)}).`);
  const factor = Number(argumento('factor') ?? FACTOR_DEL_DIA_DE_BOTS);
  const hasta = argumento('hasta');
  const finDelEnsayo = hasta === undefined ? null : APERTURA_MIN + Number(hasta);
  const arbitroCada = Number(argumento('arbitro-cada') ?? 60);
  await fijarLaHora(entorno, factor);

  const carpeta = carpetaDelDia(entorno.salida, DIA_DE_BOTS);
  mkdirSync(carpeta, { recursive: true });
  const leerReloj = lectorDelReloj(entorno.archivoReloj);
  const ahoraSim = (): Date => new Date(horaSimulada(leerReloj(), Date.now()));
  const azar = crearAzar(`${String(entorno.semilla)}-dp22`);
  const mundo = mundoVacio();
  const { productos, mesas } = await leerCatalogo(mundo, entorno.baseUrl);
  // `--ensayo-denso`: un grupo cada 6 minutos desde las 8:15 (en un ensayo corto el horario de verdad casi no trae gente).
  mundo.llegadas = process.argv.includes('--ensayo-denso')
    ? horarioDeEnsayo(azar.hijo('horario'), APERTURA_MIN + 15, 20, 7)
    : generarHorario(azar.hijo('horario'), LLEGADAS_DEL_DIA_DE_BOTS, 'B');
  console.log(
    `Día de bots (dp22, ${FECHA_DEL_DIA_DE_BOTS}, semilla ${String(entorno.semilla)}): ${String(productos)} productos, ` +
      `${String(mesas)} mesas, ${String(mundo.llegadas.length)} llegadas; reloj ×${String(leerReloj().factor)}.`,
  );
  // La línea base de las invariantes ANTES de que nadie toque nada: lo que ya estaba mal no es del día.
  await guardarLineaBase(entorno.baseUrl, entorno.salida);

  const registro = abrirRegistro(entorno.salida, avisarCritico);
  const libro = abrirLibro(rutaDelLibro(entorno.salida, DIA_DE_BOTS), DIA_DE_BOTS, ahoraSim);
  const tiempos = crearTiempos();
  const navegador = await abrirNavegador();
  const navegadores = crearNavegadores(navegador);
  let parar = false;
  process.on('SIGINT', () => {
    parar = true;
  });
  process.on('unhandledRejection', (razon) => {
    console.error(`Promesa sin atender en un bot: ${String(razon).slice(0, 300)}`);
  });
  const cierre = finDelEnsayo ?? CIERRE_MIN;
  const tope = finDelEnsayo === null ? TOPE_DURO_MIN : finDelEnsayo + 120;
  const terminado = (): boolean => {
    const minuto = minutosDesdeLaMedianoche(FECHA_DEL_DIA_DE_BOTS, ahoraSim());
    if (finDelEnsayo !== null && minuto >= finDelEnsayo) mundo.llegadas.length = 0;
    return diaTerminado({
      minuto,
      cierre,
      tope,
      parar,
      pendientes: mundo.llegadas.length + mundo.atendidas.size + mundo.porCobrar.length,
    });
  };
  const base: BaseDelDia = {
    entorno,
    azar,
    libro,
    registro,
    tiempos,
    mundo,
    navegador,
    terminado,
    navegadores,
    sustitutos: SUSTITUTOS_DEL_DIA,
    conDedo: true,
  };
  const cajasCerradas = (): boolean =>
    (mundo.volumen.get('cajas_cerradas') ?? 0) >= (mundo.volumen.has('cupo_de_dos_cajas') ? 2 : 1);
  const deLaCocina: BaseDelDia = {
    ...base,
    terminado: () =>
      parar ||
      (terminado() && cajasCerradas()) ||
      minutosDesdeLaMedianoche(FECHA_DEL_DIA_DE_BOTS, ahoraSim()) >= tope + 60,
  };
  const archivoDelCaos = join(carpeta, 'caos-dp22.json');
  const turnos = elPersonal(archivoDelCaos, (clave) => mundo.volumen.has(clave));
  const inicio = Date.now();
  const arranqueReal = inicio;

  // El árbitro de cada hora corre aparte de los bots y sólo lee.
  const revisiones: RevisionDeLaHora[] = [];
  const reportadas = new Set<string>();
  const lineaBase = leerLaLineaBase(entorno.salida);
  const revisar = async (etiqueta: string, adelanto = 0): Promise<void> => {
    try {
      const r = await arbitrarLaHora(
        {
          baseUrl: entorno.baseUrl,
          salida: entorno.salida,
          desde: new Date(`${FECHA_DEL_DIA_DE_BOTS}T00:00:00-06:00`).toISOString(),
          ahoraSim: () => new Date(ahoraSim().getTime() + adelanto * 60_000),
          leerLibro: () => libro.leer(),
          vigilarDesde: arranqueReal,
        },
        lineaBase,
      );
      revisiones.push({ ...r, hora: etiqueta });
      writeFileSync(join(carpeta, 'horas.json'), JSON.stringify(revisiones, null, 2));
      console.log(
        `[árbitro ${etiqueta}] ${String(r.comparaciones)} comparaciones, ${String(r.diferencias.length)} diferencias ` +
          `(${String(r.transitorias)} transitorias) · cobros ${String(r.dinero.cobros)} · 5xx ${String(r.vigilancia.cincoXX)} · consola sin explicar ${String(r.vigilancia.consolaSinExplicar)}`,
      );
      for (const d of r.diferencias) {
        const k = `${d.fuente}|${d.concepto}`;
        if (reportadas.has(k)) continue;
        reportadas.add(k);
        await registro.registrar({
          dia: DIA_DE_BOTS,
          horaSim: ahoraSim().toISOString(),
          bot: 'arbitro-de-la-hora',
          rol: 'arbitro',
          aparato: 'ninguno',
          pantalla: d.fuente,
          hizo: `Comparar «${d.concepto}» a las ${etiqueta} entre el libro y el sistema`,
          esperaba: d.esperado,
          paso: `El sistema dice: ${d.real}`,
          gravedad: d.gravedad,
          clase: d.clase,
          reproducido: '2/3',
        });
      }
    } catch (error: unknown) {
      console.error(`El árbitro de las ${etiqueta} se cayó: ${String(error).slice(0, 300)}`);
      await registro.registrar({
        dia: DIA_DE_BOTS,
        horaSim: ahoraSim().toISOString(),
        bot: 'arbitro-de-la-hora',
        rol: 'arbitro',
        aparato: 'ninguno',
        pantalla: 'Árbitro',
        hizo: `Correr la revisión de las ${etiqueta}`,
        esperaba: 'La revisión termina',
        paso: String(error).slice(0, 300),
        gravedad: 'bajo',
        clase: 'prueba',
        reproducido: 'no intentado',
      });
    }
  };
  const horario = async (): Promise<void> => {
    const objetivos: number[] = [];
    for (
      let m = (HORAS_DEL_ARBITRO[0] ?? 9) * 60;
      m <= (finDelEnsayo ?? CIERRE_MIN);
      m += arbitroCada
    )
      objetivos.push(m);
    for (const objetivo of objetivos) {
      while (!parar && minutosDesdeLaMedianoche(FECHA_DEL_DIA_DE_BOTS, ahoraSim()) < objetivo) {
        if (terminado()) return;
        await new Promise((r) => setTimeout(r, 2_000));
      }
      if (parar) return;
      await revisar(
        `${String(Math.floor(objetivo / 60)).padStart(2, '0')}:${String(objetivo % 60).padStart(2, '0')}`,
      );
    }
  };

  let vigilante = null as NodeJS.Timeout | null;
  let ultimoReporte = -1;
  const vigilar = setInterval(() => {
    const minuto = Math.floor(minutosDesdeLaMedianoche(FECHA_DEL_DIA_DE_BOTS, ahoraSim()));
    const tramo = Math.floor(minuto / 30);
    for (const l of quienesSeVan(mundo.llegadas, minuto)) {
      mundo.llegadas.splice(mundo.llegadas.indexOf(l), 1);
      contar(mundo, 'grupos_que_se_fueron');
    }
    if (tramo !== ultimoReporte) {
      ultimoReporte = tramo;
      const v = (clave: string): number => mundo.volumen.get(clave) ?? 0;
      const hora = `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`;
      const yaLlegaron = mundo.llegadas.filter((l) => l.horaSim <= minuto).length;
      console.log(
        `[${hora}] esperan mesa ${String(yaLlegaron)} · por llegar ${String(mundo.llegadas.length - yaLlegaron)} · ` +
          `mesas ocupadas ${String(mundo.atendidas.size)} · por cobrar ${String(mundo.porCobrar.length)} · ` +
          `cuentas de mesa ${String(v('cuentas_de_mesa'))} · portal ${String(v('cuentas_pedidas_por_portal'))}`,
      );
    }
    if (!terminado() || vigilante !== null) return;
    vigilante = setTimeout(() => {
      console.log('Bots atorados tras el fin del día: se cierra el navegador.');
      void navegador.close();
      void navegadores.cerrar();
    }, ESPERA_DE_SALIDA_MS);
  }, 5_000);

  const arbitroHorario = horario();
  const resultados = await Promise.allSettled(
    turnos.map(async ({ bot, entra, hastaQueCierrenLasCajas, espera }) => {
      const ctx = contextoPara(hastaQueCierrenLasCajas === true ? deLaCocina : base, bot);
      try {
        if (entra > 0) await ctx.esperarSim(entra);
        while (espera !== undefined && !espera() && !ctx.terminado()) await ctx.esperarSim(1);
        if (ctx.terminado()) return;
        await bot.correr(ctx);
      } catch (error: unknown) {
        await ctx.incidente({
          pantalla: 'El bot entero',
          hizo: `${bot.nombre} hizo su jornada`,
          esperaba: 'Que el bot termine su día',
          paso: `Se cayó: ${String(error).slice(0, 400)}`,
          gravedad: 'alto',
          clase: 'prueba',
          reproducido: 'no intentado',
        });
        throw error;
      }
    }),
  );
  clearInterval(vigilar);
  if (vigilante !== null) clearTimeout(vigilante);
  await arbitroHorario.catch((error: unknown) => {
    console.error(`El árbitro horario terminó mal: ${String(error)}`);
  });
  await navegadores.cerrar().catch((error: unknown) => {
    console.error(`Los navegadores no cerraron limpio: ${String(error)}`);
  });
  await navegador.close().catch(() => undefined);
  const caidos = resultados.filter((r) => r.status === 'rejected').length;
  const minutosReales = Math.round((Date.now() - inicio) / 60_000);
  console.log(
    `Bots terminados a las ${ahoraSim().toISOString()} (${String(minutosReales)} min reales, ${String(caidos)} se cayeron).`,
  );

  writeFileSync(join(carpeta, 'tiempos.json'), JSON.stringify(tiempos.resumen(), null, 2));
  writeFileSync(
    join(carpeta, 'volumen.json'),
    JSON.stringify(Object.fromEntries(mundo.volumen), null, 2),
  );

  // El cierre: la revisión de la hora con todo lo anotado, y el árbitro de siempre (cortes de cada caja, Registros, CSV, Tablero).
  await revisar('cierre', 6);
  const resultado = await arbitrar(
    entorno.baseUrl,
    entorno.salida,
    DIA_DE_BOTS,
    `${FECHA_DEL_DIA_DE_BOTS}T00:00:00-06:00`,
    ['C02'],
  );
  const caosDeLaDuena: ResultadoDelPaso[] = existsSync(archivoDelCaos)
    ? (JSON.parse(readFileSync(archivoDelCaos, 'utf8')) as ResultadoDelPaso[])
    : [];
  const motores = navegadores.motores().map((m) => ({
    aparato: m.aparato,
    motor: `${m.motor.corre}${m.motor.version === null ? '' : ` ${m.motor.version}`}`,
  }));
  const informe = redactarElDiaDeBots({
    salida: entorno.salida,
    dia: DIA_DE_BOTS,
    semilla: entorno.semilla,
    fecha: FECHA_DEL_DIA_DE_BOTS,
    factor,
    minutosReales,
    aparatos: motores,
    avisosDeMotor: navegadores.avisos(),
    toques: CUENTA_DE_TOQUES.toques,
    clicsQueSeQuedaron: CUENTA_DE_TOQUES.clicsQueSeQuedaron,
    volumen: Object.fromEntries(mundo.volumen),
    libro: libro.leer(),
    revisiones,
    caosDeLaDuena,
    ...(hasta === undefined ? {} : { hastaMinuto: Number(hasta) }),
  });
  const nombre = `DIA-dp22-${String(entorno.semilla)}.md`;
  writeFileSync(join(carpeta, nombre), informe);
  writeFileSync(join(entorno.salida, 'INCIDENTES.md'), redactarIncidentes(entorno.salida));
  const publicar = argumento('publicar');
  if (publicar !== undefined) {
    mkdirSync(publicar, { recursive: true });
    copyFileSync(join(carpeta, nombre), join(publicar, nombre));
    copyFileSync(join(entorno.salida, 'INCIDENTES.md'), join(publicar, 'INCIDENTES.md'));
  }

  const delDia = registro.todos().filter((i) => i.dia === DIA_DE_BOTS);
  const por = (g: Incidente['gravedad']): number => delDia.filter((i) => i.gravedad === g).length;
  console.log('--- Resumen del día de bots ---');
  console.log(
    `Incidentes: ${String(por('critico'))} críticos, ${String(por('alto'))} altos, ${String(por('medio'))} medios, ${String(por('bajo'))} bajos.`,
  );
  console.log(
    `Árbitro del cierre: ${String(resultado.comparaciones)} comparaciones, ${String(resultado.diferencias.length)} diferencias` +
      `${resultado.diferencias.length === 0 ? ' (cuadró)' : ''}. Horas con diferencias: ${String(revisiones.filter((r) => r.diferencias.length > 0).length)} de ${String(revisiones.length)}.`,
  );
  console.log(
    `Toques: ${String(CUENTA_DE_TOQUES.toques)} · navegadores vigilados: ${String(hechosVigilados().length)} hechos.`,
  );
  console.log(`Informe: ${join(carpeta, nombre)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
