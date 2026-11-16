'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactElement } from 'react';

import {
  LO_QUE_NUNCA_SE_QUITA,
  NOMBRE_DEL_PAPEL,
  PAPELES_DE_VENTA,
  camposDelPapel,
  papelIgual,
  type PapelATuGusto as Papel,
} from '@morphiqpos/domain/venta';
import { Button } from '@morphiqpos/ui/primitivas/button';
import { Switch } from '@morphiqpos/ui/primitivas/switch';
import { Aviso, Esqueleto, Superficie } from '@morphiqpos/ui/sistema';
import { ReceiptText } from 'lucide-react';

import { consultarPuente, invocarComando } from '~/cliente/api';
import { useCambiosSinGuardar } from '~/configuracion/cambios-sin-guardar';

import {
  avisosDelPapel,
  CLAVE_DEL_PAPEL,
  papelConCambio,
  papelLeido,
} from './papel-a-tu-gusto-formulario.ts';
import { VistaPreviaDelPapel } from './VistaPreviaDelPapel.tsx';

/**
 * CONFIGURACIÓN → TICKET Y FOLIOS · «EL TICKET A TU GUSTO» (DP-21 · Bloque 12).
 *
 * Dos columnas, la precuenta y el ticket de venta, cada una con sus interruptores y su vista previa
 * en vivo (el mismo papel que imprime la app). Por omisión sale todo. Los platillos con su importe,
 * el subtotal y el TOTAL no tienen interruptor: nunca se quitan. Lo guardan el dueño o el
 * administrador (el servidor lo exige) y queda en la auditoría; los demás lo ven y no lo editan.
 */
export function PapelATuGusto({ puedeCambiar }: { readonly puedeCambiar: boolean }): ReactElement {
  const consultas = useQueryClient();
  const titulo = useId();
  const base = useId();
  const guardado = useQuery({
    queryKey: CLAVE_DEL_PAPEL,
    queryFn: async () => {
      const [configuracion] = await consultarPuente<Record<string, unknown>>(
        'ConfiguracionNegocio',
        { limite: 1 },
      );
      return { configuracion: configuracion ?? {}, papel: papelLeido(configuracion) };
    },
    staleTime: 60_000,
  });
  const [elegido, setElegido] = useState<Papel | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const actual = elegido ?? guardado.data?.papel;
  const hayCambios =
    actual !== undefined && guardado.data !== undefined && !papelIgual(actual, guardado.data.papel);
  // DP-21 · Bloque 21: salir con esto sin guardar avisa.
  useCambiosSinGuardar('papel-a-tu-gusto', hayCambios);

  async function guardar(): Promise<void> {
    if (guardando || actual === undefined) return;
    setGuardando(true);
    setFallo(null);
    setListo(false);
    try {
      await invocarComando('/api/caja/fijar-papel-a-tu-gusto', {
        precuenta: actual.precuenta,
        ticket: actual.ticket,
      });
      await consultas.invalidateQueries({ queryKey: CLAVE_DEL_PAPEL });
      await consultas.invalidateQueries({ queryKey: ['config'] });
      setElegido(null);
      setListo(true);
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudo guardar el papel.');
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
          <ReceiptText aria-hidden className="size-5 shrink-0 text-primario" />
          El ticket a tu gusto
        </h3>
        <p className="max-w-prose text-sm text-texto-sutil">
          Elige qué renglones salen en cada papel y míralo tal cual saldrá. Siempre salen{' '}
          {LO_QUE_NUNCA_SE_QUITA.join(', ')}.
        </p>
      </div>
      {actual === undefined || guardado.data === undefined ? (
        guardado.isError ? (
          <Aviso tono="peligro" titulo="No se pudo leer el papel guardado.">
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
          <div className="grid gap-(--espacio-6) lg:grid-cols-2">
            {PAPELES_DE_VENTA.map((papel) => (
              <fieldset
                key={papel}
                data-papel={papel}
                className="flex min-w-0 flex-col gap-(--espacio-3)"
              >
                <legend className="mb-(--espacio-2) text-base font-semibold">
                  {NOMBRE_DEL_PAPEL[papel]}
                </legend>
                <ul className="flex flex-col gap-(--espacio-2)">
                  {camposDelPapel(papel).map((campo) => {
                    const id = `${base}-${papel}-${campo.id}`;
                    return (
                      <li
                        key={campo.id}
                        className="flex items-center justify-between gap-(--espacio-3)"
                      >
                        <label htmlFor={id} className="text-sm font-medium">
                          {campo.nombre}
                        </label>
                        <Switch
                          id={id}
                          checked={actual[papel][campo.id]}
                          disabled={!puedeCambiar || guardando}
                          onCheckedChange={(sale) => {
                            setListo(false);
                            setElegido(papelConCambio(actual, papel, campo.id, sale));
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
                {papel === 'ticket'
                  ? avisosDelPapel(actual).map((aviso) => (
                      <Aviso key={aviso} tono="atencion" titulo={aviso} />
                    ))
                  : null}
                <VistaPreviaDelPapel
                  papel={papel}
                  elegido={actual}
                  configuracion={guardado.data.configuracion}
                />
              </fieldset>
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
            <p className="text-sm text-texto-sutil">Lo cambian el dueño o el administrador.</p>
          )}
        </form>
      )}
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </Superficie>
  );
}
