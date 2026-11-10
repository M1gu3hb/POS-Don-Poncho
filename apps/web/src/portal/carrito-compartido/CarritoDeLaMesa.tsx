'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@morphiqpos/ui/primitivas/alert-dialog';
import { Button } from '@morphiqpos/ui/primitivas/button';
import { Label } from '@morphiqpos/ui/primitivas/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@morphiqpos/ui/primitivas/sheet';
import { Textarea } from '@morphiqpos/ui/primitivas/textarea';
import { Aviso, Dinero } from '@morphiqpos/ui/sistema';
import { BellRing, Send, ShoppingCart } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import {
  avisoDelEnvio,
  botonDelCarrito,
  conPrecios,
  CUENTA_PEDIDA,
  PEDIDO_GUARDADO,
  personasConectadas,
  reglaDelError,
  subtotalAproximadoCentavos,
} from './carrito-de-la-mesa';
import { RenglonDelCarrito as Renglon } from './RenglonDelCarrito';
import type { CarritoDeLaMesa as Carrito } from './use-carrito-de-la-mesa';

/**
 * EL PEDIDO DE LA MESA en el teléfono (DP-9.5): lo de todos, con «Quitar» sólo en lo propio.
 *
 * DP-12.2 · Quién manda a cocina lo decide el negocio: por omisión el botón es «Llamar a mi mesero
 * para confirmar» y el pedido se queda guardado; si también envían los comensales, «Enviar a
 * cocina» (en una mesa de dos o más, antes «¿Ya pidieron todos?»); con la mesa cerrada, abrirla
 * primero si el negocio lo deja o, si no, pedir que los atiendan. Ningún texto para el personal.
 */

export function CarritoDeLaMesa({
  carrito,
  alAbrirLaMesa,
  abrirConSenal = 0,
}: {
  readonly carrito: Carrito;
  /**
   * DP-12.2 · Con la mesa cerrada y el negocio dejando abrirla: su diálogo (personas, alergias).
   * DP-13.3 · Lo que ese diálogo confirma sale con el envío, en UN comando: la nota para cocina que
   * se escribió aquí viaja hasta allá.
   */
  readonly alAbrirLaMesa?: (datos: { readonly notaGeneral: string }) => void;
  /**
   * DP-16 · Cada vez que cambia (y es mayor que cero), la hoja del pedido se abre: el contador del
   * encabezado del menú digital la abre sin duplicar el estado de aquí.
   */
  readonly abrirConSenal?: number;
}) {
  const idNota = useId();
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [fallo, setFallo] = useState<string | null>(null);
  const estado = carrito.estado;
  const ronda = estado?.ronda ?? null;
  const vacio = (estado?.lineas.length ?? 0) === 0;

  // DP-12.2 · Cuando otro teléfono (o el mesero) manda el pedido, la hoja y «¿Ya pidieron todos?»
  // se cierran aquí también. Antes se quedaban «abiertos» por dentro y reaparecían solos en
  // cuanto alguien agregaba lo siguiente. Se ajusta al pintar, no en un efecto.
  const [visto, setVisto] = useState({ ronda, vacio });
  const [senalVista, setSenalVista] = useState(abrirConSenal);
  if (senalVista !== abrirConSenal) {
    setSenalVista(abrirConSenal);
    if (abrirConSenal > 0 && !vacio) setAbierto(true);
  }
  if (visto.ronda !== ronda || visto.vacio !== vacio) {
    setVisto({ ronda, vacio });
    if (visto.ronda !== ronda || vacio) {
      setConfirmando(false);
      setAbierto(false);
    }
    if (visto.ronda !== ronda) setNota('');
  }

  if (estado === null || vacio) return null;
  const subtotal = subtotalAproximadoCentavos(estado.lineas);
  const precios = conPrecios(estado.lineas);
  const boton = botonDelCarrito(estado);

  const mandar = async (confirmado: boolean) => {
    setEnviando(true);
    setFallo(null);
    try {
      const aviso = avisoDelEnvio(await carrito.enviar({ confirmado, notaGeneral: nota }));
      if (aviso.tono === 'exito') toast.success(aviso.texto);
      else toast.warning(aviso.texto);
      setNota('');
      setConfirmando(false);
      setAbierto(false);
    } catch (error: unknown) {
      const regla = reglaDelError(error);
      if (regla === 'QR_CARRITO_SIN_CONFIRMAR') {
        setConfirmando(true);
      } else if (regla === 'QR_CUENTA_PEDIDA') {
        // DP-13.3: la cuenta se pidió mientras el comensal armaba el pedido. No es un fallo suyo.
        toast.info(error instanceof Error ? error.message : CUENTA_PEDIDA);
        setConfirmando(false);
        setAbierto(false);
      } else {
        setConfirmando(false);
        setFallo(error instanceof Error ? error.message : 'No pudimos enviar el pedido.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const llamar = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      await carrito.llamar();
      toast.success(PEDIDO_GUARDADO);
      setAbierto(false);
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No pudimos llamar a tu mesero.');
    } finally {
      setEnviando(false);
    }
  };

  const quitar = async (id: string) => {
    setQuitando(id);
    setFallo(null);
    try {
      await carrito.quitar(id);
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No pudimos quitarlo.');
    } finally {
      setQuitando(null);
    }
  };

  // «Abrir la mesa y enviar»: el diálogo de la apertura pregunta cuántas personas son y, al
  // confirmarlo, abre y envía en un solo comando (DP-13.3).
  const abrirLaMesa = () => {
    setConfirmando(false);
    setAbierto(false);
    alAbrirLaMesa?.({ notaGeneral: nota });
  };

  const alTocar = () => {
    if (boton.accion === 'llamar') void llamar();
    else if (estado.esperarATodos) setConfirmando(true);
    else if (boton.accion === 'abrir') abrirLaMesa();
    else void mandar(false);
  };

  return (
    <>
      <Button
        className="fixed inset-x-(--espacio-4) bottom-(--espacio-4) z-30 mx-auto max-w-md gap-(--espacio-3)"
        onClick={() => {
          setAbierto(true);
        }}
      >
        <ShoppingCart className="size-5" aria-hidden />
        <span className="flex-1 text-left">Pedido de la mesa ({String(estado.lineas.length)})</span>
        {precios ? <Dinero centavos={subtotal} /> : null}
      </Button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>El pedido de la mesa</SheetTitle>
            <SheetDescription>
              {personasConectadas(estado.conectados)} · cada quien quita lo suyo
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-(--espacio-3) px-(--espacio-4)">
            {boton.explicacion === null ? null : <Aviso tono="info" titulo={boton.explicacion} />}
            {estado.esperarATodos && boton.accion === 'enviar' ? (
              <Aviso
                tono="atencion"
                titulo="Esperen a que todos agreguen su pedido antes de enviarlo."
              />
            ) : null}
            <ul>
              {estado.lineas.map((linea) => (
                <Renglon
                  key={linea.id}
                  linea={linea}
                  quitando={quitando === linea.id}
                  alQuitar={(id) => void quitar(id)}
                />
              ))}
            </ul>
            {boton.accion === 'llamar' ? null : (
              <span className="flex flex-col gap-(--espacio-1)">
                <Label htmlFor={idNota} className="text-xs">
                  Nota para cocina (opcional)
                </Label>
                <Textarea
                  id={idNota}
                  rows={2}
                  maxLength={300}
                  value={nota}
                  placeholder="Ej. todo junto, sin picante…"
                  onChange={(e) => {
                    setNota(e.target.value);
                  }}
                />
              </span>
            )}
            {precios ? (
              <>
                <p className="flex items-center justify-between text-sm font-semibold">
                  Subtotal aproximado <Dinero centavos={subtotal} />
                </p>
                <p className="text-xs text-texto-sutil">El cobro final se confirma en caja.</p>
              </>
            ) : null}
            {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              disabled={enviando}
              onClick={() => {
                setAbierto(false);
              }}
            >
              Seguir viendo el menú
            </Button>
            <Button className="gap-(--espacio-2)" disabled={enviando} onClick={alTocar}>
              {boton.accion === 'llamar' ? (
                <BellRing className="size-4" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {enviando ? 'Un momento…' : boton.texto}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmando && !vacio} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Ya pidieron todos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se manda a cocina el pedido completo de la mesa, una sola vez:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-[40dvh] overflow-y-auto">
            {estado.lineas.map((linea) => (
              <Renglon key={linea.id} linea={linea} quitando={false} />
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={enviando}
              onClick={(e) => {
                e.preventDefault();
                if (boton.accion === 'abrir') abrirLaMesa();
                else void mandar(true);
              }}
            >
              {enviando ? 'Enviando…' : boton.accion === 'abrir' ? 'Abrir la mesa' : 'Enviar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
