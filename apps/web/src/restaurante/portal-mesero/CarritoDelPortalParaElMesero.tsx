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
import { Aviso, EsqueletoDeLista, Superficie, Vacio } from '@morphiqpos/ui/sistema';
import { Send, Smartphone, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import { pideElPinDelSupervisor } from '~/restaurante/permiso-al-cancelar';
import { PinDeSupervisor, type Autorizada } from '~/venta/PinDeSupervisor';
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
import { RenglonDelCarritoDelMesero } from './RenglonDelCarritoDelMesero';

/**
 * EL PORTAL EN MODO MESERO (DP-12.2): lo que armaron los teléfonos de la mesa, con los poderes del
 * mesero. Ve el carrito de todos, cambia cantidades, quita cualquier línea, borra el pedido entero
 * (los comensales se fueron y llegan otros), abre la mesa si está cerrada y lo confirma y lo manda
 * a cocina a su nombre. Lo usa la pantalla del mesero al escanear el QR, al tocar el aviso
 * «Pedido listo para confirmar» y dentro de la mesa abierta.
 */

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
  const [reabriendo, setReabriendo] = useState(false);
  // DP-14.6 · Otro mesero necesita el PIN de un gerente para reabrir: lo dice el servidor.
  const [pidePin, setPidePin] = useState(false);
  const [autorizada, setAutorizada] = useState<Autorizada | null>(null);

  if (cargando) return compacto ? null : <EsqueletoDeLista filas={3} />;
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

  const enviar = (reabrirCuenta = false) =>
    hacer('enviar', async () => {
      const r = await enviarACocina(mesa.id, '', reabrirCuenta, autorizada?.token);
      if (r.enviado) {
        sonar('enviarACocina');
        toast.success(`Pedido de la mesa ${String(mesa.numero)} enviado a cocina.`);
        alEnviar?.();
      } else {
        toast.info('Ya no había nada que enviar: el pedido de la mesa está vacío.');
      }
    });

  /** Reabrir y enviar; si el servidor pide el PIN de un gerente, el mismo diálogo lo pide. */
  const reabrirYEnviar = async () => {
    setOcupado('enviar');
    try {
      const r = await enviarACocina(mesa.id, '', true, autorizada?.token);
      setReabriendo(false);
      setPidePin(false);
      setAutorizada(null);
      if (r.enviado) {
        sonar('enviarACocina');
        toast.success(`Pedido de la mesa ${String(mesa.numero)} enviado a cocina.`);
        alEnviar?.();
      } else {
        toast.info('Ya no había nada que enviar: el pedido de la mesa está vacío.');
      }
      await releer();
    } catch (fallo: unknown) {
      if (pideElPinDelSupervisor(fallo)) {
        setPidePin(true);
        setAutorizada(null);
      } else {
        toast.error(mensajeDe(fallo, 'No se pudo. Intenta de nuevo.'));
      }
    } finally {
      setOcupado(null);
    }
  };

  const abrir = () => {
    const n = Number(personas);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      toast.error('¿Cuántas personas son? Entre 1 y 99.');
      return;
    }
    void hacer('abrir', () => abrirLaMesa(mesa.id, n), `Mesa ${String(mesa.numero)} abierta.`);
  };

  return (
    <Superficie
      como="section"
      nivel={0}
      relleno={3}
      className="flex min-w-0 flex-col gap-(--espacio-3)"
      data-carrito-del-portal={mesa.id}
      aria-label={`Pedido del portal de la mesa ${String(mesa.numero)}`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-(--espacio-2)">
        <h3 className="min-w-0 text-base font-semibold">Pedido del portal · Mesa {mesa.numero}</h3>
        <span className="flex items-center gap-1 text-xs text-texto-sutil">
          <Smartphone className="size-3.5" aria-hidden />
          {carrito.conectados === 1 ? '1 teléfono' : `${String(carrito.conectados)} teléfonos`}
        </span>
      </header>
      {sinConexion ? <Aviso tono="atencion" titulo="Sin conexión, reintentando…" /> : null}
      {mesa.cuentaPedida ? (
        <Aviso
          tono="atencion"
          titulo="La cuenta de esta mesa ya se pidió. Para mandarle este pedido hay que reabrirla (mientras no se haya cobrado)."
        />
      ) : null}
      {carrito.lineas.length === 0 ? (
        <Vacio tamano="compacto" titulo="Los comensales todavía no han armado nada." />
      ) : (
        porTelefono(carrito.lineas).map(([telefono, lineas]) => (
          <div key={telefono} className="flex min-w-0 flex-col gap-(--espacio-1)">
            <p className="text-xs font-semibold text-texto-sutil">Teléfono {telefono}</p>
            <ul className="flex flex-col">
              {lineas.map((linea) => (
                <RenglonDelCarritoDelMesero
                  key={linea.id}
                  linea={linea}
                  ocupado={ocupado !== null}
                  alCambiar={(cantidad) => {
                    void hacer(linea.id, () => cambiarCantidad(mesa.id, linea.id, cantidad));
                  }}
                  alQuitar={() => {
                    void hacer(linea.id, () => quitarLinea(mesa.id, linea.id));
                  }}
                />
              ))}
            </ul>
          </div>
        ))
      )}
      {carrito.lineas.length === 0 ? null : (
        <footer className="flex flex-wrap items-end justify-between gap-(--espacio-2)">
          <Button
            variant="outline"
            className="max-w-full text-peligro"
            disabled={ocupado !== null}
            onClick={() => {
              setBorrando(true);
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Borrar el pedido
          </Button>
          {mesa.ordenId === null ? (
            <span className="flex min-w-0 max-w-full items-end gap-(--espacio-2)">
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
              className="max-w-full gap-(--espacio-2)"
              disabled={ocupado !== null}
              onClick={() => {
                if (mesa.cuentaPedida) setReabriendo(true);
                else void enviar();
              }}
            >
              <Send className="size-4" aria-hidden />
              {ocupado === 'enviar'
                ? 'Enviando…'
                : mesa.cuentaPedida
                  ? 'Reabrir la cuenta y enviar'
                  : 'Confirmar y enviar a cocina'}
            </Button>
          )}
        </footer>
      )}

      <AlertDialog
        open={reabriendo}
        onOpenChange={(abierto) => {
          setReabriendo(abierto);
          if (!abierto) {
            setPidePin(false);
            setAutorizada(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reabrir la cuenta de la mesa {mesa.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              La cuenta ya se pidió y todavía no se cobra. Si la reabres, este pedido sale a cocina
              y la cuenta queda abierta otra vez; hay que volver a pedirla cuando terminen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!pidePin ? null : autorizada === null ? (
            <div className="flex flex-col gap-(--espacio-2)">
              <Aviso tono="atencion" titulo="Esa mesa la atiende otro mesero.">
                Reabrir su cuenta lo autoriza un gerente o el dueño con su PIN.
              </Aviso>
              {mesa.ordenId === null ? null : (
                <PinDeSupervisor
                  ordenId={mesa.ordenId}
                  para="cancelacion"
                  idDelCampo="reabrir-cuenta-pin"
                  alAutorizar={setAutorizada}
                />
              )}
            </div>
          ) : (
            <Aviso tono="exito" titulo={`Autorizó ${autorizada.nombre}.`} />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              disabled={ocupado !== null || (pidePin && autorizada === null)}
              onClick={() => {
                void reabrirYEnviar();
              }}
            >
              Reabrir y enviar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </Superficie>
  );
}
