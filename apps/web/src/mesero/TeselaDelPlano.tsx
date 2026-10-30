'use client';

import { Superficie } from '@morphiqpos/ui/sistema';
import { PartyPopper, TriangleAlert, Users } from 'lucide-react';
import type { CSSProperties, ReactElement } from 'react';

import { TAMANOS_MESA } from '../../heredado/lib/constants.js';
import { GlobosDeSolicitud, type LugarDeLosGlobos } from '../restaurante/GlobosDeSolicitud';

import { paletaDeLaMesa } from './colores-de-la-mesa';
import type { MesaDelSalon, SolicitudPendiente } from './tipos-del-salon';

/**
 * UNA MESA EN EL PLANO (PC y tableta): posición libre, forma y tamaño de la mesa real.
 *
 * Es un `div` que se toca, no un botón, a propósito: lleva dentro los globos de solicitud, que SON
 * botones, y un botón dentro de un botón no es válido. Sus clases `cursor-pointer select-none` y los
 * `span` de su número (`font-heading`) y de su estado (`leading-tight`) son por donde la prueba
 * de navegador de los estados la encuentra y mide.
 *
 * El relleno es SÓLIDO —el color del estado, sin degradado—, la profundidad la pone `Superficie`
 * y la mesa abierta lleva el anillo de `activa`. El estado va escrito con su palabra sobre un fondo
 * propio (`colores-de-la-mesa.ts`), que es lo que lo hace legible.
 */

interface MedidasDeLaMesa {
  readonly w: number;
  readonly h: number;
}
const TAMANOS = TAMANOS_MESA as unknown as Readonly<
  Record<string, Readonly<Record<string, MedidasDeLaMesa>>>
>;
/** Si el negocio guardó una forma o tamaño que ya no existe, la mesa se pinta mediana. */
const MEDIDAS_DE_RESPALDO: MedidasDeLaMesa = { w: 80, h: 80 };
/** Debajo de este ancho la letra baja un punto y el contador suelto ya no cabe. */
const ANCHO_PARA_LETRA_CHICA = 75;
/** Debajo de este ancho, quien atiende se escribe sólo con su primer nombre. */
const ANCHO_PARA_NOMBRE_CORTO = 80;
/** Dónde cae una mesa que nunca se colocó en el plano. */
const POSICION_DE_RESPALDO = 100;

export function medidasDeLaMesa(mesa: MesaDelSalon): MedidasDeLaMesa {
  return TAMANOS[mesa.tamano ?? 'mediana']?.[mesa.forma ?? 'redonda'] ?? MEDIDAS_DE_RESPALDO;
}

export interface TeselaDelPlanoProps {
  readonly mesa: MesaDelSalon;
  readonly oscuro: boolean;
  /** La mesa que está abierta en el diálogo. */
  readonly activa: boolean;
  readonly responsableNombre: string;
  readonly responsableColor: string | null;
  readonly solicitudes: readonly SolicitudPendiente[] | undefined;
  readonly lugarDeLosGlobos: LugarDeLosGlobos;
  readonly alTocar: (mesa: MesaDelSalon) => void;
  readonly alAtender: () => void;
}

export function TeselaDelPlano({
  mesa,
  oscuro,
  activa,
  responsableNombre,
  responsableColor,
  solicitudes,
  lugarDeLosGlobos,
  alTocar,
  alAtender,
}: TeselaDelPlanoProps): ReactElement {
  const paleta = paletaDeLaMesa(mesa.estado ?? undefined, oscuro);
  const medidas = medidasDeLaMesa(mesa);
  const personas = Number(mesa.personas_actuales) || 0;
  const capacidad = Number(mesa.capacidad) || 0;
  const letra = medidas.w < ANCHO_PARA_LETRA_CHICA ? 8 : 9;

  const estilo: CSSProperties = {
    left: mesa.posicion_x ?? POSICION_DE_RESPALDO,
    top: mesa.posicion_y ?? POSICION_DE_RESPALDO,
    width: medidas.w,
    height: medidas.h,
    background: paleta.relleno,
    borderColor: paleta.borde,
    color: paleta.texto,
  };

  return (
    <Superficie
      nivel={1}
      relleno={0}
      radio={(mesa.forma ?? 'redonda') === 'redonda' ? 'completo' : 'lg'}
      interactiva
      activa={activa}
      onClick={() => {
        alTocar(mesa);
      }}
      className="absolute flex flex-col items-center justify-center border-2 select-none"
      style={estilo}
    >
      {solicitudes === undefined ? null : (
        <GlobosDeSolicitud
          solicitudes={solicitudes}
          mesaNumero={mesa.numero}
          alAtender={alAtender}
          lugar={lugarDeLosGlobos}
        />
      )}
      {responsableColor === null ? null : (
        // El punto del color de quien atiende: se ve de lejos aunque no se lea el nombre.
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 size-3 rounded-full ring-2 ring-superficie"
          style={{ background: responsableColor }}
        />
      )}
      {mesa.celebracion_especial === true ? (
        <PartyPopper
          aria-hidden="true"
          className="absolute top-0.5 left-0.5 size-3.5"
          style={{ color: paleta.texto }}
        />
      ) : null}
      {mesa.notas_alergias ? (
        <TriangleAlert
          aria-hidden="true"
          className="absolute bottom-0.5 left-0.5 size-3.5"
          style={{ color: paleta.texto }}
        />
      ) : null}
      <span className="font-heading text-base leading-none font-bold">{mesa.numero}</span>
      <span
        className="mt-1 text-center leading-tight font-semibold"
        style={{
          fontSize: letra,
          maxWidth: medidas.w - 8,
          // La letra de cuerpo y no la del estilo: en «terminal» (monoespaciada) «Cuenta solicitada»
          // se salía del círculo de la mesa chica y pisaba el borde (cierre del 21-10).
          fontFamily: 'var(--font-body)',
          background: paleta.fondoDeLaEtiqueta,
          color: paleta.texto,
          // Esquinas FIJAS de 4 px y aire a los lados, no los del estilo: con el radio de «media» o
          // «amplia», las puntas de «Esperando entrega» en dos renglones quedaban sobre el verde
          // vivo y el blanco bajaba de 4.5:1 (lo midió la prueba de estados, como en el 21-10).
          borderRadius: 4,
          padding: '1px 5px',
        }}
      >
        {paleta.etiqueta}
      </span>
      <QuienYCuantos
        nombre={responsableNombre}
        personas={personas}
        capacidad={capacidad}
        ancho={medidas.w}
        letra={letra}
      />
    </Superficie>
  );
}

/**
 * Quién atiende y cuántos son. Con responsable, una sola pastilla («Carlos · 4 pers.»; en la mesa
 * chica, «Carlos · 4»). Sin él, el contador suelto si la mesa tiene lugar para leerlo.
 */
function QuienYCuantos({
  nombre,
  personas,
  capacidad,
  ancho,
  letra,
}: {
  readonly nombre: string;
  readonly personas: number;
  readonly capacidad: number;
  readonly ancho: number;
  readonly letra: number;
}): ReactElement | null {
  const chica = ancho < ANCHO_PARA_NOMBRE_CORTO;
  if (nombre !== '') {
    const sinPrefijo = nombre.replace(/^(Mesero:|Atiende:)\s*/i, '');
    const corto = chica ? (sinPrefijo.split(' ')[0] ?? sinPrefijo) : sinPrefijo;
    const sufijo =
      personas > 0 ? (chica ? ` · ${String(personas)}` : ` · ${String(personas)} pers.`) : '';
    return (
      <span
        className="mt-1 truncate rounded-full bg-superficie px-2 py-0.5 font-bold text-texto"
        style={{ fontSize: letra, maxWidth: ancho - 8 }}
        title={`${nombre}${personas > 0 ? ` — ${String(personas)} personas` : ''}`}
      >
        {corto}
        {sufijo}
      </span>
    );
  }
  const valor = personas > 0 ? personas : capacidad;
  if (valor <= 0 || ancho < ANCHO_PARA_LETRA_CHICA) return null;
  return (
    <span className="mt-0.5 flex items-center gap-0.5 opacity-70" style={{ fontSize: letra }}>
      <Users aria-hidden="true" className="size-2" />
      {valor}
      {personas > 0 ? ' pers.' : ''}
    </span>
  );
}
