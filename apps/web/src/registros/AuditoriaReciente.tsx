'use client';

import { Input } from '@morphiqpos/ui/primitivas/input';
import { Aviso, EsqueletoDeLista, Vacio } from '@morphiqpos/ui/sistema';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useState } from 'react';

import { invocarComando } from '~/cliente/api';

import { describirAccion } from './describir-accion.ts';

/**
 * DP-15 · «Auditoría» en Registros: lo que se cambió, quién y cuándo (`reportes.auditoria_reciente`).
 * El renombre de una caja, un PIN, un agotado, los descuentos… dichos en palabras; lo demás, con el
 * nombre del comando. Sólo para el dueño y el administrador (el servidor lo exige igual).
 */

interface Renglon {
  readonly id: string;
  readonly cuando: string;
  readonly accion: string;
  readonly entidad: string;
  readonly quien: string | null;
  readonly payload: unknown;
}

const FECHA = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function AuditoriaReciente() {
  const [busqueda, setBusqueda] = useState('');
  const lectura = useQuery({
    queryKey: ['auditoria-reciente'],
    queryFn: () =>
      invocarComando<{ readonly renglones: readonly Renglon[] }>(
        '/api/reportes/auditoria-reciente',
        {
          limite: 200,
        },
      ),
  });
  const texto = busqueda.trim().toLocaleLowerCase('es-MX');
  const renglones = (lectura.data?.renglones ?? [])
    .map((r) => ({ ...r, dicho: describirAccion(r.accion, r.payload) }))
    .filter(
      (r) =>
        texto === '' ||
        r.dicho.toLocaleLowerCase('es-MX').includes(texto) ||
        (r.quien ?? '').toLocaleLowerCase('es-MX').includes(texto),
    );

  if (lectura.isPending) return <EsqueletoDeLista filas={5} />;
  if (lectura.isError) {
    return (
      <Aviso tono="peligro" titulo="No se pudo leer la auditoría. Vuelve a abrir la pestaña." />
    );
  }
  return (
    <div className="flex flex-col gap-(--espacio-3)">
      <Input
        type="search"
        aria-label="Buscar en la auditoría"
        placeholder="Buscar (caja, PIN, agotado, un nombre…)"
        value={busqueda}
        onChange={(evento) => {
          setBusqueda(evento.target.value);
        }}
      />
      {renglones.length === 0 ? (
        <Vacio tamano="compacto" icono={<History />} titulo="Nada que mostrar con esa búsqueda." />
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {renglones.map((r) => (
            <li key={r.id} className="flex flex-col gap-(--espacio-1) py-(--espacio-2) text-sm">
              <span className="font-medium">{r.dicho}</span>
              <span className="text-xs text-texto-sutil">
                {FECHA.format(new Date(r.cuando))} · {r.quien ?? 'el sistema'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-texto-sutil">Los 200 cambios más recientes del negocio.</p>
    </div>
  );
}
