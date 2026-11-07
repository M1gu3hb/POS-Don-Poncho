'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Aviso, Esqueleto, Vacio } from '@morphiqpos/ui/sistema';

import { invocarComando } from '~/cliente/api';

/**
 * LAS CAJAS DE LA SUCURSAL, CON SU NOMBRE (DP-14 · ronda 2, medio 3). Configuración → Caja.
 *
 * Cada navegador que abre la caja se da de alta solo como «Caja N»; con dos cajas, el aviso «Ya se
 * cobró en Caja 7» no le dice a nadie cuál es. Aquí el dueño o el administrador ve cada una —y cuál
 * tiene la caja abierta— y le pone su nombre («Caja 1», «Barra»). El servidor dice si el nombre ya
 * lo tiene otra (`caja.nombrar_terminal`) y deja el cambio en la auditoría.
 */

interface Terminal {
  readonly id: string;
  readonly nombre: string;
  readonly cajaAbierta: boolean;
}

const CLAVE_DE_LAS_TERMINALES = ['caja', 'terminales'] as const;

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo guardar el nombre.';
}

function FilaDeTerminal({ terminal }: { readonly terminal: Terminal }) {
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
        {terminal.cajaAbierta ? `${terminal.nombre} · con la caja abierta` : terminal.nombre}
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

export function TerminalesDeLaSucursal() {
  const idTitulo = useId();
  const lectura = useQuery({
    queryKey: CLAVE_DE_LAS_TERMINALES,
    queryFn: ({ signal }) =>
      invocarComando<{ readonly terminales: readonly Terminal[] }>(
        '/api/caja/terminales',
        {},
        { signal },
      ),
  });

  return (
    <div className="flex flex-col gap-(--espacio-2)">
      <h4 id={idTitulo} className="text-base font-semibold">
        El nombre de cada caja
      </h4>
      {lectura.data === undefined ? (
        lectura.isError ? (
          <Aviso tono="peligro" titulo="No se pudieron leer las cajas.">
            <Button variant="outline" size="sm" onClick={() => void lectura.refetch()}>
              Reintentar
            </Button>
          </Aviso>
        ) : (
          <Esqueleto className="h-(--altura-control) w-full rounded-lg" />
        )
      ) : lectura.data.terminales.length === 0 ? (
        <Vacio
          tamano="compacto"
          titulo="Todavía no hay cajas"
          explicacion="Cada navegador que abre la caja aparece aquí para ponerle nombre."
        />
      ) : (
        <ul aria-labelledby={idTitulo} className="flex flex-col gap-(--espacio-3)">
          {lectura.data.terminales.map((t) => (
            <FilaDeTerminal key={`${t.id}-${t.nombre}`} terminal={t} />
          ))}
        </ul>
      )}
    </div>
  );
}
