/**
 * UN DÍA DE LA SEMANA SIMULADA, DE PRINCIPIO A FIN.
 *
 *   node --conditions=react-server qa/simulador/correr-dia.ts --dia 1 \
 *     --app http://localhost:32800 --base postgres://morphiqpos@localhost:5460/qa_dp18_semana \
 *     --pines D:/mpos-tmp/qa-dp18-semana/pines.json --reloj D:/mpos-tmp/dp18/reloj.json \
 *     --salida D:/mpos-tmp/dp18/semana --semilla 18 --fijar [--hasta 600] [--publicar docs/qa/semana]
 *
 * 1. Pasa por el candado (lo hace `leerEntorno`): app local, base local `qa_…`, fuera de Vercel.
 * 2. Con `--fijar`, pone el reloj de QA (servidor, base y navegadores) en las 8:00 de la fecha del
 *    día (`perfiles.ts`), a su velocidad.
 * 3. Lee el catálogo y las mesas de la copia (sólo lectura) y arma las llegadas con la semilla.
 * 4. Corre a la vez a todo el personal: 6 meseros, los comensales con sus teléfonos, las 5
 *    estaciones y 2 teléfonos de cocina, 2 cajas, la gerente, el almacén, el dueño y el caos.
 * 5. El día termina pasadas las 19:00, cuando ya no queda nadie en las mesas ni nada por cobrar
 *    (tope: 20:30, o `--hasta` minutos después de las 8:00 para un ensayo). Las cajas cobran lo que
 *    quede, cierran una tras otra y el dueño hace el Cierre del día.
 * 6. El árbitro compara el libro contra el sistema y se escribe el informe del día (`DIA-N.md`).
 *    Con `--publicar`, el informe, los incidentes y su resumen se copian a esa carpeta del repo.
 *
 * Un incidente crítico se imprime en cuanto aparece (`CRÍTICO …`), para avisarlo en el momento.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { arbitrar } from './arbitro/index.ts';
import { carpetaDelDia, rutaDelLibro } from './arbitro/salida.ts';
import type { Bot } from './bot.ts';
import { crearBotAlmacen } from './bots/almacen.ts';
import { crearBotCaja } from './bots/caja.ts';
import { crearBotCaos } from './bots/caos.ts';
import { crearBotDisputa } from './bots/caos-disputa.ts';
import { crearComensales } from './bots/comensal.ts';
import { crearBotDueno } from './bots/dueno.ts';
import { crearEstacion } from './bots/estacion.ts';
import { crearBotGerente } from './bots/gerente.ts';
import { crearMesero } from './bots/mesero.ts';
import { crearTelefonoDeCocina } from './bots/telefono-cocina.ts';
import { abrirCliente, leerCatalogo } from './catalogo.ts';
import { contextoPara, lectorDelReloj, type BaseDelDia } from './contexto-de-bots.ts';
import { leerEntorno, type Entorno } from './entorno.ts';
import { APERTURA_MIN, CIERRE_MIN, generarHorario, quienesSeVan } from './horario.ts';
import { abrirRegistro, type Incidente } from './incidentes.ts';
import { redactarIncidentes } from './informe-incidentes.ts';
import { redactarInforme } from './informe.ts';
import { abrirLibro } from './libro.ts';
import { contar, mundoVacio } from './mundo.ts';
import { diaDeLaSemana, type DiaDeLaSemana } from './perfiles.ts';
import { diaTerminado, minutosDesdeLaMedianoche } from './fin-del-dia.ts';
import { fijarElReloj } from './reloj/fijar.ts';
import { horaSimulada } from './reloj/formula.ts';
import { crearAzar } from './semilla.ts';
import { abrirNavegador } from './sesion.ts';
import { crearTiempos } from './tiempos.ts';

/** Pasadas las 19:00 sin nada pendiente, o a las 20:30 pase lo que pase. */
const TOPE_DURO_MIN = 20 * 60 + 30;
/** Lo que se espera (real) a que los bots salgan de su bucle una vez terminado el día. */
const ESPERA_DE_SALIDA_MS = 20 * 60_000;

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Un bot y el minuto simulado (desde las 8:00) en que entra a trabajar. */
interface Turno {
  readonly bot: Bot;
  readonly entra: number;
  /** La cocina no se va al terminar el día: termina lo que falta hasta que las cajas cierran. */
  readonly hastaQueCierrenLasCajas?: true;
}

/**
 * El personal del día. Los nombres son los de la copia y los que crea el día 0. Llegan escalonados,
 * como en un restaurante: primero cocina y cajas, luego la gerencia y los meseros uno tras otro (20
 * entradas con PIN a la vez ahogaban al servidor de la laptop).
 */
function elPersonal(d: DiaDeLaSemana): Turno[] {
  const aparatosDeMesero = [
    'android-360',
    'android-412',
    'iphone',
    'tableta-768',
    'android-412',
    'iphone',
  ] as const;
  const meseros = aparatosDeMesero.map((aparato, i) =>
    crearMesero({
      numero: i + 1,
      persona: `Mesero ${String(i + 1)}`,
      aparato,
      quienAutoriza: 'Gerente',
    }),
  );
  const estaciones = [
    { persona: 'Cocina', estacion: 'Cocina' },
    { persona: 'Bebidas', estacion: 'Bebidas' },
    { persona: 'Cocina Parrilla', estacion: 'Parrilla' },
    { persona: 'Cocina Postres', estacion: 'Postres' },
    { persona: 'Cocina Pulques', estacion: 'Pulques' },
  ].map((e) => crearEstacion({ ...e, marcaAgotados: e.estacion === 'Cocina' }));
  return [
    ...estaciones.map((bot, i) => ({ bot, entra: i * 2, hastaQueCierrenLasCajas: true as const })),
    ...d.cajas.map((plan, i) => ({ bot: crearBotCaja(plan), entra: 1 + i * 3 })),
    {
      bot: crearTelefonoDeCocina({ persona: 'Cocina', estacion: 'Cocina' }),
      entra: 11,
      hastaQueCierrenLasCajas: true,
    },
    {
      bot: crearTelefonoDeCocina({ persona: 'Cocina Parrilla', estacion: 'Parrilla' }),
      entra: 13,
      hastaQueCierrenLasCajas: true,
    },
    ...meseros.map((bot, i) => ({ bot, entra: 15 + i * 3 })),
    { bot: crearBotGerente(d.gerente), entra: 34 },
    { bot: crearBotAlmacen(d.almacen), entra: 37 },
    { bot: crearComensales({ maximoDeTelefonos: d.telefonos }), entra: 30 },
    { bot: crearBotDueno({ cajas: d.cajas.length }), entra: 40 },
    { bot: crearBotCaos({ enMinuto: d.caosEnMinuto }), entra: 42 },
    { bot: crearBotDisputa({ enMinuto: d.disputaEnMinuto }), entra: 44 },
  ];
}

async function fijarLaHora(entorno: Entorno, d: DiaDeLaSemana): Promise<void> {
  const cliente = abrirCliente(entorno.baseUrl);
  await cliente.connect();
  try {
    await fijarElReloj(
      cliente,
      entorno.archivoReloj,
      new Date(`${d.fecha}T08:00:00-06:00`),
      d.factor,
    );
  } finally {
    await cliente.end();
  }
}

function avisarCritico(i: Incidente): void {
  console.log(
    `CRÍTICO ${i.id} · día ${String(i.dia)} ${i.horaSim} · ${i.bot} (${i.rol}, ${i.aparato}) · ` +
      `${i.pantalla}: ${i.hizo} → ${i.paso.slice(0, 300)}`,
  );
}

async function main(): Promise<void> {
  const entorno = leerEntorno();
  const d = diaDeLaSemana(entorno.dia);
  const hasta = argumento('hasta');
  const finDelEnsayo = hasta === undefined ? null : APERTURA_MIN + Number(hasta);
  if (process.argv.includes('--fijar')) await fijarLaHora(entorno, d);

  const leerReloj = lectorDelReloj(entorno.archivoReloj);
  const ahoraSim = (): Date => new Date(horaSimulada(leerReloj(), Date.now()));
  const azar = crearAzar(`${String(entorno.semilla)}-dia-${String(d.dia)}`);
  const mundo = mundoVacio();
  const { productos, mesas } = await leerCatalogo(mundo, entorno.baseUrl);
  mundo.llegadas = generarHorario(azar.hijo('horario'), d.llegadas, `D${String(d.dia)}-`);
  console.log(
    `Día ${String(d.dia)} (${d.perfil}, ${d.fecha}): ${String(productos)} productos, ` +
      `${String(mesas)} mesas, ${String(mundo.llegadas.length)} llegadas; reloj ×${String(leerReloj().factor)}.`,
  );

  const registro = abrirRegistro(entorno.salida, avisarCritico);
  const libro = abrirLibro(rutaDelLibro(entorno.salida, d.dia), d.dia, ahoraSim);
  const tiempos = crearTiempos();
  const navegador = await abrirNavegador();
  let parar = false;
  process.on('SIGINT', () => {
    parar = true;
  });
  // Una promesa que un guion dejó sin atender no tumba el día: se dice y se sigue (el bot que la
  // dejó ya registró su fallo o lo registrará al salir).
  process.on('unhandledRejection', (razon) => {
    console.error(`Promesa sin atender en un bot: ${String(razon).slice(0, 300)}`);
  });
  // En un ensayo (`--hasta`), a esa hora ya no llega nadie más y el día se acaba como uno de verdad:
  // cuando las mesas se vacían y no queda nada por cobrar (con 90 minutos de tope).
  const cierre = finDelEnsayo ?? CIERRE_MIN;
  const tope = finDelEnsayo === null ? TOPE_DURO_MIN : finDelEnsayo + 90;
  const terminado = (): boolean => {
    const minuto = minutosDesdeLaMedianoche(d.fecha, ahoraSim());
    if (finDelEnsayo !== null && minuto >= finDelEnsayo) mundo.llegadas.length = 0;
    return diaTerminado({
      minuto,
      cierre,
      tope,
      parar,
      pendientes: mundo.llegadas.length + mundo.atendidas.size + mundo.porCobrar.length,
    });
  };
  const base: BaseDelDia = { entorno, azar, libro, registro, tiempos, mundo, navegador, terminado };
  const cajasCerradas = (): boolean => (mundo.volumen.get('cajas_cerradas') ?? 0) >= d.cajas.length;
  const deLaCocina: BaseDelDia = {
    ...base,
    terminado: () =>
      parar ||
      (terminado() && cajasCerradas()) ||
      minutosDesdeLaMedianoche(d.fecha, ahoraSim()) >= tope + 60,
  };
  const turnos = elPersonal(d);
  const inicio = Date.now();

  // Si el día ya terminó y algún bot no sale en ESPERA_DE_SALIDA_MS, se cierra el navegador: los
  // bots atorados fallan, su fallo queda registrado y el árbitro corre con lo que haya.
  // Se asigna dentro del intervalo: con el `as`, TypeScript no la da por `null` para siempre.
  let vigilante = null as NodeJS.Timeout | null;
  // Cada media hora simulada, cómo va el flujo: quién espera mesa, cuántas mesas hay ocupadas y
  // cuántas cuentas esperan a la caja (para ver dónde se atora el día).
  let ultimoReporte = -1;
  const vigilar = setInterval(() => {
    const minuto = Math.floor(minutosDesdeLaMedianoche(d.fecha, ahoraSim()));
    const tramo = Math.floor(minuto / 30);
    // Quien se cansa de esperar mesa se va (y a las 18:45 ya no se sienta a nadie).
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
    }, ESPERA_DE_SALIDA_MS);
  }, 5_000);

  const resultados = await Promise.allSettled(
    turnos.map(async ({ bot, entra, hastaQueCierrenLasCajas }) => {
      const ctx = contextoPara(hastaQueCierrenLasCajas === true ? deLaCocina : base, bot);
      try {
        if (entra > 0) await ctx.esperarSim(entra);
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
  await navegador.close().catch((error: unknown) => {
    console.error(`El navegador no cerró limpio: ${String(error)}`);
  });
  const caidos = resultados.filter((r) => r.status === 'rejected').length;

  const carpeta = carpetaDelDia(entorno.salida, d.dia);
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, 'tiempos.json'), JSON.stringify(tiempos.resumen(), null, 2));
  writeFileSync(
    join(carpeta, 'volumen.json'),
    JSON.stringify(Object.fromEntries(mundo.volumen), null, 2),
  );
  const minutosReales = Math.round((Date.now() - inicio) / 60_000);
  console.log(
    `Bots terminados a las ${ahoraSim().toISOString()} (${String(minutosReales)} min reales, ` +
      `${String(caidos)} se cayeron).`,
  );

  const resultado = await arbitrar(
    entorno.baseUrl,
    entorno.salida,
    d.dia,
    `${d.fecha}T00:00:00-06:00`,
  );
  const informe = redactarInforme(entorno.salida, d.dia);
  writeFileSync(join(carpeta, `DIA-${String(d.dia)}.md`), informe);
  writeFileSync(join(entorno.salida, 'INCIDENTES.md'), redactarIncidentes(entorno.salida));

  const publicar = argumento('publicar');
  if (publicar !== undefined) {
    mkdirSync(publicar, { recursive: true });
    copyFileSync(
      join(carpeta, `DIA-${String(d.dia)}.md`),
      join(publicar, `DIA-${String(d.dia)}.md`),
    );
    copyFileSync(join(entorno.salida, 'INCIDENTES.jsonl'), join(publicar, 'INCIDENTES.jsonl'));
    copyFileSync(join(entorno.salida, 'INCIDENTES.md'), join(publicar, 'INCIDENTES.md'));
  }

  const delDia = registro.todos().filter((i) => i.dia === d.dia);
  const por = (g: Incidente['gravedad']): number => delDia.filter((i) => i.gravedad === g).length;
  const v = (clave: string): number => mundo.volumen.get(clave) ?? 0;
  console.log('--- Resumen del día ---');
  console.log(
    `Volumen: ${String(v('cuentas_de_mesa'))} cuentas de mesa, ${String(v('lineas'))} líneas de mesero, ` +
      `${String(v('pedidos_del_portal_confirmados'))} pedidos del portal, ${String(v('cancelaciones'))} cancelaciones.`,
  );
  console.log(
    `Incidentes: ${String(por('critico'))} críticos, ${String(por('alto'))} altos, ` +
      `${String(por('medio'))} medios, ${String(por('bajo'))} bajos.`,
  );
  console.log(
    `Libro: ${String(resultado.comparaciones)} comparaciones, ${String(resultado.diferencias.length)} diferencias` +
      `${resultado.diferencias.length === 0 ? ' (cuadró)' : ''}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
