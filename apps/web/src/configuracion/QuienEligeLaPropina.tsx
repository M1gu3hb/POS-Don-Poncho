'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Checkbox } from '@morphiqpos/ui/primitivas/checkbox';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { HandCoins } from 'lucide-react';

import { useConfig } from '@/lib/ConfigContext';

import { invocarComando } from '~/cliente/api';
import { useCambiosSinGuardar } from '~/configuracion/cambios-sin-guardar';

/**
 * CONFIGURACIÓN → VENTAS Y COBRO → PROPINAS · «¿Quién puede elegir la propina?» (DP-21 · M12).
 *
 * Tres casillas: los comensales (en el portal), el mesero (al pedir la cuenta) y la Caja (al
 * cobrar). Por omisión, comensales y Caja, sin mesero. Lo guardan el dueño o el administrador
 * (`configuracion.fijar_quien_elige_la_propina`, con su auditoría); los demás lo ven.
 *
 * La propina se decide una sola vez: la primera que se confirma gana y la otra pantalla se
 * entera. Sin la casilla del mesero, «Pedir cuenta» nunca le enseña el diálogo de propina.
 */
interface ConfiguracionDelNegocio {
  readonly config: {
    readonly propinas_activas?: unknown;
    readonly portal_qr_permitir_propina_cliente?: unknown;
    readonly propina_la_elige_mesero?: unknown;
    readonly propina_la_elige_caja?: unknown;
  };
}

interface Casillas {
  readonly comensales: boolean;
  readonly mesero: boolean;
  readonly caja: boolean;
}

const OPCIONES: readonly {
  readonly clave: keyof Casillas;
  readonly nombre: string;
  readonly ayuda: string;
}[] = [
  {
    clave: 'comensales',
    nombre: 'Comensales (portal)',
    ayuda: 'La eligen en su teléfono al pedir la cuenta.',
  },
  {
    clave: 'mesero',
    nombre: 'Mesero',
    ayuda: 'Se la pregunta a la mesa al tocar «Pedir cuenta».',
  },
  { clave: 'caja', nombre: 'Caja', ayuda: 'La elige quien cobra, antes de cobrar.' },
];

export function QuienEligeLaPropina({
  puedeCambiar,
}: {
  readonly puedeCambiar: boolean;
}): ReactElement | null {
  const consultas = useQueryClient();
  const titulo = useId();
  const base = useId();
  const { config } = useConfig() as unknown as ConfiguracionDelNegocio;
  const guardadas: Casillas = {
    comensales: config.portal_qr_permitir_propina_cliente !== false,
    mesero: config.propina_la_elige_mesero === true,
    caja: config.propina_la_elige_caja !== false,
  };
  const [elegidas, setElegidas] = useState<Casillas | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const casillas = elegidas ?? guardadas;
  const hayCambios = OPCIONES.some(({ clave }) => casillas[clave] !== guardadas[clave]);
  // DP-21 · Bloque 21: salir con esto sin guardar avisa.
  useCambiosSinGuardar('quien-elige-la-propina', hayCambios);

  async function guardar(): Promise<void> {
    if (guardando) return;
    setGuardando(true);
    setFallo(null);
    setListo(false);
    try {
      await invocarComando('/api/configuracion/quien-elige-la-propina', casillas);
      await consultas.invalidateQueries({ queryKey: ['config'] });
      setElegidas(null);
      setListo(true);
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  // Con las propinas apagadas nadie elige: la tarjeta no tiene nada que ofrecer.
  if (config.propinas_activas === false) return null;

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={titulo}
      className="mt-(--espacio-4) flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex flex-col gap-(--espacio-1)">
        <h3 id={titulo} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
          <HandCoins aria-hidden className="size-5 shrink-0 text-primario" />
          ¿Quién puede elegir la propina?
        </h3>
        <p className="max-w-prose text-sm text-texto-sutil">
          La propina se decide una sola vez: la primera que se confirma se aplica, y la otra
          pantalla se entera en segundos.
        </p>
      </div>
      <form
        className="flex flex-col gap-(--espacio-4)"
        onSubmit={(evento) => {
          evento.preventDefault();
          void guardar();
        }}
      >
        <div className="flex flex-col gap-(--espacio-3)">
          {OPCIONES.map(({ clave, nombre, ayuda }) => (
            <div
              key={clave}
              className="flex min-h-(--altura-control) items-start gap-(--espacio-3)"
            >
              <Checkbox
                id={`${base}-${clave}`}
                className="mt-0.5 size-5"
                checked={casillas[clave]}
                disabled={!puedeCambiar || guardando}
                onCheckedChange={(marcada) => {
                  setListo(false);
                  setElegidas({ ...casillas, [clave]: marcada === true });
                }}
              />
              <label htmlFor={`${base}-${clave}`} className="flex flex-col text-sm">
                <span className="font-medium">{nombre}</span>
                <span className="text-texto-sutil">{ayuda}</span>
              </label>
            </div>
          ))}
        </div>
        {!casillas.comensales && !casillas.mesero && !casillas.caja ? (
          <Aviso tono="atencion" titulo="Así nadie podrá registrar una propina.">
            <p>Si no quieres propinas, apaga «Activar propinas».</p>
          </Aviso>
        ) : null}
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
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </Superficie>
  );
}
