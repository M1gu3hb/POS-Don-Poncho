/**
 * EL INFORME DEL DÍA DE BOTS (`DIA-dp22-<semilla>.md`): los aparatos y sus motores, el volumen por
 * tipo de operación, el caos (qué se ejecutó y qué no, por id), lo que dijo el árbitro CADA HORA, y
 * debajo el informe de siempre (`informe.ts`: el libro contra el sistema, los incidentes y los
 * tiempos). Sin PIN y sin nombres reales.
 */
import type { ResultadoDelPaso } from './bots/caos-dp22.ts';
import type { RevisionDeLaHora } from './arbitro/hora.ts';
import type { AsientoFechado } from './libro.ts';
import { redactarInforme } from './informe.ts';
import { CAOS_DEL_DIA, type PasoDeCaos } from './perfil-dp22.ts';
import { dinero } from './pantallas/comun.ts';

export interface DatosDelDiaDeBots {
  readonly salida: string;
  readonly dia: number;
  readonly semilla: number;
  readonly fecha: string;
  readonly factor: number;
  readonly minutosReales: number;
  readonly aparatos: readonly { readonly aparato: string; readonly motor: string }[];
  readonly avisosDeMotor: readonly string[];
  readonly toques: number;
  readonly clicsQueSeQuedaron: number;
  readonly volumen: Readonly<Record<string, number>>;
  readonly libro: readonly AsientoFechado[];
  readonly revisiones: readonly RevisionDeLaHora[];
  readonly caosDeLaDuena: readonly ResultadoDelPaso[];
  /** Minutos desde las 8:00 en que termina un ensayo (`--hasta`); sin él, el día completo. */
  readonly hastaMinuto?: number;
}

export type EstadoDelCaos =
  'ejecutado' | 'no ejecutado' | 'fuera del ensayo' | 'rechazado por el servidor' | 'fallo';

export interface CaosContado {
  readonly paso: PasoDeCaos;
  readonly estado: EstadoDelCaos;
  readonly detalle: string;
}

/** Cruza el calendario del caos con lo que dejaron la dueña, el libro y los contadores de los bots. */
export function contarElCaos(
  duena: readonly ResultadoDelPaso[],
  libro: readonly AsientoFechado[],
  volumen: Readonly<Record<string, number>>,
  hastaMinuto?: number,
): readonly CaosContado[] {
  const cambios = libro.flatMap((a) => (a.asiento.tipo === 'cambio_en_vivo' ? [a.asiento] : []));
  const hubo = (f: (c: (typeof cambios)[number]) => boolean): boolean => cambios.some(f);
  const traslado = libro.some((a) => a.asiento.tipo === 'traslado');
  const v = (k: string): number => volumen[k] ?? 0;
  const delBot = (paso: PasoDeCaos): { ok: boolean; detalle: string } => {
    switch (paso.id) {
      case 'C3':
        return {
          ok: hubo((c) => c.que === 'modo del menú' && c.despues === 'A la carta'),
          detalle: 'el menú pasó a «A la carta»',
        };
      case 'C3r':
        return {
          ok: hubo((c) => c.que === 'modo del menú' && c.despues === 'Menú digital'),
          detalle: 'el menú volvió a «Menú digital»',
        };
      case 'C4':
        return {
          ok: hubo((c) => c.que.startsWith('agotado') && c.despues === 'agotado'),
          detalle: 'platillo agotado',
        };
      case 'C4r':
        return {
          ok: hubo((c) => c.que.startsWith('agotado') && c.despues === 'disponible'),
          detalle: 'platillo disponible otra vez',
        };
      case 'C5':
        return {
          ok: hubo((c) => c.que.startsWith('precio:') && c.despues === '62'),
          detalle: 'precio a $62',
        };
      case 'C5r':
        return {
          ok: hubo((c) => c.que.startsWith('precio:') && c.despues === '60'),
          detalle: 'precio de vuelta a $60',
        };
      case 'R1':
        return { ok: traslado, detalle: 'traslado de la caja anotado en el libro' };
      case 'N1':
        return {
          ok: v('caos_de_caja:red') > 0,
          detalle: `${String(v('caos_de_caja:red'))} cortes de red en el cobro`,
        };
      case 'N2':
        return {
          ok: v('caos_de_caja:recargar') + v('caos_de_caja:cerrar-pestana') > 0,
          detalle: `${String(v('caos_de_caja:recargar'))} recargas y ${String(v('caos_de_caja:cerrar-pestana'))} pestañas cerradas`,
        };
      case 'A2':
        return {
          ok: v('caos_de_entrada') > 0,
          detalle: 'PIN equivocado, sesión vencida y cambio de usuario',
        };
      default:
        return { ok: false, detalle: 'sin huella' };
    }
  };
  return CAOS_DEL_DIA.map((paso): CaosContado => {
    const sinTiempo = hastaMinuto !== undefined && paso.enMinuto > hastaMinuto && paso.enMinuto > 0;
    if (paso.quien === 'dueno') {
      const r = duena.find((x) => x.id === paso.id);
      if (r === undefined || r.hora === '—')
        return sinTiempo
          ? {
              paso,
              estado: 'fuera del ensayo',
              detalle: `el ensayo termina a los ${String(hastaMinuto)} min`,
            }
          : { paso, estado: 'no ejecutado', detalle: r?.detalle ?? 'no se intentó' };
      const estado: EstadoDelCaos =
        r.estado === 'hecho'
          ? 'ejecutado'
          : r.estado === 'rechazado'
            ? 'rechazado por el servidor'
            : r.hora === '—'
              ? 'no ejecutado'
              : 'fallo';
      return { paso, estado, detalle: `${r.hora} · ${r.detalle}` };
    }
    const r = delBot(paso);
    if (!r.ok && sinTiempo)
      return {
        paso,
        estado: 'fuera del ensayo',
        detalle: `el ensayo termina a los ${String(hastaMinuto)} min`,
      };
    return { paso, estado: r.ok ? 'ejecutado' : 'no ejecutado', detalle: r.detalle };
  });
}

const NOMBRES_DEL_VOLUMEN: readonly (readonly [string, string])[] = [
  ['cuentas_de_mesa', 'Cuentas de mesa abiertas por los meseros'],
  ['cuentas_pedidas_por_portal', 'Cuentas pedidas por el portal'],
  ['pedidos_del_portal_confirmados', 'Pedidos del portal confirmados'],
  ['lineas', 'Líneas de mesero'],
  ['lineas_del_portal', 'Líneas del portal'],
  ['mesas_unidas', 'Mesas unidas'],
  ['cambios_de_mesa', 'Cambios de mesa'],
  ['divisiones', 'Cuentas divididas'],
  ['cancelaciones', 'Cancelaciones'],
  ['cuentas_adoptadas', 'Cuentas que adoptó otro mesero'],
  ['aparatos_que_se_apagaron_y_volvieron', 'Aparatos que se apagaron y volvieron'],
  ['cajas_cerradas', 'Cajas cerradas'],
  ['grupos_que_se_fueron', 'Grupos que se fueron sin mesa'],
];

export function redactarElDiaDeBots(d: DatosDelDiaDeBots): string {
  const cobros = d.libro.flatMap((a) => (a.asiento.tipo === 'cobro' ? [a.asiento] : []));
  const cuenta = (tipo: string): number => d.libro.filter((a) => a.asiento.tipo === tipo).length;
  const lineasPor = (canal: string): number =>
    d.libro.filter((a) => a.asiento.tipo === 'linea' && a.asiento.canal === canal).length;
  const metodo = (m: 'efectivo' | 'tarjeta' | 'transferencia'): number =>
    cobros.reduce((s, c) => s + c.pagos[m], 0);
  const mixtos = cobros.filter(
    (c) => Object.values(c.pagos).filter((x) => x > 0).length > 1,
  ).length;
  const caos = contarElCaos(d.caosDeLaDuena, d.libro, d.volumen, d.hastaMinuto);
  const lineas: string[] = [
    `# Día de bots (dp22) · semilla ${String(d.semilla)} · ${d.fecha}`,
    '',
    `Duración: ${String(d.minutosReales)} min reales con el reloj a ×${String(d.factor)}.`,
    '',
    '## Aparatos (todos táctiles: toques por `tap`, sin ratón)',
    '',
    '| Aparato | Motor |',
    '| --- | --- |',
    ...d.aparatos.map((a) => `| ${a.aparato} | ${a.motor} |`),
    '',
    `Toques dados: ${String(d.toques)}; clics que se quedaron como clic (botón derecho, modificadores): ${String(d.clicsQueSeQuedaron)}.`,
    ...d.avisosDeMotor.map((x) => `- AVISO: ${x}`),
    '',
    '## Volumen por tipo de operación',
    '',
    `- Cobros: ${String(cobros.length)} (${String(cobros.filter((c) => c.canal === 'mesa').length)} de mesa, ${String(cobros.filter((c) => c.canal === 'llevar').length)} para llevar) por ${dinero(cobros.reduce((s, c) => s + c.totalCentavos, 0))}`,
    `- Por método: efectivo ${dinero(metodo('efectivo'))} · tarjeta ${dinero(metodo('tarjeta'))} · transferencia ${dinero(metodo('transferencia'))} · cobros mixtos ${String(mixtos)}`,
    `- Propinas ${dinero(cobros.reduce((s, c) => s + c.propinaCentavos, 0))} · descuentos ${dinero(cobros.reduce((s, c) => s + c.descuentoCentavos, 0))}`,
    `- Líneas por canal: mesa ${String(lineasPor('mesa'))} · portal ${String(lineasPor('portal'))} · para llevar ${String(lineasPor('llevar'))}`,
    `- Retiros ${String(cuenta('retiro'))} · entradas de cambio ${String(cuenta('entrada'))} · gastos ${String(cuenta('gasto'))} · compras ${String(cuenta('compra'))} · mermas ${String(cuenta('merma'))} · cortes ${String(cuenta('corte'))}`,
    ...NOMBRES_DEL_VOLUMEN.flatMap(([k, n]) =>
      d.volumen[k] === undefined ? [] : [`- ${n}: ${String(d.volumen[k])}`],
    ),
    ...Object.entries(d.volumen)
      .filter(([k]) => k.startsWith('linea:') || k.startsWith('caos_de_caja:'))
      .map(([k, n]) => `- ${k}: ${String(n)}`),
    '',
    '## El caos programado: qué se ejecutó y qué no',
    '',
    '| Id | Hora | Qué | Quién | Estado | Detalle |',
    '| --- | --- | --- | --- | --- | --- |',
    ...caos.map(
      (c) =>
        `| ${c.paso.id}${c.paso.preparacion === true ? ' (preparación)' : ''} | ${String(Math.floor((480 + c.paso.enMinuto) / 60)).padStart(2, '0')}:${String((480 + c.paso.enMinuto) % 60).padStart(2, '0')} | ${c.paso.que} | ${c.paso.quien} | ${c.estado} | ${c.detalle.replaceAll('|', '/')} |`,
    ),
    '',
    '## El árbitro, hora por hora',
    '',
    'Cada hora simulada, sólo lectura, con las cajas abiertas (corte asentado: ver `arbitro/hora.ts`).',
    '',
    '| Hora | Comparaciones | Diferencias | Transitorias del borde | Cobros | Ventas | Comandas libro/base/atoradas | 5xx | Consola sin explicar |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |',
    ...d.revisiones.map(
      (r) =>
        `| ${r.hora} | ${String(r.comparaciones)} | **${String(r.diferencias.length)}** | ${String(r.transitorias)} | ${String(r.dinero.cobros)} | ${dinero(r.dinero.ventasCentavos)} | ${String(r.comandas.enLibro)}/${String(r.comandas.enBase)}/${String(r.comandas.atoradas)} | ${String(r.vigilancia.cincoXX)} | ${String(r.vigilancia.consolaSinExplicar)} |`,
    ),
    '',
  ];
  for (const r of d.revisiones) {
    if (r.diferencias.length === 0 && r.vigilancia.ejemplos.length === 0) continue;
    lineas.push(`### ${r.hora}`, '');
    for (const x of r.diferencias.slice(0, 25))
      lineas.push(
        `- [${x.fuente}] ${x.concepto}: esperado **${x.esperado}**, real **${x.real}** (${x.clase}/${x.gravedad})`,
      );
    for (const e of r.vigilancia.ejemplos) lineas.push(`- vigilancia: ${e}`);
    lineas.push('');
  }
  const ultima = d.revisiones.at(-1);
  if (ultima !== undefined) {
    lineas.push('Propinas por mesero (según el libro, última revisión):', '');
    for (const [m, c] of Object.entries(ultima.dinero.propinasPorMesero))
      lineas.push(`- ${m}: ${dinero(c)}`);
    lineas.push('');
  }
  const abajo = redactarInforme(d.salida, d.dia)
    .split('\n')
    .slice(1)
    .map((l) => (l.startsWith('## ') ? `#${l}` : l));
  return `${lineas.join('\n')}\n## Informe del simulador (el libro contra el sistema al cierre)\n${abajo.join('\n')}`;
}
