import { Button } from '@morphiqpos/ui/primitivas/button';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * EL ENCABEZADO DEL TABLERO (DP-11.4).
 *
 * Un `h1` con su descripción, y a su lado —en un `div` HERMANO del que contiene al `h1`— las
 * acciones. Esa relación es el contrato con las pruebas de navegador: `accionesDelTablero`
 * llega a los botones desde el `h1` con `../following-sibling::div[1]`, así que ni el `h1` ni
 * el bloque de acciones pueden cambiar de lugar en el árbol.
 *
 * La acción principal es la que decide la plantilla: «Nueva venta» donde hay sala (mesas) e
 * «Ir a Caja» donde se cobra en mostrador. Es el único botón del tablero con
 * `data-principal`: el sistema le pone el halo de lo que la pantalla quiere que se toque.
 *
 * Las acciones son un botón DENTRO de un enlace, como siempre: las pruebas las buscan por su
 * rol de botón.
 */

export interface EncabezadoDelTableroProps {
  /** «Nombre del negocio · fecha»; lo arma el tablero. */
  readonly descripcion: string;
  /** `venta` donde hay mesas; `caja` donde se cobra en mostrador. */
  readonly accionPrincipal: 'venta' | 'caja';
  /** El paquete incluye compras: se ofrece «Registrar compra». */
  readonly conCompras: boolean;
}

export function EncabezadoDelTablero({
  descripcion,
  accionPrincipal,
  conCompras,
}: EncabezadoDelTableroProps): ReactElement {
  return (
    <header className="mb-(--espacio-6) flex flex-col gap-(--espacio-4) sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-heading text-2xl font-bold text-texto">Buen día</h1>
        <p className="mt-1 text-sm text-texto-sutil">{descripcion}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={accionPrincipal === 'venta' ? '/pos' : '/caja'}>
          <Button size="sm" data-principal>
            <ShoppingCart aria-hidden="true" />
            {accionPrincipal === 'venta' ? 'Nueva venta' : 'Ir a Caja'}
          </Button>
        </Link>
        {conCompras ? (
          <Link href="/compras">
            <Button size="sm" variant="outline">
              Registrar compra
            </Button>
          </Link>
        ) : null}
      </div>
    </header>
  );
}
