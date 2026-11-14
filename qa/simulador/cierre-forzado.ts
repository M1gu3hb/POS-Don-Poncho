/**
 * EL CIERRE FORZADO: lo que un día simulado dejó abierto al terminar, se cierra POR LA APP antes de
 * que empiece el siguiente. Es una PRUEBA MAL HECHA (los bots no terminaron su jornada), no una
 * falla del POS: el día siguiente no puede abrir caja con las dos del día anterior abiertas (cupo de
 * 2) ni cerrar las suyas con mesas de ayer ocupadas.
 *
 * Entra como el dueño y, con las mismas llamadas que hacen sus botones:
 *   1. cancela cada cuenta que quedó sin cobrar (`/api/restaurante/cancelar-orden`, con motivo);
 *   2. libera cada mesa que quedó ocupada (`/api/restaurante/liberar-mesa`) y separa las uniones
 *      que sigan abiertas (`/api/restaurante/separar-mesas`);
 *   3. trae cada caja abierta a su pantalla y la cierra contando justo lo esperado.
 * Cada cosa que hizo queda como incidente de clase «prueba» del día que la dejó, y el resumen en
 * `<salida>/dia-N/cierre-forzado.json`.
 *
 * Uso: node --conditions=react-server qa/simulador/cierre-forzado.ts --dia N --app … --base …
 *        --pines … --salida … [--a-las 2026-11-20T20:45:00-06:00]
 * Con `--a-las`, primero pone el reloj de QA a esa hora (×1): para cerrar un día que ya pasó.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { llamar } from './api-app.ts';
import { leerSql } from './arbitro/base.ts';
import { carpetaDelDia } from './arbitro/salida.ts';
import { abrirCliente } from './catalogo.ts';
import { leerEntorno, type Entorno } from './entorno.ts';
import { abrirRegistro, type NuevoIncidente } from './incidentes.ts';
import { irACaja } from './pantallas/caja.ts';
import { cierreDeLaCaja } from './pantallas/corte.ts';
import { fijarElReloj } from './reloj/fijar.ts';
import { abrirNavegador, sesionDe } from './sesion.ts';

const DUENO = 'Dueño Don Poncho';
/** Lo que ya no está abierto: cobrada, anulada, repartida en partes o devuelta. */
const CUENTAS_CERRADAS = ['pagada', 'cancelada', 'cerrada', 'reembolsada', 'absorbida', 'dividida'];

interface Hecho {
  readonly que: string;
  readonly ok: boolean;
  readonly detalle: string;
}

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** La sucursal del restaurante: la que tiene las mesas (la copia trae otra de demostración). */
async function sucursalDelRestaurante(baseUrl: string): Promise<string> {
  const [fila] = await leerSql<{ sucursal_id: string }>(
    baseUrl,
    'select sucursal_id from mesas group by sucursal_id order by count(*) desc limit 1',
  );
  if (fila === undefined) throw new Error('La copia no tiene mesas.');
  return fila.sucursal_id;
}

/**
 * Las cuentas sin cobrar, PARTES de una cuenta dividida incluidas (primero ellas): el día 2 las
 * mesas 5 y 10 se quedaron con dos partes sin cobrar cada una, la madre ya «dividida», y como sólo
 * se miraban las cuentas sin madre no se cancelaron: las mesas no se liberaron y la caja no cerró.
 */
async function cuentasAbiertas(
  baseUrl: string,
  sucursal: string,
): Promise<
  readonly { id: string; mesa: string | null; estado: string; canal: string; parte: boolean }[]
> {
  return leerSql(
    baseUrl,
    `select o.id, coalesce(m.numero, mm.numero)::text as mesa, o.estado, o.canal,
        o.orden_padre_id is not null as parte
      from ordenes o
      left join mesas m on m.id = o.mesa_id
      left join ordenes ma on ma.id = o.orden_padre_id
      left join mesas mm on mm.id = ma.mesa_id
      where o.sucursal_id = $1 and not (o.estado = any($2::text[]))
      order by (o.orden_padre_id is null), o.created_at`,
    [sucursal, CUENTAS_CERRADAS],
  );
}

async function mesasOcupadas(
  baseUrl: string,
  sucursal: string,
): Promise<readonly { id: string; numero: string; estado: string }[]> {
  return leerSql(
    baseUrl,
    `select id, numero::text as numero, estado from mesas
      where sucursal_id = $1 and estado <> 'libre' and activa is not false order by numero`,
    [sucursal],
  );
}

async function unionesAbiertas(
  baseUrl: string,
  sucursal: string,
): Promise<readonly { id: string; principal: string | null; miembros: string | null }[]> {
  return leerSql(
    baseUrl,
    `select u.id, (select numero::text from mesas where id = u.mesa_principal_id) as principal,
       (select string_agg(m.numero::text, ', ' order by m.numero) from union_mesa_miembros um
          join mesas m on m.id = um.mesa_id where um.union_id = u.id) as miembros
      from uniones_mesa u where u.sucursal_id = $1 and u.cerrada_en is null`,
    [sucursal],
  );
}

async function cajasAbiertas(
  baseUrl: string,
  sucursal: string,
): Promise<readonly { id: string; terminal: string | null }[]> {
  return leerSql(
    baseUrl,
    `select s.id, t.nombre as terminal from sesiones_caja s left join terminales t on t.id = s.terminal_id
      where s.sucursal_id = $1 and s.estado <> 'cerrada' order by s.abierta_en`,
    [sucursal],
  );
}

async function ponerElReloj(entorno: Entorno, aLas: string): Promise<void> {
  const cliente = abrirCliente(entorno.baseUrl);
  await cliente.connect();
  try {
    await fijarElReloj(cliente, entorno.archivoReloj, new Date(aLas), 1);
  } finally {
    await cliente.end();
  }
}

async function main(): Promise<void> {
  const entorno = leerEntorno();
  const aLas = argumento('a-las');
  if (aLas !== undefined) await ponerElReloj(entorno, aLas);
  const sucursal = await sucursalDelRestaurante(entorno.baseUrl);
  const registro = abrirRegistro(entorno.salida);
  const hechos: Hecho[] = [];
  const navegador = await abrirNavegador();
  try {
    const { pagina } = await sesionDe(navegador, entorno, DUENO, 'pc-1920');
    const anotar = async (h: Hecho, pantalla: string, esperaba: string): Promise<void> => {
      hechos.push(h);
      console.log(`${h.ok ? 'OK ' : 'NO '} ${h.que} · ${h.detalle}`);
      const incidente: NuevoIncidente = {
        dia: entorno.dia,
        horaSim: new Date().toISOString(),
        bot: 'Cierre forzado',
        rol: 'dueno',
        aparato: 'pc-1920',
        pantalla,
        hizo: h.que,
        esperaba,
        paso: `Prueba mal hecha: el día ${String(entorno.dia)} terminó con esto abierto. ${h.detalle}`,
        gravedad: h.ok ? 'bajo' : 'medio',
        clase: 'prueba',
        reproducido: 'no intentado',
      };
      await registro.registrar(incidente);
    };

    for (const c of await cuentasAbiertas(entorno.baseUrl, sucursal)) {
      // Un para llevar armado y sin cobrar es un borrador de la caja, no una cuenta de mesa: se
      // descarta como lo hace la caja al cancelar su cobro (el día 3, cancelar-orden lo rechazó).
      const esBorradorParaLlevar = c.canal === 'llevar' && c.estado === 'borrador';
      const r = esBorradorParaLlevar
        ? await llamar(pagina, '/api/restaurante/descartar-para-llevar', { ordenId: c.id })
        : await llamar(pagina, '/api/restaurante/cancelar-orden', {
            ordenId: c.id,
            motivo: `Cierre forzado del simulador: la cuenta seguía abierta al terminar el día ${String(entorno.dia)}`,
          });
      await anotar(
        {
          que: esBorradorParaLlevar
            ? 'Descartar un para llevar armado y sin cobrar'
            : `Cancelar ${c.parte ? 'una parte de ' : ''}la cuenta de la mesa ${c.mesa ?? '(sin mesa)'} (${c.estado})`,
          ok: r.ok,
          detalle: r.ok ? 'cancelada' : `${String(r.estado)} ${r.mensaje}`,
        },
        'Cierre forzado → cuentas',
        'Ninguna cuenta del día queda abierta al cierre',
      );
    }

    for (const m of await mesasOcupadas(entorno.baseUrl, sucursal)) {
      const r = await llamar(pagina, '/api/restaurante/liberar-mesa', {
        mesaId: m.id,
        grupo: 'separar',
      });
      await anotar(
        {
          que: `Liberar la mesa ${m.numero} (${m.estado})`,
          ok: r.ok,
          detalle: r.ok ? 'libre' : `${String(r.estado)} ${r.mensaje}`,
        },
        'Cierre forzado → mesas',
        'Ninguna mesa queda ocupada al cierre',
      );
    }

    // Cancelar la cuenta de mesas unidas las deja libres pero UNIDAS (A19): el día 2 la mesa 8, aún
    // unida a la 7, mandó lo de su grupo del QR a la cuenta del grupo de la 7 (D2-091/092, D2-094 y
    // D2-096, críticos falsos). Al cierre ningún bot tiene mesas unidas: las que queden se separan.
    for (const u of await unionesAbiertas(entorno.baseUrl, sucursal)) {
      const r = await llamar(pagina, '/api/restaurante/separar-mesas', { unionId: u.id });
      await anotar(
        {
          que: `Separar la ${u.miembros ?? '(sin miembros)'} de la mesa ${u.principal ?? '?'}`,
          ok: r.ok,
          detalle: r.ok ? 'separadas' : `${String(r.estado)} ${r.mensaje}`,
        },
        'Cierre forzado → mesas',
        'Ninguna mesa queda unida al cierre',
      );
    }

    for (const s of await cajasAbiertas(entorno.baseUrl, sucursal)) {
      const traida = await llamar(pagina, '/api/caja/traer', { sesionCajaId: s.id });
      if (!traida.ok) {
        await anotar(
          {
            que: `Traer «${s.terminal ?? 'la caja'}» para cerrarla`,
            ok: false,
            detalle: `${String(traida.estado)} ${traida.mensaje}`,
          },
          'Cierre forzado → cajas',
          'Ninguna caja queda abierta al cierre',
        );
        continue;
      }
      const estado = await llamar(pagina, '/api/caja/estado', { efectivoContadoCentavos: 0 });
      const esperado = Number(estado.datos['efectivoEsperadoCentavos']);
      let detalle: string;
      let ok = false;
      try {
        if (!Number.isFinite(esperado)) throw new Error('el estado no dijo el efectivo esperado');
        await irACaja(pagina, entorno.appUrl);
        const cierre = await cierreDeLaCaja(pagina, esperado);
        ok = !cierre.bloqueadoPorMesas;
        detalle = ok
          ? `cerrada contando ${(esperado / 100).toFixed(2)} (justo lo esperado)`
          : 'el sistema avisó de mesas pendientes';
      } catch (error: unknown) {
        detalle = String(error).slice(0, 300);
      }
      await anotar(
        { que: `Cerrar «${s.terminal ?? 'la caja'}»`, ok, detalle },
        'Cierre forzado → cajas',
        'Ninguna caja queda abierta al cierre',
      );
    }
  } finally {
    await navegador.close();
  }

  const carpeta = carpetaDelDia(entorno.salida, entorno.dia);
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, 'cierre-forzado.json'), JSON.stringify(hechos, null, 2));
  const fallidos = hechos.filter((h) => !h.ok).length;
  console.log(
    `Cierre forzado del día ${String(entorno.dia)}: ${String(hechos.length)} cosas, ${String(fallidos)} sin cerrar.`,
  );
  process.exit(fallidos === 0 ? 0 : 1);
}

await main();
