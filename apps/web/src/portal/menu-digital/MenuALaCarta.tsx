'use client';

import { EsqueletoDeLista, Vacio } from '@morphiqpos/ui/sistema';
import { Plus, UtensilsCrossed } from 'lucide-react';

import { BarraDeSecciones } from './BarraDeSecciones';
import {
  precioDeLaTarjeta,
  seccionesDelMenu,
  type CategoriaDelMenu,
  type ProductoDelMenu,
} from './menu-digital';

/**
 * DP-16 · EL MENÚ «A LA CARTA», mejorado (3.2).
 *
 * Como una carta impresa: todas las secciones seguidas, con la barra de secciones arriba para saltar
 * entre ellas, letra grande, el nombre y el precio en la misma línea y el botón «+» alineado con el
 * precio. Sin fotos que empujen el texto; la foto, si la hay, va pequeña a la izquierda.
 */
export function MenuALaCarta<P extends ProductoDelMenu>({
  productos,
  categorias,
  mostrarPrecios,
  mostrarSinImagen,
  puedePedir,
  alTocar,
  cargando = false,
}: {
  readonly productos: readonly P[];
  readonly categorias: readonly CategoriaDelMenu[];
  readonly mostrarPrecios: boolean;
  readonly mostrarSinImagen: boolean;
  readonly puedePedir: boolean;
  readonly alTocar: (producto: P) => void;
  /** Mientras llega el menú (la primera lectura del portal). */
  readonly cargando?: boolean;
}) {
  const visibles = mostrarSinImagen
    ? productos
    : productos.filter((p) => typeof p.imagen_url === 'string' && p.imagen_url !== '');
  const secciones = seccionesDelMenu(visibles, categorias);
  if (cargando) return <EsqueletoDeLista filas={4} />;
  if (secciones.length === 0) {
    return <Vacio icono={<UtensilsCrossed />} titulo="El menú todavía no tiene platillos." />;
  }
  return (
    <div className="flex flex-col gap-(--espacio-6)">
      <BarraDeSecciones secciones={secciones} />
      {secciones.map((s) => (
        <section
          key={s.id}
          data-seccion-del-menu={s.id}
          aria-labelledby={`carta-${s.id}`}
          className="flex flex-col"
        >
          <h2
            id={`carta-${s.id}`}
            className="border-b-2 border-texto pb-(--espacio-2) text-xl font-black tracking-tight text-texto"
          >
            {s.nombre}
          </h2>
          <ul className="flex flex-col divide-y divide-borde">
            {s.productos.map((p) => (
              <li key={p.id}>
                <Renglon
                  producto={p}
                  precio={precioDeLaTarjeta(p, mostrarPrecios)}
                  puedePedir={puedePedir}
                  alTocar={() => {
                    alTocar(p);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Renglon({
  producto,
  precio,
  puedePedir,
  alTocar,
}: {
  readonly producto: ProductoDelMenu;
  readonly precio: string | null;
  readonly puedePedir: boolean;
  readonly alTocar: () => void;
}) {
  const agotado = producto.agotado === true;
  const descripcion = (producto.descripcion ?? '').trim();
  const conFoto = typeof producto.imagen_url === 'string' && producto.imagen_url !== '';
  const activo = puedePedir && !agotado;
  const cuerpo = (
    <>
      {conFoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={producto.imagen_url ?? ''}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-16 shrink-0 rounded-(--radio-md) object-cover"
        />
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="flex items-baseline justify-between gap-(--espacio-3)">
          <span className="min-w-0 text-lg font-bold leading-tight text-texto">
            {producto.nombre}
          </span>
          {precio === null ? null : (
            <span className="shrink-0 text-lg font-bold tabular-nums text-texto">{precio}</span>
          )}
        </span>
        {descripcion === '' ? null : (
          <span className="text-base leading-snug text-texto-sutil">{descripcion}</span>
        )}
        {agotado ? (
          <span className="self-start rounded-full bg-peligro/15 px-(--espacio-2) py-0.5 text-sm font-bold text-peligro">
            Agotado hoy
          </span>
        ) : null}
      </span>
      {activo ? (
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center self-center rounded-full bg-primario text-primario-texto"
        >
          <Plus className="size-5" strokeWidth={2.5} />
        </span>
      ) : null}
    </>
  );
  const clase = `flex w-full items-center gap-(--espacio-3) py-(--espacio-4) ${agotado ? 'opacity-60' : ''}`;
  if (!activo) return <div className={clase}>{cuerpo}</div>;
  return (
    <button
      type="button"
      onClick={alTocar}
      aria-label={`${[producto.nombre, precio].filter(Boolean).join(', ')}. Ver y agregar`}
      className={`${clase} rounded-(--radio-md) transition-colors duration-(--duracion-rapida) hover:bg-fondo-sutil focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anillo`}
    >
      {cuerpo}
    </button>
  );
}
