'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Dialog, DialogContent, DialogTitle } from '@morphiqpos/ui/primitivas/dialog';
import { cn } from '@morphiqpos/ui/utilidades';
import { Trash2, X } from 'lucide-react';
import { useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';

import {
  COBRO_INICIAL,
  leerElCobro,
  teclear,
  type CobroEnPantalla,
  type TeclaDeImporte,
} from './cobro-en-pantalla.ts';
import { enPesos, type CuentaDelCobro, type PropinaDelCobro } from './cuenta-del-cobro.ts';
import { PagoDeLaTarjeta, type PropinasEnLaCaja } from './PagoDeLaTarjeta';
import { seMencionaElIva } from '~/venta/se-menciona-el-iva';

/**
 * LA TARJETA DE COBRO (DP-24 · «la Caja manda»).
 *
 * El cobro eran dos diálogos (la cuenta con sus métodos, y encima «¿Desean agregar propina?») en una
 * columna angosta que había que desplazar. Ahora es UNA tarjeta grande y casi cuadrada, pensada para
 * las pantallas táctiles de la caja (1024×768 y 800×600): a la izquierda la cuenta —los platillos, el
 * subtotal, la propina y el total— y a la derecha el pago —la propina que se elige con un toque, las
 * formas de pago, lo recibido, el cambio y el botón de cobrar—. Sin diálogos encimados.
 *
 * Esta pieza no habla con el servidor: recibe la cuenta y avisa lo que la cajera decide
 * (`alElegirPropina`, `alCobrar`). La cuenta del dinero vive en `cuenta-del-cobro.ts`.
 */

/** Un renglón de la cuenta, ya en palabras. */
export interface RenglonDeLaTarjeta {
  readonly id: string;
  readonly nombre: string;
  /** «×2», «½ kg», «3 copas». */
  readonly cantidad: string;
  readonly importeCentavos: number;
  /** Sus opciones y su nota, una por línea. */
  readonly detalles?: readonly string[];
}

export interface TarjetaDeCobroProps {
  readonly abierta: boolean;
  /** «Cobrar — Mesa 5». */
  readonly titulo: string;
  /**
   * La cuenta y su total. Cuando cambia (otra cuenta, o el total de ésta), lo tecleado se limpia:
   * era para el total de antes.
   */
  readonly clave: string;
  readonly renglones: readonly RenglonDeLaTarjeta[];
  readonly subtotalCentavos: number;
  readonly descuentoCentavos: number;
  /** Con el IVA en cero no se menciona (lo decide `seMencionaElIva`, la regla de todos los papeles). */
  readonly ivaCentavos: number;
  readonly ivaSeSuma: boolean;
  /** La venta, sin propina: lo que el servidor dice que cuesta. */
  readonly totalCentavos: number;
  readonly propina: PropinaDelCobro;
  /** Los porcentajes sugeridos de la Configuración: 5, 10, 15, 20. */
  readonly porcentajes: readonly number[];
  readonly propinas: PropinasEnLaCaja;
  /** `true` mientras la propina elegida viaja al servidor. */
  readonly guardandoPropina: boolean;
  readonly procesando: boolean;
  readonly mensajeDeProceso?: string;
  /** Avisos de la cuenta: el del portal QR, la propina que eligió otra pantalla. */
  readonly aviso?: ReactNode;
  /** Lo que va bajo el renglón del descuento («Autorizó X · motivo»). */
  readonly bajoElDescuento?: ReactNode;
  /** Los botones que cambian la cuenta: agregar, dividir, descuento, cancelar. */
  readonly acciones?: ReactNode;
  /** Si viene, ocupa el lugar del pago: quitar un platillo, agregar productos. */
  readonly panel?: ReactNode;
  readonly alElegirPropina: (propina: PropinaDelCobro) => void;
  readonly alCobrar: (cuenta: CuentaDelCobro) => void;
  readonly alCerrar: () => void;
  /** Sólo con la cuenta en $0.00. */
  readonly alBorrarEnCero?: (() => void) | undefined;
  readonly alQuitar?: ((renglon: RenglonDeLaTarjeta) => void) | undefined;
}

const TECLAS_FISICAS: Readonly<Record<string, TeclaDeImporte>> = {
  Backspace: 'borrar',
  Delete: 'limpiar',
  '.': '.',
};

function teclaDe(evento: KeyboardEvent): TeclaDeImporte | null {
  if (evento.ctrlKey || evento.metaKey || evento.altKey) return null;
  if (/^\d$/.test(evento.key)) return evento.key as TeclaDeImporte;
  return TECLAS_FISICAS[evento.key] ?? null;
}

function Renglon({
  etiqueta,
  valor,
  tono,
}: {
  readonly etiqueta: ReactNode;
  readonly valor: string;
  readonly tono?: 'sutil' | 'propina';
}): ReactElement {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-(--espacio-2) text-sm',
        tono === 'sutil' && 'text-texto-sutil',
        tono === 'propina' && 'font-semibold text-peligro',
      )}
    >
      <span>{etiqueta}</span>
      <span className="font-numeros tabular-nums">{valor}</span>
    </div>
  );
}

function LaCuenta({
  p,
  cuenta,
}: {
  readonly p: TarjetaDeCobroProps;
  readonly cuenta: CuentaDelCobro;
}): ReactElement {
  const porcentaje =
    p.propina.tipo === 'porcentaje' && cuenta.propinaAEnviar.tipo === 'porcentaje'
      ? ` (${String(p.propina.puntosBase / 100)}%)`
      : '';
  return (
    <section aria-label="La cuenta" className="flex min-h-0 flex-col gap-(--espacio-2)">
      {/* En pantallas sin barra lateral flota el botón «Menú» arriba a la izquierda: el título le deja sitio. */}
      <DialogTitle className="pr-(--espacio-8) font-heading text-lg max-lg:pl-24 md:pr-0">
        {p.titulo}
      </DialogTitle>
      {p.aviso}
      <ul
        aria-label="Platillos de la cuenta"
        className="min-h-24 flex-1 divide-y divide-dashed divide-borde overflow-y-auto overscroll-contain rounded-md border border-borde bg-superficie"
      >
        {p.renglones.map((renglon) => (
          <li
            key={renglon.id}
            className="flex min-h-11 items-center gap-(--espacio-2) px-(--espacio-2) py-1"
          >
            <div className="min-w-0 flex-1 text-sm">
              <p className="leading-tight">
                <span className="font-medium">{renglon.nombre}</span>{' '}
                <span className="whitespace-nowrap text-texto-sutil">{renglon.cantidad}</span>
              </p>
              {(renglon.detalles ?? []).map((detalle) => (
                <p key={detalle} className="text-xs leading-tight text-texto-sutil">
                  {detalle}
                </p>
              ))}
            </div>
            <span className="font-numeros text-sm font-semibold tabular-nums">
              {enPesos(renglon.importeCentavos)}
            </span>
            {p.alQuitar !== undefined && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 text-texto-sutil"
                disabled={p.procesando}
                aria-label={`Quitar ${renglon.nombre}`}
                onClick={() => p.alQuitar?.(renglon)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-0.5">
        <Renglon etiqueta="Subtotal" valor={enPesos(p.subtotalCentavos)} tono="sutil" />
        {p.descuentoCentavos > 0 && (
          <div>
            <Renglon etiqueta="Descuento" valor={`−${enPesos(p.descuentoCentavos)}`} />
            {p.bajoElDescuento}
          </div>
        )}
        {seMencionaElIva(p.ivaCentavos) && (
          <Renglon
            etiqueta={p.ivaSeSuma ? 'IVA' : 'IVA incluido'}
            valor={enPesos(p.ivaCentavos)}
            tono="sutil"
          />
        )}
        {p.propinas !== 'apagadas' && (
          <Renglon
            etiqueta={`Propina${porcentaje}`}
            valor={`+ ${enPesos(cuenta.propinaCentavos)}`}
            tono={cuenta.propinaCentavos > 0 ? 'propina' : 'sutil'}
          />
        )}
        <div className="mt-1 flex items-baseline justify-between gap-(--espacio-2) border-t border-borde pt-1 font-black">
          <span className="text-base">TOTAL A COBRAR</span>
          <span className="font-numeros text-2xl tabular-nums text-primario" data-total-a-cobrar>
            {enPesos(cuenta.aCobrarCentavos)}
          </span>
        </div>
      </div>
      {p.acciones !== undefined && (
        <div className="grid grid-cols-3 gap-(--espacio-1) [&>button]:h-auto [&>button]:min-h-11 [&>button]:px-(--espacio-2) [&>button]:py-1 [&>button]:text-xs [&>button]:leading-tight [&>button]:whitespace-normal">
          {p.acciones}
        </div>
      )}
    </section>
  );
}

function Contenido(p: TarjetaDeCobroProps): ReactElement {
  const [estado, setEstado] = useState<CobroEnPantalla>(COBRO_INICIAL);
  const { cuenta } = leerElCobro(estado, p.totalCentavos, p.propina);
  const enCero = p.totalCentavos <= 0;
  const noSePuede = cuenta.tropiezo !== null || p.procesando || p.guardandoPropina;

  // Con teclado físico se teclea sin tocar antes el campo: va al campo activo.
  const alTeclear = (evento: KeyboardEvent): void => {
    if (p.procesando || p.panel !== undefined) return;
    const destino = evento.target as HTMLElement;
    if (destino.tagName === 'INPUT' || destino.tagName === 'TEXTAREA') return;
    const tecla = teclaDe(evento);
    if (tecla === null || estado.campoActivo === null) return;
    evento.preventDefault();
    setEstado(teclear(estado, tecla));
  };

  return (
    // El teclado físico escribe en el campo activo desde cualquier parte de la tarjeta; cada control
    // conserva su propio foco.
    <div
      data-tarjeta-de-cobro
      onKeyDown={alTeclear}
      className="grid min-h-0 gap-(--espacio-3) md:h-[min(90vh,44rem)] md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <LaCuenta p={p} cuenta={cuenta} />
      <section aria-label="El pago" className="flex min-h-0 flex-col gap-(--espacio-2)">
        {p.panel ?? (
          <>
            {enCero ? (
              <p className="rounded-md border border-peligro/30 bg-peligro/10 p-(--espacio-3) text-sm text-peligro">
                Este ticket está en $0.00. No se puede cobrar. Puedes eliminarlo para limpiar la
                caja.
              </p>
            ) : (
              <PagoDeLaTarjeta
                estado={estado}
                alCambiar={setEstado}
                cuenta={cuenta}
                propina={p.propina}
                porcentajes={p.porcentajes}
                propinas={p.propinas}
                guardandoPropina={p.guardandoPropina}
                procesando={p.procesando}
                alElegirPropina={p.alElegirPropina}
              />
            )}
            {!enCero && cuenta.tropiezo !== null && (
              <p role="alert" data-tropiezo className="text-sm font-semibold text-peligro">
                {cuenta.tropiezo}
              </p>
            )}
            <div className="mt-auto flex gap-(--espacio-2)">
              <Button
                type="button"
                variant="outline"
                className="h-14 px-(--espacio-4)"
                disabled={p.procesando}
                onClick={p.alCerrar}
              >
                Cerrar
              </Button>
              {enCero && p.alBorrarEnCero !== undefined ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="h-14 flex-1 text-base"
                  onClick={p.alBorrarEnCero}
                >
                  <Trash2 aria-hidden="true" /> Borrar ticket en cero
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-14 flex-1 text-xl font-black"
                  disabled={noSePuede}
                  onClick={() => {
                    p.alCobrar(cuenta);
                  }}
                >
                  {p.procesando ? (
                    <span className="flex items-center gap-(--espacio-2) text-base">
                      <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-primario-texto/40 border-t-primario-texto motion-reduce:animate-none" />
                      {p.mensajeDeProceso ?? 'Procesando…'}
                    </span>
                  ) : (
                    `Cobrar ${enPesos(cuenta.aCobrarCentavos)}`
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function TarjetaDeCobro(p: TarjetaDeCobroProps): ReactElement {
  return (
    <Dialog
      open={p.abierta}
      onOpenChange={(abierta) => {
        if (!abierta && !p.procesando) p.alCerrar();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-h-[96vh] w-full max-w-[calc(100%-1rem)] gap-0 overflow-y-auto p-(--espacio-3) sm:max-w-[min(97vw,70rem)] md:overflow-hidden md:p-(--espacio-4)"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 size-11 md:hidden"
          aria-label="Cerrar sin cobrar"
          disabled={p.procesando}
          onClick={p.alCerrar}
        >
          <X aria-hidden="true" />
        </Button>
        <Contenido key={p.clave} {...p} />
      </DialogContent>
    </Dialog>
  );
}
