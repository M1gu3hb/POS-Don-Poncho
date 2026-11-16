'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Switch } from '@morphiqpos/ui/primitivas/switch';
import { Aviso, Esqueleto, Superficie } from '@morphiqpos/ui/sistema';
import { Percent } from 'lucide-react';

import { consultarPuente, invocarComando } from '~/cliente/api';
import { useCambiosSinGuardar } from '~/configuracion/cambios-sin-guardar';

import {
  ajustesDelCorteIguales,
  ajustesDelCorteLeidos,
  CLAVE_DE_LOS_AJUSTES_DEL_CORTE,
  comisionTecleada,
  entradaDeLosAjustesDelCorte,
  type AjustesDelCorteEditables as Ajustes,
} from './corte-de-la-caja-formulario.ts';

/**
 * CONFIGURACIÓN → CAJA · «El corte de la caja» (DP-21 · Bloque 20).
 *
 * Dos ajustes que el corte ya leía y nadie podía escribir:
 *   · «El cajero ve costos y utilidad en su corte» (`mostrar_costos_a_caja`): apagado, el corte del
 *     cajero sale sin un solo costo;
 *   · «Comisión de la terminal» (`comision_terminal_bp`): el porcentaje que cobra la terminal de
 *     tarjeta; el corte calcula con él la comisión estimada. Sin tasa, el corte dice «sin tasa».
 *
 * Los cambian el dueño o el administrador (el servidor lo exige) y queda en la auditoría.
 */
export function CorteDeLaCaja({ puedeCambiar }: { readonly puedeCambiar: boolean }): ReactElement {
  const consultas = useQueryClient();
  const titulo = useId();
  const idCostos = useId();
  const idComision = useId();
  const guardados = useQuery({
    queryKey: CLAVE_DE_LOS_AJUSTES_DEL_CORTE,
    queryFn: async () => {
      const [configuracion] = await consultarPuente<{
        mostrar_costos_a_caja?: unknown;
        comision_terminal_bp?: unknown;
      }>('ConfiguracionNegocio', { limite: 1 });
      return ajustesDelCorteLeidos(configuracion);
    },
    staleTime: 60_000,
  });
  const [elegidos, setElegidos] = useState<Ajustes | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const actuales = elegidos ?? guardados.data;
  const hayCambios =
    actuales !== undefined &&
    guardados.data !== undefined &&
    !ajustesDelCorteIguales(actuales, guardados.data);
  useCambiosSinGuardar('corte-de-la-caja', hayCambios);

  async function guardar(): Promise<void> {
    if (guardando || actuales === undefined) return;
    const entrada = entradaDeLosAjustesDelCorte(actuales);
    if (!entrada.ok) {
      setFallo(entrada.mensaje);
      return;
    }
    setGuardando(true);
    setFallo(null);
    setListo(false);
    try {
      await invocarComando('/api/caja/fijar-ajustes-del-corte', entrada.entrada);
      await consultas.invalidateQueries({ queryKey: CLAVE_DE_LOS_AJUSTES_DEL_CORTE });
      await consultas.invalidateQueries({ queryKey: ['config'] });
      setElegidos(null);
      setListo(true);
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudo guardar el corte de la caja.');
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
          <Percent aria-hidden className="size-5 shrink-0 text-primario" />
          El corte de la caja
        </h3>
        <p className="max-w-prose text-sm text-texto-sutil">
          Qué ve el cajero en su corte y la comisión que cobra la terminal de tarjeta.
        </p>
      </div>
      {actuales === undefined ? (
        guardados.isError ? (
          <Aviso tono="peligro" titulo="No se pudieron leer los ajustes del corte.">
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
          <div className="flex items-start justify-between gap-(--espacio-3)">
            <div className="flex-1">
              <Label htmlFor={idCostos} className="text-sm font-medium">
                El cajero ve costos y utilidad en su corte
              </Label>
              <p className="mt-0.5 text-xs text-texto-sutil">
                Apagado, el corte del cajero sale sin costos, margen ni utilidad; el dueño, el
                administrador y el gerente siempre los ven.
              </p>
            </div>
            <Switch
              id={idCostos}
              checked={actuales.mostrarCostosACaja}
              disabled={!puedeCambiar || guardando}
              onCheckedChange={(sale) => {
                setListo(false);
                setFallo(null);
                setElegidos({ ...actuales, mostrarCostosACaja: sale });
              }}
            />
          </div>
          <div className="flex flex-col gap-(--espacio-1)">
            <Label htmlFor={idComision} className="text-sm font-medium">
              Comisión de la terminal (%)
            </Label>
            <Input
              id={idComision}
              inputMode="decimal"
              className="max-w-40"
              value={actuales.comision}
              placeholder="Ej: 3.6"
              disabled={!puedeCambiar || guardando}
              onChange={(evento) => {
                setListo(false);
                setFallo(null);
                setElegidos({ ...actuales, comision: comisionTecleada(evento.target.value) });
              }}
            />
            <p className="text-xs text-texto-sutil">
              De 0 a 10 %. El corte calcula con ella la comisión estimada de los cobros con tarjeta;
              vacío, el corte dice «sin tasa».
            </p>
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
