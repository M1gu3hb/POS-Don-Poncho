'use client';

import { useQuery } from '@tanstack/react-query';
import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { Banknote } from 'lucide-react';
import { toast } from 'sonner';

import { PinDeSupervisor } from '~/venta/PinDeSupervisor';

import {
  abrirCajon,
  MOTIVOS_SIN_VENTA,
  PUESTOS_QUE_ABREN_EL_CAJON,
  textoDeLaApertura,
  type MotivoSinVenta,
} from './cajon.ts';
import { usePerfilDelAparato } from './use-app.ts';

/**
 * EL CAJÓN Y LA IMPRESORA, EN LA CAJA (DP-20 · Parte 3.4 y refuerzo §4).
 *
 * `abrirCajonAlCobrar`: lo llama el cobro cuando hubo efectivo (sin PIN; el servidor comprueba
 * que sí hubo un cobro en efectivo). `<BotonAbrirCajon>`: el botón manual, sólo para cajera,
 * gerente, administrador y dueño, y sólo si el aparato TIENE cajón (el interruptor del
 * laboratorio): SIEMPRE pide el PIN de un gerente, administrador o dueño, también a quien ya lo
 * es (DP-21 · Bloque 7). `<AvisoDeLaImpresora>`: avisa en la Caja si la impresora del aparato
 * está sin papel o desconectada.
 */

/** Al cobrar en efectivo. No espera ni lanza: el cobro ya quedó; si el cajón no abre, se dice. */
export function abrirCajonAlCobrar(ordenId: string, referencia?: string): void {
  abrirCajon({ por: 'cobro', ordenId, ...(referencia === undefined ? {} : { referencia }) })
    .then((resultado) => {
      if (!resultado.abierto && !resultado.sinCajon) {
        toast.warning(`El cajón no abrió: ${resultado.mensaje} Ábrelo con «Abrir cajón».`);
      }
    })
    .catch((error: unknown) => {
      console.error('[cajon] al cobrar:', error);
      toast.warning('El cajón no abrió. Ábrelo con «Abrir cajón».');
    });
}

export function BotonAbrirCajon({
  rol,
}: {
  readonly rol: string | undefined;
}): ReactElement | null {
  const { app, perfil } = usePerfilDelAparato();
  const campoDelPin = useId();
  const [abriendo, setAbriendo] = useState(false);
  const [pidiendoElPin, setPidiendoElPin] = useState(false);
  const [motivo, setMotivo] = useState<MotivoSinVenta>('dar_cambio');
  if (app === null || perfil?.tieneCajon !== true) return null;
  if (rol === undefined || !PUESTOS_QUE_ABREN_EL_CAJON.includes(rol)) return null;

  async function abrir(autorizacion: string): Promise<void> {
    if (abriendo) return;
    setAbriendo(true);
    try {
      const resultado = await abrirCajon({ por: 'manual', motivo, autorizacion });
      if (resultado.abierto) {
        // «Cajón abierto» sólo si la impresora lo confirma; si no, lo único cierto es la señal.
        if (resultado.confirmado) toast.success(textoDeLaApertura(resultado));
        else toast.info(textoDeLaApertura(resultado));
      } else if (!resultado.sinCajon) toast.error(`El cajón no abrió: ${resultado.mensaje}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'El cajón no abrió.');
    } finally {
      setAbriendo(false);
      setPidiendoElPin(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 text-sm text-texto-sutil">
          Motivo
          <select
            className="h-(--altura-control) rounded-md border border-borde bg-superficie px-2 text-sm text-texto"
            value={motivo}
            disabled={abriendo || pidiendoElPin}
            onChange={(evento) => {
              const elegido = MOTIVOS_SIN_VENTA.find((m) => m.valor === evento.target.value);
              if (elegido !== undefined) setMotivo(elegido.valor);
            }}
          >
            {MOTIVOS_SIN_VENTA.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          cargando={abriendo}
          disabled={pidiendoElPin}
          onClick={() => {
            setPidiendoElPin(true);
          }}
        >
          <Banknote aria-hidden className="mr-1 size-4" />
          Abrir cajón
        </Button>
      </div>
      {pidiendoElPin ? (
        <Superficie
          como="section"
          relleno={0}
          aria-label="PIN para abrir el cajón"
          className="flex w-full max-w-md flex-col gap-2 p-(--espacio-3)"
        >
          <p className="text-sm">
            Abrir el cajón sin venta lo autoriza un gerente, administrador o dueño con su PIN.
          </p>
          <PinDeSupervisor
            para="cajon"
            idDelCampo={campoDelPin}
            alAutorizar={(autorizada) => {
              void abrir(autorizada.token);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-end"
            disabled={abriendo}
            onClick={() => {
              setPidiendoElPin(false);
            }}
          >
            Cancelar
          </Button>
        </Superficie>
      ) : null}
    </div>
  );
}

/** Lo del aparato en la Caja: el aviso de la impresora y «Abrir cajón». Sin la app no pinta nada. */
export function AparatoEnLaCaja({
  rol,
}: {
  readonly rol: string | undefined;
}): ReactElement | null {
  const { app, perfil } = usePerfilDelAparato();
  if (app === null || perfil == null) return null;
  return (
    <div className="mb-(--espacio-3) flex flex-col gap-2" data-aparato-en-la-caja>
      <AvisoDeLaImpresora />
      <BotonAbrirCajon rol={rol} />
    </div>
  );
}

const REVISAR_CADA_MS = 20_000;

export function AvisoDeLaImpresora(): ReactElement | null {
  const { app, perfil } = usePerfilDelAparato();
  const consulta = useQuery({
    queryKey: ['app', 'estado-de-la-impresora'],
    queryFn: async () => (app === null ? null : app.estado()),
    enabled: app !== null && perfil != null,
    refetchInterval: REVISAR_CADA_MS,
    staleTime: REVISAR_CADA_MS,
  });
  const estado = consulta.data;
  if (estado?.soportado !== true) return null;
  const titulo =
    estado.sinPapel === true
      ? 'La impresora está sin papel'
      : estado.tapaAbierta === true
        ? 'La impresora tiene la tapa abierta'
        : estado.enLinea === false
          ? 'La impresora está desconectada'
          : null;
  if (titulo === null) return null;
  return (
    <Aviso tono="atencion" titulo={titulo}>
      <p>Los cobros siguen funcionando; el ticket saldrá cuando la impresora esté lista.</p>
    </Aviso>
  );
}
