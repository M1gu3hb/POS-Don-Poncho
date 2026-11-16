'use client';
import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/api/cliente';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { hayCambios, leidoDe, parcheDeLaSeccion } from '~/configuracion/parche-de-la-seccion';
import { useCambiosSinGuardar } from '~/configuracion/cambios-sin-guardar';
import { AlertasDeEspera } from '~/cocina/AlertasDeEspera';

/**
 * Configuración → Cocina → «Alertas de espera de la cocina» (DP-21 · Bloque 21): los minutos de
 * ámbar y de rojo. Guarda sólo `cocina_alerta_ambar_min` y `cocina_alerta_roja_min` (el servidor
 * valida que el rojo quede después del ámbar), con su «✓ Guardado».
 */
export default function AlertasDeEsperaDeCocina({ cfg }) {
  const queryClient = useQueryClient();
  const leido = useRef({});
  const [minutos, setMinutos] = useState({
    cocina_alerta_ambar_min: 10,
    cocina_alerta_roja_min: 20,
  });
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!cfg?.id) return;
    const desdeLaConfig = {
      cocina_alerta_ambar_min: cfg.cocina_alerta_ambar_min ?? 10,
      cocina_alerta_roja_min: cfg.cocina_alerta_roja_min ?? 20,
    };
    leido.current = leidoDe(cfg, Object.keys(desdeLaConfig));
    setMinutos(desdeLaConfig);
  }, [cfg?.id, cfg?.updated_date]);

  const parche = parcheDeLaSeccion(minutos, leido.current);
  const sucia = !!cfg?.id && hayCambios(parche);
  useCambiosSinGuardar('alertas-de-espera', sucia);

  const guardar = async () => {
    if (!cfg?.id || !hayCambios(parche)) {
      toast.info('No hay cambios que guardar');
      return;
    }
    try {
      await api.entidades.ConfiguracionNegocio.update(cfg.id, parche);
      await queryClient.invalidateQueries({ queryKey: ['config'] });
      setGuardado(true);
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e?.message || ''));
    }
  };

  return (
    <div className="mt-4">
      <AlertasDeEspera
        ambar={minutos.cocina_alerta_ambar_min}
        roja={minutos.cocina_alerta_roja_min}
        onCambiar={(cambio) => {
          setGuardado(false);
          setMinutos({ ...minutos, ...cambio });
        }}
        onGuardar={guardar}
      />
      {guardado && !sucia && (
        <p role="status" className="mt-2 text-sm font-medium">
          ✓ Guardado
        </p>
      )}
    </div>
  );
}
