'use client';

import { Superficie } from '@morphiqpos/ui/sistema';
import { PartyPopper, TriangleAlert, Users } from 'lucide-react';
import type { ReactElement } from 'react';

import { GlobosDeSolicitud } from '../restaurante/GlobosDeSolicitud';

import { paletaDeLaMesa } from './colores-de-la-mesa';
import type { TeselaDelPlanoProps } from './TeselaDelPlano';

/**
 * UNA MESA EN LA REJILLA DEL TELÉFONO: una tarjeta que se toca, de dos en dos.
 *
 * Es un botón de verdad (`rounded-2xl`, como la busca la prueba de navegador), con el número
 * grande, la palabra del estado en su pastilla (`rounded-full border`) y, si hay, quién atiende y
 * cuántos son. Los globos de solicitud van EN LÍNEA, sobre la tarjeta y no dentro: un botón no
 * puede llevar otro botón adentro. Relleno sólido; la mesa abierta lleva el anillo de `activa`.
 */
export function TeselaDeLaRejilla({
  mesa,
  oscuro,
  activa,
  responsableNombre,
  responsableColor,
  solicitudes,
  alTocar,
  alAtender,
}: Omit<TeselaDelPlanoProps, 'lugarDeLosGlobos'>): ReactElement {
  const paleta = paletaDeLaMesa(mesa.estado ?? undefined, oscuro);
  const personas = Number(mesa.personas_actuales) || 0;
  const capacidad = Number(mesa.capacidad) || 0;
  const cuantos = personas > 0 ? personas : capacidad;

  return (
    <div className="flex flex-col gap-1">
      {solicitudes === undefined ? null : (
        <GlobosDeSolicitud
          solicitudes={solicitudes}
          mesaNumero={mesa.numero}
          alAtender={alAtender}
          lugar="en-linea"
        />
      )}
      <Superficie
        como="button"
        type="button"
        nivel={1}
        relleno={3}
        radio="lg"
        interactiva
        activa={activa}
        onClick={() => {
          alTocar(mesa);
        }}
        className="relative flex min-h-28 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 text-center"
        style={{ background: paleta.relleno, borderColor: paleta.borde, color: paleta.texto }}
      >
        {responsableColor === null ? null : (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 size-2.5 rounded-full ring-2 ring-superficie"
            style={{ background: responsableColor }}
          />
        )}
        {mesa.celebracion_especial === true ? (
          <PartyPopper aria-hidden="true" className="absolute top-1.5 left-1.5 size-4" />
        ) : null}
        {mesa.notas_alergias ? (
          <TriangleAlert aria-hidden="true" className="absolute bottom-1.5 left-1.5 size-4" />
        ) : null}
        <span className="font-heading text-2xl leading-none font-black">{mesa.numero}</span>
        {mesa.nombre ? <span className="mt-0.5 text-xs opacity-80">{mesa.nombre}</span> : null}
        <span
          className="mt-1.5 rounded-full border px-2 py-0.5 text-xs font-bold"
          style={{
            background: paleta.fondoDeLaEtiqueta,
            borderColor: paleta.borde,
            color: paleta.texto,
          }}
        >
          {paleta.etiqueta}
        </span>
        {cuantos > 0 ? (
          <span className="mt-1 flex items-center gap-1 text-xs font-semibold">
            <Users aria-hidden="true" className="size-3" />
            {personas > 0
              ? `${String(personas)} ${personas === 1 ? 'persona' : 'personas'}`
              : cuantos}
          </span>
        ) : null}
        {responsableNombre === '' ? null : (
          <span
            className="mt-1 max-w-full truncate rounded-full bg-superficie px-2.5 py-0.5 text-xs font-bold text-texto"
            title={responsableNombre}
          >
            {responsableNombre.replace(/^(Mesero:|Atiende:)\s*/i, '')}
          </span>
        )}
      </Superficie>
    </div>
  );
}
