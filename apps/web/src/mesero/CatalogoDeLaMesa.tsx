'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { ErrorDePantalla, EsqueletoDeLista, Vacio } from '@morphiqpos/ui/sistema';
import { Search, UtensilsCrossed } from 'lucide-react';
import { memo, useDeferredValue, useMemo, type ReactElement } from 'react';

import type { AlmacenDelBorrador } from './almacen-del-borrador';
import { filtrarPlatillos, type ProductoDelMenu } from './borrador-de-la-mesa';
import { PlatilloTesela } from './PlatilloTesela';
import { useBorrador } from './use-borrador-de-la-mesa';

export interface CategoriaDelMenu {
  readonly id: string;
  readonly nombre: string;
}

export interface CatalogoDeLaMesaProps {
  readonly borrador: AlmacenDelBorrador;
  readonly productos: readonly ProductoDelMenu[];
  readonly categorias: readonly CategoriaDelMenu[];
  /** La primera lectura del catálogo todavía no llega. */
  readonly cargando: boolean;
  /** La lectura terminó (aunque haya traído cero platillos). */
  readonly leido: boolean;
  /** La lectura falló. */
  readonly sinLeer: boolean;
  readonly colorear: boolean;
  readonly alElegir: (producto: ProductoDelMenu) => void;
  readonly alReintentar: () => void;
}

/** La lista con que arranca el primer dibujo: el diálogo abre primero y los platillos llegan detrás. */
const SIN_PLATILLOS: readonly ProductoDelMenu[] = [];

/**
 * EL CATÁLOGO DE LA MESA ABIERTA: el buscador, las categorías y la cuadrícula de platillos.
 *
 * ── Qué cuesta abrir una mesa, y qué se hizo ──────────────────────────────
 *   1 · El catálogo ya no se redibuja con cada toque al carrito ni cada sondeo: el borrador está
 *       fuera de `Mesero`, y aquí sólo se lee la búsqueda y la categoría.
 *   2 · Cada platillo está memoizado (`PlatilloTesela`) y recibe la misma función de agregar.
 *   3 · La lista se pinta en DOS tiempos (`useDeferredValue` con valor inicial vacío): el primer
 *       dibujo es el diálogo con su esqueleto —se abre a 60 cuadros— y los 107 botones llegan
 *       en un dibujo de baja prioridad que se interrumpe si el mesero ya está tocando. Al teclear,
 *       la lista anterior se queda hasta que la nueva está lista: el campo nunca espera a los botones.
 */
function CatalogoDeLaMesaSinMemo({
  borrador,
  productos,
  categorias,
  cargando,
  leido,
  sinLeer,
  colorear,
  alElegir,
  alReintentar,
}: CatalogoDeLaMesaProps): ReactElement {
  const busqueda = useBorrador(borrador, (e) => e.busqueda);
  const categoria = useBorrador(borrador, (e) => e.categoria);
  const filtrados = useMemo(
    () => filtrarPlatillos(productos, categoria, busqueda),
    [productos, categoria, busqueda],
  );
  const visibles = useDeferredValue(filtrados, SIN_PLATILLOS);
  // Sólo el primer dibujo, cuando hay platillos que aún no llegan: al teclear se conserva la lista.
  const preparando = visibles === SIN_PLATILLOS && filtrados.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:border-r">
      <div className="shrink-0 space-y-2 border-b bg-fondo-sutil/50 px-(--espacio-4) py-(--espacio-3)">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-texto-sutil"
          />
          <Input
            value={busqueda}
            onChange={(evento) => {
              borrador.ponerBusqueda(evento.target.value);
            }}
            placeholder="Buscar producto..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Button
            type="button"
            size="sm"
            variant={categoria === 'todas' ? 'default' : 'outline'}
            aria-pressed={categoria === 'todas'}
            onClick={() => {
              borrador.ponerCategoria('todas');
            }}
            className="shrink-0 rounded-full"
          >
            Todas
          </Button>
          {categorias.map((c) => (
            <Button
              key={c.id}
              type="button"
              size="sm"
              variant={categoria === c.id ? 'default' : 'outline'}
              aria-pressed={categoria === c.id}
              onClick={() => {
                borrador.ponerCategoria(c.id);
              }}
              className="shrink-0 rounded-full"
            >
              {c.nombre}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-(--espacio-3) pb-32 md:pb-(--espacio-3)">
        {sinLeer && productos.length === 0 ? (
          <div className="col-span-2">
            <ErrorDePantalla
              titulo="No se pudo leer el menú."
              queHacer="Revisa la conexión y vuelve a intentarlo. Lo que ya pediste no se perdió."
              reintentar={
                <Button type="button" size="sm" variant="outline" onClick={alReintentar}>
                  Volver a intentar
                </Button>
              }
            />
          </div>
        ) : cargando || preparando ? (
          <div className="col-span-2">
            <EsqueletoDeLista filas={5} />
          </div>
        ) : (
          <>
            {visibles.map((producto) => (
              <PlatilloTesela
                key={producto.id}
                producto={producto}
                colorear={colorear}
                alElegir={alElegir}
              />
            ))}
            {filtrados.length === 0 && productos.length > 0 ? (
              <div className="col-span-2">
                <Vacio
                  tamano="compacto"
                  icono={<Search />}
                  titulo="Sin resultados para tu búsqueda"
                />
              </div>
            ) : null}
            {productos.length === 0 && leido ? (
              <div className="col-span-2">
                <Vacio
                  tamano="compacto"
                  icono={<UtensilsCrossed />}
                  titulo="Sin productos disponibles"
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Memoizado: sus propiedades son estables, así que un sondeo de las mesas no lo toca. */
export const CatalogoDeLaMesa = memo(CatalogoDeLaMesaSinMemo);
