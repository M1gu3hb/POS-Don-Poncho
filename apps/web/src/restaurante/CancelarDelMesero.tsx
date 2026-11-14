'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';
import { Aviso, EsqueletoDeLista, Vacio } from '@morphiqpos/ui/sistema';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { puedeCancelarPedidos } from './ajustes-de-la-cuenta-por-rol.ts';
import { CancelarLaCuenta } from './AjustesDeLaCuenta';
import { AnularLineaDialog } from './AnularLineaDialog';
import {
  avisoDePerdidaAlCancelar,
  descripcionDelRenglon,
  platillosQuitables,
  type DetalleDeLaCuenta,
} from './cancelar-del-mesero.ts';
import { loQueYaSalio, releerLaCuenta, type CuentaViva } from './cancelar-del-mesero-lecturas.ts';
import { lineasQueSigueCobrando } from './lineas-vivas.ts';
import { useRolDeLaSesion } from './rol-de-la-sesion.ts';
import { useTermino } from '~/cliente/vocabulario';
import {
  NO_PUDE_COMPROBAR_LA_COCINA,
  SI_NO_PUDE_COMPROBARLA,
  estadoDeLaCocina,
} from './permiso-al-cancelar.ts';

/**
 * CANCELAR DESDE LA MESA DEL MESERO (DP-12.4): quitar un platillo y cancelar la cuenta.
 *
 * Hasta ahora una cuenta o un platillo mal pedido se le pedía al cajero; la mesa del cliente que
 * se va sin pagar quedaba clavada hasta que alguien con permiso la soltara. El servidor ya deja al
 * mesero (`restaurante.anular_linea`, `restaurante.cancelar_orden`: por rol y por sucursal); aquí
 * está lo que ve en SU diálogo de la mesa ocupada: dos botones, y los mismos diálogos de la caja,
 * con el motivo obligatorio. Si la cocina ya preparó algo se le dice ANTES, con esas palabras:
 * queda como pérdida en el corte, con su nombre.
 *
 * Se monta una vez en `Mesero.jsx` y no tiene más contacto con la página que dos avisos:
 * `alActualizar` (la cuenta releída, sin los renglones anulados) y `alCancelarLaCuenta`.
 *
 * ── Los renglones anulados ───────────────────────────────────────────────
 * Desde DP-14.1 el puente ya no sirve el platillo anulado en `DetalleVenta`. Igual, al montarse,
 * este componente le pregunta al servidor cuáles renglones siguen en la cuenta y, si la página
 * trae de más (una lectura de antes de anular), le devuelve la lista limpia.
 */

export interface CancelarDelMeseroProps {
  /** La cuenta abierta de la mesa, o `null` si no hay. */
  readonly ventaId: string | null;
  /** DP-18 · La mesa de la cuenta: si encabeza mesas unidas, cancelar pregunta qué hacer con ellas. */
  readonly mesaId?: string | null;
  /** Los renglones que la página tiene de esa cuenta. */
  readonly detalles: readonly DetalleDeLaCuenta[];
  readonly alActualizar: (cuenta: CuentaViva) => void;
  readonly alCancelarLaCuenta: () => void;
}

type Cuadro = 'lista' | null;

const CADA_CUANTO_SE_RELEE_LA_COCINA = 3_000;

export function CancelarDelMesero({
  ventaId,
  mesaId = null,
  detalles,
  alActualizar,
  alCancelarLaCuenta,
}: CancelarDelMeseroProps) {
  const rol = useRolDeLaSesion();
  // «cocina» en el restaurante: el diccionario del giro lo dice (F-017).
  const cocina = useTermino('preparacion');
  const puede = puedeCancelarPedidos(rol);
  const [cuadro, setCuadro] = useState<Cuadro>(null);
  const [quitando, setQuitando] = useState<DetalleDeLaCuenta | null>(null);
  const [yaSalieron, setYaSalieron] = useState<ReadonlySet<string>>(new Set());
  const [sinLeerLaCocina, setSinLeerLaCocina] = useState<string | null>(null);
  /** Ya hubo una lectura de la cocina, buena o mala: antes no se sabe qué «ya salió». */
  const [cocinaLeida, setCocinaLeida] = useState(false);
  /** DP-13.2 · Se está releyendo la cocina para el diálogo de cancelar: no se cancela a ciegas. */
  const [comprobando, setComprobando] = useState(false);
  /** El servidor no confirmó cuáles renglones siguen en la cuenta. */
  const [listaSinConfirmar, setListaSinConfirmar] = useState(false);

  // Lo último que trajo la página, para leerlo dentro de los efectos sin volver a dispararlos: la
  // página crea sus avisos de nuevo en cada render y no deben provocar una lectura cada vez.
  const ultimo = useRef({ detalles, alActualizar });
  useEffect(() => {
    ultimo.current = { detalles, alActualizar };
  });

  // La página lista los renglones anulados: se le devuelve la cuenta sin ellos.
  const ids = detalles.map((d) => d.id).join(',');
  const hayCuenta = puede && ventaId !== null && ids !== '';
  useEffect(() => {
    if (!hayCuenta) return;
    const control = new AbortController();
    void (async () => {
      try {
        const vivas = await lineasQueSigueCobrando(ventaId, control.signal);
        if (control.signal.aborted) return;
        if (ultimo.current.detalles.some((d) => !vivas.has(d.id))) {
          ultimo.current.alActualizar(await releerLaCuenta(ventaId));
        }
        setListaSinConfirmar(false);
      } catch {
        // Un aborto es esta misma pantalla que ya no está. Cualquier otro fallo se DICE en el
        // diálogo (abajo); la lista queda como la trajo la página y el servidor cobra lo correcto.
        if (!control.signal.aborted) setListaSinConfirmar(true);
      }
    })();
    return () => {
      control.abort();
    };
  }, [hayCuenta, ventaId, ids]);

  /** Lee qué platillos ya salieron de cocina, para avisar antes de quitar o cancelar. */
  const leerLaCocina = useCallback(async (): Promise<void> => {
    if (ventaId === null) return;
    try {
      setYaSalieron(await loQueYaSalio(ventaId));
      setSinLeerLaCocina(null);
    } catch (fallo: unknown) {
      setSinLeerLaCocina(
        fallo instanceof Error ? fallo.message : 'No se pudo leer lo que cocina ya preparó.',
      );
    } finally {
      setCocinaLeida(true);
    }
  }, [ventaId]);

  useEffect(() => {
    if (!hayCuenta) return;
    // La primera lectura en el siguiente tick y no en el cuerpo del efecto: una lectura que
    // escribe estado a media sincronía encadena un render extra en cada montaje (como
    // `useListosDeLaCuenta`). Después se relee: cocina marca desde otra pantalla, y el aviso de
    // «ya salió» tiene que estar al día cuando el mesero toca «Cancelar la cuenta».
    const primera = setTimeout(() => {
      void leerLaCocina();
    });
    const reloj = setInterval(() => {
      void leerLaCocina();
    }, CADA_CUANTO_SE_RELEE_LA_COCINA);
    return () => {
      clearTimeout(primera);
      clearInterval(reloj);
    };
  }, [hayCuenta, leerLaCocina]);

  const hayRenglones = detalles.length > 0;
  // DP-14.6 · Una mesa abierta SIN renglones también se cancela (se abrió por error, o se fueron
  // antes de pedir): el botón de la cuenta no depende de que haya platillos.
  if (!puede || ventaId === null) return null;

  async function alQuitar(): Promise<void> {
    if (ventaId === null) return;
    try {
      alActualizar(await releerLaCuenta(ventaId));
      toast.success('Platillo quitado de la cuenta');
    } catch (fallo: unknown) {
      // El platillo SÍ se quitó (el comando contestó bien); lo que falló fue releer la cuenta.
      toast.error(
        fallo instanceof Error
          ? `Se quitó, pero no se pudo releer la cuenta: ${fallo.message}`
          : 'Se quitó, pero no se pudo releer la cuenta. Cierra y abre la mesa.',
      );
    }
  }

  const quitables = platillosQuitables(detalles, yaSalieron);
  return (
    <div
      role="group"
      aria-label="Cancelar"
      className="flex shrink-0 flex-wrap items-center gap-(--espacio-2) border-b px-(--espacio-4) py-(--espacio-2)"
    >
      {hayRenglones ? (
        <Button
          variant="outline"
          onClick={() => {
            void leerLaCocina();
            setCuadro('lista');
          }}
        >
          <Trash2 aria-hidden="true" />
          Quitar un platillo
        </Button>
      ) : null}
      <CancelarLaCuenta
        ordenId={ventaId}
        mesaId={mesaId}
        aviso={avisoDePerdidaAlCancelar(detalles, yaSalieron)}
        cocina={estadoDeLaCocina({ comprobando, leida: cocinaLeida, fallo: sinLeerLaCocina })}
        alAbrir={() => {
          setComprobando(true);
          void leerLaCocina().finally(() => {
            setComprobando(false);
          });
        }}
        alCancelar={() => {
          toast.success('Cuenta cancelada');
          alCancelarLaCuenta();
        }}
      />

      <Dialog
        open={cuadro === 'lista'}
        onOpenChange={(abierto) => {
          if (!abierto) setCuadro(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quitar un platillo</DialogTitle>
            <DialogDescription>
              Elige cuál. Hace falta decir por qué y queda a tu nombre.
            </DialogDescription>
          </DialogHeader>
          {listaSinConfirmar ? (
            <Aviso tono="atencion" titulo="No se pudo confirmar la lista de la cuenta">
              Revisa el pedido antes de quitar algo: puede mostrar un platillo que ya se quitó.
            </Aviso>
          ) : null}
          {sinLeerLaCocina === null ? null : (
            <Aviso tono="atencion" titulo={NO_PUDE_COMPROBAR_LA_COCINA}>
              Puedes quitar el platillo igual. {SI_NO_PUDE_COMPROBARLA}
            </Aviso>
          )}
          {!cocinaLeida ? (
            // Sin saber qué ya salió de cocina no se ofrece quitar nada: el aviso de pérdida
            // tiene que estar antes de elegir, no después.
            <EsqueletoDeLista filas={Math.max(1, Math.min(quitables.length, 4))} />
          ) : quitables.length === 0 ? (
            <Vacio
              tamano="compacto"
              titulo="No hay platillos que quitar"
              explicacion="La cuenta no tiene platillos."
            />
          ) : (
            <ul className="flex flex-col gap-(--espacio-2)">
              {quitables.map(({ detalle, yaSePreparo }) => (
                <li key={detalle.id}>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-auto min-h-[calc(var(--altura-control)*1.15)] w-full justify-between py-(--espacio-2) text-left whitespace-normal"
                    aria-label={`Quitar ${descripcionDelRenglon(detalle)}`}
                    onClick={() => {
                      setCuadro(null);
                      setQuitando(detalle);
                    }}
                  >
                    <span>{descripcionDelRenglon(detalle)}</span>
                    {yaSePreparo ? (
                      <span className="text-xs font-bold text-peligro">Ya salió de {cocina}</span>
                    ) : null}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {quitando === null ? null : (
        <AnularLineaDialog
          abierto
          ordenId={ventaId}
          lineaId={quitando.id}
          nombreDelPlatillo={quitando.producto_nombre}
          yaSePreparo={yaSalieron.has(quitando.producto_nombre)}
          onCerrar={() => {
            setQuitando(null);
          }}
          onAnulada={() => {
            void alQuitar();
          }}
        />
      )}
    </div>
  );
}
