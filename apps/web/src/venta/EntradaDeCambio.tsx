'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { ArrowDownToLine } from 'lucide-react';
import { useState } from 'react';

import { ErrorApi, invocarComando } from '~/cliente/api';

import { CampoDePesos } from './CampoDePesos.tsx';
import {
  ORIGENES_DEL_CAMBIO,
  entradaParaEnviar,
  type OrigenDelCambio,
} from './importe-tecleado.ts';

/**
 * DP-15 · EL EFECTIVO QUE ENTRA AL CAJÓN Y NO ES UN COBRO: el cambio que trae el dueño o el banco.
 *
 * El comando (`caja.entrada_cambio`) existía y el corte ya sumaba «Entradas de cambio» al efectivo
 * esperado, pero ninguna pantalla lo usaba: el cambio que entraba a media jornada salía en el arqueo
 * como un sobrante sin explicación. Lo registra quien tiene la caja (cajera, gerente, administrador,
 * dueño), en la caja abierta de ESTE aparato.
 */

const RUTA = '/api/caja/entrada-cambio';

export function EntradaDeCambio({ alRegistrar }: { readonly alRegistrar?: () => void }) {
  const [importe, setImporte] = useState('');
  const [origen, setOrigen] = useState<OrigenDelCambio>('dueno');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'peligro' | 'atencion'; texto: string } | null>(null);

  async function registrar(): Promise<void> {
    const entrada = entradaParaEnviar(importe, origen, motivo);
    if ('tropiezo' in entrada) {
      setAviso({ tono: 'atencion', texto: entrada.tropiezo });
      return;
    }
    setGuardando(true);
    setAviso(null);
    try {
      await invocarComando(RUTA, entrada.cuerpo);
      setImporte('');
      setMotivo('');
      alRegistrar?.();
    } catch (fallo: unknown) {
      setAviso({
        tono: 'peligro',
        texto:
          fallo instanceof ErrorApi
            ? fallo.message
            : 'No se pudo. Lo capturado sigue aquí: vuelve a intentarlo.',
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Superficie
      como="form"
      nivel={0}
      relleno={4}
      aria-labelledby="entrada-titulo"
      onSubmit={(evento) => {
        evento.preventDefault();
        void registrar();
      }}
      className="flex flex-col gap-(--espacio-4)"
    >
      <div className="flex items-start gap-(--espacio-3)">
        <ArrowDownToLine
          aria-hidden="true"
          className="mt-(--espacio-1) size-5 shrink-0 text-texto-sutil"
        />
        <div className="flex flex-col gap-(--espacio-1)">
          <h2 id="entrada-titulo" className="font-semibold">
            Entrada de cambio
          </h2>
          <p className="text-sm text-texto-sutil">
            El efectivo que entra al cajón sin ser un cobro, con de dónde viene.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-(--espacio-2)">
        <Label htmlFor="entrada-importe">Cuánto</Label>
        <CampoDePesos
          id="entrada-importe"
          siguiente="entrada-origen"
          value={importe}
          onChange={(evento) => {
            setImporte(evento.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-(--espacio-2)">
        <Label htmlFor="entrada-origen">De dónde viene</Label>
        <select
          id="entrada-origen"
          className="h-[calc(var(--altura-control)*1.25)] rounded-md border border-borde bg-superficie px-(--espacio-3)"
          value={origen}
          onChange={(evento) => {
            setOrigen(evento.target.value as OrigenDelCambio);
          }}
        >
          {ORIGENES_DEL_CAMBIO.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-(--espacio-2)">
        <Label htmlFor="entrada-motivo">Nota (opcional)</Label>
        <Input
          id="entrada-motivo"
          className="h-[calc(var(--altura-control)*1.25)]"
          placeholder="cambio en monedas · fondo extra"
          value={motivo}
          onChange={(evento) => {
            setMotivo(evento.target.value);
          }}
        />
      </div>

      {aviso === null ? null : aviso.tono === 'peligro' ? (
        <Aviso tono="peligro" titulo={aviso.texto} />
      ) : (
        <Aviso tono="atencion" titulo={aviso.texto}>
          No se mandó nada.
        </Aviso>
      )}

      <div className="mt-auto">
        <Button
          type="submit"
          size="lg"
          variant="outline"
          className="w-full"
          disabled={guardando}
          cargando={guardando}
        >
          Registrar la entrada
        </Button>
      </div>
    </Superficie>
  );
}
