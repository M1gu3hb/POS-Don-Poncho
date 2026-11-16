'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Aviso, Esqueleto, Superficie } from '@morphiqpos/ui/sistema';
import { Hash } from 'lucide-react';

import { consultarPuente, invocarComando } from '~/cliente/api';

import {
  CLAVE_DE_LOS_FOLIOS,
  entradaDeLosFolios,
  foliosIgualesEnPantalla,
  foliosLeidos,
  numeroTecleado,
  porQueNoSeCambiaElPrimerFolio,
  prefijoTecleado,
  vistaPreviaDeLosFolios,
  type FoliosEditables,
} from './folios-formulario.ts';

/**
 * CONFIGURACIÓN → OPERACIÓN · «Prefijo del folio» y «Primer folio» (DP-21 · Bloque 6).
 *
 * El prefijo («DP») sólo cambia cómo se LEE el folio: «DP-01001» las cuentas, «DPC-0101» los
 * cortes. El primer folio de cada serie sólo se cambia con los folios en cero y mientras el
 * negocio no opere de verdad. Los guarda el dueño con `configuracion.fijar_folios`; los demás los
 * ven y no los editan.
 */
export function FoliosDelNegocio({
  puedeCambiar,
}: {
  readonly puedeCambiar: boolean;
}): ReactElement {
  const consultas = useQueryClient();
  const titulo = useId();
  const idPrefijo = useId();
  const idCuentas = useId();
  const idCortes = useId();
  const guardado = useQuery({
    queryKey: CLAVE_DE_LOS_FOLIOS,
    queryFn: async () => {
      const [configuracion] = await consultarPuente<{
        folios?: unknown;
        operacion_desde?: unknown;
      }>('ConfiguracionNegocio', { limite: 1 });
      const [venta] = await consultarPuente<{ folio?: unknown }>('Venta', { limite: 1 });
      const [corte] = await consultarPuente<{ folio?: unknown }>('CorteCaja', { limite: 1 });
      const dado = (f: { folio?: unknown } | undefined) =>
        f?.folio !== undefined && f.folio !== null && f.folio !== '';
      return { ...foliosLeidos(configuracion), hayFolios: dado(venta) || dado(corte) };
    },
    staleTime: 60_000,
  });
  const [elegido, setElegido] = useState<FoliosEditables | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const actual: FoliosEditables | undefined = elegido ?? guardado.data;
  const hayCambios =
    actual !== undefined &&
    guardado.data !== undefined &&
    !foliosIgualesEnPantalla(actual, guardado.data);
  const bloqueo = guardado.data
    ? porQueNoSeCambiaElPrimerFolio(guardado.data.operaDesde, guardado.data.hayFolios)
    : null;

  function cambiar(parte: Partial<FoliosEditables>): void {
    if (actual === undefined) return;
    setListo(false);
    setFallo(null);
    setElegido({ ...actual, ...parte });
  }

  async function guardar(): Promise<void> {
    if (guardando || actual === undefined) return;
    const entrada = entradaDeLosFolios(actual);
    if (!entrada.ok) {
      setFallo(entrada.mensaje);
      return;
    }
    setGuardando(true);
    setFallo(null);
    setListo(false);
    try {
      await invocarComando('/api/configuracion/fijar-folios', entrada.entrada);
      await consultas.invalidateQueries({ queryKey: CLAVE_DE_LOS_FOLIOS });
      await consultas.invalidateQueries({ queryKey: ['config'] });
      setElegido(null);
      setListo(true);
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudieron guardar los folios.');
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
          <Hash aria-hidden className="size-5 shrink-0 text-primario" />
          Folios
        </h3>
        <p className="max-w-prose text-sm text-texto-sutil">
          El prefijo cambia cómo se lee el folio en el ticket, la cuenta, los cortes y los reportes.
          El número sigue siendo el consecutivo de siempre, sin huecos.
        </p>
      </div>
      {actual === undefined ? (
        guardado.isError ? (
          <Aviso tono="peligro" titulo="No se pudieron leer los folios guardados.">
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
          <div className="flex flex-wrap gap-(--espacio-4)">
            <div className="flex flex-col gap-(--espacio-1)">
              <label htmlFor={idPrefijo} className="text-sm font-medium">
                Prefijo del folio
              </label>
              <Input
                id={idPrefijo}
                value={actual.prefijo}
                maxLength={4}
                autoCapitalize="characters"
                placeholder="DP"
                disabled={!puedeCambiar || guardando}
                className="w-28"
                onChange={(e) => {
                  cambiar({ prefijo: prefijoTecleado(e.target.value) });
                }}
              />
            </div>
            <div className="flex flex-col gap-(--espacio-1)">
              <label htmlFor={idCuentas} className="text-sm font-medium">
                Primer folio de las cuentas
              </label>
              <Input
                id={idCuentas}
                inputMode="numeric"
                value={actual.primerFolioDeCuentas}
                disabled={!puedeCambiar || guardando || bloqueo !== null}
                className="w-36"
                onChange={(e) => {
                  cambiar({ primerFolioDeCuentas: numeroTecleado(e.target.value) });
                }}
              />
            </div>
            <div className="flex flex-col gap-(--espacio-1)">
              <label htmlFor={idCortes} className="text-sm font-medium">
                Primer folio de los cortes
              </label>
              <Input
                id={idCortes}
                inputMode="numeric"
                value={actual.primerFolioDeCortes}
                disabled={!puedeCambiar || guardando || bloqueo !== null}
                className="w-36"
                onChange={(e) => {
                  cambiar({ primerFolioDeCortes: numeroTecleado(e.target.value) });
                }}
              />
            </div>
          </div>
          {bloqueo === null ? null : (
            <p className="max-w-prose text-sm text-texto-sutil">{bloqueo}</p>
          )}
          <p className="max-w-prose text-sm" data-vista-previa-de-folios>
            {vistaPreviaDeLosFolios(actual)}
          </p>
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
            <p className="text-sm text-texto-sutil">Lo cambia el dueño.</p>
          )}
        </form>
      )}
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </Superficie>
  );
}
