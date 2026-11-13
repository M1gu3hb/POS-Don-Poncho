/**
 * EL REGISTRO DE INCIDENTES: cada cosa que sale mal, con lo que hizo el bot, lo que esperaba y lo
 * que pasó, y su evidencia (captura, traza, consola, red, correlationId, log del servidor).
 *
 * `<salida>/INCIDENTES.jsonl` (el de la semana) y la evidencia en `<salida>/evidencia/<id>/`,
 * fuera del repositorio. `informe.ts` resume y copia al repo lo que no lleva datos sensibles.
 * Una repetición es el mismo (rol, pantalla, paso) ya visto ese día o antes.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

export type Gravedad = 'critico' | 'alto' | 'medio' | 'bajo';
export type Clase =
  | 'ui'
  | 'ux'
  | 'servidor'
  | 'permisos'
  | 'concurrencia'
  | 'dinero'
  | 'inventario'
  | 'red'
  | 'rendimiento'
  | 'prueba'
  | 'extraordinario';

export interface Evidencia {
  readonly captura?: string;
  readonly traza?: string;
  readonly consola?: readonly string[];
  readonly red?: readonly string[];
  readonly correlationId?: string;
  readonly logServidor?: string;
}

export interface Incidente {
  readonly id: string;
  readonly dia: number;
  readonly horaSim: string;
  readonly bot: string;
  readonly rol: string;
  readonly aparato: string;
  readonly pantalla: string;
  readonly hizo: string;
  readonly esperaba: string;
  readonly paso: string;
  readonly evidencia: Evidencia;
  readonly repeticion: boolean;
  readonly reproducido: '0/3' | '1/3' | '2/3' | '3/3' | 'no intentado';
  readonly gravedad: Gravedad;
  readonly clase: Clase;
}

export type NuevoIncidente = Omit<Incidente, 'id' | 'repeticion' | 'evidencia'> & {
  readonly evidencia?: Evidencia;
};

/** Lo último que dijo la consola y la red de cada página (lo llena `vigilar`). */
const recientes = new WeakMap<Page, { consola: string[]; red: string[] }>();

export function vigilar(pagina: Page): void {
  const r = { consola: [] as string[], red: [] as string[] };
  recientes.set(pagina, r);
  const guardar = (lista: string[], linea: string) => {
    lista.push(linea.slice(0, 500));
    if (lista.length > 40) lista.shift();
  };
  pagina.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      guardar(r.consola, `${m.type()}: ${m.text()}`);
  });
  pagina.on('response', (resp) => {
    if (resp.status() >= 400) {
      const cid = resp.headers()['x-correlation-id'] ?? '';
      guardar(
        r.red,
        `${String(resp.status())} ${resp.request().method()} ${new URL(resp.url()).pathname} ${cid}`,
      );
    }
  });
  pagina.on('requestfailed', (req) => {
    guardar(
      r.red,
      `FALLÓ ${req.method()} ${new URL(req.url()).pathname}: ${req.failure()?.errorText ?? ''}`,
    );
  });
}

export interface Registro {
  registrar(i: NuevoIncidente, pagina?: Page): Promise<Incidente>;
  todos(): readonly Incidente[];
}

export function abrirRegistro(
  salida: string,
  alCritico: (i: Incidente) => void = () => undefined,
): Registro {
  mkdirSync(salida, { recursive: true });
  const archivo = join(salida, 'INCIDENTES.jsonl');
  const leer = (): Incidente[] =>
    existsSync(archivo)
      ? readFileSync(archivo, 'utf8')
          .split('\n')
          .filter((l) => l.trim() !== '')
          .map((l) => JSON.parse(l) as Incidente)
      : [];
  return {
    todos: leer,
    async registrar(nuevo, pagina) {
      const previos = leer();
      const id = `D${String(nuevo.dia)}-${String(previos.filter((p) => p.dia === nuevo.dia).length + 1).padStart(3, '0')}`;
      const carpeta = join(salida, 'evidencia', id);
      mkdirSync(carpeta, { recursive: true });
      let captura: string | undefined;
      if (pagina !== undefined && !pagina.isClosed()) {
        captura = join(carpeta, 'pantalla.png');
        await pagina.screenshot({ path: captura, fullPage: false }).catch((e: unknown) => {
          writeFileSync(join(carpeta, 'sin-captura.txt'), String(e));
          captura = undefined;
        });
      }
      const r = pagina === undefined ? undefined : recientes.get(pagina);
      const incidente: Incidente = {
        ...nuevo,
        id,
        repeticion: previos.some(
          (p) => p.rol === nuevo.rol && p.pantalla === nuevo.pantalla && p.paso === nuevo.paso,
        ),
        evidencia: {
          ...(captura === undefined ? {} : { captura }),
          ...(r === undefined ? {} : { consola: [...r.consola], red: [...r.red] }),
          ...nuevo.evidencia,
        },
      };
      appendFileSync(archivo, `${JSON.stringify(incidente)}\n`);
      if (incidente.gravedad === 'critico') alCritico(incidente);
      return incidente;
    },
  };
}
