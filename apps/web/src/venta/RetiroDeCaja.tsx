'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { ArrowUpFromLine } from 'lucide-react';
import { useState } from 'react';

import { ErrorApi, invocarComando } from '~/cliente/api';

import { CampoDePesos } from './CampoDePesos.tsx';
import { retiroParaEnviar } from './importe-tecleado.ts';
import { PinDeSupervisor } from './PinDeSupervisor.tsx';
import { pesosDelUmbral, retiroPideElPin } from './pin-en-retiros.ts';
import { useUmbralDeRetiro } from './use-umbral-de-retiro.ts';

/**
 * EL RETIRO QUE SALE DEL CAJÓN (§8.3 de cada `02-DINERO-Y-CAJA`, D.1 de la 2.4).
 *
 * «Retiro parcial · Encargado · − monto · No»: lo que se lleva al banco, a la caja fuerte o
 * a pagarle al proveedor. Vivía dentro de la caja de la tienda y el salón no lo tenía: el
 * dinero salía del cajón a mano y el arqueo de la noche cerraba con un faltante. Es el
 * mismo formulario para los dos, con los mismos `id` —`#retiro-importe`, `#retiro-motivo`—
 * que leen los días completos.
 *
 * Va por `caja.movimiento` a la caja de ESTA terminal, y lleva escrito a dónde va: un
 * retiro sin motivo es la única salida que puede esconder un faltante.
 */

const RUTA_MOVIMIENTO = '/api/caja/movimiento';

/** El servidor dice por qué rechazó: sin autorización, o con una que ya no sirve. */
function faltaLaAutorizacion(fallo: unknown): boolean {
  if (!(fallo instanceof ErrorApi)) return false;
  const regla = (fallo.error.datos as { readonly regla?: unknown } | undefined)?.regla;
  return regla === 'PUESTO_NO_OTORGABLE' || regla === 'AUTORIZACION_USADA';
}

export function RetiroDeCaja({
  alRetirar,
  esDeGerencia = false,
}: {
  readonly alRetirar?: () => void;
  /** Gerente, administrador o dueño: su retiro no pide el PIN de otro. */
  readonly esDeGerencia?: boolean;
}) {
  const umbral = useUmbralDeRetiro();
  const [importe, setImporte] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  // El retiro pasa del umbral: espera el PIN de un gerente antes de mandarse.
  const [pidiendoPin, setPidiendoPin] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'peligro' | 'atencion'; texto: string } | null>(null);

  const retiro = retiroParaEnviar(importe, motivo);
  const montoAbsoluto = 'cuerpo' in retiro ? Math.abs(retiro.cuerpo.montoCentavos) : null;
  const pideElPin =
    montoAbsoluto !== null && retiroPideElPin(montoAbsoluto, umbral ?? null, esDeGerencia);

  async function enviar(autorizacion: string | null): Promise<void> {
    if (!('cuerpo' in retiro)) {
      setAviso({ tono: 'atencion', texto: retiro.tropiezo });
      return;
    }
    setGuardando(true);
    setAviso(null);
    try {
      await invocarComando(RUTA_MOVIMIENTO, {
        ...retiro.cuerpo,
        ...(autorizacion === null ? {} : { autorizacion }),
      });
      setImporte('');
      setMotivo('');
      setPidiendoPin(false);
      alRetirar?.();
    } catch (fallo: unknown) {
      // Una autorización vencida, usada o de otro monto —o un umbral que cambió—: PIN otra vez.
      if (faltaLaAutorizacion(fallo)) setPidiendoPin(true);
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

  async function retirar(): Promise<void> {
    if (!('cuerpo' in retiro)) {
      setAviso({ tono: 'atencion', texto: retiro.tropiezo });
      return;
    }
    if (pideElPin) {
      setAviso(null);
      setPidiendoPin(true);
      return;
    }
    await enviar(null);
  }

  return (
    <Superficie
      como="form"
      nivel={0}
      relleno={4}
      aria-labelledby="retiro-titulo"
      onSubmit={(evento) => {
        evento.preventDefault();
        void retirar();
      }}
      className="flex flex-col gap-(--espacio-4)"
    >
      <div className="flex items-start gap-(--espacio-3)">
        <ArrowUpFromLine
          aria-hidden="true"
          className="mt-(--espacio-1) size-5 shrink-0 text-texto-sutil"
        />
        <div className="flex flex-col gap-(--espacio-1)">
          <h2 id="retiro-titulo" className="font-semibold">
            Retirar
          </h2>
          <p className="text-sm text-texto-sutil">
            Lo que sale del cajón lleva escrito a dónde va.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-(--espacio-2)">
        <Label htmlFor="retiro-importe">Cuánto</Label>
        <CampoDePesos
          id="retiro-importe"
          siguiente="retiro-motivo"
          value={importe}
          onChange={(evento) => {
            setImporte(evento.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-(--espacio-2)">
        <Label htmlFor="retiro-motivo">A dónde va</Label>
        <Input
          id="retiro-motivo"
          className="h-[calc(var(--altura-control)*1.25)]"
          placeholder="al banco · pago a Bimbo · caja fuerte"
          value={motivo}
          onChange={(evento) => {
            setMotivo(evento.target.value);
          }}
        />
      </div>

      {pidiendoPin && pideElPin ? (
        <div className="flex flex-col gap-(--espacio-2)">
          <Aviso tono="info" titulo="Un retiro de ese monto lo autoriza un gerente.">
            Pasa de {pesosDelUmbral(umbral ?? 0)}: que un gerente, administrador o dueño teclee su
            PIN. Sirve una sola vez y para este monto.
          </Aviso>
          <PinDeSupervisor
            key={montoAbsoluto}
            para="retiro"
            montoCentavos={montoAbsoluto}
            idDelCampo="retiro-pin"
            alAutorizar={(autorizada) => {
              void enviar(autorizada.token);
            }}
          />
        </div>
      ) : null}

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
          disabled={guardando || (pidiendoPin && pideElPin)}
          cargando={guardando}
        >
          {pidiendoPin && pideElPin ? 'Esperando el PIN…' : 'Registrar el retiro'}
        </Button>
      </div>
    </Superficie>
  );
}
