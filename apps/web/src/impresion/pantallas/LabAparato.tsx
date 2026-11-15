'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Esqueleto } from '@morphiqpos/ui/sistema';
import { MonitorSmartphone, RefreshCw } from 'lucide-react';

import type { Diagnostico, MorphiqApp } from '../puente/contrato.ts';
import { describirDestino } from '../termico/perfil.ts';
import { SeccionDelLab } from './campos';

/**
 * 1 · EL APARATO (DP-20 · laboratorio): lo que la app dice de la máquina —sistema, memoria,
 * procesador, pantalla, navegador— y de lo que ve conectado: impresoras, USB, Bluetooth y
 * servicios de marca. Los avisos de la app salen tal cual.
 */

function Dato({
  etiqueta,
  valor,
}: {
  readonly etiqueta: string;
  readonly valor: string;
}): ReactElement {
  return (
    <>
      <dt className="text-texto-sutil">{etiqueta}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </>
  );
}

function Lista({
  titulo,
  vacio,
  renglones,
}: {
  readonly titulo: string;
  readonly vacio: string;
  readonly renglones: readonly string[];
}): ReactElement {
  return (
    <div className="flex flex-col gap-(--espacio-1)">
      <h4 className="text-sm font-medium">{titulo}</h4>
      {renglones.length === 0 ? (
        <p className="text-sm text-texto-sutil">{vacio}</p>
      ) : (
        <ul className="list-disc pl-(--espacio-5) text-sm">
          {renglones.map((renglon) => (
            <li key={renglon}>{renglon}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const enMb = (mb: number): string => `${(mb / 1024).toFixed(1)} GB`;

function DiagnosticoLeido({ d }: { readonly d: Diagnostico }): ReactElement {
  const sistema = `${d.sistema.nombre} ${d.sistema.version} · ${String(d.sistema.bits)} bits`;
  const aparato =
    d.sistema.marca === undefined && d.sistema.modelo === undefined
      ? null
      : `${d.sistema.marca ?? ''} ${d.sistema.modelo ?? ''}`.trim();
  return (
    <div className="flex flex-col gap-(--espacio-4)">
      <dl className="grid grid-cols-[auto_1fr] gap-x-(--espacio-4) gap-y-(--espacio-1) text-sm">
        <Dato etiqueta="App" valor={`${d.app.nombre} ${d.app.version} · ${d.app.cliente}`} />
        <Dato etiqueta="Plataforma" valor={d.plataforma === 'windows' ? 'Windows' : 'Android'} />
        <Dato etiqueta="Sistema" valor={sistema} />
        {aparato === null ? null : <Dato etiqueta="Aparato" valor={aparato} />}
        <Dato
          etiqueta="Memoria"
          valor={`${enMb(d.memoria.libreMb)} libres de ${enMb(d.memoria.totalMb)}`}
        />
        <Dato
          etiqueta="Procesador"
          valor={`${d.procesador.nombre} · ${String(d.procesador.nucleos)} núcleos · ${d.procesador.arquitectura}`}
        />
        <Dato
          etiqueta="Pantalla"
          valor={`${String(d.pantalla.anchoPx)} × ${String(d.pantalla.altoPx)} px · escala ${String(d.pantalla.escala)} · ${d.pantalla.tactil ? 'táctil' : 'sin tacto'}`}
        />
        <Dato etiqueta="Navegador" valor={`${d.navegador.nombre} ${d.navegador.version}`} />
        <Dato
          etiqueta="Modo ligero"
          valor={`${d.modoLigero.activo ? 'encendido' : 'apagado'} · ${d.modoLigero.motivo}`}
        />
      </dl>
      <div className="grid gap-(--espacio-4) md:grid-cols-2">
        <Lista
          titulo="Impresoras que ve"
          vacio="Ninguna."
          renglones={d.impresoras.map(
            (i) =>
              `${i.nombre} · ${describirDestino(i.destino)}${i.predeterminada === true ? ' · predeterminada' : ''}`,
          )}
        />
        <Lista
          titulo="USB"
          vacio="Nada conectado por USB."
          renglones={(d.usb ?? []).map(
            (u) =>
              `${u.nombre} · ${String(u.vendorId)}:${String(u.productId)}${u.esImpresora ? ' · impresora' : ''}`,
          )}
        />
        <Lista
          titulo="Bluetooth"
          vacio="Nada emparejado."
          renglones={(d.bluetooth ?? []).map(
            (b) => `${b.nombre} · ${b.direccion}${b.esInnerPrinter ? ' · impresora interna' : ''}`,
          )}
        />
        <Lista titulo="Servicios de marca" vacio="Ninguno." renglones={d.serviciosDeMarca ?? []} />
      </div>
      {d.avisos.length === 0 ? null : (
        <Aviso tono="atencion" titulo="Avisos de la app">
          <ul className="list-disc pl-(--espacio-5)">
            {d.avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        </Aviso>
      )}
    </div>
  );
}

export function LabAparato({ app }: { readonly app: MorphiqApp }): ReactElement {
  const diagnostico = useQuery({
    queryKey: ['lab', 'diagnostico'],
    queryFn: () => app.diagnostico(),
    staleTime: 30_000,
  });
  return (
    <SeccionDelLab
      titulo="1 · El aparato"
      icono={<MonitorSmartphone aria-hidden className="size-5 shrink-0 text-primario" />}
      descripcion="Lo que la app ve de esta máquina y de lo que tiene conectado."
    >
      {diagnostico.data === undefined ? (
        diagnostico.isError ? (
          <Aviso tono="peligro" titulo="La app no pudo dar el diagnóstico.">
            <p>{diagnostico.error.message}</p>
          </Aviso>
        ) : (
          <Esqueleto className="h-40 w-full rounded-lg" />
        )
      ) : (
        <DiagnosticoLeido d={diagnostico.data} />
      )}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={diagnostico.isFetching}
        cargando={diagnostico.isFetching}
        onClick={() => {
          void diagnostico.refetch();
        }}
      >
        <RefreshCw aria-hidden className="size-4" />
        Volver a leer
      </Button>
    </SeccionDelLab>
  );
}
