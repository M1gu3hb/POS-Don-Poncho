/**
 * EL TICKET DE EJEMPLO (DP-20 · laboratorio). Puro.
 *
 * Datos inventados y fijos, claramente de ejemplo (folio «EJEMPLO»): con acentos, ñ, una nota
 * larga y una opción con precio, que es lo que más se rompe al pasar un ticket a una térmica.
 * No hay venta, ni cuenta, ni folio: nada de esto toca dinero.
 */

export const FOLIO_DE_EJEMPLO = 'EJEMPLO';
export const CODIGO_DE_EJEMPLO = 'AB12';

export interface RenglonDeEjemplo {
  readonly producto_nombre: string;
  readonly cantidad: number;
  readonly subtotal: number;
  readonly notas_producto?: string;
  readonly opciones_snapshot?: readonly {
    readonly grupo: string;
    readonly opciones: readonly { readonly nombre: string; readonly precioCentavos: number }[];
  }[];
}

interface Platillo {
  readonly nombre: string;
  readonly precio: number;
  readonly cantidad: number;
  readonly nota?: string;
  readonly extra?: { readonly nombre: string; readonly centavos: number };
}

const PLATILLOS: readonly Platillo[] = [
  { nombre: 'Barbacoa de borrego ½ kg', precio: 420, cantidad: 1 },
  { nombre: 'Consomé con garbanzo', precio: 60, cantidad: 2 },
  { nombre: 'Agua de piña', precio: 35, cantidad: 2 },
  {
    nombre: 'Tacos de canasta',
    precio: 18,
    cantidad: 6,
    extra: { nombre: 'Queso extra', centavos: 1500 },
  },
  {
    nombre: 'Pozole rojo',
    precio: 135,
    cantidad: 1,
    nota: 'Sin cebolla, con mucho limón, el chile aparte y las tostadas bien doradas, por favor',
  },
  { nombre: 'Café de olla', precio: 32, cantidad: 3 },
];

const alCentavo = (n: number): number => Math.round(n * 100) / 100;

function renglonDe(platillo: Platillo): RenglonDeEjemplo {
  const extra = platillo.extra;
  const unitario = platillo.precio + (extra === undefined ? 0 : extra.centavos / 100);
  return {
    producto_nombre: platillo.nombre,
    cantidad: platillo.cantidad,
    subtotal: alCentavo(unitario * platillo.cantidad),
    ...(platillo.nota === undefined ? {} : { notas_producto: platillo.nota }),
    ...(extra === undefined
      ? {}
      : {
          opciones_snapshot: [
            {
              grupo: 'Extras',
              opciones: [{ nombre: extra.nombre, precioCentavos: extra.centavos }],
            },
          ],
        }),
  };
}

export const RENGLONES_DEL_TICKET_CORTO = PLATILLOS.length;
export const RENGLONES_DEL_TICKET_LARGO = 40;

/** `cuantos` renglones: los seis de siempre y, si se piden más, se repiten (el ticket largo). */
export function detallesDeEjemplo(cuantos: number): readonly RenglonDeEjemplo[] {
  const total = Math.max(0, Math.trunc(cuantos));
  return Array.from({ length: total }, (_, i) => {
    const platillo = PLATILLOS[i % PLATILLOS.length];
    if (platillo === undefined) throw new RangeError('No hay platillos de ejemplo.');
    return renglonDe(platillo);
  });
}

export interface VentaDeEjemplo {
  readonly id: string;
  readonly folio: string;
  readonly personas: number;
  readonly cliente_nombre: string;
  readonly usuario_mesero_nombre: string;
  readonly usuario_cajero_nombre: string;
  readonly fecha_apertura: string;
  readonly subtotal: number;
  readonly total: number;
  readonly descuentos: number;
  readonly impuestos: number;
  readonly propina_tipo: string;
  readonly canal: string;
}

export function ventaDeEjemplo(detalles: readonly RenglonDeEjemplo[]): VentaDeEjemplo {
  const suma = alCentavo(detalles.reduce((total, d) => total + d.subtotal, 0));
  return {
    id: 'ejemplo',
    folio: FOLIO_DE_EJEMPLO,
    personas: 4,
    cliente_nombre: 'Cliente de ejemplo',
    usuario_mesero_nombre: 'Mesero de ejemplo',
    usuario_cajero_nombre: 'Cajero de ejemplo',
    fecha_apertura: '2026-01-15T14:30:00',
    subtotal: suma,
    total: suma,
    descuentos: 0,
    impuestos: 0,
    propina_tipo: 'ninguna',
    canal: 'salon',
  };
}

export const MESA_DE_EJEMPLO = { numero: 7, nombre: 'Terraza' } as const;
