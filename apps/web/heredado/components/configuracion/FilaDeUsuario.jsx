'use client';
import React from 'react';
import { Mail, Phone } from 'lucide-react';
import { etiquetaDelPuesto } from './puestos';

/**
 * Una fila de Configuración → Usuarios POS y el cuerpo con que se guarda (DP-14, ronda 2).
 * Viven aparte de `UsuariosPOSSection.jsx` para que cada archivo quede corto.
 */

/** El cuerpo del comando para un usuario tal como lo sirve el puente, con los cambios encima. */
export function cuerpoDelEmpleado(u, cambios = {}) {
  return {
    empleado: u.id,
    nombre: u.nombre,
    puesto: u.rol,
    telefono: u.telefono || null,
    color: u.color_guardado || null,
    estacionPreparacionId: u.estacion_preparacion_id || null,
    veTodasLasEstaciones: u.puede_ver_todas_estaciones === true,
    activo: true,
    ...cambios,
  };
}

export function FilaDeUsuario({ u, cfg, acciones }) {
  const mostrarEstacionInfo = cfg?.estaciones_preparacion_activas === true && u.rol === 'cocina';
  const mostrarColorDot =
    u.rol === 'mesero' || (u.rol === 'cocina' && cfg?.estaciones_preparacion_activas === true);
  return (
    <div
      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50"
      data-testid="fila-de-usuario"
    >
      <div className="flex items-center gap-3 min-w-0">
        {mostrarColorDot && (
          <span
            aria-hidden
            className="w-3 h-3 rounded-full shrink-0"
            style={{
              background: u.color || '#94a3b8',
              boxShadow: u.color ? `0 0 6px ${u.color}88` : 'none',
            }}
            title={u.color || 'Sin color'}
          />
        )}
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{u.nombre}</p>
          <p className="text-xs text-muted-foreground truncate">
            {u.etiqueta || etiquetaDelPuesto(u.rol)} · PIN: ••••
          </p>
          {mostrarEstacionInfo && (
            <div className="mt-1">
              {u.puede_ver_todas_estaciones ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/30">
                  Todas las estaciones
                </span>
              ) : u.estacion_preparacion_id ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/30">
                  {u.estacion_preparacion_nombre || 'Con estación'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-advertencia/10 text-advertencia border-advertencia/30">
                  Sin estación
                </span>
              )}
            </div>
          )}
          {(u.telefono || u.correo) && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
              {u.telefono && (
                <span className="inline-flex items-center gap-0.5">
                  <Phone className="w-2.5 h-2.5" />
                  {u.telefono}
                </span>
              )}
              {u.correo && (
                <span className="inline-flex items-center gap-0.5 truncate">
                  <Mail className="w-2.5 h-2.5" />
                  {u.correo}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      {acciones}
    </div>
  );
}
