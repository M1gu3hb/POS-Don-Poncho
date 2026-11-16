'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { LockKeyhole } from 'lucide-react';

import { useConfig } from '@/lib/ConfigContext';

import { invocarComando } from '~/cliente/api';
import { OPCIONES_DEL_CANDADO, minutosDelCandado } from '~/espera/pin-de-esta-ejecucion';

/**
 * CONFIGURACIÓN → PERSONAS Y SEGURIDAD · «Candado de los puestos de mando» (DP-21 · Bloque 2).
 *
 * Cuántos minutos sin tocar la pantalla aguanta la sesión de un dueño, un administrador o un
 * gerente antes de pedir su PIN: de 5 a 30, 10 por omisión. Lo cambian el dueño o el
 * administrador (`configuracion.fijar_candado_de_mando`, con su auditoría).
 *
 * Lo que NO se elige aquí, y se dice: al abrir la app esos puestos, el cajero y el almacén
 * teclean siempre su PIN; el mesero y la cocina entran directo mientras su sesión siga viva.
 */
interface ConfiguracionDelNegocio {
  readonly config: { readonly candado_de_mando_min?: unknown };
}

export function CandadoDeMando({ puedeCambiar }: { readonly puedeCambiar: boolean }): ReactElement {
  const consultas = useQueryClient();
  const titulo = useId();
  const idMinutos = useId();
  const { config } = useConfig() as unknown as ConfiguracionDelNegocio;
  const guardados = minutosDelCandado(config.candado_de_mando_min);
  const [elegidos, setElegidos] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const minutos = elegidos ?? guardados;

  async function guardar(): Promise<void> {
    if (guardando) return;
    setGuardando(true);
    setFallo(null);
    setListo(false);
    try {
      await invocarComando('/api/configuracion/fijar-candado-de-mando', { minutos });
      await consultas.invalidateQueries({ queryKey: ['config'] });
      setElegidos(null);
      setListo(true);
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudo guardar el candado.');
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
          <LockKeyhole aria-hidden className="size-5 shrink-0 text-primario" />
          Entrar con PIN
        </h3>
        <p className="max-w-prose text-sm text-texto-sutil">
          El dueño, el administrador, el gerente, el cajero y el almacén teclean su PIN cada vez que
          se abre la app. El mesero y la cocina entran directo a su pantalla mientras su sesión siga
          viva (12 horas desde el último uso); «Salir» la termina en ese momento.
        </p>
      </div>
      <form
        className="flex flex-col gap-(--espacio-4)"
        onSubmit={(evento) => {
          evento.preventDefault();
          void guardar();
        }}
      >
        <label htmlFor={idMinutos} className="flex flex-col gap-(--espacio-1) text-sm font-medium">
          Pedir el PIN al dueño, al administrador y al gerente si nadie toca la pantalla en
          <select
            id={idMinutos}
            className="h-(--altura-control) max-w-xs rounded-md border border-borde-fuerte bg-superficie px-(--espacio-2) text-base font-normal text-texto outline-none focus-visible:border-anillo focus-visible:ring-[3px] focus-visible:ring-anillo/50 disabled:opacity-60"
            value={minutos}
            disabled={!puedeCambiar || guardando}
            onChange={(evento) => {
              setListo(false);
              setElegidos(minutosDelCandado(Number(evento.target.value)));
            }}
          >
            {OPCIONES_DEL_CANDADO.map((n) => (
              <option key={n} value={n}>
                {n} minutos
              </option>
            ))}
          </select>
        </label>
        {puedeCambiar ? (
          <div className="flex flex-wrap items-center gap-(--espacio-3)">
            <Button
              type="submit"
              variant="outline"
              disabled={guardando || minutos === guardados}
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
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </Superficie>
  );
}
