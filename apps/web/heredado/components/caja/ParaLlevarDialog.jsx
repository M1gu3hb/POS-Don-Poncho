import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShoppingBag, X } from 'lucide-react';

import { api, nuevaClave } from '@/api/cliente';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProductoFichaExpandible from '@/components/mesero/ProductoFichaExpandible';
import SeleccionModificadoresDialog from '@/components/mesero/SeleccionModificadoresDialog';
import CantidadVariableDialog from '@/components/mesero/CantidadVariableDialog';
import OpcionesNoLeidasDialog from '@/components/mesero/OpcionesNoLeidasDialog';
import { formatCurrency } from '@/utils/financialUtils';
import CatalogoDelPedido from '@/components/pedido/CatalogoDelPedido';
import { useArmadoDelPedido } from '@/components/pedido/useArmadoDelPedido';
import { Aviso } from '@morphiqpos/ui/sistema';
import { claveDelBorrador } from '~/restaurante/borrador-del-pedido';
import { pedidoSinTerminar } from '~/restaurante/pedido-sin-terminar';
import { conSusOpciones } from '~/restaurante/opciones-de-los-platillos';
import { useOpcionesDeLosPlatillos } from '~/restaurante/use-opciones-de-los-platillos';
import {
  apartarAgotados,
  avisoDeAgotados,
  esRechazoPorAgotado,
} from '~/restaurante/apartar-agotados';
import {
  porcionesQueNoSeVenden,
  porcionesQueNoSeVendenAviso,
  renglonParaElComando,
} from '~/restaurante/toma-de-pedido/renglon-para-el-comando';

/** El borrador del pedido para llevar es uno por persona en este aparato. */
export const ORDEN_DEL_BORRADOR_PARA_LLEVAR = 'para-llevar';
export const claveDelParaLlevar = (usuarioId) =>
  usuarioId ? claveDelBorrador(usuarioId, ORDEN_DEL_BORRADOR_PARA_LLEVAR) : null;

/**
 * DP-16 · EL PEDIDO PARA LLEVAR, desde la Caja.
 *
 * La misma toma de pedido del mesero —categorías, búsqueda, opciones obligatorias, notas, barbacoa
 * por peso, agotados y el borrador que sobrevive a una recarga— pero sin mesa. «Cobrar» escribe el
 * pedido en el servidor (`restaurante.armar_para_llevar`, sin mandar nada a cocina) y la Caja abre
 * su diálogo de cobro de siempre; la comanda sale con el cobro, en la misma transacción.
 */
export default function ParaLlevarDialog({
  open,
  usuarioId,
  volviendoDelCobro = false,
  onCerrar,
  onCobrar,
}) {
  const queryClient = useQueryClient();
  const [armando, setArmando] = useState(false);
  const [verPedido, setVerPedido] = useState(false);
  const [decidido, setDecidido] = useState(false);

  const productosQ = useQuery({
    queryKey: ['productos_pos'],
    queryFn: () => api.entidades.ProductoTerminado.filter({ activo: true, visible_en_pos: true }),
    placeholderData: (prev) => prev,
    staleTime: 5000,
    refetchInterval: 30_000,
    enabled: open,
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api.entidades.CategoriaProducto.filter({ activo: true }, 'orden'),
    initialData: [],
    enabled: open,
  });
  const { opciones, listas } = useOpcionesDeLosPlatillos();
  const productos = conSusOpciones(
    Array.isArray(productosQ.data) ? productosQ.data : [],
    opciones,
  );

  const pedido = useArmadoDelPedido({
    claveDelAparato: claveDelParaLlevar(usuarioId),
    ordenDelBorrador: ORDEN_DEL_BORRADOR_PARA_LLEVAR,
    opcionesListas: listas,
  });
  const { carrito, total, dialogos } = pedido;
  // DP-18 · A7 · Un borrador que quedó de antes no se mezcla en silencio con el pedido nuevo.
  const sinTerminar = pedidoSinTerminar({
    recuperado: pedido.recuperado,
    volviendoDelCobro,
    decidido,
  });
  const piezas = carrito.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);

  /** Lo agotado se aparta y se avisa; la cajera revisa y vuelve a tocar «Cobrar». */
  const apartarLoAgotado = async () => {
    try {
      const menu = await queryClient.fetchQuery({
        queryKey: ['productos_pos'],
        queryFn: () =>
          api.entidades.ProductoTerminado.filter({ activo: true, visible_en_pos: true }),
        staleTime: 0,
      });
      const { quedan, apartados } = apartarAgotados(carrito, Array.isArray(menu) ? menu : []);
      if (apartados.length === 0) return false;
      pedido.setCarrito([...quedan]);
      toast.warning(`${avisoDeAgotados(apartados)} Revisa el pedido y vuelve a cobrar.`, {
        duration: 10000,
      });
      return true;
    } catch {
      return false;
    }
  };

  const cobrar = async () => {
    if (carrito.length === 0) {
      toast.error('El pedido está vacío');
      return;
    }
    const lineas = [];
    for (const item of carrito) {
      const linea = renglonParaElComando(item);
      if (linea === null) {
        if (porcionesQueNoSeVenden(item)) {
          toast.error(porcionesQueNoSeVendenAviso(item));
          return;
        }
        toast.error(`La cantidad de ${item?.nombre || 'un producto'} no es válida.`);
        return;
      }
      lineas.push(linea);
    }
    setArmando(true);
    try {
      const nombre = pedido.nota.trim();
      const armado = await api.comandos.ejecutar(
        '/api/restaurante/armar-para-llevar',
        { ...(nombre ? { nombrePedido: nombre } : {}), lineas },
        nuevaClave(),
      );
      await onCobrar(armado.ordenId);
    } catch (err) {
      if (esRechazoPorAgotado(err) && (await apartarLoAgotado())) return;
      toast.error(err?.message || 'No se pudo preparar el cobro. Intenta de nuevo.');
    } finally {
      setArmando(false);
    }
  };

  const lista = (
    <div className="space-y-2">
      {carrito.map((item) => (
        <ProductoFichaExpandible
          key={item._linea}
          item={item}
          onCambiarCantidad={(_id, delta) => pedido.cambiarCantidad(item._linea, delta)}
          onUpdateNotas={(_id, notas) => pedido.cambiarNotas(item._linea, notas)}
          onUpdateExclusiones={(_id, ex) => pedido.cambiarExclusiones(item._linea, ex)}
        />
      ))}
    </div>
  );

  const botonCobrar = (
    <Button
      onClick={cobrar}
      disabled={armando || carrito.length === 0}
      className="w-full min-h-14 text-lg font-bold"
    >
      {armando ? 'Preparando el cobro…' : `Cobrar ${formatCurrency(total)}`}
    </Button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(abierto) => !abierto && onCerrar()}>
        <DialogContent
          className="max-w-6xl w-[100vw] sm:w-[96vw] h-[100dvh] sm:h-[94vh] p-0 gap-0 flex flex-col overflow-hidden [&>button.absolute]:hidden"
          aria-describedby="para-llevar-descripcion"
        >
          <header className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-lg sm:text-xl font-black leading-tight">
                Pedido para llevar
              </DialogTitle>
              <DialogDescription id="para-llevar-descripcion" className="text-xs">
                El número se asigna al cobrar. Nada sale a cocina hasta cobrarlo.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCerrar}
              aria-label="Cerrar sin cobrar (el pedido se guarda)"
              className="shrink-0 min-h-11 min-w-11"
            >
              <X className="w-5 h-5" />
            </Button>
          </header>
          <div className="px-4 py-2 border-b shrink-0 flex items-center gap-2">
            <Label htmlFor="para-llevar-nombre" className="shrink-0 text-sm">
              Nombre
            </Label>
            <Input
              id="para-llevar-nombre"
              value={pedido.nota}
              onChange={(e) => pedido.setNota(e.target.value.slice(0, 60))}
              placeholder="Opcional: ¿a nombre de quién?"
              autoComplete="off"
              className="h-10"
            />
          </div>

          {sinTerminar ? (
            <div className="flex-1 overflow-y-auto p-4">
              <Aviso
                tono="atencion"
                titulo="Quedó un pedido sin terminar"
                accion={
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setDecidido(true)}>Retomarlo</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        pedido.vaciar();
                        setDecidido(true);
                      }}
                    >
                      Descartarlo y empezar uno nuevo
                    </Button>
                  </div>
                }
              >
                Hay {piezas} {piezas === 1 ? 'pieza' : 'piezas'} ({formatCurrency(total)}) de un pedido
                para llevar que no se terminó. Antes de empezar otro, di si es el mismo (retómalo) o si
                ya no sirve (descártalo): así no se cobra dos veces.
              </Aviso>
            </div>
          ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
            <CatalogoDelPedido
              productos={productos}
              categorias={categorias}
              cargando={!productosQ.isFetched && productosQ.isLoading}
              cargados={productosQ.isFetched}
              onTocar={pedido.agregar}
            />
            <aside className="hidden md:flex w-80 lg:w-96 flex-col border-l shrink-0 min-h-0">
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  PEDIDO ({piezas})
                </p>
                {carrito.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Toca los platillos para agregarlos
                  </p>
                ) : (
                  lista
                )}
              </div>
              <div className="px-4 py-3 border-t shrink-0">{botonCobrar}</div>
            </aside>
          </div>
          )}

          {/* Teléfono: la barra de abajo con el pedido y el cobro siempre a la mano. */}
          <div
            className={
              sinTerminar
                ? 'hidden'
                : 'md:hidden border-t px-3 py-2 flex gap-2 shrink-0 bg-background'
            }
          >
            <Button
              variant="outline"
              className="min-h-14 shrink-0"
              onClick={() => setVerPedido(true)}
              disabled={carrito.length === 0}
            >
              Ver pedido ({piezas})
            </Button>
            <div className="flex-1">{botonCobrar}</div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={verPedido && open} onOpenChange={setVerPedido}>
        <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col">
          <DialogTitle>Pedido para llevar ({piezas})</DialogTitle>
          <DialogDescription className="sr-only">Lo que lleva el pedido</DialogDescription>
          <div className="flex-1 overflow-y-auto">{lista}</div>
          <div className="pt-2">{botonCobrar}</div>
        </DialogContent>
      </Dialog>

      <OpcionesNoLeidasDialog
        lectura={dialogos.lecturaDeOpciones}
        onCerrar={dialogos.cerrarLectura}
        onReintentar={dialogos.reintentarLectura}
      />
      <SeleccionModificadoresDialog
        key={dialogos.turnoDePersonalizar}
        producto={dialogos.productoParaPersonalizar}
        precioBase={dialogos.productoParaPersonalizar?._variablePendiente?.precio_total_linea}
        open={!!dialogos.productoParaPersonalizar}
        onClose={dialogos.cerrarPersonalizacion}
        onConfirm={dialogos.confirmarPersonalizacion}
      />
      <CantidadVariableDialog
        open={!!dialogos.productoVariable}
        producto={dialogos.productoVariable}
        onClose={dialogos.cerrarVariable}
        onConfirm={dialogos.confirmarCantidadVariable}
      />
    </>
  );
}
