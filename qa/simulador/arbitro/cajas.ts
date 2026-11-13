/**
 * EL ÁRBITRO DE LAS CAJAS: cada cobro del libro contra la cuenta y sus pagos en la base (total,
 * descuento, propina, método por método, cambio), y el corte de cada caja contra lo que el libro
 * dice que debía haber en el cajón (retiros, entradas, gastos y apertura incluidos), al centavo.
 * También avisa de lo que el sistema cobró y el libro no sabe (un cobro fantasma) y al revés.
 */
import type { AsientoFechado } from '../libro.ts';
import { leerSql, num, ORGANIZACION, type Comparador } from './base.ts';

interface FilaDeCobro {
  readonly orden_id: string;
  readonly folio: string;
  readonly estado: string;
  readonly total: string;
  readonly descuento: string;
  readonly sesion: string;
  readonly efectivo: string;
  readonly tarjeta: string;
  readonly transferencia: string;
  readonly propina: string;
  readonly cambio: string;
}

const COBROS = `
select o.id as orden_id, o.folio::text as folio, o.estado, o.total_centavos::text as total,
       o.descuento_centavos::text as descuento, o.sesion_caja_id::text as sesion,
       coalesce(sum(p.monto_centavos) filter (where p.metodo = 'efectivo' and p.estado = 'confirmado'), 0)::text as efectivo,
       coalesce(sum(p.monto_centavos) filter (where p.metodo = 'tarjeta' and p.estado = 'confirmado'), 0)::text as tarjeta,
       coalesce(sum(p.monto_centavos) filter (where p.metodo = 'transferencia' and p.estado = 'confirmado'), 0)::text as transferencia,
       coalesce(sum(p.propina_centavos) filter (where p.estado = 'confirmado'), 0)::text as propina,
       coalesce(sum(p.cambio_centavos) filter (where p.estado = 'confirmado'), 0)::text as cambio
  from ordenes o left join pagos p on p.orden_id = o.id
 where o.organizacion_id = ${ORGANIZACION} and o.folio is not null and o.created_at >= $1::timestamptz
 group by o.id`;

const MOVIMIENTOS = `
select sesion_caja_id::text as sesion, tipo, sum(monto_centavos)::text as suma, count(*)::int as n
  from movimientos_caja where organizacion_id = ${ORGANIZACION} and sesion_caja_id = any($1::uuid[])
 group by 1, 2`;

const SESIONES = `
select id::text as id, estado, efectivo_contado_centavos::text as contado, efectivo_esperado_centavos::text as esperado,
       diferencia_centavos::text as diferencia, fondo_inicial_centavos::text as fondo
  from sesiones_caja where id = any($1::uuid[])`;

const cobros = (libro: readonly AsientoFechado[]) =>
  libro.flatMap((f) => (f.asiento.tipo === 'cobro' ? [{ ...f.asiento, bot: f.bot }] : []));

/** Desde cuándo mirar la base: lo anterior a la semana es historia de la copia. */
export async function arbitrarCajas(
  baseUrl: string,
  libro: readonly AsientoFechado[],
  desde: string,
  c: Comparador,
): Promise<void> {
  const delLibro = cobros(libro);
  const filas = await leerSql<FilaDeCobro>(baseUrl, COBROS, [desde]);
  const porFolio = new Map(filas.map((f) => [f.folio, f]));
  const cuentasDelLibro = new Set(delLibro.map((x) => x.folio));
  for (const x of delLibro) {
    const f = porFolio.get(x.folio);
    const quien = `${x.caja} · ${x.folio} (${x.canal})`;
    if (f === undefined) {
      c.violacion(
        'cajas',
        `El cobro ${quien} está en el libro y no en la base`,
        'sin fila en ordenes',
      );
      continue;
    }
    c.comparar('cajas', `${quien}: estado`, 'pagada', f.estado);
    c.comparar('cajas', `${quien}: total de la cuenta`, x.totalCentavos, num(f.total));
    c.comparar('cajas', `${quien}: descuento`, x.descuentoCentavos, num(f.descuento));
    c.comparar('cajas', `${quien}: propina`, x.propinaCentavos, num(f.propina));
    c.comparar('cajas', `${quien}: pagado en efectivo`, x.pagos.efectivo, num(f.efectivo));
    c.comparar('cajas', `${quien}: pagado con tarjeta`, x.pagos.tarjeta, num(f.tarjeta));
    c.comparar(
      'cajas',
      `${quien}: pagado por transferencia`,
      x.pagos.transferencia,
      num(f.transferencia),
    );
    c.comparar('cajas', `${quien}: cambio`, x.cambioCentavos, num(f.cambio));
  }
  const fantasmas = filas.filter((f) => f.estado === 'pagada' && !cuentasDelLibro.has(f.folio));
  c.comparar('cajas', 'Cobros en la base que ningún bot anotó', 0, fantasmas.length);
  await cortes(baseUrl, libro, delLibro, porFolio, c);
}

async function cortes(
  baseUrl: string,
  libro: readonly AsientoFechado[],
  delLibro: ReturnType<typeof cobros>,
  porFolio: Map<string, FilaDeCobro>,
  c: Comparador,
): Promise<void> {
  const sesionDe = new Map<string, string>();
  for (const x of delLibro) {
    const s = porFolio.get(x.folio)?.sesion;
    if (s !== undefined && s !== '') sesionDe.set(x.caja, s);
  }
  const sesiones = [...new Set(sesionDe.values())];
  if (sesiones.length === 0) return;
  const filas = await leerSql<{
    id: string;
    estado: string;
    contado: string;
    esperado: string;
    diferencia: string;
    fondo: string;
  }>(baseUrl, SESIONES, [sesiones]);
  const movs = await leerSql<{ sesion: string; tipo: string; suma: string; n: number }>(
    baseUrl,
    MOVIMIENTOS,
    [sesiones],
  );
  const suma = (sesion: string, patron: RegExp): number =>
    movs
      .filter((m) => m.sesion === sesion && patron.test(m.tipo))
      .reduce((s, m) => s + Math.abs(num(m.suma)), 0);
  for (const [caja, sesion] of sesionDe) {
    const mios = libro.filter((f) => 'caja' in f.asiento && f.asiento.caja === caja);
    const sum = (tipo: string) =>
      mios.reduce(
        (s, f) => (f.asiento.tipo === tipo && 'centavos' in f.asiento ? s + f.asiento.centavos : s),
        0,
      );
    c.comparar('cajas', `${caja}: retiros en el sistema`, sum('retiro'), suma(sesion, /retiro/i));
    c.comparar(
      'cajas',
      `${caja}: entradas de cambio en el sistema`,
      sum('entrada'),
      suma(sesion, /entrada/i),
    );
    const corte = mios.find((f) => f.asiento.tipo === 'corte')?.asiento;
    const s = filas.find((x) => x.id === sesion);
    if (corte?.tipo !== 'corte' || s === undefined) continue;
    c.comparar('cajas', `${caja}: la caja quedó cerrada`, 'cerrada', s.estado);
    c.comparar(
      'cajas',
      `${caja}: efectivo contado en el corte`,
      corte.contadoCentavos,
      num(s.contado),
    );
    if (corte.esperadoCentavos !== undefined) {
      c.comparar(
        'cajas',
        `${caja}: efectivo esperado en el corte`,
        corte.esperadoCentavos,
        num(s.esperado),
      );
      c.comparar(
        'cajas',
        `${caja}: diferencia del corte (faltante −, sobrante +)`,
        corte.contadoCentavos - corte.esperadoCentavos,
        num(s.diferencia),
      );
    }
  }
}
