'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { useConfig } from '@/lib/ConfigContext';
import { usePOSAuth } from '@/lib/POSAuthContext';

import { PedirPinAlDespertar } from './PedirPinAlDespertar';
import {
  almacenDeLaEjecucion,
  claseDelPuesto,
  marcarPin,
  minutosDelCandado,
  olvidarPin,
  pidePinAlAbrir,
  seCierraSinUso,
  suscribirAlPin,
  tecleoSuPin,
  venceElCandado,
} from './pin-de-esta-ejecucion';

/**
 * EL CANDADO DE LA SESIÓN (DP-21 · Bloque 2 · M14 y O10).
 *
 * Dos momentos en que la pantalla se cierra con el PIN de quien tiene la sesión:
 *
 *  1. **Al abrir la app** (dueño, administrador, gerente, cajero y almacén): una pantalla nueva,
 *     sin la marca de esta ejecución, arranca cerrada aunque la cookie siga viva. Mesero y
 *     cocina entran directo.
 *  2. **Sin tocar la pantalla** (sólo el mando): a los 10 minutos, o los que diga Configuración
 *     (de 5 a 30).
 *
 * Abrirla vuelve a comprobar el PIN EN EL SERVIDOR (`/api/auth/entrar`), con sus intentos y su
 * bloqueo: aquí no se compara nada. Es una capa encima; la pantalla de abajo sigue montada.
 */

const ACTIVIDAD = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
const REVISAR_CADA_MS = 15_000;

interface SesionDelPuesto {
  readonly posUser: {
    readonly id: string;
    readonly nombre: string;
    readonly rol?: string | null;
  } | null;
  readonly logout: () => Promise<void>;
}

interface ConfiguracionDelNegocio {
  readonly config: { readonly candado_de_mando_min?: unknown };
}

export function CandadoDeLaSesion() {
  const { posUser, logout } = usePOSAuth() as unknown as SesionDelPuesto;
  const { config } = useConfig() as unknown as ConfiguracionDelNegocio;
  const empleoId = posUser?.id ?? null;
  const clase = claseDelPuesto(posUser?.rol);
  const pide = empleoId !== null && pidePinAlAbrir(clase);
  const cerrada = useSyncExternalStore(
    suscribirAlPin,
    () => pide && !tecleoSuPin(almacenDeLaEjecucion(), empleoId),
    () => false,
  );
  const minutos = minutosDelCandado(config.candado_de_mando_min);
  const vigila = pide && !cerrada && seCierraSinUso(clase);

  useEffect(() => {
    if (!vigila) return undefined;
    let ultimoToque = Date.now();
    const tocar = (): void => {
      ultimoToque = Date.now();
    };
    const revisar = (): void => {
      if (venceElCandado(ultimoToque, Date.now(), minutos)) olvidarPin(almacenDeLaEjecucion());
    };
    for (const evento of ACTIVIDAD) window.addEventListener(evento, tocar, { passive: true });
    // Un aparato que durmió no corre su reloj: al volver a la vista se revisa en el momento.
    document.addEventListener('visibilitychange', revisar);
    const reloj = window.setInterval(revisar, REVISAR_CADA_MS);
    return () => {
      for (const evento of ACTIVIDAD) window.removeEventListener(evento, tocar);
      document.removeEventListener('visibilitychange', revisar);
      window.clearInterval(reloj);
    };
  }, [vigila, minutos]);

  if (!cerrada || posUser === null) return null;
  return (
    <PedirPinAlDespertar
      empleoId={posUser.id}
      nombre={posUser.nombre}
      alVolver={() => {
        marcarPin(almacenDeLaEjecucion(), posUser.id);
      }}
      alCambiarDePersona={logout}
    />
  );
}
