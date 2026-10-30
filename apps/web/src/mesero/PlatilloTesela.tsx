'use client';

import { Dinero, Superficie, dineroEnTexto } from '@morphiqpos/ui/sistema';
import { ChefHat, UtensilsCrossed } from 'lucide-react';
import { memo, type ReactElement } from 'react';

import { TIPO_VENTA } from '../../heredado/utils/tipoVentaUtils.js';
import { centavosDe } from '../cliente/dinero-del-puente';

import { productoTieneModificadores, type ProductoDelMenu } from './borrador-de-la-mesa';
import { textoDe } from './texto';

/**
 * UN PLATILLO DE LA CUADRÍCULA: un botón sólido que se toca para agregarlo al pedido.
 *
 * Es el elemento que más hay en la pantalla —107 en el menú real— y por eso está memoizado: sus
 * propiedades son el platillo (el mismo objeto mientras el catálogo no cambie), si el importe va
 * en el color del estilo y la función de agregar, que no cambia. Un toque, una tecla del buscador
 * o un sondeo de las mesas ya no lo vuelven a pintar.
 *
 * Con su foto si el platillo la tiene; si no, el marcador de la marca. El nombre accesible es
 * «Nombre $importe área» (la prueba de navegador busca `^Nombre \$`): el importe se dice con
 * `dineroEnTexto` porque `<Dinero>` se lee «329 pesos con 00 centavos».
 */

type CampoDePrecio = 'precio_venta' | 'precio_por_unidad_variable' | 'precio_por_porcion';

interface PrecioDelPlatillo {
  readonly centavos: number;
  /** «/ kg», «/ copa»: la medida en que se vende, si no es por pieza. */
  readonly medida: string;
}

function precioDe(producto: ProductoDelMenu): PrecioDelPlatillo {
  const centavosDeCampo = (campo: CampoDePrecio): number =>
    centavosDe('ProductoTerminado', campo, producto[campo]) ?? 0;
  if (producto.tipo_venta === TIPO_VENTA.VARIABLE_MEDIDA) {
    return {
      centavos: centavosDeCampo('precio_por_unidad_variable'),
      medida: textoDe(producto['unidad_variable'], 'g'),
    };
  }
  if (producto.tipo_venta === TIPO_VENTA.PORCION_CONTENEDOR) {
    return {
      centavos: centavosDeCampo('precio_por_porcion'),
      medida: textoDe(producto['nombre_porcion'], 'porción'),
    };
  }
  return { centavos: centavosDeCampo('precio_venta'), medida: '' };
}

function aviso(producto: ProductoDelMenu): 'Variable' | 'Por porción' | null {
  if (producto.tipo_venta === TIPO_VENTA.VARIABLE_MEDIDA) return 'Variable';
  if (producto.tipo_venta === TIPO_VENTA.PORCION_CONTENEDOR) return 'Por porción';
  return null;
}

export interface PlatilloTeselaProps {
  readonly producto: ProductoDelMenu;
  /** El importe en el color del estilo (`colorear_importes_monetarios`) o en el del texto. */
  readonly colorear: boolean;
  readonly alElegir: (producto: ProductoDelMenu) => void;
}

function PlatilloTeselaSinMemo({
  producto,
  colorear,
  alElegir,
}: PlatilloTeselaProps): ReactElement {
  const precio = precioDe(producto);
  const variable = aviso(producto);
  const conOpciones = productoTieneModificadores(producto);
  const area = textoDe(producto.area_preparacion, 'cocina');
  const nombre = producto.nombre ?? '';
  const foto = typeof producto['imagen_url'] === 'string' ? producto['imagen_url'] : '';
  const dicho = [
    nombre,
    `${dineroEnTexto(precio.centavos)}${precio.medida === '' ? '' : ` / ${precio.medida}`}`,
    area,
    variable,
    conOpciones ? 'Opciones' : null,
  ]
    .filter((parte) => parte !== null && parte !== '')
    .join(' ');

  return (
    <Superficie
      como="button"
      type="button"
      nivel={1}
      relleno={3}
      radio="lg"
      interactiva
      aria-label={dicho}
      onClick={() => {
        alElegir(producto);
      }}
      className="flex w-full items-start gap-(--espacio-3)"
    >
      {foto === '' ? (
        // El marcador de la marca: un cuadro del color suave del estilo con el cubierto cruzado.
        <span
          aria-hidden="true"
          className="flex size-(--altura-control) shrink-0 items-center justify-center rounded-md bg-acento-suave text-acento-suave-texto"
        >
          <UtensilsCrossed className="size-5" />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- la foto viene del almacén del negocio, fuera de `next/image`
        <img
          src={foto}
          alt=""
          width={44}
          height={44}
          loading="lazy"
          decoding="async"
          className="size-(--altura-control) shrink-0 rounded-md object-cover"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="block text-sm leading-tight font-semibold">{nombre}</span>
        <span className="block">
          <Dinero
            centavos={precio.centavos}
            tamano="sm"
            className={`font-bold ${colorear ? 'text-primario' : 'text-texto'}`}
          />
          {precio.medida === '' ? null : (
            <span className="ml-1 text-xs font-medium opacity-70">/ {precio.medida}</span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-1 text-xs text-texto-sutil">
          <ChefHat aria-hidden="true" className="size-3" />
          <span className="capitalize">{area}</span>
          {variable === null ? null : (
            <span className="rounded-full bg-advertencia/15 px-1.5 py-0.5 text-xs font-bold text-advertencia">
              {variable}
            </span>
          )}
          {conOpciones ? (
            <span className="rounded-full bg-primario/15 px-1.5 py-0.5 text-xs font-bold text-primario">
              Opciones
            </span>
          ) : null}
        </span>
      </span>
    </Superficie>
  );
}

export const PlatilloTesela = memo(PlatilloTeselaSinMemo);
