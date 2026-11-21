'use client';
import React, { useCallback } from 'react';
import { usePOSAuth } from '@/lib/POSAuthContext';
import { useConfig } from '@/lib/ConfigContext';
import { ROLES } from '@/lib/constants';
import { canAccessModule } from '@/lib/packageConfig';
import { sonarAntesDeHablar } from '~/sonidos/gestor';
import { speak, getAlertConfig } from '@/lib/voiceAlert';
import { debeEscucharAudio } from '@/lib/asignacionMesas';
import { AvisosDeListo } from '~/restaurante/AvisosDeListo';
import { useAvisosDeListo } from '~/restaurante/use-avisos-de-listo';
import { fraseHablada } from '~/restaurante/avisos-de-listo';

/**
 * DP-24 · 4.3 · Watcher global: el aviso de «listo» GRANDE para el mesero de esa mesa.
 *
 * Reglas:
 * - El aviso es SÓLO del mesero de la mesa (el asignado; sin asignación, el que la atiende). El
 *   SERVIDOR decide cuáles son suyos (`restaurante.avisos_de_listo`): este watcher ya no lee las
 *   comandas listas de todos ni compara mesas en el navegador, y el administrador, el gerente y
 *   la caja no reciben nada. Cocina nunca escucha el «listo».
 * - Cómo se ve: una tarjeta grande por mesa y estación («Mesa 5 · Listo en Cantina: 2 Coca cola,
 *   1 Jugo · Recoger en Cantina»), apiladas, que no se van solas; se quitan deslizando o tocando.
 * - Cómo suena: PRIMERO lo visual; luego el sonido (Check) y, cuando termina, la voz si el mesero
 *   la tiene activada. Y vibra si el aparato puede (la app de Android sí; donde no, sólo suena).
 */

/** Vibra si el aparato lo sabe hacer. Protegida: no existe en iOS ni en el motor viejo. */
function vibrar() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([300, 120, 300]);
    }
  } catch {
    // Un aparato que no vibra no es un error.
  }
}

export default function PedidoListoWatcher() {
  const { posUser } = usePOSAuth();
  const { paquete_modo, config } = useConfig();
  // Un pedido «listo» sólo existe donde hay cocina que lo marque, así que decide el módulo y no el
  // nombre de la plantilla. Y sólo para el mesero: el administrador no recibe este aviso.
  const haySala = canAccessModule('cocina', paquete_modo);
  const watch = haySala && posUser?.rol === ROLES.WAITER;
  const audioOk = debeEscucharAudio(posUser, config);

  const alLlegarNuevos = useCallback(
    (nuevos) => {
      if (!Array.isArray(nuevos) || nuevos.length === 0) return;
      vibrar();
      const alertCfg = getAlertConfig();
      const conSonido = audioOk && (alertCfg.modo === 'sonido' || alertCfg.modo === 'sonido_voz');
      const conVoz = audioOk && (alertCfg.modo === 'voz' || alertCfg.modo === 'sonido_voz');
      if (!conSonido && !conVoz) return;
      const nombre = alertCfg.decir_nombre ? posUser?.nombre || '' : '';
      const frases = conVoz ? nuevos.map((aviso) => fraseHablada(aviso, nombre)) : [];
      // Visual → luego voz/sonido con ~280ms de delay. DP-12.6: el sonido (Check) es del gestor
      // y la voz empieza cuando termina; nunca se le encima.
      setTimeout(() => {
        const sonido = conSonido ? sonarAntesDeHablar('comandaLista') : Promise.resolve();
        sonido.then(() => {
          frases.forEach((frase, i) => {
            // Pequeño stagger entre frases si hay varias.
            setTimeout(() => {
              try {
                speak(frase);
              } catch {}
            }, i * 1400);
          });
        });
      }, 280);
    },
    [audioOk, posUser],
  );

  const { pendientes, quitar, quitarTodos } = useAvisosDeListo(
    watch,
    watch ? (posUser?.id ?? null) : null,
    alLlegarNuevos,
  );

  if (!watch) return null;
  return <AvisosDeListo avisos={pendientes} alQuitar={quitar} alQuitarTodos={quitarTodos} />;
}
