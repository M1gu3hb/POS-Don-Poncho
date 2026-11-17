/**
 * UN TRABAJO A LA VEZ POR DOCUMENTO (DP-20 · refuerzo §4). Puro.
 *
 * Lo que evita los tickets repetidos por picarle varias veces: mientras un trabajo está en curso,
 * el mismo botón no acepta otro toque. Al terminar —bien o mal— se puede volver a imprimir: no
 * hay bloqueo permanente de «ya se imprimió». Un REINTENTO tras un fallo lleva el MISMO id (la
 * app no imprime dos veces lo que sí entregó); una impresión nueva lleva id nuevo.
 */

export type Fase = 'libre' | 'enviando' | 'imprimiendo' | 'impreso' | 'enviado' | 'error';

export interface Fallo {
  readonly codigo: string;
  /** Qué pasó: «Sin papel». */
  readonly titulo: string;
  /** Qué hacer: «Pon un rollo y reintenta.» */
  readonly queHacer: string;
}

export interface EstadoDelTrabajo {
  readonly fase: Fase;
  /** De 0 a 1 mientras salen los bytes; `null` si no se sabe. */
  readonly avance: number | null;
  readonly fallo: Fallo | null;
  /** El id del trabajo que falló, para reintentarlo sin duplicar. */
  readonly idPendiente: string | null;
}

export type FinDelTrabajo =
  /** `navegador`: este aparato no imprime ese documento directo; se abrió el diálogo de siempre. */
  | { readonly ok: true; readonly estado: 'impreso' | 'enviado' | 'navegador' }
  | { readonly ok: false; readonly fallo: Fallo };

export interface ControlesDelTrabajo {
  readonly id: string;
  /** Pasa de «Enviando…» a «Imprimiendo…», con su avance si se sabe. */
  avanzar(avance: number | null): void;
}

const LIBRE: EstadoDelTrabajo = { fase: 'libre', avance: null, fallo: null, idPendiente: null };

export function enCurso(estado: EstadoDelTrabajo): boolean {
  return estado.fase === 'enviando' || estado.fase === 'imprimiendo';
}

/** Lo que acompaña a un trabajo para que su aviso de error tenga salidas. */
export interface SalidasDelTrabajo {
  /** Con qué se le dice a la persona: «Ticket A-12». */
  readonly titulo: string;
  /** Lo de siempre: el diálogo del navegador. */
  readonly alNavegador?: () => void;
  /** Lo que ya está hecho aunque el papel falle: «La venta ya quedó cobrada». */
  readonly yaQuedo?: string;
}

export interface TrabajoALaVista {
  readonly clave: string;
  readonly estado: EstadoDelTrabajo;
  readonly salidas: SalidasDelTrabajo;
}

export interface MesaDeTrabajos {
  readonly leer: (clave: string) => EstadoDelTrabajo;
  readonly suscribir: (oyente: () => void) => () => void;
  /** Los trabajos que no están libres, del más viejo al más nuevo (la misma lista hasta que cambie). */
  readonly aLaVista: () => readonly TrabajoALaVista[];
  /** Vuelve a lanzar el último trabajo de esa clave (con el mismo id si había fallado). */
  readonly reintentar: (clave: string) => void;
  /**
   * Corre `tarea` si el botón está libre. Devuelve `null` —sin llamarla— si ya había un trabajo
   * en curso con esa clave: ese toque no cuenta.
   */
  readonly lanzar: (
    clave: string,
    nuevoId: () => string,
    tarea: (controles: ControlesDelTrabajo) => Promise<FinDelTrabajo>,
    salidas?: SalidasDelTrabajo,
  ) => Promise<FinDelTrabajo | null>;
  /** Quita el «Impreso ✓» o el error y deja el botón como al principio. */
  readonly soltar: (clave: string) => void;
}

/**
 * X5 · Cuánto espera la página una respuesta de la app antes de dar el trabajo por perdido.
 *
 * Es SILENCIO, no duración total: cada aviso de avance de la app lo renueva. Pasado el plazo la
 * barra pasa a error con sus tres salidas, y el reintento lleva el mismo id (la app no imprime
 * doble lo que sí entregó). Lo que la app conteste después de vencido ya no cuenta.
 */
export const PLAZO_PARA_ENVIAR_MS = 20_000;

const FALLO_SIN_RESPUESTA: Fallo = {
  codigo: 'SIN_RESPUESTA',
  titulo: 'La impresora no contestó',
  queHacer:
    'Reintenta: no saldrá doble. Si sigue igual, imprime con el navegador o ve a Impresión.',
};

const FALLO_INESPERADO: Fallo = {
  codigo: 'DESCONOCIDO',
  titulo: 'No se pudo imprimir',
  queHacer: 'Reintenta; si sigue igual, imprime con el navegador.',
};

type Tarea = (controles: ControlesDelTrabajo) => Promise<FinDelTrabajo>;

/**
 * El mensaje de lo que se lanzó. Los rechazos del puente de la app no son un `Error`: son un
 * objeto plano `{ codigo, message }` (es lo que deja pasar el aislamiento de contexto).
 */
export function mensajeDe(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const mensaje = (error as { message?: unknown }).message;
  return typeof mensaje === 'string' && mensaje !== '' ? mensaje : null;
}

export function crearMesaDeTrabajos(plazoMs: number = PLAZO_PARA_ENVIAR_MS): MesaDeTrabajos {
  const estados = new Map<string, EstadoDelTrabajo>();
  const lanzados = new Map<
    string,
    { readonly nuevoId: () => string; readonly tarea: Tarea; readonly salidas: SalidasDelTrabajo }
  >();
  const oyentes = new Set<() => void>();
  let vista: readonly TrabajoALaVista[] = [];

  const poner = (clave: string, estado: EstadoDelTrabajo): void => {
    if (estado === LIBRE) estados.delete(clave);
    else estados.set(clave, estado);
    vista = Array.from(estados, ([deQuien, suEstado]) => ({
      clave: deQuien,
      estado: suEstado,
      salidas: lanzados.get(deQuien)?.salidas ?? { titulo: deQuien },
    }));
    for (const oyente of oyentes) oyente();
  };

  const mesa: MesaDeTrabajos = {
    leer: (clave) => estados.get(clave) ?? LIBRE,
    aLaVista: () => vista,
    reintentar(clave) {
      const lanzado = lanzados.get(clave);
      if (lanzado !== undefined)
        void mesa.lanzar(clave, lanzado.nuevoId, lanzado.tarea, lanzado.salidas);
    },
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },
    async lanzar(clave, nuevoId, tarea, salidas) {
      const previo = estados.get(clave) ?? LIBRE;
      if (enCurso(previo)) return null;
      lanzados.set(clave, { nuevoId, tarea, salidas: salidas ?? { titulo: clave } });
      const id =
        previo.fase === 'error' && previo.idPendiente !== null ? previo.idPendiente : nuevoId();
      poner(clave, { fase: 'enviando', avance: null, fallo: null, idPendiente: null });
      // El plazo corre desde que se lanza y se renueva con cada aviso de avance de la app.
      let cerrado = false;
      let reloj: ReturnType<typeof setTimeout> | undefined;
      let vencer: (fin: FinDelTrabajo) => void = () => undefined;
      const sinRespuesta = new Promise<FinDelTrabajo>((resolver) => {
        vencer = resolver;
      });
      const armarElPlazo = (): void => {
        clearTimeout(reloj);
        reloj = setTimeout(() => {
          cerrado = true;
          vencer({ ok: false, fallo: FALLO_SIN_RESPUESTA });
        }, plazoMs);
      };
      armarElPlazo();
      let fin: FinDelTrabajo;
      try {
        fin = await Promise.race([
          tarea({
            id,
            avanzar(avance) {
              if (cerrado) return;
              armarElPlazo();
              poner(clave, { fase: 'imprimiendo', avance, fallo: null, idPendiente: null });
            },
          }),
          sinRespuesta,
        ]);
      } catch (error: unknown) {
        const detalle = mensajeDe(error);
        fin = {
          ok: false,
          fallo: detalle === null ? FALLO_INESPERADO : { ...FALLO_INESPERADO, titulo: detalle },
        };
      } finally {
        cerrado = true;
        clearTimeout(reloj);
      }
      if (!fin.ok) poner(clave, { fase: 'error', avance: null, fallo: fin.fallo, idPendiente: id });
      else if (fin.estado === 'navegador') poner(clave, LIBRE);
      else poner(clave, { fase: fin.estado, avance: 1, fallo: null, idPendiente: null });
      return fin;
    },
    soltar(clave) {
      const actual = estados.get(clave);
      if (actual !== undefined && !enCurso(actual)) poner(clave, LIBRE);
    },
  };
  return mesa;
}

/** La mesa de toda la página: un botón de la Caja y el mismo documento en Registros no se pisan. */
export const MESA_DE_TRABAJOS = crearMesaDeTrabajos();

const FALLOS: Readonly<Record<string, Omit<Fallo, 'codigo'>>> = {
  SIN_PAPEL: { titulo: 'Sin papel', queHacer: 'Pon un rollo nuevo y reintenta.' },
  TAPA_ABIERTA: { titulo: 'Tapa abierta', queHacer: 'Cierra la tapa de la impresora y reintenta.' },
  DESCONECTADA: {
    titulo: 'Impresora desconectada',
    queHacer: 'Revisa que esté encendida y conectada, y reintenta.',
  },
  TIEMPO: {
    titulo: 'No respondió en 10 s',
    queHacer: 'Revisa la impresora y reintenta, o imprime con el navegador.',
  },
  SIN_PERMISO: {
    titulo: 'Falta el permiso de la impresora',
    queHacer: 'Ve a Impresión y da el permiso en este aparato.',
  },
  SIN_PERFIL: {
    titulo: 'Este aparato no tiene impresora configurada',
    queHacer: 'Ve a Impresión, o imprime con el navegador.',
  },
  NO_SOPORTADO: {
    titulo: 'Este aparato no puede imprimir así',
    queHacer: 'Imprime con el navegador y avisa a tu proveedor.',
  },
};

/** El fallo que contestó la app, dicho para la persona: qué pasó y qué hacer. */
export function falloDelPuente(codigo: string | undefined, mensaje: string | undefined): Fallo {
  const conocido = FALLOS[codigo ?? ''];
  if (conocido !== undefined) return { codigo: codigo ?? 'DESCONOCIDO', ...conocido };
  return {
    ...FALLO_INESPERADO,
    codigo: codigo ?? 'DESCONOCIDO',
    titulo: mensaje !== undefined && mensaje !== '' ? mensaje : FALLO_INESPERADO.titulo,
  };
}

/** Lo que dice el botón en cada fase. «Enviado» = los bytes salieron y la impresora no confirma. */
export function textoDeLaFase(estado: EstadoDelTrabajo, etiqueta: string): string {
  switch (estado.fase) {
    case 'enviando':
      return 'Enviando…';
    case 'imprimiendo':
      return 'Imprimiendo…';
    case 'impreso':
      return 'Impreso ✓';
    case 'enviado':
      return 'Enviado ✓';
    case 'libre':
    case 'error':
      return etiqueta;
  }
}
