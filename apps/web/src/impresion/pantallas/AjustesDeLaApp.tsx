'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Progreso, Superficie } from '@morphiqpos/ui/sistema';
import { Activity, Download, Gauge, RefreshCw } from 'lucide-react';

import type { Actualizacion, MorphiqApp } from '../puente/contrato.ts';
import { CLAVE_DE_LOS_AJUSTES, usePerfilDelAparato } from '../use-app.ts';
import {
  comoActualizacion,
  fraseDelModoLigero,
  opcionDelModoLigero,
  OPCIONES_DEL_MODO_LIGERO,
  textoDeLaActualizacion,
  valorDelModoLigero,
  type OpcionDelModoLigero,
} from './ajustes-de-la-app.ts';
import { resultadoDeUnError } from './resultado-de-prueba.ts';

/**
 * «ESTE APARATO», DENTRO DE LA APP (DP-20 · Parte 4): el modo ligero, la versión con su botón de
 * actualizar y el diagnóstico. Todo se guarda en el aparato, no en el negocio.
 */

function ModoLigeroDelAparato({ app }: { readonly app: MorphiqApp }): ReactElement {
  const consultas = useQueryClient();
  const { ajustes } = usePerfilDelAparato();
  const titulo = useId();
  const [fallo, setFallo] = useState<string | null>(null);
  const modo = useQuery({ queryKey: ['app', 'modo-ligero'], queryFn: () => app.modoLigero() });

  useEffect(
    () =>
      app.escuchar('modo-ligero', () => {
        void consultas.invalidateQueries({ queryKey: ['app', 'modo-ligero'] });
      }),
    [app, consultas],
  );

  const elegida = opcionDelModoLigero(ajustes?.modoLigero);

  async function elegir(opcion: OpcionDelModoLigero): Promise<void> {
    setFallo(null);
    try {
      const guardados = await app.guardarAjustes({ modoLigero: valorDelModoLigero(opcion) });
      consultas.setQueryData(CLAVE_DE_LOS_AJUSTES, guardados);
      await consultas.invalidateQueries({ queryKey: ['app', 'modo-ligero'] });
    } catch (error: unknown) {
      setFallo(resultadoDeUnError(error).texto);
    }
  }

  return (
    <fieldset className="flex flex-col gap-(--espacio-2)" aria-describedby={titulo}>
      <legend className="flex items-center gap-(--espacio-2) text-sm font-medium">
        <Gauge aria-hidden className="size-4 text-primario" />
        Modo ligero
      </legend>
      <p id={titulo} className="max-w-prose text-sm text-texto-sutil">
        Quita animaciones y efectos para que un aparato lento responda mejor. En automático, la app
        lo enciende sola cuando el aparato anda justo.
      </p>
      <div className="flex flex-wrap gap-(--espacio-2)">
        {OPCIONES_DEL_MODO_LIGERO.map((opcion) => (
          <label
            key={opcion.valor}
            className="flex min-h-(--altura-control) cursor-pointer items-center gap-(--espacio-2) rounded-md border border-borde bg-superficie px-(--espacio-4) text-sm has-checked:border-primario has-checked:font-semibold has-focus-visible:ring-[3px] has-focus-visible:ring-anillo/60"
          >
            <input
              type="radio"
              name="modo-ligero"
              className="accent-primario"
              checked={elegida === opcion.valor}
              onChange={() => {
                void elegir(opcion.valor);
              }}
            />
            {opcion.nombre}
          </label>
        ))}
      </div>
      {modo.data === undefined ? null : (
        <p className="text-sm text-texto-sutil" role="status">
          {fraseDelModoLigero(modo.data)}
        </p>
      )}
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </fieldset>
  );
}

function VersionDeLaApp({ app }: { readonly app: MorphiqApp }): ReactElement {
  const version = useQuery({ queryKey: ['app', 'version'], queryFn: () => app.version() });
  const [estado, setEstado] = useState<Actualizacion | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(
    () =>
      app.escuchar('actualizacion', (datos) => {
        const nueva = comoActualizacion(datos);
        if (nueva !== null) setEstado(nueva);
      }),
    [app],
  );

  async function pedir(accion: () => Promise<Actualizacion>): Promise<void> {
    if (trabajando) return;
    setTrabajando(true);
    setFallo(null);
    try {
      setEstado(await accion());
    } catch (error: unknown) {
      setFallo(resultadoDeUnError(error).texto);
    } finally {
      setTrabajando(false);
    }
  }

  const texto = estado === null ? null : textoDeLaActualizacion(estado);
  return (
    <div className="flex flex-col gap-(--espacio-2)">
      <p className="text-sm font-medium">
        Versión de la app:{' '}
        <span className="tabular-nums text-texto-sutil">{version.data ?? 'leyendo…'}</span>
      </p>
      <div className="flex flex-wrap items-center gap-(--espacio-2)">
        <Button
          type="button"
          variant="outline"
          disabled={trabajando}
          cargando={trabajando}
          onClick={() => {
            void pedir(() => app.buscarActualizacion());
          }}
        >
          <RefreshCw aria-hidden className="size-4" />
          Buscar actualización
        </Button>
        {texto?.instalable === true ? (
          <Button
            type="button"
            disabled={trabajando}
            onClick={() => {
              void pedir(() => app.instalarActualizacion());
            }}
          >
            <Download aria-hidden className="size-4" />
            Actualizar
          </Button>
        ) : null}
      </div>
      {texto === null ? null : (
        <div role="status" className="flex flex-col gap-(--espacio-1) text-sm">
          <p className={texto.fallo ? 'font-medium text-peligro' : 'font-medium'}>
            {texto.fallo ? '× ' : ''}
            {texto.titulo}
          </p>
          {texto.detalle === null ? null : <p className="text-texto-sutil">{texto.detalle}</p>}
          {texto.avance === null ? null : (
            <Progreso valor={texto.avance} etiqueta="Descarga de la actualización" />
          )}
        </div>
      )}
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </div>
  );
}

function DiagnosticoDeLaApp({ app }: { readonly app: MorphiqApp }): ReactElement {
  const [fallo, setFallo] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-(--espacio-2)">
      <p className="max-w-prose text-sm text-texto-sutil">
        El diagnóstico junta lo que tu proveedor necesita para ayudarte: el aparato, las impresoras
        que ve y los avisos de la app.
      </p>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => {
          setFallo(null);
          app.abrirDiagnostico().catch((error: unknown) => {
            setFallo(resultadoDeUnError(error).texto);
          });
        }}
      >
        <Activity aria-hidden className="size-4" />
        Diagnóstico
      </Button>
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </div>
  );
}

export function AjustesDeLaApp({ app }: { readonly app: MorphiqApp }): ReactElement {
  const titulo = useId();
  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={titulo}
      className="flex flex-col gap-(--espacio-6) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <h3 id={titulo} className="text-lg font-semibold">
        Este aparato
      </h3>
      <ModoLigeroDelAparato app={app} />
      <VersionDeLaApp app={app} />
      <DiagnosticoDeLaApp app={app} />
    </Superficie>
  );
}
