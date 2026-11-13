/**
 * EL CANDADO DEL SIMULADOR: los bots, el reloj de QA y el servidor del simulador sólo corren contra
 * una COPIA en esta máquina. PRODUCCIÓN NO SE USA PARA PROBAR.
 *
 * Aborta (lanza) si la URL de la app no es local (`pos-don-poncho.vercel.app` o cualquier otro
 * dominio), si la base no es local, si nombra un proyecto de Supabase real (la propia de Don Poncho,
 * la compartida de MorphiqPOS o la de Confetti), si su nombre no empieza con `qa_`, o si el proceso
 * corre en Vercel. Lo usan el lanzador de los bots, el servidor del simulador y el reloj (en el
 * servidor y en la base): ninguna de esas piezas arranca sin pasar por aquí.
 */

/** Los dominios de producción conocidos. Cualquier dominio no local ya se rechaza; éstos, por nombre. */
export const DOMINIOS_DE_PRODUCCION: readonly string[] = ['pos-don-poncho.vercel.app'];

/** Los proyectos de Supabase reales: la propia de Don Poncho, la compartida y la de Confetti. */
export const PROYECTOS_REALES: readonly string[] = [
  'mqlcusxwqrefpfttjjks',
  'wyqmzhliurwyxuyxznpb',
  'ivqcxdpqxwjxfohiswqb',
];

const ANFITRIONES_LOCALES: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  '::1',
]);

export interface DestinoDelSimulador {
  /** La URL de la app que van a usar los bots (o la del servidor del simulador). */
  readonly appUrl?: string | undefined;
  /** La cadena de la base a la que apunta el servidor o el guion. */
  readonly databaseUrl?: string | undefined;
  /** El entorno del proceso (`process.env`). */
  readonly entorno?: Readonly<Record<string, string | undefined>>;
}

function url(texto: string, que: string): URL {
  try {
    return new URL(texto);
  } catch {
    throw new Error(`Candado del simulador: ${que} no es una URL.`);
  }
}

function nombraUnProyectoReal(texto: string): string | undefined {
  const bajo = texto.toLowerCase();
  return PROYECTOS_REALES.find((ref) => bajo.includes(ref));
}

/** Lanza si algo del destino no es la copia local. No devuelve nada: o pasa o aborta. */
export function exigirCopiaLocal(destino: DestinoDelSimulador): void {
  const entorno = destino.entorno ?? {};
  if ((entorno['VERCEL'] ?? '') !== '' || (entorno['VERCEL_ENV'] ?? '') !== '') {
    throw new Error(
      'Candado del simulador: este proceso corre en Vercel. El simulador sólo corre en la laptop.',
    );
  }
  if (destino.appUrl !== undefined) {
    const app = url(destino.appUrl, 'la URL de la app');
    if (DOMINIOS_DE_PRODUCCION.includes(app.hostname.toLowerCase())) {
      throw new Error(
        `Candado del simulador: ${app.hostname} es PRODUCCIÓN. Los bots corren contra una copia.`,
      );
    }
    if (!ANFITRIONES_LOCALES.has(app.hostname.toLowerCase())) {
      throw new Error(
        `Candado del simulador: ${app.hostname} no es esta máquina. Los bots sólo usan la app local.`,
      );
    }
  }
  if (destino.databaseUrl !== undefined) {
    const real = nombraUnProyectoReal(destino.databaseUrl);
    if (real !== undefined) {
      throw new Error(
        `Candado del simulador: la base nombra el proyecto real ${real}. Sólo una copia local.`,
      );
    }
    const base = url(destino.databaseUrl, 'la cadena de la base');
    if (!ANFITRIONES_LOCALES.has(base.hostname.toLowerCase())) {
      throw new Error(
        `Candado del simulador: la base está en ${base.hostname}, no en esta máquina.`,
      );
    }
    const nombre = decodeURIComponent(base.pathname.replace(/^\//, ''));
    if (!nombre.startsWith('qa_')) {
      throw new Error(`Candado del simulador: la base «${nombre}» no es una copia de QA (qa_…).`);
    }
  }
}
