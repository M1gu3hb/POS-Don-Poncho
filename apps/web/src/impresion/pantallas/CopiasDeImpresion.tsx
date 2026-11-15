'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Esqueleto, Superficie } from '@morphiqpos/ui/sistema';
import { Copy } from 'lucide-react';

import { consultarPuente, invocarComando } from '~/cliente/api';

import { CLAVE_DE_LAS_COPIAS, copiasLeidas, type CopiasDeImpresion as Copias } from '../copias.ts';
import {
  copiasConCambio,
  copiasIguales,
  DOCUMENTOS_CON_COPIAS,
  OPCIONES_DE_COPIAS,
} from './copias-formulario.ts';

/**
 * OPERACIÓN → «COPIAS DEL TICKET DE VENTA», «DE LA PRECUENTA» Y «DEL CORTE» (DP-20 · refuerzo §3).
 *
 * De 1 a 3 cada una, con un solo «Guardar». Las cambian el dueño o el administrador (el servidor
 * lo exige); los demás las ven y no las editan.
 */
export function CopiasDeImpresion({
  puedeCambiar,
}: {
  readonly puedeCambiar: boolean;
}): ReactElement {
  const consultas = useQueryClient();
  const titulo = useId();
  const guardadas = useQuery({
    queryKey: CLAVE_DE_LAS_COPIAS,
    queryFn: async () => {
      const [configuracion] = await consultarPuente<{ copias_de_impresion?: unknown }>(
        'ConfiguracionNegocio',
        { limite: 1 },
      );
      return copiasLeidas(configuracion);
    },
    staleTime: 60_000,
  });
  const [elegidas, setElegidas] = useState<Copias | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const actuales = elegidas ?? guardadas.data;
  const hayCambios =
    actuales !== undefined &&
    guardadas.data !== undefined &&
    !copiasIguales(actuales, guardadas.data);

  async function guardar(): Promise<void> {
    if (guardando || actuales === undefined) return;
    setGuardando(true);
    setFallo(null);
    setListo(false);
    try {
      await invocarComando('/api/caja/fijar-copias-de-impresion', {
        ticket: actuales.ticket,
        precuenta: actuales.precuenta,
        corte: actuales.corte,
      });
      await consultas.invalidateQueries({ queryKey: CLAVE_DE_LAS_COPIAS });
      await consultas.invalidateQueries({ queryKey: ['config'] });
      setElegidas(null);
      setListo(true);
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudieron guardar las copias.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={titulo}
      className="mt-(--espacio-4) flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex flex-col gap-(--espacio-1)">
        <h3 id={titulo} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
          <Copy aria-hidden className="size-5 shrink-0 text-primario" />
          Copias de impresión
        </h3>
        <p className="max-w-prose text-sm text-texto-sutil">
          Cada copia dice al pie «ORIGINAL — CLIENTE» o «COPIA — NEGOCIO». El cajón se abre una sola
          vez, sin importar cuántas copias salgan.
        </p>
      </div>
      {actuales === undefined ? (
        guardadas.isError ? (
          <Aviso tono="peligro" titulo="No se pudieron leer las copias guardadas.">
            <p>Recarga la página; si sigue igual, avisa a tu proveedor.</p>
          </Aviso>
        ) : (
          <Esqueleto className="h-(--altura-control) w-full max-w-md rounded-lg" />
        )
      ) : (
        <form
          className="flex flex-col gap-(--espacio-4)"
          onSubmit={(evento) => {
            evento.preventDefault();
            void guardar();
          }}
        >
          <div className="grid gap-(--espacio-4) sm:grid-cols-3">
            {DOCUMENTOS_CON_COPIAS.map((documento) => (
              <label
                key={documento.clave}
                className="flex flex-col gap-(--espacio-1) text-sm font-medium"
              >
                {documento.nombre}
                <select
                  className="h-(--altura-control) rounded-md border border-borde-fuerte bg-superficie px-(--espacio-2) text-base font-normal text-texto outline-none focus-visible:border-anillo focus-visible:ring-[3px] focus-visible:ring-anillo/50 disabled:opacity-60"
                  value={actuales[documento.clave]}
                  disabled={!puedeCambiar || guardando}
                  onChange={(evento) => {
                    setListo(false);
                    setElegidas(copiasConCambio(actuales, documento.clave, evento.target.value));
                  }}
                >
                  {OPCIONES_DE_COPIAS.map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? '1 copia' : `${String(n)} copias`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {puedeCambiar ? (
            <div className="flex flex-wrap items-center gap-(--espacio-3)">
              <Button
                type="submit"
                variant="outline"
                disabled={guardando || !hayCambios}
                cargando={guardando}
              >
                Guardar
              </Button>
              {listo ? (
                <p role="status" className="text-sm font-medium">
                  ✓ Guardado
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-texto-sutil">Las cambian el dueño o el administrador.</p>
          )}
        </form>
      )}
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </Superficie>
  );
}
