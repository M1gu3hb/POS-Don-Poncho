/**
 * EL TICKET Y LA PRECUENTA A TU GUSTO (DP-21 · Bloque 12 · M10). Puro.
 *
 * El dueño elige, para la precuenta y para el ticket de venta por separado, qué renglones de
 * ENCABEZADO y de DETALLE salen en el papel. La regla vive aquí, en un solo sitio, y la lee quien
 * pinta el papel (`PreCuentaTicket`), quien arma la vista previa y quien guarda.
 *
 *   · Por omisión TODO sale: sin elegir nada, el papel de hoy no cambia ni un punto.
 *   · Hay cosas que NO se pueden quitar y por eso no tienen interruptor: los platillos con su
 *     importe, el subtotal y el TOTAL. El IVA tampoco tiene: sale sólo si la tasa es mayor que 0
 *     (`seMencionaElIva`).
 *   · Quitar el folio del ticket de venta se permite, con un aviso: sin él el cliente no puede
 *     reclamar ni pedir factura.
 *
 * Las copias («ORIGINAL — CLIENTE», «COPIA — NEGOCIO») y «REIMPRESIÓN» no son renglones del papel
 * sino marcas de quien lo imprime: esta regla no las toca.
 */

export type PapelDeVenta = 'precuenta' | 'ticket';
export const PAPELES_DE_VENTA: readonly PapelDeVenta[] = ['precuenta', 'ticket'];

export const NOMBRE_DEL_PAPEL: Readonly<Record<PapelDeVenta, string>> = {
  precuenta: 'Precuenta',
  ticket: 'Ticket de venta',
};

interface FormaDeUnCampo {
  readonly id: string;
  /** Lo que lee quien elige. */
  readonly nombre: string;
  /** La precuenta todavía no cobra: no tiene forma de pago, efectivo recibido ni cambio. */
  readonly enLaPrecuenta: boolean;
}

/** Los renglones con interruptor, en el orden en que salen en el papel. */
export const CAMPOS_DEL_PAPEL = [
  { id: 'logo', nombre: 'Logo', enLaPrecuenta: true },
  { id: 'negocio', nombre: 'Nombre del negocio', enLaPrecuenta: true },
  { id: 'direccion', nombre: 'Dirección', enLaPrecuenta: true },
  { id: 'telefono', nombre: 'Teléfono', enLaPrecuenta: true },
  { id: 'folio', nombre: 'Folio', enLaPrecuenta: true },
  { id: 'mesa', nombre: 'Mesa', enLaPrecuenta: true },
  { id: 'personas', nombre: 'Personas', enLaPrecuenta: true },
  { id: 'cliente', nombre: 'Cliente', enLaPrecuenta: true },
  { id: 'mesero', nombre: 'Mesero', enLaPrecuenta: true },
  { id: 'cajero', nombre: 'Cajero', enLaPrecuenta: true },
  { id: 'fecha', nombre: 'Fecha y hora', enLaPrecuenta: true },
  { id: 'opciones', nombre: 'Opciones de cada platillo', enLaPrecuenta: true },
  { id: 'notas', nombre: 'Notas de cada platillo', enLaPrecuenta: true },
  { id: 'descuento', nombre: 'Descuento', enLaPrecuenta: true },
  { id: 'propina', nombre: 'Propina', enLaPrecuenta: true },
  { id: 'forma_de_pago', nombre: 'Forma de pago', enLaPrecuenta: false },
  { id: 'efectivo_recibido', nombre: 'Efectivo recibido', enLaPrecuenta: false },
  { id: 'cambio', nombre: 'Cambio', enLaPrecuenta: false },
  { id: 'mensaje', nombre: 'Mensaje final', enLaPrecuenta: true },
] as const satisfies readonly FormaDeUnCampo[];

export type CampoDelPapel = (typeof CAMPOS_DEL_PAPEL)[number];

export type IdDeCampo = (typeof CAMPOS_DEL_PAPEL)[number]['id'];
export const IDS_DE_CAMPOS: readonly IdDeCampo[] = CAMPOS_DEL_PAPEL.map((c) => c.id);

/** Lo que el papel lleva SIEMPRE: no tiene interruptor y ninguna configuración lo quita. */
export const LO_QUE_NUNCA_SE_QUITA: readonly string[] = [
  'los platillos con su importe',
  'el subtotal',
  'el TOTAL',
];

export type ElegidoDeUnPapel = Readonly<Record<IdDeCampo, boolean>>;
export type PapelATuGusto = Readonly<Record<PapelDeVenta, ElegidoDeUnPapel>>;

/** Lo que llega de una configuración: lo que falte, o no se entienda, vale «sale». */
export type PapelATuGustoParcial =
  | Readonly<Partial<Record<PapelDeVenta, Readonly<Partial<Record<IdDeCampo, unknown>>> | null>>>
  | null
  | undefined;

const TODO_ENCENDIDO: ElegidoDeUnPapel = Object.fromEntries(
  IDS_DE_CAMPOS.map((id) => [id, true]),
) as ElegidoDeUnPapel;

/** Con lo que nace un negocio y con lo que imprime el que nunca lo tocó: todo encendido. */
export const PAPEL_POR_OMISION: PapelATuGusto = {
  precuenta: TODO_ENCENDIDO,
  ticket: TODO_ENCENDIDO,
};

/**
 * ¿Sale este renglón en este papel? Sólo un `false` explícito lo quita: un valor ausente, nulo o
 * que no es un booleano se lee como «sale» (el papel de siempre).
 */
export function seEnsena(
  elegido: PapelATuGustoParcial,
  papel: PapelDeVenta,
  campo: IdDeCampo,
): boolean {
  return elegido?.[papel]?.[campo] !== false;
}

/** El papel completo (todos los renglones, true o false), a partir de lo que haya. */
export function completarPapel(elegido: PapelATuGustoParcial): PapelATuGusto {
  const de = (papel: PapelDeVenta): ElegidoDeUnPapel =>
    Object.fromEntries(
      IDS_DE_CAMPOS.map((id) => [id, seEnsena(elegido, papel, id)]),
    ) as ElegidoDeUnPapel;
  return { precuenta: de('precuenta'), ticket: de('ticket') };
}

export const AVISO_SIN_FOLIO = 'Sin folio, el cliente no podrá reclamar ni pedir factura.';

/** El aviso que se da al apagar este renglón, o `null` si se apaga sin más. */
export function avisoAlQuitar(papel: PapelDeVenta, campo: IdDeCampo): string | null {
  return papel === 'ticket' && campo === 'folio' ? AVISO_SIN_FOLIO : null;
}

/** Los renglones que se pueden elegir en este papel (la precuenta no lleva los del cobro). */
export function camposDelPapel(papel: PapelDeVenta): readonly CampoDelPapel[] {
  return CAMPOS_DEL_PAPEL.filter((c) => papel === 'ticket' || c.enLaPrecuenta);
}

export function papelIgual(a: PapelATuGusto, b: PapelATuGusto): boolean {
  return PAPELES_DE_VENTA.every((p) => IDS_DE_CAMPOS.every((c) => a[p][c] === b[p][c]));
}
