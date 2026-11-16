'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MonitorSmartphone } from 'lucide-react';
import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Aviso, Esqueleto, Superficie } from '@morphiqpos/ui/sistema';

import { invocarComando } from '~/cliente/api';

/**
 * EL NOMBRE DE ESTE APARATO, Y EL DE LOS DEMÁS (DP-21 · Bloque 5). Configuración → Este aparato.
 *
 * Cada navegador o aparato que entra se da de alta solo, como «Aparato N». Hasta DP-21 se llamaba
 * «Caja N» y ése era el nombre que veía la caja: por eso «las cajas se sumaban». Ahora la caja
 * tiene su propio nombre (Configuración → Caja) y el aparato el suyo, que sólo sirve para decir
 * dónde está: «Caja principal · abierta en «iMin mostrador»».
 *
 * El dueño o el administrador le pone nombre a éste y a los que han tenido la caja. El servidor
 * dice si el nombre ya lo tiene otro (`caja.nombrar_terminal`) y deja el cambio en la auditoría.
 */

interface Terminal {
  readonly id: string;
  readonly nombre: string;
  readonly cajaAbierta: boolean;
}

interface AparatosLeidos {
  readonly terminales: readonly Terminal[];
  /** El aparato desde el que se pregunta. Un servidor de antes no lo manda. */
  readonly esteAparato?: { readonly id: string; readonly nombre: string } | null;
}

const CLAVE_DE_LAS_TERMINALES = ['caja', 'terminales'] as const;

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo guardar el nombre.';
}

function FilaDeAparato({
  terminal,
  etiqueta,
}: {
  readonly terminal: Terminal;
  readonly etiqueta: string;
}) {
  const consultas = useQueryClient();
  const idCampo = useId();
  const [nombre, setNombre] = useState(terminal.nombre);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const cambiado = nombre.trim() !== '' && nombre.trim() !== terminal.nombre;

  async function guardar(): Promise<void> {
    if (guardando || !cambiado) return;
    setGuardando(true);
    setFallo(null);
    try {
      await invocarComando('/api/caja/nombrar-terminal', { terminal: terminal.id, nombre });
      await consultas.invalidateQueries({ queryKey: CLAVE_DE_LAS_TERMINALES });
      await consultas.invalidateQueries({ queryKey: ['cortes_caja_estado'] });
    } catch (error: unknown) {
      setFallo(mensajeDe(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <li className="flex flex-col gap-(--espacio-1)">
      <label htmlFor={idCampo} className="text-sm font-medium">
        {terminal.cajaAbierta ? `${etiqueta} · con una caja abierta` : etiqueta}
      </label>
      <div className="flex gap-(--espacio-2)">
        <Input
          id={idCampo}
          value={nombre}
          maxLength={40}
          onChange={(e) => {
            setNombre(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void guardar();
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!cambiado || guardando}
          onClick={() => {
            void guardar();
          }}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </li>
  );
}

/** Sólo el dueño y el administrador ponen nombres: a los demás no se les enseña la tarjeta. */
export function AparatosDeLaSucursal({
  puedeCambiar,
}: {
  readonly puedeCambiar: boolean;
}): ReactElement | null {
  const idTitulo = useId();
  const idOtros = useId();
  const lectura = useQuery({
    queryKey: CLAVE_DE_LAS_TERMINALES,
    enabled: puedeCambiar,
    queryFn: ({ signal }) => invocarComando<AparatosLeidos>('/api/caja/terminales', {}, { signal }),
  });
  if (!puedeCambiar) return null;

  const este = lectura.data?.esteAparato ?? null;
  const otros = (lectura.data?.terminales ?? []).filter((t) => t.id !== este?.id);
  const esteConCaja = (lectura.data?.terminales ?? []).some(
    (t) => t.id === este?.id && t.cajaAbierta,
  );

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={idTitulo}
      className="flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex flex-col gap-(--espacio-1)">
        <h3 id={idTitulo} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
          <MonitorSmartphone aria-hidden className="size-5 shrink-0 text-primario" />
          Nombre de este aparato
        </h3>
        <p className="max-w-prose text-sm text-texto-sutil">
          Sirve para decir dónde está abierta una caja: «Caja principal · abierta en «iMin
          mostrador»». No es el nombre de la caja: ése se pone en Configuración → Caja.
        </p>
      </div>
      {lectura.data === undefined ? (
        lectura.isError ? (
          <Aviso tono="peligro" titulo="No se pudieron leer los aparatos.">
            <Button variant="outline" size="sm" onClick={() => void lectura.refetch()}>
              Reintentar
            </Button>
          </Aviso>
        ) : (
          <Esqueleto className="h-(--altura-control) w-full rounded-lg" />
        )
      ) : (
        <>
          {este === null ? (
            <p className="text-sm text-texto-sutil">
              Este aparato todavía no está dado de alta en una sucursal.
            </p>
          ) : (
            <ul className="flex flex-col gap-(--espacio-3)">
              <FilaDeAparato
                key={`${este.id}-${este.nombre}`}
                terminal={{ ...este, cajaAbierta: esteConCaja }}
                etiqueta="Este aparato"
              />
            </ul>
          )}
          {otros.length === 0 ? null : (
            <div className="flex flex-col gap-(--espacio-2)">
              <h4 id={idOtros} className="text-base font-semibold">
                Otros aparatos que han tenido la caja
              </h4>
              <ul aria-labelledby={idOtros} className="flex flex-col gap-(--espacio-3)">
                {otros.map((t) => (
                  <FilaDeAparato key={`${t.id}-${t.nombre}`} terminal={t} etiqueta={t.nombre} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Superficie>
  );
}
