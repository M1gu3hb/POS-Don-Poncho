import React, { useMemo, useState } from 'react';
import { ChefHat, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import PrecioProductoMesero, { VariableBadge } from '@/components/mesero/PrecioProductoMesero';
import { tieneGrupos } from './useArmadoDelPedido';
import { ordenarMenu } from '@morphiqpos/domain/catalogo';
import { coincideConLaBusqueda } from '~/restaurante/buscar-producto';
import { coloresPorCategoria, franjaDeLaCategoria } from '~/restaurante/rejilla/colores';
import { PestanasDeCategoria } from '~/restaurante/rejilla/PestanasDeCategoria';
import { BotonQueAgrega, useRejillaQueVuelveArriba } from '~/tacto/BotonQueAgrega';

/**
 * DP-16 · EL MENÚ PARA TOMAR UN PEDIDO: búsqueda, categorías y platillos, como en la mesa del
 * mesero (`Mesero.jsx`). Lo agotado del día se ve apagado y no entra (lo dice `agregar`).
 *
 * DP-24 · Platillos y búsqueda en EL orden del menú (`ordenarMenu`, el mismo del mesero y del portal);
 * las pestañas con su color de categoría y cada tarjeta con su franja (`rejilla/PestanasDeCategoria`).
 */
export default function CatalogoDelPedido({
  productos,
  categorias,
  cargando,
  cargados,
  onTocar,
  colorize = true,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const listaCategorias = useMemo(() => (Array.isArray(categorias) ? categorias : []), [categorias]);
  const colores = useMemo(() => coloresPorCategoria(listaCategorias), [listaCategorias]);
  const lista = useMemo(
    () => ordenarMenu(Array.isArray(productos) ? productos : [], listaCategorias),
    [productos, listaCategorias],
  );
  // DP-23 · La rejilla vuelve arriba al cambiar de categoría o de búsqueda.
  const rejillaRef = useRejillaQueVuelveArriba(`${categoria}|${busqueda}`);

  const filtrados = useMemo(() => {
    let l = lista;
    if (categoria !== 'todas') l = l.filter((p) => p?.categoria_id === categoria);
    // DP-D178 · Con acentos o sin ellos, encuentra igual.
    if (busqueda.trim()) l = l.filter((p) => coincideConLaBusqueda(p?.nombre, busqueda));
    return l;
  }, [lista, categoria, busqueda]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="px-4 py-3 space-y-2 border-b bg-muted/30 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            aria-label="Buscar producto"
            className="pl-9 h-10"
          />
        </div>
        <PestanasDeCategoria categorias={listaCategorias} elegida={categoria} alElegir={setCategoria} />
      </div>
      <div
        ref={rejillaRef}
        data-rejilla-de-platillos=""
        className="flex-1 overflow-y-auto p-3 pb-32 md:pb-3 grid grid-cols-2 lg:grid-cols-3 auto-rows-min gap-2 content-start"
      >
        {cargando ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
            <p className="text-xs">Cargando productos…</p>
          </div>
        ) : (
          <>
            {filtrados.map((p) => {
              const agotado = p?.agotado_hoy === true;
              const franja = franjaDeLaCategoria(colores, p?.categoria_id);
              return (
                <BotonQueAgrega
                  key={p.id}
                  alAgregar={() => onTocar(p)}
                  aria-disabled={agotado}
                  className={`p-3 rounded-xl border bg-superficie text-left hover:bg-muted/30 active:bg-muted/60 transition-all relative flex flex-col items-start ${franja.className} ${agotado ? 'opacity-50' : ''}`}
                  data-categoria-color={franja['data-categoria-color']}
                >
                  <p className="font-semibold text-sm leading-tight">{p?.nombre}</p>
                  <PrecioProductoMesero producto={p} colorize={colorize} />
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <ChefHat className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground capitalize">
                      {p?.area_preparacion || 'cocina'}
                    </span>
                    <VariableBadge producto={p} />
                    {tieneGrupos(p) && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/5 text-primary">
                        Opciones
                      </span>
                    )}
                    {agotado && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-peligro/15 text-peligro">
                        Agotado hoy
                      </span>
                    )}
                  </div>
                </BotonQueAgrega>
              );
            })}
            {filtrados.length === 0 && lista.length > 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">
                Sin resultados para tu búsqueda
              </p>
            )}
            {lista.length === 0 && cargados && (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">
                Sin productos disponibles
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
