'use client';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';

import { api } from '@/api/cliente';
import { Button } from '@/components/ui/button';
import LiquidarPropinasDialog from '@/components/propinas/LiquidarPropinasDialog';
import { aPesos } from '@/components/caja/dinero';
import { formatCurrency } from '@/utils/financialUtils';
import { claves } from '~/cliente/claves-de-consulta';

/**
 * DP-24 · LAS PROPINAS DEL DÍA, EN EL CORTE: por persona, las cuentas que atendió, su propina y un
 * botón «Liquidar».
 *
 * Es OPCIONAL: no obliga a liquidar para cerrar. Y NO es un segundo camino: «Liquidar» abre el
 * mismo diálogo del Tablero (`LiquidarPropinasDialog`, `propinas.liquidar`), con la persona ya
 * elegida y avisando que se entrega DE ESTA CAJA: lo entregado queda como salida del cajón y el
 * efectivo esperado del corte baja lo mismo, para que el conteo cuadre.
 *
 * Lo que se lista es lo PENDIENTE de liquidar desde que abrió esta caja, y lo suma el servidor
 * (`propinas.pendientes`): la pantalla no calcula ninguna propina.
 */
export default function PropinasDelCorte({ desde, deLaCaja = true, alLiquidar }) {
  const queryClient = useQueryClient();
  const [persona, setPersona] = useState(null);

  const inicio = desde ? new Date(desde) : null;
  const desdeIso = inicio && Number.isFinite(inicio.getTime()) ? inicio.toISOString() : null;
  const { data: pendientes, isError } = useQuery({
    queryKey: ['propinas_pendientes', 'corte', desdeIso],
    queryFn: () =>
      api.comandos.ejecutar('/api/propinas/pendientes', {
        desde: desdeIso,
        // Hasta «ahora» con holgura: lo que se cobre mientras el corte está abierto también cuenta.
        hasta: new Date(Date.now() + 5 * 60_000).toISOString(),
        meseroId: null,
        limite: 200,
      }),
    enabled: desdeIso !== null,
    staleTime: 5000,
  });
  const { data: usuarios = [] } = useQuery({
    queryKey: claves.usuarios.activos(),
    queryFn: () => api.entidades.UsuarioPOS.filter({ activo: true }),
    initialData: [],
  });

  const personas = (Array.isArray(pendientes?.meseros) ? pendientes.meseros : []).filter(
    (m) => (Number(m?.propinaCentavos) || 0) > 0,
  );

  if (desdeIso === null) return null;
  if (isError) {
    return (
      <p className="text-xs text-advertencia mt-2">
        No se pudieron leer las propinas por persona. Puedes cerrar igual y liquidarlas después en el
        Tablero.
      </p>
    );
  }
  if (personas.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground mt-2">
        No hay propinas pendientes de liquidar de este turno.
      </p>
    );
  }

  return (
    <div className="mt-3" data-propinas-del-corte>
      <p className="text-[11px] text-muted-foreground mb-2">
        Liquidar es opcional. Lo que entregues aquí sale del cajón de esta caja y el efectivo
        esperado baja lo mismo.
      </p>
      <ul className="divide-y rounded-lg border">
        {personas.map((m) => (
          <li
            key={m.meseroId ?? 'sin-persona'}
            className="flex items-center justify-between gap-3 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{m.meseroNombre}</p>
              <p className="text-[11px] text-muted-foreground">
                {Number(m.numeroVentas) || 0}{' '}
                {Number(m.numeroVentas) === 1 ? 'cuenta atendida' : 'cuentas atendidas'}
              </p>
            </div>
            <p className="font-heading font-black text-base text-peligro shrink-0">
              {formatCurrency(aPesos(m.propinaCentavos))}
            </p>
            {m.meseroId ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 shrink-0 gap-1.5"
                aria-label={`Liquidar a ${m.meseroNombre}`}
                onClick={() => setPersona(m)}
              >
                <Wallet className="w-4 h-4" /> Liquidar
              </Button>
            ) : (
              <span className="text-[11px] text-muted-foreground shrink-0 max-w-28 text-right">
                Sin persona: se liquida en el Tablero
              </span>
            )}
          </li>
        ))}
      </ul>

      <LiquidarPropinasDialog
        open={persona !== null}
        onClose={() => setPersona(null)}
        meseros={usuarios}
        rangoInicial="caja"
        desdeLaApertura={desdeIso}
        meseroInicialId={persona?.meseroId ?? ''}
        deLaCaja={deLaCaja}
        onLiquidada={() => {
          queryClient.invalidateQueries({ queryKey: ['propinas_pendientes'] });
          alLiquidar?.();
        }}
      />
    </div>
  );
}
