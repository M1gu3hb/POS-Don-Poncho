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
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Aviso, Dinero } from '@morphiqpos/ui/sistema';
import { Minus, Plus, Send, Smartphone, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import type { LineaDelCarrito } from '~/portal/carrito-compartido/carrito-de-la-mesa';
import { sonar } from '~/sonidos/gestor';

import {
  abrirLaMesa,
  borrarElPedido,
  cambiarCantidad,
  enviarACocina,
  quitarLinea,
  useCarritoDelMesero,
  type MesaBuscada,
} from './api-del-carrito-del-mesero';

/**
 * EL PORTAL EN MODO MESERO (DP-12.2): lo que armaron los teléfonos de la mesa, con los poderes del
 * mesero. Ve el carrito de todos, cambia cantidades, quita cualquier línea, borra el pedido entero
 * (los comensales se fueron y llegan otros), abre la mesa si está cerrada y lo confirma y lo manda
 * a cocina a su nombre. Lo usa la pantalla del mesero al escanear el QR, al tocar el aviso
 * «Pedido listo para confirmar» y dentro de la mesa abierta.
 */

const ENTERO = /^\d+$/;

function porTelefono(lineas: readonly LineaDelCarrito[]) {
  const grupos = new Map<number, LineaDelCarrito[]>();
  for (const linea of lineas) {
    const n = linea.telefono ?? 0;
    grupos.set(n, [...(grupos.get(n) ?? []), linea]);
  }
  return [...grupos.entries()].sort(([a], [b]) => a - b);
}

function mensajeDe(error: unknown, porOmision: string): string {
  return error instanceof Error && error.message !== '' ? error.message : porOmision;
}

export function CarritoDelPortalParaElMesero({
  buscada,
  compacto = false,
  alEnviar,
}: {
  readonly buscada: MesaBuscada;
  /** Dentro de la mesa abierta: sin nada que enseñar, no ocupa lugar. */
  readonly compacto?: boolean;
  readonly alEnviar?: () => void;
}) {
  const idPersonas = useId();
  const { datos, error, cargando, sinConexion, releer } = useCarritoDelMesero(buscada);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [personas, setPersonas] = useState('2');
  const [borrando, setBorrando] = useState(false);

  if (cargando) return compacto ? null : <p className="text-sm text-texto-sutil">Cargando…</p>;
  if (datos === null) {
    return compacto ? null : (
      <Aviso tono="peligro" titulo={mensajeDe(error, 'No pudimos leer el pedido de la mesa.')} />
    );
  }
  const { mesa, carrito } = datos;
  if (compacto && carrito.lineas.length === 0) return null;

  const hacer = async (que: string, accion: () => Promise<unknown>, exito?: string) => {
    setOcupado(que);
    try {
      await accion();
      if (exito !== undefined) toast.success(exito);
      await releer();
    } catch (fallo: unknown) {
      toast.error(mensajeDe(fallo, 'No se pudo. Intenta de nuevo.'));
    } finally {
      setOcupado(null);
    }
  };

  const enviar = () =>
    hacer('enviar', async () => {
      const r = await enviarACocina(mesa.id, '');
      if (r.enviado) {
        sonar('enviarACocina');
        toast.success(`Pedido de la mesa ${String(mesa.numero)} enviado a cocina.`);
        alEnviar?.();
      } else {
        toast.info('Ya no había nada que enviar: el pedido de la mesa está vacío.');
      }
    });

  const abrir = () => {
    const n = Number(personas);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      toast.error('¿Cuántas personas son? Entre 1 y 99.');
      return;
    }
    void hacer('abrir', () => abrirLaMesa(mesa.id, n), `Mesa ${String(mesa.numero)} abierta.`);
  };

  return (
    <section
      className="flex flex-col gap-(--espacio-3) rounded-xl border border-borde bg-superficie p-(--espacio-3)"
      data-carrito-del-portal={mesa.id}
      aria-label={`Pedido del portal de la mesa ${String(mesa.numero)}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-(--espacio-2)">
        <h3 className="text-base font-semibold">Pedido del portal · Mesa {mesa.numero}</h3>
        <span className="flex items-center gap-1 text-xs text-texto-sutil">
          <Smartphone className="size-3.5" aria-hidden />
          {carrito.conectados === 1 ? '1 teléfono' : `${String(carrito.conectados)} teléfonos`}
        </span>
      </header>
      {sinConexion ? <Aviso tono="atencion" titulo="Sin conexión, reintentando…" /> : null}
      {carrito.lineas.length === 0 ? (
        <p className="text-sm text-texto-sutil">Los comensales todavía no han armado nada.</p>
      ) : (
        porTelefono(carrito.lineas).map(([telefono, lineas]) => (
          <div key={telefono} className="flex flex-col gap-(--espacio-1)">
            <p className="text-xs font-semibold text-texto-sutil">Teléfono {telefono}</p>
            <ul className="flex flex-col">
              {lineas.map((linea) => (
                <li
                  key={linea.id}
                  className="flex items-center gap-(--espacio-2) border-b border-borde py-(--espacio-2)"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{linea.nombre}</span>
                    {linea.notas === '' ? null : (
                      <span className="block text-xs text-texto-sutil">«{linea.notas}»</span>
                    )}
                    {linea.disponible === false ? (
                      <span className="block text-xs font-semibold text-peligro">
                        Ya no está en el menú digital
                      </span>
                    ) : null}
                  </span>
                  {ENTERO.test(linea.cantidad) ? (
                    <span className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Uno menos de ${linea.nombre}`}
                        disabled={ocupado !== null || linea.cantidad === '1'}
                        onClick={() =>
                          void hacer(linea.id, () =>
                            cambiarCantidad(mesa.id, linea.id, String(Number(linea.cantidad) - 1)),
                          )
                        }
                      >
                        <Minus className="size-4" aria-hidden />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">
                        {linea.cantidad}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Uno más de ${linea.nombre}`}
                        disabled={ocupado !== null}
                        onClick={() =>
                          void hacer(linea.id, () =>
                            cambiarCantidad(mesa.id, linea.id, String(Number(linea.cantidad) + 1)),
                          )
                        }
                      >
                        <Plus className="size-4" aria-hidden />
                      </Button>
                    </span>
                  ) : (
                    <span className="text-sm font-semibold tabular-nums">{linea.cantidad}</span>
                  )}
                  {linea.precioCentavos === null ? null : (
                    <Dinero
                      centavos={Math.round(Number(linea.cantidad) * Number(linea.precioCentavos))}
                    />
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-peligro"
                    aria-label={`Quitar ${linea.nombre}`}
                    disabled={ocupado !== null}
                    onClick={() => void hacer(linea.id, () => quitarLinea(mesa.id, linea.id))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      {carrito.lineas.length === 0 ? null : (
        <footer className="flex flex-wrap items-end justify-between gap-(--espacio-2)">
          <Button
            variant="outline"
            className="text-peligro"
            disabled={ocupado !== null}
            onClick={() => {
              setBorrando(true);
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Borrar el pedido
          </Button>
          {mesa.ordenId === null ? (
            <span className="flex items-end gap-(--espacio-2)">
              <span className="flex flex-col gap-1">
                <Label htmlFor={idPersonas} className="text-xs">
                  Personas
                </Label>
                <Input
                  id={idPersonas}
                  inputMode="numeric"
                  className="w-20"
                  value={personas}
                  onChange={(e) => {
                    setPersonas(e.target.value);
                  }}
                />
              </span>
              <Button disabled={ocupado !== null} onClick={abrir}>
                Abrir la mesa
              </Button>
            </span>
          ) : (
            <Button
              className="gap-(--espacio-2)"
              disabled={ocupado !== null}
              onClick={() => void enviar()}
            >
              <Send className="size-4" aria-hidden />
              {ocupado === 'enviar' ? 'Enviando…' : 'Confirmar y enviar a cocina'}
            </Button>
          )}
        </footer>
      )}

      <AlertDialog open={borrando} onOpenChange={setBorrando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar el pedido de la mesa {mesa.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quita todo lo que armaron los teléfonos de esta mesa. Es para cuando los comensales
              se fueron sin pedir y llegan otros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void hacer('borrar', () => borrarElPedido(mesa.id), 'Pedido de la mesa borrado.');
              }}
            >
              Borrar el pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
