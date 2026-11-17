'use client';
import React, { useEffect, useRef } from 'react';
import { speak, getCocinaVozConfig } from '@/lib/voiceAlert';
import { sonarAntesDeHablar } from '~/sonidos/gestor';
import { toast } from 'sonner';
import { despertarLaPantalla } from '~/espera/despertador';
import { rotuloDeLaComanda } from '~/restaurante/rotulo-de-la-comanda';
import { almacenDelAparato } from '~/restaurante/vista-de-solicitudes';
import { comandasPorAnunciar, frasesAAnunciar } from '~/cocina/anuncio-de-comandas';
import { anunciaEsteAparato, leerEleccionDelAparato } from '~/voz/anuncio-del-aparato';
import { usePuesto } from '@/components/configuracion/usePuesto';

const NOTIFIED_KEY = 'mh_cocina_notified_nuevos';

const loadSet = () => {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};
const saveSet = (set) => {
  try {
    sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set].slice(-200)));
  } catch {}
};

/**
 * Watcher LOCAL de cocina (montado solo en /cocina).
 *
 * IMPORTANTE — Visibilidad de pedidos:
 * Este componente recibe `pedidos` desde `pages/Cocina.jsx`, que ya aplica TODA
 * la lógica de filtrado por estación/cocina general/legacy (ver `pedidosFiltrados`
 * en Cocina.jsx). Por eso aquí NO duplicamos esa lógica — solo filtramos por
 * `estado === 'nuevo'`.
 *
 * 🔴 HOTFIX bandera roja (estaciones activas):
 * Antes filtrábamos también por `p.area === 'cocina'`. Esto rompía estaciones
 * activas: si un pedido era de la estación "Barra" o "Postres", `area` puede
 * venir vacío o distinto a 'cocina', y la voz NO sonaba aunque Cocina visual
 * sí lo mostrara. Ahora confiamos en el filtro de la pantalla:
 *
 *   - Legacy (estaciones apagadas) → Cocina.jsx ya filtra por `area:'cocina'`
 *     en la query, así que `pedidos` solo trae cocina. Comportamiento intacto.
 *   - Estaciones activas + estación específica → Cocina.jsx ya filtra por
 *     `estacion_preparacion_id` del usuario. Solo escuchamos lo que ve.
 *   - Estaciones activas + cocina general / ver todas → Cocina.jsx pasa todo
 *     lo visible. Voz suena para cada pedido nuevo que ve el usuario.
 *
 * Deduplicación por `pedido.id` se mantiene intacta vía `notifiedRef` +
 * sessionStorage, así que un pedido nunca suena dos veces.
 *
 * - Detecta pedidos NUEVOS (estado=nuevo) y reproduce:
 *   1) toast visual,
 *   2) sonido básico,
 *   3) voz larga con productos/notas + alergia/celebración (si voz activa).
 * - Cocina NUNCA reproduce voz cuando los pedidos pasan a "listo".
 */
export default function CocinaNuevoPedidoWatcher({ pedidos = [], cargando = false }) {
  const firstLoadRef = useRef(true);
  const notifiedRef = useRef(loadSet());
  // El puesto REAL (no el rol de cuatro de `posUser.rol`): decide si este aparato anuncia mientras
  // nadie haya elegido. En un ref para que un cambio de puesto no vuelva a correr el efecto.
  const puestoRef = useRef(null);
  puestoRef.current = usePuesto();

  useEffect(() => {
    // Mientras la primera lectura no llega, `pedidos` es una lista vacía que NO es la de la
    // cocina: tomarla por «la primera carga» dejaba que la lectura de verdad se anunciara
    // entera —toast y voz por cada pedido que ya estaba— al entrar a la pantalla con la red lenta.
    if (cargando) return;
    const arr = Array.isArray(pedidos) ? pedidos : [];
    // Solo filtramos por estado. La visibilidad ya está aplicada por Cocina.jsx
    // (que respeta estaciones, cocina general y legacy).
    const nuevos = arr.filter((p) => p?.estado === 'nuevo');

    if (firstLoadRef.current) {
      nuevos.forEach((p) => notifiedRef.current.add(p.id));
      saveSet(notifiedRef.current);
      firstLoadRef.current = false;
      return;
    }
    // DP-21: cada comanda se anuncia UNA vez por aparato, aunque la lectura la traiga repetida.
    const recien = comandasPorAnunciar(nuevos, notifiedRef.current);
    if (recien.length === 0) return;
    // DP-11.2: una comanda nueva de mi estación despierta la pantalla (si estaba en modo espera).
    despertarLaPantalla('comanda');

    recien.forEach((p) => {
      notifiedRef.current.add(p.id);
      // 1) Visual primero.
      // DP-16 · El rótulo sale del canal: «PARA LLEVAR · 3 · Don Beto» o «Mesa 4».
      const desc = `${rotuloDeLaComanda(p)} — ${(p.items || []).length} producto(s)`;
      toast.success('Nuevo pedido recibido', { description: desc, duration: 10000 });
    });
    saveSet(notifiedRef.current);

    // 2) Voz. DP-21: sólo si ESTE aparato anuncia («Esta pantalla anuncia las comandas»: con dos
    //    pantallas en la misma estación se apaga en la secundaria) y con los renglones iguales
    //    ya juntos («tres Consomés de carnero»). Las alergias y la celebración van con prioridad
    //    (HOTFIX bandera roja de auditoría). DP-22: sin haber elegido, anuncia quien entra con el
    //    puesto de cocina; los demás puestos, no.
    const anuncia = anunciaEsteAparato({
      puesto: puestoRef.current,
      elegido: leerEleccionDelAparato(almacenDelAparato()),
    });
    if (!anuncia) return;
    const frasesAHablar = frasesAAnunciar(recien, {
      anuncia,
      vozActiva: getCocinaVozConfig().voz_activa,
    });

    // 3) Audio con pequeño delay después del visual.
    // La cola interna de speak() garantiza que TODAS las frases se lean en orden,
    // sin que una pise a la otra (antes solo se oía la última con setTimeout paralelos).
    // DP-12.6: el timbre es del gestor de sonido (Ping) y la voz empieza cuando termina, así
    // nunca se le encima; sin timbre (aparato en «Apagado», otra voz hablando) habla de inmediato.
    setTimeout(() => {
      sonarAntesDeHablar('comandaNueva').then(() => {
        frasesAHablar.forEach((frase) => {
          speak(frase, { cocina: true });
        });
      });
    }, 280);
  }, [pedidos, cargando]);

  return null;
}
