import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { PartyPopper } from 'lucide-react';

import { rotuloDeLaComanda } from '~/restaurante/rotulo-de-la-comanda';

import { cantidadDelPlatillo, notaDelPlatillo, textoDeLaOpcion } from './carrusel-del-telefono';
import { datosDelRotulo, type ComandaDelTelefono } from './pantalla-del-telefono';

const conTexto = (texto: string | null): texto is string => texto !== null && texto.trim() !== '';

/**
 * La comanda en vista rápida (DP-9.4, DP-16 · 2.3): de quién es, cuánto lleva esperando y el
 * desglose completo. La alergia va primero y en rojo; las opciones del cliente resaltadas y
 * aparte de la nota del platillo; la nota de la comanda al final.
 */
export function ComandaEnElTelefono({
  comanda,
  haceCuanto,
}: {
  readonly comanda: ComandaDelTelefono;
  readonly haceCuanto: string;
}) {
  const quien = rotuloDeLaComanda(datosDelRotulo(comanda));
  return (
    <Superficie
      como="article"
      aria-label={`Comanda de ${quien}`}
      relleno={4}
      className="flex flex-col gap-(--espacio-3)"
    >
      <header className="flex flex-col gap-(--espacio-1)">
        <h2 className="text-display leading-none font-bold break-words">{quien}</h2>
        <p className="font-semibold text-texto-sutil">
          {comanda.estado === 'en_preparacion' ? 'Preparando' : 'Nueva'} · {haceCuanto}
        </p>
      </header>
      {comanda.alergias !== null && comanda.alergias.trim() !== '' ? (
        <Aviso tono="peligro" titulo={`Alergia: ${comanda.alergias}`} />
      ) : null}
      {comanda.celebracion ? (
        <p className="flex items-center gap-(--espacio-2) font-semibold">
          <PartyPopper aria-hidden className="size-5" />
          {comanda.tipoCelebracion ?? 'Celebración'}
        </p>
      ) : null}
      <ul className="flex flex-col gap-(--espacio-3)">
        {comanda.platillos.map((p, i) => (
          <li
            key={`${p.nombre}-${String(i)}`}
            className="flex flex-col gap-(--espacio-1) leading-tight"
          >
            <p className="text-2xl">
              <span className="font-bold">{cantidadDelPlatillo(p)}×</span> {p.nombre}
            </p>
            {(p.opciones ?? []).map((o) => (
              <p
                key={o.grupo}
                className="rounded-md bg-fondo-sutil px-(--espacio-2) py-(--espacio-1) text-lg font-semibold"
              >
                {textoDeLaOpcion(o)}
              </p>
            ))}
            {conTexto(notaDelPlatillo(p)) ? (
              <p className="text-lg text-texto-sutil">Nota: {notaDelPlatillo(p)}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {conTexto(comanda.notas) ? (
        <p className="border-t border-borde pt-(--espacio-2) text-lg">Nota: {comanda.notas}</p>
      ) : null}
    </Superficie>
  );
}
