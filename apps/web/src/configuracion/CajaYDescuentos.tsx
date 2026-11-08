'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Switch } from '@morphiqpos/ui/primitivas/switch';
import { Aviso, Dinero, Esqueleto, Superficie } from '@morphiqpos/ui/sistema';
import { BadgePercent, Calculator } from 'lucide-react';

import { invocarComando } from '~/cliente/api';
import { TerminalesDeLaSucursal } from './TerminalesDeLaSucursal';
import { topesEnPantalla, type TopeDelPuestoLeido } from './topes-de-los-puestos';
import {
  CLAVE_DE_DESCUENTOS_PERMITIDOS,
  useDescuentosPermitidos,
} from '~/venta/use-descuentos-permitidos';

/**
 * CONFIGURACIÓN → CAJA y CONFIGURACIÓN → DESCUENTOS (DP-14.2, decisiones DP-D60 y DP-D61).
 *
 * Lo que decidió Miguel, en dos interruptores que sólo cambian el dueño o el administrador (la
 * pestaña ni aparece para los demás, y el servidor lo exige igual):
 *   · «Cajas abiertas a la vez», 1 o 2: con dos, las dos cajas cobran las mismas cuentas y la
 *     cobra quien la tome primero; nunca dos veces.
 *   · «Permitir descuentos», sí o no: apagados, el botón no aparece en ninguna pantalla y el
 *     servidor los rechaza; encendidos, todo descuento pide la clave de quien lo autoriza.
 * Cada cambio queda en la auditoría con su antes y su después.
 */

const CLAVE_DE_LAS_CAJAS = ['caja', 'cajas_simultaneas'] as const;

interface CajasALaVezLeidas {
  readonly cajas: number;
  readonly abiertas: number;
}

function mensajeDe(error: unknown, porOmision: string): string {
  return error instanceof Error ? error.message : porOmision;
}

export function CajasALaVez() {
  const consultas = useQueryClient();
  const idTitulo = useId();
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const lectura = useQuery({
    queryKey: CLAVE_DE_LAS_CAJAS,
    queryFn: ({ signal }) =>
      invocarComando<CajasALaVezLeidas>('/api/caja/cajas-simultaneas', {}, { signal }),
  });

  async function fijar(cajas: number): Promise<void> {
    if (guardando) return;
    setGuardando(true);
    setFallo(null);
    try {
      await invocarComando('/api/caja/fijar-cajas-simultaneas', { cajas });
      await consultas.invalidateQueries({ queryKey: CLAVE_DE_LAS_CAJAS });
    } catch (error: unknown) {
      setFallo(mensajeDe(error, 'No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={idTitulo}
      className="flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex flex-col gap-(--espacio-1)">
        <h3 id={idTitulo} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
          <Calculator aria-hidden className="size-5 shrink-0 text-primario" />
          Cajas abiertas a la vez
        </h3>
        <p className="max-w-prose text-sm text-texto-sutil">
          Con 2, las dos cajas ven y cobran las mismas cuentas pendientes: la cobra quien la tome
          primero, y si las dos lo intentan, entra un solo cobro. El corte de cada caja trae sólo lo
          suyo.
        </p>
      </div>
      {lectura.data === undefined ? (
        lectura.isError ? (
          <Aviso tono="peligro" titulo="No se pudo leer cuántas cajas puede haber.">
            <Button variant="outline" size="sm" onClick={() => void lectura.refetch()}>
              Reintentar
            </Button>
          </Aviso>
        ) : (
          <Esqueleto className="h-(--altura-control) w-48 rounded-lg" />
        )
      ) : (
        <div role="group" aria-labelledby={idTitulo} className="flex gap-(--espacio-2)">
          {[1, 2].map((cajas) => (
            <Button
              key={cajas}
              type="button"
              variant={lectura.data.cajas === cajas ? 'default' : 'outline'}
              aria-pressed={lectura.data.cajas === cajas}
              disabled={guardando}
              onClick={() => {
                void fijar(cajas);
              }}
            >
              {cajas === 1 ? '1 caja' : '2 cajas'}
            </Button>
          ))}
        </div>
      )}
      {lectura.data !== undefined && lectura.data.abiertas > 0 ? (
        <p className="text-sm text-texto-sutil">Abiertas ahora: {String(lectura.data.abiertas)}.</p>
      ) : null}
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
      {/* DP-14 · ronda 2, medio 3: el nombre de cada caja, para que «Ya se cobró en …» diga cuál. */}
      <TerminalesDeLaSucursal />
    </Superficie>
  );
}

export function PermitirDescuentos() {
  const consultas = useQueryClient();
  const permitidos = useDescuentosPermitidos();
  const idTitulo = useId();
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function cambiar(permitir: boolean): Promise<void> {
    if (guardando) return;
    setGuardando(true);
    setFallo(null);
    try {
      await invocarComando('/api/configuracion/permitir-descuentos', { permitir });
      await consultas.invalidateQueries({ queryKey: CLAVE_DE_DESCUENTOS_PERMITIDOS });
      // La configuración heredada (`useConfig`) también la lee.
      await consultas.invalidateQueries({ queryKey: ['config'] });
    } catch (error: unknown) {
      setFallo(mensajeDe(error, 'No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={idTitulo}
      className="flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex items-start justify-between gap-(--espacio-4)">
        <div className="flex flex-col gap-(--espacio-1)">
          <h3 id={idTitulo} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
            <BadgePercent aria-hidden className="size-5 shrink-0 text-primario" />
            Permitir descuentos
          </h3>
          <p className="max-w-prose text-sm text-texto-sutil">
            Encendidos, todo descuento pide la clave (PIN) de un gerente, administrador o dueño,
            aunque sea de $1, y la autorización sirve una sola vez y por ese monto. Apagados, el
            botón no aparece en ninguna pantalla.
          </p>
          <TopesDeLosPuestos />
        </div>
        {permitidos === null ? (
          <Esqueleto className="h-(--altura-control) w-11 rounded-full" />
        ) : (
          <Switch
            checked={permitidos}
            disabled={guardando}
            aria-labelledby={idTitulo}
            onCheckedChange={(valor) => {
              void cambiar(valor);
            }}
          />
        )}
      </div>
      {fallo === null ? null : (
        <Aviso tono="peligro" titulo={fallo}>
          Se queda como estaba guardado para el negocio.
        </Aviso>
      )}
    </Superficie>
  );
}

/** Lo más que autoriza cada puesto, como lo aplica el servidor: el porcentaje o el monto. */
function TopesDeLosPuestos() {
  const lectura = useQuery({
    queryKey: ['topes_de_los_puestos'],
    queryFn: () =>
      invocarComando<{ readonly topes: readonly TopeDelPuestoLeido[] }>(
        '/api/venta/topes-de-los-puestos',
        {},
      ),
  });
  if (lectura.isError) {
    return (
      <Aviso tono="atencion" titulo="No se pudieron leer los topes de cada puesto.">
        El servidor los sigue aplicando igual al autorizar.
      </Aviso>
    );
  }
  if (lectura.data === undefined) return <Esqueleto className="h-5 w-72 max-w-full" />;
  return (
    <p className="max-w-prose text-sm text-texto-sutil">
      Lo más que autoriza cada uno, lo que llegue primero:{' '}
      {topesEnPantalla(lectura.data.topes).map((t, i) => (
        <span key={t.rol}>
          {i === 0 ? '' : ' · '}
          <span className="font-medium text-texto">{t.puesto}</span> {t.porcentaje} % o{' '}
          <Dinero centavos={t.centavos} />
        </span>
      ))}
      .
    </p>
  );
}
