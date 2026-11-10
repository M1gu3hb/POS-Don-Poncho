import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { Timer } from 'lucide-react';

import { alertasValidas, MAXIMO_DE_MINUTOS, UMBRALES_POR_OMISION } from './espera';

/**
 * DP-16 · 2.2 · CONFIGURACIÓN → «Alertas de espera de la cocina».
 *
 * Desde cuántos minutos esperando una comanda se pinta ámbar y desde cuántos, roja. Lo edita quien
 * entra a Configuración (dueño, administrador y gerente); el servidor lo valida otra vez (enteros
 * de 1 a 240, el rojo después del ámbar). Es controlado: la pantalla de Configuración guarda con
 * su propio botón de negocio.
 */

export interface AlertasDeEsperaProps {
  readonly ambar: unknown;
  readonly roja: unknown;
  readonly onCambiar: (parche: {
    readonly cocina_alerta_ambar_min?: number | '';
    readonly cocina_alerta_roja_min?: number | '';
  }) => void;
  readonly onGuardar: () => void;
}

function comoCampo(valor: unknown, porOmision: number): number | '' {
  if (valor === '') return '';
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : porOmision;
}

export function AlertasDeEspera({ ambar, roja, onCambiar, onGuardar }: AlertasDeEsperaProps) {
  const a = comoCampo(ambar, UMBRALES_POR_OMISION.ambarMin);
  const r = comoCampo(roja, UMBRALES_POR_OMISION.rojoMin);
  const valido = alertasValidas(a, r);
  const lee = (texto: string): number | '' => (texto === '' ? '' : Number(texto));

  return (
    <Superficie nivel={1} radio="md" relleno={4} className="flex flex-col gap-(--espacio-3)">
      <div>
        <h3 className="flex items-center gap-2 font-heading text-base font-bold">
          <Timer aria-hidden="true" className="size-4" />
          Alertas de espera de la cocina
        </h3>
        <p className="mt-0.5 text-xs text-texto-sutil">
          Cada comanda lleva su tiempo de espera: verde mientras va a tiempo, ámbar cuando ya tarda
          y rojo cuando tarda de más. Siempre dice también los minutos.
        </p>
      </div>
      <div className="grid gap-(--espacio-3) sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="cocina-ambar">
          Ámbar desde (minutos)
          <input
            id="cocina-ambar"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAXIMO_DE_MINUTOS}
            value={a}
            onChange={(e) => {
              onCambiar({ cocina_alerta_ambar_min: lee(e.target.value) });
            }}
            className="h-(--altura-control) rounded-md border bg-fondo px-(--espacio-3) text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="cocina-roja">
          Rojo desde (minutos)
          <input
            id="cocina-roja"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAXIMO_DE_MINUTOS}
            value={r}
            onChange={(e) => {
              onCambiar({ cocina_alerta_roja_min: lee(e.target.value) });
            }}
            className="h-(--altura-control) rounded-md border bg-fondo px-(--espacio-3) text-base"
          />
        </label>
      </div>
      {!valido && (
        <Aviso tono="atencion" titulo="Revisa los minutos">
          Van de 1 a {MAXIMO_DE_MINUTOS} (enteros) y el rojo tiene que quedar después del ámbar.
        </Aviso>
      )}
      <div>
        <Button size="sm" variant="outline" disabled={!valido} onClick={onGuardar}>
          Guardar
        </Button>
      </div>
    </Superficie>
  );
}
