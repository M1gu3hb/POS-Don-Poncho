import { Superficie } from '@morphiqpos/ui/sistema';

import { cantidadParaMostrar } from '../restaurante/peso.ts';

import { opcionesDelServidor, separarOpcionesYNota } from './opciones-y-nota';
import type { ItemDeCocina } from './tipos';

/**
 * DP-16 · 2.2 · UN PLATILLO DE LA COMANDA.
 *
 * La cantidad a la izquierda, en su propia columna; el nombre; y debajo, lo que el cocinero NO
 * puede pasar por alto: las OPCIONES elegidas (fichas ámbar sólidas, texto oscuro) y la NOTA
 * (recuadro con borde ámbar, texto normal). Antes la nota salía en naranja sobre naranja: aquí el
 * texto va en el color de texto del sistema sobre un fondo apenas teñido, y las fichas en la pareja
 * `advertencia` / `advertencia-texto`, ambas con contraste AA.
 */

export interface RenglonDePlatilloProps {
  readonly item: ItemDeCocina;
  readonly compacto: boolean;
  /** Si hay ficha de cocina del platillo, tocar el renglón la abre. */
  readonly onVerFicha?: ((item: ItemDeCocina) => void) | undefined;
}

function cantidadDelRenglon(item: ItemDeCocina): string {
  if (item.tipo_venta === 'porcion_contenedor') {
    const porciones = Number(item.cantidad_porciones ?? item.cantidad);
    if (Number.isFinite(porciones) && porciones > 0) {
      const nombre = (item.nombre_porcion ?? '').trim() || 'porción';
      const plural = porciones === 1 || /[sx]$/i.test(nombre) ? nombre : `${nombre}s`;
      return `${String(porciones)} ${plural}`;
    }
  }
  return cantidadParaMostrar({ ...item, cantidad: item.cantidad ?? 1 });
}

export function RenglonDePlatillo({ item, compacto, onVerFicha }: RenglonDePlatilloProps) {
  const { opciones, nota } = separarOpcionesYNota(item.notas, opcionesDelServidor(item.opciones));
  const nombre = item.producto_nombre ?? 'Producto sin nombre';
  const puedeAbrirFicha = onVerFicha !== undefined && Boolean(item.producto_id);
  const tamano = compacto ? 'text-base xl:text-lg' : 'text-lg xl:text-xl';

  const contenido = (
    <>
      <span className="text-right font-numeros font-black tabular-nums text-primario">
        {cantidadDelRenglon(item)}
      </span>
      <span className="font-semibold leading-tight">{nombre}</span>
    </>
  );

  return (
    <li
      className={`flex ${compacto ? 'flex-wrap items-baseline gap-x-(--espacio-2) gap-y-0.5' : 'flex-col gap-1'} ${tamano}`}
    >
      {puedeAbrirFicha ? (
        <button
          type="button"
          onClick={() => {
            onVerFicha(item);
          }}
          title="Ver ficha interna del platillo"
          className={`grid ${compacto ? '' : 'w-full'} grid-cols-[minmax(3ch,auto)_minmax(0,1fr)] items-baseline gap-x-(--espacio-2) rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-anillo/60`}
        >
          {contenido}
        </button>
      ) : (
        <div
          className={`grid ${compacto ? '' : 'w-full'} grid-cols-[minmax(3ch,auto)_minmax(0,1fr)] items-baseline gap-x-(--espacio-2)`}
        >
          {contenido}
        </div>
      )}
      {(opciones.length > 0 || nota !== '') && (
        <div
          className={`flex flex-wrap items-center gap-1 ${compacto ? '' : 'pl-[calc(3ch+var(--espacio-2))]'}`}
        >
          {opciones.length > 0 && (
            <ul className="contents" aria-label="Opciones elegidas">
              {opciones.map((grupo) =>
                grupo.opciones.map((opcion) => (
                  <li
                    key={`${grupo.grupo}:${opcion}`}
                    className="rounded-md bg-advertencia px-(--espacio-2) py-0.5 text-sm font-bold text-advertencia-texto xl:text-base"
                  >
                    <span className="font-medium opacity-80">{grupo.grupo}: </span>
                    {opcion}
                  </li>
                )),
              )}
            </ul>
          )}
          {nota !== '' && (
            <Superficie
              como="p"
              nivel={0}
              radio="md"
              relleno={0}
              className="max-w-full rounded-md border-2 border-dashed border-advertencia bg-advertencia/10 px-(--espacio-2) py-0.5 text-sm font-semibold text-texto xl:text-base"
            >
              <span className="sr-only">Nota: </span>
              {nota}
            </Superficie>
          )}
        </div>
      )}
    </li>
  );
}
