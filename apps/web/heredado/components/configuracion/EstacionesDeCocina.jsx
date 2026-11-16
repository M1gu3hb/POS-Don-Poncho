'use client';
import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/api/cliente';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { hayCambios, leidoDe, parcheDeLaSeccion } from '~/configuracion/parche-de-la-seccion';
import { useCambiosSinGuardar } from '~/configuracion/cambios-sin-guardar';
import EstacionesPreparacionSection from '@/components/configuracion/EstacionesPreparacionSection';
import EstacionesAyuda from '@/components/configuracion/EstacionesAyuda';

/**
 * Configuración → Cocina → «Estaciones de preparación» (DP-21 · Bloque 21).
 *
 * UNA sola tarjeta: el interruptor para activarlas, su ayuda y el CRUD de estaciones (sólo si están
 * activas). Antes su «Guardar» era el del formulario único de Operación; ahora guarda sólo
 * `estaciones_preparacion_activas`, con su «✓ Guardado».
 */
export default function EstacionesDeCocina({ cfg }) {
  const queryClient = useQueryClient();
  const leido = useRef({});
  const [activas, setActivas] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (!cfg?.id) return;
    const desdeLaConfig = {
      estaciones_preparacion_activas: cfg.estaciones_preparacion_activas === true,
    };
    leido.current = leidoDe(cfg, Object.keys(desdeLaConfig));
    setActivas(desdeLaConfig.estaciones_preparacion_activas);
  }, [cfg?.id, cfg?.updated_date]);

  const parche = parcheDeLaSeccion({ estaciones_preparacion_activas: activas }, leido.current);
  const sucia = !!cfg?.id && hayCambios(parche);
  useCambiosSinGuardar('estaciones', sucia);

  const guardar = async () => {
    if (!cfg?.id || !hayCambios(parche)) return;
    try {
      await api.entidades.ConfiguracionNegocio.update(cfg.id, parche);
      await queryClient.invalidateQueries({ queryKey: ['config'] });
      setGuardado(true);
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e?.message || ''));
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <UtensilsCrossed className="w-4 h-4 text-primary" />
          Estaciones de preparación
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Permite separar pedidos por áreas como cocina, barra, postres, bebidas, etc.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Label className="text-sm font-medium">Activar estaciones de preparación</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Si está apagado, la cocina funciona como flujo normal. Si está encendido, cada
              categoría puede asignarse a una estación y cada usuario de cocina puede ver solo su
              estación.
            </p>
          </div>
          <Switch
            checked={activas}
            onCheckedChange={(v) => {
              setGuardado(false);
              setActivas(v);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" disabled={!sucia} onClick={guardar}>
            Guardar
          </Button>
          {guardado && !sucia && (
            <p role="status" className="text-sm font-medium">
              ✓ Guardado
            </p>
          )}
        </div>

        {/* Contenido expandible: sólo se ve si el interruptor está encendido */}
        {activas && (
          <div className="pt-3 border-t space-y-3">
            <EstacionesAyuda />
            <EstacionesPreparacionSection embedded />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
