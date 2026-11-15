'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Esqueleto } from '@morphiqpos/ui/sistema';
import { Cable, RefreshCw } from 'lucide-react';

import type { Impresora, MorphiqApp } from '../puente/contrato.ts';
import { CONEXIONES, type Conexion } from '../termico/perfil.ts';
import { CampoDeTexto, SeccionDelLab } from './campos';
import { conConexion, conImpresoraElegida } from './cambios-del-formulario.ts';
import { poniendo, type PropsDelFormulario } from './lab-tipos.ts';
import { mismoDestino, NOMBRES_DE_CONEXIONES } from './nombres.ts';
import { resultadoDeUnError } from './resultado-de-prueba.ts';

/**
 * 2 · LAS CONEXIONES (DP-20 · laboratorio): las que la plataforma sabe hacer, y las que no se ven
 * desactivadas con su razón. Por lista (impresoras de Windows, USB, Bluetooth), por red (IP y
 * puerto) o por puerto serie (COM y baudios).
 */

const MOTIVO_SIN_DECIR = 'Esta plataforma no puede usar esta conexión.';

function Impresoras({
  app,
  props,
  impresoras,
}: {
  readonly app: MorphiqApp;
  readonly props: PropsDelFormulario;
  readonly impresoras: readonly Impresora[];
}): ReactElement {
  const { formulario, errores, actualizar } = props;
  const [permisos, setPermisos] = useState<Readonly<Record<string, string>>>({});
  const delTipo = impresoras.filter((i) => i.destino.conexion === formulario.conexion);

  async function pedirPermiso(impresora: Impresora): Promise<void> {
    let mensaje: string;
    try {
      const respuesta = await app.pedirPermiso(impresora.destino);
      mensaje = respuesta.concedido
        ? 'Permiso concedido ✓'
        : (respuesta.mensaje ?? 'No se dio el permiso.');
    } catch (error: unknown) {
      mensaje = resultadoDeUnError(error).texto;
    }
    setPermisos((antes) => ({ ...antes, [impresora.id]: mensaje }));
  }

  if (delTipo.length === 0) {
    return (
      <p className="text-sm text-texto-sutil">
        No se encontró ninguna impresora con esta conexión. Conéctala, enciéndela y toca «Buscar de
        nuevo».
      </p>
    );
  }
  return (
    <fieldset className="flex flex-col gap-(--espacio-2)">
      <legend className="mb-(--espacio-1) text-sm font-medium">Impresora</legend>
      {delTipo.map((impresora) => (
        <div
          key={impresora.id}
          className="flex flex-wrap items-center justify-between gap-(--espacio-2) rounded-md border border-borde px-(--espacio-3) py-(--espacio-2)"
        >
          <label className="flex min-h-(--altura-control) flex-1 cursor-pointer items-center gap-(--espacio-3) text-sm">
            <input
              type="radio"
              name="impresora-del-laboratorio"
              className="size-5 accent-primario"
              checked={mismoDestino(formulario.elegida, impresora.destino)}
              onChange={() => {
                actualizar((f) => conImpresoraElegida(f, impresora.destino, impresora.nombre));
              }}
            />
            <span className="flex flex-col">
              <span className="font-medium">
                {impresora.nombre}
                {impresora.predeterminada === true ? ' · predeterminada' : ''}
              </span>
              {impresora.detalle === undefined ? null : (
                <span className="text-xs text-texto-sutil">{impresora.detalle}</span>
              )}
              {impresora.esImpresora === false ? (
                <span className="text-xs text-texto-sutil">No parece una impresora.</span>
              ) : null}
            </span>
          </label>
          {impresora.conPermiso === false ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void pedirPermiso(impresora);
              }}
            >
              Dar permiso
            </Button>
          ) : null}
          {permisos[impresora.id] === undefined ? null : (
            <p role="status" className="basis-full text-xs">
              {permisos[impresora.id]}
            </p>
          )}
        </div>
      ))}
      {errores.elegida === undefined ? null : (
        <p role="alert" className="text-sm text-peligro">
          × {errores.elegida}
        </p>
      )}
    </fieldset>
  );
}

export function LabConexion({
  app,
  ...props
}: PropsDelFormulario & { readonly app: MorphiqApp }): ReactElement {
  const { formulario, errores, actualizar } = props;
  const conexiones = useQuery({ queryKey: ['lab', 'conexiones'], queryFn: () => app.conexiones() });
  const impresoras = useQuery({ queryKey: ['lab', 'impresoras'], queryFn: () => app.impresoras() });
  const buscando = conexiones.isFetching || impresoras.isFetching;

  return (
    <SeccionDelLab
      titulo="2 · Las conexiones"
      icono={<Cable aria-hidden className="size-5 shrink-0 text-primario" />}
      descripcion="Elige cómo se le habla a la impresora. Las que esta plataforma no puede se ven desactivadas, con su razón."
    >
      {conexiones.data === undefined ? (
        conexiones.isError ? (
          <Aviso tono="peligro" titulo="La app no dijo qué conexiones tiene.">
            <p>{conexiones.error.message}</p>
          </Aviso>
        ) : (
          <Esqueleto className="h-32 w-full rounded-lg" />
        )
      ) : (
        <fieldset className="grid gap-(--espacio-2) md:grid-cols-2">
          <legend className="mb-(--espacio-1) text-sm font-medium">Conexión</legend>
          {CONEXIONES.map((conexion: Conexion) => {
            const capacidad = conexiones.data.find((c) => c.conexion === conexion);
            const disponible = capacidad?.disponible === true;
            const razon = capacidad?.motivo ?? MOTIVO_SIN_DECIR;
            return (
              <label
                key={conexion}
                className="flex min-h-(--altura-control) cursor-pointer items-start gap-(--espacio-3) rounded-md border border-borde px-(--espacio-3) py-(--espacio-2) text-sm has-checked:border-primario has-disabled:cursor-not-allowed has-disabled:opacity-60"
              >
                <input
                  type="radio"
                  name="conexion-del-laboratorio"
                  className="mt-0.5 size-5 accent-primario"
                  disabled={!disponible}
                  checked={formulario.conexion === conexion}
                  onChange={() => {
                    actualizar((f) => conConexion(f, conexion));
                  }}
                />
                <span className="flex flex-col">
                  <span className="font-medium">{NOMBRES_DE_CONEXIONES[conexion]}</span>
                  {disponible ? null : (
                    <span className="text-xs text-texto-sutil">No disponible · {razon}</span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {formulario.conexion === 'red' ? (
        <div className="grid gap-(--espacio-4) sm:grid-cols-2">
          <CampoDeTexto
            etiqueta="IP o nombre de la impresora"
            marcador="192.168.1.50"
            valor={formulario.host}
            error={errores.host}
            alCambiar={(host) => {
              actualizar(poniendo({ host }));
            }}
          />
          <CampoDeTexto
            etiqueta="Puerto"
            numerico
            marcador="9100"
            valor={formulario.puerto}
            error={errores.puerto}
            ayuda="9100 es el de casi todas las térmicas."
            alCambiar={(puerto) => {
              actualizar(poniendo({ puerto }));
            }}
          />
        </div>
      ) : formulario.conexion === 'serial' ? (
        <div className="grid gap-(--espacio-4) sm:grid-cols-2">
          <CampoDeTexto
            etiqueta="Puerto COM"
            marcador="COM3"
            valor={formulario.puertoSerie}
            error={errores.puertoSerie}
            alCambiar={(puertoSerie) => {
              actualizar(poniendo({ puertoSerie }));
            }}
          />
          <CampoDeTexto
            etiqueta="Baudios"
            numerico
            marcador="9600"
            valor={formulario.baudios}
            error={errores.baudios}
            alCambiar={(baudios) => {
              actualizar(poniendo({ baudios }));
            }}
          />
        </div>
      ) : impresoras.data === undefined ? (
        impresoras.isError ? (
          <Aviso tono="peligro" titulo="La app no pudo buscar impresoras.">
            <p>{impresoras.error.message}</p>
          </Aviso>
        ) : (
          <Esqueleto className="h-20 w-full rounded-lg" />
        )
      ) : (
        <Impresoras app={app} props={props} impresoras={impresoras.data} />
      )}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={buscando}
        cargando={buscando}
        onClick={() => {
          void conexiones.refetch();
          void impresoras.refetch();
        }}
      >
        <RefreshCw aria-hidden className="size-4" />
        Buscar de nuevo
      </Button>
    </SeccionDelLab>
  );
}
