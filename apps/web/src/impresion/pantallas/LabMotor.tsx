'use client';

import { useState, useSyncExternalStore, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso } from '@morphiqpos/ui/sistema';
import { Check, Cpu, X } from 'lucide-react';

import {
  AVISO_DEL_NIVEL,
  chromiumDe,
  probarCompatibilidad,
  type ResultadoDeCompatibilidad,
  type VentanaSondeable,
} from '~/compatibilidad/sondas';

import { SeccionDelLab } from './campos';

/**
 * EL MOTOR DE ESTE APARATO (DP-20.1 · laboratorio).
 *
 * Los POS con Android viejo traen un navegador interno que no se actualiza, y de él depende cómo
 * se ve el POS. Aquí se lee tal cual lo declara el aparato y, con «Probar compatibilidad», se le
 * pregunta cosa por cosa qué entiende. No hace falta la app: funciona también en un navegador.
 */

const sinCambios = (): (() => void) => () => undefined;
const leerAgente = (): string => navigator.userAgent;
const agenteEnElServidor = (): string => '';

function Sonda({ etiqueta, pasa }: { readonly etiqueta: string; readonly pasa: boolean }) {
  const Icono = pasa ? Check : X;
  return (
    <li className="flex items-center gap-(--espacio-2) text-sm">
      <Icono
        aria-hidden
        className={pasa ? 'size-4 text-exito-texto' : 'size-4 text-peligro-texto'}
      />
      <span>{etiqueta}</span>
      <span className={pasa ? 'text-texto-sutil' : 'font-medium'}>· {pasa ? 'pasa' : 'falla'}</span>
    </li>
  );
}

function Resultado({ resultado }: { readonly resultado: ResultadoDeCompatibilidad }): ReactElement {
  const aviso = AVISO_DEL_NIVEL[resultado.nivel];
  const fallan = resultado.sondas.filter((s) => !s.pasa).length;
  return (
    <div className="flex flex-col gap-(--espacio-3)" data-nivel-del-motor={resultado.nivel}>
      {aviso === null ? (
        <Aviso tono="exito" titulo="Este aparato entiende todo lo que usa el POS." />
      ) : (
        <Aviso tono={resultado.nivel === 'compatible' ? 'atencion' : 'peligro'} titulo={aviso} />
      )}
      <p className="text-sm text-texto-sutil">
        {String(resultado.sondas.length - fallan)} de {String(resultado.sondas.length)} pasan.
      </p>
      <ul className="grid gap-x-(--espacio-6) gap-y-(--espacio-1) sm:grid-cols-2">
        {resultado.sondas.map((sonda) => (
          <Sonda key={sonda.id} etiqueta={sonda.etiqueta} pasa={sonda.pasa} />
        ))}
      </ul>
    </div>
  );
}

export function LabMotor(): ReactElement {
  const agente = useSyncExternalStore(sinCambios, leerAgente, agenteEnElServidor);
  const [resultado, setResultado] = useState<ResultadoDeCompatibilidad | null>(null);
  const chromium = chromiumDe(agente);

  return (
    <SeccionDelLab
      titulo="El motor de este aparato"
      descripcion="El navegador interno con el que el aparato pinta el POS. En los POS con Android viejo no se actualiza: por eso el POS trae un modo compatible."
      icono={<Cpu aria-hidden className="size-5" />}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-(--espacio-4) gap-y-(--espacio-1) text-sm">
        <dt className="text-texto-sutil">Motor</dt>
        <dd className="tabular-nums">
          {chromium === null ? 'No es Chromium (o no lo declara)' : `Chromium ${chromium}`}
        </dd>
        <dt className="text-texto-sutil">Se identifica como</dt>
        <dd className="break-all">{agente}</dd>
      </dl>
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setResultado(probarCompatibilidad(window as unknown as VentanaSondeable));
          }}
        >
          Probar compatibilidad
        </Button>
      </div>
      {resultado === null ? null : <Resultado resultado={resultado} />}
    </SeccionDelLab>
  );
}
