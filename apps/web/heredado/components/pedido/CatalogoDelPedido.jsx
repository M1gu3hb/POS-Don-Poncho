import React, { useMemo, useState } from 'react';
import { ChefHat, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import PrecioProductoMesero, { VariableBadge } from '@/components/mesero/PrecioProductoMesero';
import { tieneGrupos } from './useArmadoDelPedido';

/**
 * DP-16 · EL MENÚ PARA TOMAR UN PEDIDO: búsqueda, categorías y platillos, como en la mesa del
 * mesero (`Mesero.jsx`). Lo agotado del día se ve apagado y no entra (lo dice `agregar`).
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
  const lista = Array.isArray(productos) ? productos : [];

  const filtrados = useMemo(() => {
    let l = lista;
    if (categoria !== 'todas') l = l.filter((p) => p?.categoria_id === categoria);
    const q = busqueda.trim().toLowerCase();
    if (q) l = l.filter((p) => (p?.nombre || '').toLowerCase().includes(q));
    return l;
  }, [lista, categoria, busqueda]);

  const chip = (activo) =>
    `shrink-0 min-h-9 px-3 py-1 rounded-full text-sm font-medium ${
      activo ? 'bg-primary text-primario-texto' : 'bg-superficie border text-muted-foreground'
    }`;

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
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Categorías">
          <button type="button" onClick={() => setCategoria('todas')} className={chip(categoria === 'todas')}>
            Todas
          </button>
          {(Array.isArray(categorias) ? categorias : []).map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={chip(categoria === c.id)}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 pb-32 md:pb-3 grid grid-cols-2 lg:grid-cols-3 auto-rows-min gap-2 content-start">
        {cargando ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
            <p className="text-xs">Cargando productos…</p>
          </div>
        ) : (
          <>
            {filtrados.map((p) => {
              const agotado = p?.agotado_hoy === true;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => onTocar(p)}
                  aria-disabled={agotado}
                  className={`p-3 rounded-xl border bg-superficie text-left hover:bg-muted/30 active:scale-95 transition-all relative flex flex-col items-start ${agotado ? 'opacity-50' : ''}`}
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
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                        Opciones
                      </span>
                    )}
                    {agotado && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-peligro/15 text-peligro">
                        Agotado hoy
                      </span>
                    )}
                  </div>
                </button>
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
