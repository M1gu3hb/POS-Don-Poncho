/**
 * EL MUNDO: lo que los bots comparten en memoria (un solo proceso de Node). No es la verdad del
 * sistema —ésa está en la base y la dice el árbitro—: es lo que el personal SABE entre sí (qué mesa
 * le tocó a quién, qué cuenta está por cobrarse, qué se agotó). Cada quien escribe lo suyo.
 *
 * Se extiende por rol; cada campo nuevo dice quién lo escribe y quién lo lee.
 */
export interface ProductoConocido {
  readonly id: string;
  readonly nombre: string;
  readonly categoria: string;
  readonly estacion: string;
  readonly tipoVenta: string;
  readonly precioCentavos: number;
  readonly presentaciones: readonly number[];
  readonly soloPresentaciones: boolean;
  readonly grupos: readonly GrupoConocido[];
}

export interface GrupoConocido {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: 'unica' | 'multiple';
  readonly obligatorio: boolean;
  readonly minimo: number | null;
  readonly maximo: number | null;
  readonly opciones: readonly {
    readonly id: string;
    readonly nombre: string;
    readonly deltaCentavos: number;
    readonly activa: boolean;
  }[];
}

export interface MesaConocida {
  readonly numero: number;
  readonly zona: string;
  readonly qrToken: string;
}

/** Un grupo de comensales que llega a una hora simulada (lo genera el horario del día). */
export interface Llegada {
  readonly id: string;
  readonly horaSim: number;
  readonly personas: number;
  readonly usaQr: boolean;
  readonly telefonos: number;
  readonly minutosEnLaMesa: number;
  readonly rondas: number;
  readonly celebracion: boolean;
}

export interface CuentaPorCobrar {
  readonly cuenta: string;
  readonly mesa: number | null;
  readonly esperadoCentavos: number;
  readonly pedidaEn: number;
  /** El código de caja de la precuenta (`M12-3456`), si el bot lo leyó. Lo escribe el mesero. */
  readonly codigo?: string;
  /** La propina que la mesa acordó al pedir la cuenta (la caja la cobra aparte del esperado). */
  readonly propinaCentavos?: number;
  /** Quién la está cobrando (para el caos de «dos cajas cobrando la misma cuenta»). */
  cobrandola: string | null;
}

/** Una línea que los comensales de una mesa armaron en el portal (el mesero la confirma y la manda a cocina). */
export interface LineaDelPortal {
  readonly producto: string;
  readonly cantidad: number;
  readonly opciones: readonly string[];
  readonly importeCentavos: number;
  readonly estacion: string;
}

/** Un grupo con teléfonos en una mesa: lo escriben los comensales, lo lee el mesero que atiende la mesa. */
export interface GrupoDePortal {
  readonly llegada: Llegada;
  readonly mesa: number;
  /** Lo que llevan pedido en cada ronda, en orden (el comensal agrega; el mesero marca cuántas ya mandó). */
  readonly lineas: LineaDelPortal[];
  /** Cuántas de las `lineas` el mesero ya mandó a cocina. */
  enviadas: number;
  /** El grupo ya pidió la cuenta por el portal. */
  cuentaPedida: boolean;
}

export interface Mundo {
  catalogo: readonly ProductoConocido[];
  mesas: readonly MesaConocida[];
  /** Llegadas del día que aún no tienen mesa (las toma el mesero que esté libre). */
  llegadas: Llegada[];
  /** Mesa → mesero que la atiende (el mesero la pone al abrirla; la quita al liberarla). */
  atendidas: Map<number, string>;
  /** Cuentas pedidas, en el orden en que se pidieron (las cajas las toman de aquí). */
  porCobrar: CuentaPorCobrar[];
  /** Productos agotados hoy (el gerente o la cocina; los meseros no los piden). */
  agotados: Set<string>;
  /** Precio vigente por producto si cambió en vivo, con la hora simulada del cambio. */
  cambiosDePrecio: Map<string, { antes: number; despues: number; horaSim: number }>;
  /** Mesa → grupo con teléfonos (portal del QR). Lo escriben los comensales; lo lee el mesero. */
  portal: Map<number, GrupoDePortal>;
  /** Contadores del día por tipo, para el volumen del informe. */
  volumen: Map<string, number>;
}

export function mundoVacio(): Mundo {
  return {
    catalogo: [],
    mesas: [],
    llegadas: [],
    atendidas: new Map(),
    porCobrar: [],
    agotados: new Set(),
    cambiosDePrecio: new Map(),
    portal: new Map(),
    volumen: new Map(),
  };
}

export function contar(mundo: Mundo, tipo: string, n = 1): void {
  mundo.volumen.set(tipo, (mundo.volumen.get(tipo) ?? 0) + n);
}
