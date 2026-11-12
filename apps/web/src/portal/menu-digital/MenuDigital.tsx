'use client';

import { EsqueletoDeLista, Vacio } from '@morphiqpos/ui/sistema';
import { Plus, UtensilsCrossed } from 'lucide-react';

import { BarraDeSecciones } from './BarraDeSecciones';
import {
  fondoDeLaTarjeta,
  inicialDelPlatillo,
  precioDeLaTarjeta,
  seccionesDelMenu,
  type CategoriaDelMenu,
  type ProductoDelMenu,
} from './menu-digital';

import './menu-digital.css';

interface Props<P extends ProductoDelMenu> {
  readonly productos: readonly P[];
  readonly categorias: readonly CategoriaDelMenu[];
  readonly mostrarPrecios: boolean;
  /** Si el comensal puede pedir desde aquí (si no, el menú sólo se lee). */
  readonly puedePedir: boolean;
  readonly alTocar: (producto: P) => void;
  /** Mientras llega el menú (la primera lectura del portal). */
  readonly cargando?: boolean;
  /**
   * DP-18 · Siempre dos columnas, como en el teléfono: la vista previa de «Personalizar menú» vive en
   * una pantalla ancha y los cortes por ancho miran la ventana, no el marco del teléfono.
   */
  readonly comoEnElTelefono?: boolean;
}

/**
 * DP-16 · EL MENÚ DIGITAL DEL COMENSAL (3.1).
 *
 * Arriba, las categorías como fichas que se quedan pegadas y siguen a la sección que se lee; abajo,
 * cada sección con sus platillos en dos columnas: con foto, la foto entera con un degradado que deja
 * leer el nombre, la descripción corta y el precio; sin foto, el fondo que el dueño eligió en
 * Productos. Tocar abre la ficha del platillo (opciones con precio, peso, cantidad, nota). Lo
 * agotado se ve, marcado, y no se puede pedir.
 */
export function MenuDigital<P extends ProductoDelMenu>({
  productos,
  categorias,
  mostrarPrecios,
  puedePedir,
  alTocar,
  cargando = false,
  comoEnElTelefono = false,
}: Props<P>) {
  const secciones = seccionesDelMenu(productos, categorias);
  if (cargando) return <EsqueletoDeLista filas={4} />;
  if (secciones.length === 0) {
    return <Vacio icono={<UtensilsCrossed />} titulo="El menú todavía no tiene platillos." />;
  }

  return (
    <div className="flex flex-col gap-(--espacio-6)">
      {/* El hueco del carrusel de promociones: reservado y apagado (no hay promociones todavía). */}
      <div data-promociones hidden />
      <BarraDeSecciones secciones={secciones} />
      {secciones.map((s) => (
        <section
          key={s.id}
          data-seccion-del-menu={s.id}
          aria-labelledby={`seccion-${s.id}`}
          className="flex flex-col gap-(--espacio-3)"
        >
          <h2 id={`seccion-${s.id}`} className="text-xl font-black tracking-tight text-texto">
            {s.nombre}
          </h2>
          <ul
            className={
              comoEnElTelefono
                ? 'grid grid-cols-2 gap-(--espacio-3)'
                : 'grid grid-cols-2 gap-(--espacio-3) sm:grid-cols-3'
            }
          >
            {s.productos.map((p, lugar) => (
              <li key={p.id} className="min-w-0">
                <TarjetaDelPlatillo
                  producto={p}
                  lugar={lugar}
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

function TarjetaDelPlatillo({
  producto,
  lugar,
  precio,
  puedePedir,
  alTocar,
}: {
  readonly producto: ProductoDelMenu;
  readonly lugar: number;
  readonly precio: string | null;
  readonly puedePedir: boolean;
  readonly alTocar: () => void;
}) {
  const agotado = producto.agotado === true;
  const conFoto = typeof producto.imagen_url === 'string' && producto.imagen_url !== '';
  const descripcion = (producto.descripcion ?? '').trim();
  const contenido = (
    <>
      {conFoto ? (
        // Un <img> y no `next/image`: la foto viene del almacén del negocio con su propia URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={producto.imagen_url ?? ''}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 -z-10 size-full object-cover"
        />
      ) : (
        // Sin foto, la inicial grande de adorno: cada tarjeta se reconoce de un vistazo.
        <span
          aria-hidden
          className="menu-tarjeta-inicial pointer-events-none absolute -right-1 -top-4 -z-10 select-none font-black leading-none opacity-15"
        >
          {inicialDelPlatillo(producto.nombre)}
        </span>
      )}
      <span className="flex min-h-0 flex-1 flex-col justify-end gap-1 p-(--espacio-3) text-left">
        {agotado ? (
          <span className="mb-auto self-start rounded-full bg-peligro px-(--espacio-2) py-0.5 text-sm font-bold text-peligro-texto">
            Agotado hoy
          </span>
        ) : null}
        {/* Con foto, este bloque lleva su propia sombra (`menu-digital.css`): crece con el texto. */}
        <span className="menu-tarjeta-texto flex flex-col gap-1">
          <span className="line-clamp-2 text-lg font-black leading-tight">{producto.nombre}</span>
          {descripcion === '' ? null : (
            <span className="line-clamp-2 text-sm leading-snug opacity-90">{descripcion}</span>
          )}
          <span className="mt-1 flex items-center justify-between gap-(--espacio-2)">
            <span className="text-base font-bold tabular-nums">{precio ?? ''}</span>
            {puedePedir && !agotado ? (
              <span
                aria-hidden
                className="grid size-[max(2.5rem,calc(var(--altura-control)*0.9))] shrink-0 place-items-center rounded-full bg-superficie text-texto ring-1 ring-borde-fuerte/40"
              >
                <Plus className="size-5" strokeWidth={2.5} />
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </>
  );
  const clase = `menu-tarjeta ${conFoto ? 'menu-tarjeta-foto' : ''} relative flex ${conFoto ? 'aspect-[4/5]' : 'aspect-square'} w-full flex-col overflow-hidden rounded-(--radio-lg) shadow-1 ${agotado ? 'opacity-60 grayscale' : ''}`;
  const etiqueta = [producto.nombre, precio, agotado ? 'agotado hoy' : null]
    .filter(Boolean)
    .join(', ');

  if (!puedePedir || agotado) {
    return (
      <div data-fondo={conFoto ? undefined : fondoDeLaTarjeta(producto, lugar)} className={clase}>
        {contenido}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={alTocar}
      aria-label={`${etiqueta}. Ver y agregar`}
      data-fondo={conFoto ? undefined : fondoDeLaTarjeta(producto, lugar)}
      className={`${clase} transition-transform duration-(--duracion-rapida) ease-out active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-anillo motion-reduce:transition-none`}
    >
      {contenido}
    </button>
  );
}
