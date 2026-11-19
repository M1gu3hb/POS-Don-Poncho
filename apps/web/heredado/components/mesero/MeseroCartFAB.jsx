'use client';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ArrowLeftRight, Printer, ShoppingCart, Send, X, Receipt } from 'lucide-react';
import { Link } from '@/enrutado';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import ProductoFichaExpandible from './ProductoFichaExpandible';

/**
 * Barra inferior horizontal de carrito + bottom sheet para Mesero en móvil.
 * Expone via ref:  { close: () => void, isOpen: () => boolean }
 * para que el padre pueda cerrar el sheet ANTES de desmontar el Dialog de mesa
 * (evita conflictos de removeChild entre AnimatePresence y Radix Portal).
 */
const MeseroCartFAB = forwardRef(function MeseroCartFAB(
  {
    carrito,
    totalCarrito,
    totalActual,
    detallesVenta,
    notaMesa,
    setNotaMesa,
    cambiarCantidad,
    enviarPedido,
    pedirCuenta,
    loading,
    estadoMesa,
    ventaActiva,
    formatCurrency,
    config,
    onUpdateNotas,
    onUpdateExclusiones,
    // DP-22 · «Cambiar de mesa» también aquí: en el teléfono el pedido de la mesa vive en esta hoja
    // y el panel de la tableta (donde estaba el botón) no se pinta. La regla la decide la página.
    puedeCambiarDeMesa = false,
    alCambiarDeMesa,
    // DP-22 · Con la cuenta ya pedida, el camino a la pantalla Precuenta para imprimir otra hoja
    // (`null` si la cuenta aún no se pide). Lo arma la página.
    hrefDeLaPrecuenta = null,
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  // DP-22 · Hallazgo 34: con el teclado en pantalla abierto (un campo con el foco), la barra flotante
  // tapaba la parte baja de la primera tarjeta del resultado. Mientras se escribe se esconde.
  const [escribiendo, setEscribiendo] = useState(false);

  useEffect(() => {
    const esCampoDeTexto = (el) =>
      el instanceof HTMLElement &&
      el.matches(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]',
      );
    const alEntrar = (evento) => setEscribiendo(esCampoDeTexto(evento.target));
    const alSalir = () => setEscribiendo(false);
    document.addEventListener('focusin', alEntrar);
    document.addEventListener('focusout', alSalir);
    return () => {
      document.removeEventListener('focusin', alEntrar);
      document.removeEventListener('focusout', alSalir);
    };
  }, []);

  // Si la hoja se cierra con el foco dentro de un campo que desaparece, el navegador no siempre avisa
  // (`focusout`): se vuelve a mirar quién tiene el foco, para que la barra no se quede escondida.
  useEffect(() => {
    if (open) return;
    const activo = document.activeElement;
    setEscribiendo(
      activo instanceof HTMLElement &&
        activo.matches('input:not([type="checkbox"]):not([type="radio"]), textarea'),
    );
  }, [open]);

  // DP-22 · Lote 8: al quitar el último renglón del carrito la hoja se cierra sola. Antes se quedaba
  // abierta, con el velo encima de los platillos, hasta que se tocaba el velo. Sólo se cierra al PASAR
  // de «con renglones» a «vacío»: una hoja abierta a propósito con el carrito vacío (para pedir la
  // cuenta o cambiar de mesa) no se toca.
  const piezasEnElCarrito = (Array.isArray(carrito) ? carrito : []).reduce(
    (suma, renglon) => suma + (renglon?.cantidad || 0),
    0,
  );
  const piezasDeAntes = useRef(piezasEnElCarrito);
  useEffect(() => {
    if (piezasDeAntes.current > 0 && piezasEnElCarrito === 0) setOpen(false);
    piezasDeAntes.current = piezasEnElCarrito;
  }, [piezasEnElCarrito]);

  useImperativeHandle(
    ref,
    () => ({
      close: () => setOpen(false),
      isOpen: () => open,
    }),
    [open],
  );

  const safeCarrito = Array.isArray(carrito) ? carrito : [];
  const safeDetalles = Array.isArray(detallesVenta) ? detallesVenta : [];
  const safeTotalCarrito = Number.isFinite(totalCarrito) ? totalCarrito : 0;
  const safeTotalActual = Number.isFinite(totalActual) ? totalActual : 0;
  const fmt =
    typeof formatCurrency === 'function' ? formatCurrency : (n) => `$${(n || 0).toFixed(2)}`;
  const cantidad = safeCarrito.reduce((s, i) => s + (i?.cantidad || 0), 0);
  const puedePedirCuenta =
    !!ventaActiva && safeCarrito.length === 0 && estadoMesa !== 'cuenta_solicitada';
  // DP-22 · Hallazgo 38: con la cuenta ya pedida la barra se queda si hay algo que ofrecer: cambiar de
  // mesa (el servidor lo permite) o imprimir otra hoja de la precuenta.
  const cuentaPedida = estadoMesa === 'cuenta_solicitada';
  const visible =
    cantidad > 0 ||
    puedePedirCuenta ||
    (cuentaPedida && (puedeCambiarDeMesa || hrefDeLaPrecuenta !== null));

  if (!visible) return null;

  const isCart = cantidad > 0;
  // DP-3: los del estilo, planos —el primario con carrito, el acento con la mesa abierta—.
  // Antes eran un rojo y el azul de Morphiq fijos, con degradado, encima de cualquier estilo.
  const colorMain = isCart ? 'hsl(var(--primario))' : 'hsl(var(--acento))';
  const colorMainEnd = colorMain;

  return (
    <>
      {/* Barra inferior horizontal — móvil (escondida mientras se escribe: ver `escribiendo`) */}
      {!escribiendo && (
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="md:hidden fixed left-3 z-[58]"
        style={{
          right: 'calc(72px + env(safe-area-inset-right, 0px))',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 pl-4 pr-3 py-3 rounded-2xl text-white shadow-2xl active:scale-[0.98] transition-transform"
          style={{
            background: `linear-gradient(135deg, ${colorMain} 0%, ${colorMainEnd} 100%)`,
            boxShadow: '0 12px 28px rgba(0,0,0,0.38), 0 1px 0 rgba(255,255,255,0.25) inset',
          }}
        >
          <div className="relative shrink-0">
            {isCart ? <ShoppingCart className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
            {isCart && (
              <span
                className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-superficie text-[10px] font-black flex items-center justify-center"
                style={{ color: 'hsl(var(--primario))' }}
              >
                {cantidad}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[11px] font-medium opacity-90 leading-tight">
              {isCart
                ? `${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}`
                : cuentaPedida
                  ? 'Cuenta pedida'
                  : 'Mesa abierta'}
            </p>
            <p className="font-heading font-black text-base leading-tight truncate">
              {isCart
                ? `${fmt(safeTotalCarrito)} · Ver pedido`
                : cuentaPedida
                  ? 'Ver pedido'
                  : 'Solicitar cuenta'}
            </p>
          </div>
          <span className="shrink-0 px-3 py-1.5 rounded-xl bg-white/20 text-xs font-bold">
            {isCart ? 'Confirmar' : 'Abrir'}
          </span>
        </button>
      </motion.div>
      )}

      {/* Bottom sheet */}
      <AnimatePresence>
        {open && (
          <motion.div key="mesero-cart-sheet-wrapper" initial={false} className="md:hidden">
            <motion.div
              key="mesero-cart-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[65] bg-velo/55"
            />
            <motion.div
              key="mesero-cart-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-x-0 bottom-0 z-[66] bg-superficie rounded-t-3xl shadow-2xl flex flex-col max-h-[88dvh]"
            >
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  <p className="font-heading font-bold text-sm">
                    {safeDetalles.length > 0 ? 'Pedido de la mesa' : 'Nuevo pedido'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-11 h-11 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {safeDetalles.length > 0 && (
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">
                      Ya enviado a cocina
                    </p>
                    {safeDetalles.map((d, i) => (
                      <div
                        key={d?.id || `det-${i}`}
                        className="flex justify-between text-xs py-0.5"
                      >
                        <span className="text-muted-foreground">
                          {d?.producto_nombre || '—'} ×{d?.cantidad || 0}
                        </span>
                        <span className="font-medium">{fmt(d?.subtotal || 0)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-bold border-t pt-1 mt-1">
                      <span>Subtotal enviado</span>
                      <span>{fmt(safeTotalActual)}</span>
                    </div>
                  </div>
                )}

                {safeCarrito.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      {safeDetalles.length > 0 ? 'Agregar al pedido' : 'Productos'}
                    </p>
                    {safeCarrito.map((item, i) => (
                      <ProductoFichaExpandible
                        key={item?.id || `cart-${i}`}
                        item={item}
                        onCambiarCantidad={cambiarCantidad}
                        onUpdateNotas={onUpdateNotas}
                        onUpdateExclusiones={onUpdateExclusiones}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Aún no agregas productos
                  </p>
                )}

                {safeCarrito.length > 0 && (
                  <div>
                    <Input
                      value={notaMesa || ''}
                      onChange={(e) => setNotaMesa?.(e.target.value)}
                      placeholder="Nota para cocina..."
                      className="text-xs h-10"
                    />
                  </div>
                )}
              </div>

              <div
                className="px-4 py-3 border-t space-y-2 shrink-0 bg-superficie"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              >
                {safeCarrito.length > 0 && (
                  <>
                    <div className="flex justify-between font-black text-base">
                      <span>Nuevo</span>
                      <span
                        className={
                          config?.colorear_importes_monetarios !== false
                            ? 'text-primary'
                            : 'text-foreground'
                        }
                      >
                        {fmt(safeTotalCarrito)}
                      </span>
                    </div>
                    <Button
                      onClick={async () => {
                        // Cerrar sheet PRIMERO para que la animación termine antes
                        // de cualquier re-render del padre que pueda tocar el DOM.
                        setOpen(false);
                        try {
                          await enviarPedido?.();
                        } catch (e) {
                          console.error('[MeseroCartFAB] enviarPedido', e);
                        }
                      }}
                      disabled={loading}
                      className="w-full h-12 text-base"
                      style={{
                        background:
                          'linear-gradient(135deg, hsl(4,72%,46%) 0%, hsl(4,72%,36%) 100%)',
                      }}
                    >
                      <Send className="w-4 h-4 mr-1.5" />
                      {loading ? 'Enviando...' : 'Enviar a Cocina'}
                    </Button>
                  </>
                )}
                {puedePedirCuenta && (
                  <Button
                    onClick={async () => {
                      setOpen(false);
                      try {
                        await pedirCuenta?.();
                      } catch (e) {
                        console.error('[MeseroCartFAB] pedirCuenta', e);
                      }
                    }}
                    disabled={loading}
                    variant="outline"
                    className="w-full h-12"
                  >
                    <Receipt className="w-4 h-4 mr-1.5" />
                    Solicitar cuenta
                  </Button>
                )}
                {/* DP-22 · Hallazgo 35: con la cuenta pedida, otra hoja de la precuenta a un toque. */}
                {hrefDeLaPrecuenta !== null && (
                  <Button asChild variant="outline" className="w-full h-12">
                    <Link to={hrefDeLaPrecuenta}>
                      <Printer className="w-4 h-4 mr-1.5" />
                      Imprimir otra hoja de la precuenta
                    </Link>
                  </Button>
                )}
                {puedeCambiarDeMesa && (
                  <Button
                    onClick={() => {
                      // Primero se cierra la hoja (como al enviar o pedir la cuenta) y luego el padre
                      // abre el panel de las mesas libres.
                      setOpen(false);
                      alCambiarDeMesa?.();
                    }}
                    disabled={loading}
                    variant="outline"
                    className="w-full h-12"
                  >
                    <ArrowLeftRight className="w-4 h-4 mr-1.5" />
                    Cambiar de mesa
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export default MeseroCartFAB;
