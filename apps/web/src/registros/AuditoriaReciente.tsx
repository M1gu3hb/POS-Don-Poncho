'use client';

import { GRUPOS_DE_AUDITORIA, IDS_DE_GRUPOS_DE_AUDITORIA } from '@morphiqpos/domain/auditoria';
import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Aviso, EsqueletoDeLista, Vacio } from '@morphiqpos/ui/sistema';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useId, useState } from 'react';

import { invocarComando } from '~/cliente/api';

import { fechaDelNegocio } from '~/tablero/dia-del-negocio';

import { describirAccion } from './describir-accion.ts';
import { entradaDeLaAuditoria, paginaAnterior, paginaSiguiente } from './filtros-de-auditoria.ts';

/**
 * DP-15 · «Auditoría» en Registros: lo que se cambió, quién y cuándo (`reportes.auditoria_reciente`).
 * DP-15.1: el filtro (grupo de acción y día del negocio) y las páginas los resuelve el SERVIDOR: un
 * cambio de PIN de la mañana se encuentra en la noche. La pantalla sólo pide y enseña.
 * El renombre de una caja, un PIN, un agotado, los descuentos… dichos en palabras; lo demás, con el
 * nombre del comando. Sólo para el dueño y el administrador (el servidor lo exige igual).
 */

interface RespuestaDeAuditoria {
  readonly renglones: readonly Renglon[];
  readonly pagina: number;
  readonly hayMas: boolean;
}

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

const CLASE_DE_CONTROL =
  'h-(--altura-control) rounded-md border border-borde-fuerte bg-superficie px-(--espacio-2) text-sm text-texto outline-none focus-visible:ring-[3px] focus-visible:ring-anillo/60';

export function AuditoriaReciente() {
  const idGrupo = useId();
  const idFecha = useId();
  const [filtros, setFiltros] = useState({ grupo: '', fecha: '', pagina: 0 });
  const entrada = entradaDeLaAuditoria(filtros);
  const lectura = useQuery({
    queryKey: ['auditoria-reciente', entrada],
    queryFn: () =>
      invocarComando<RespuestaDeAuditoria>('/api/reportes/auditoria-reciente', entrada),
    placeholderData: (anterior) => anterior,
  });
  // Cambiar un filtro vuelve a la primera página: la página 3 de otro filtro puede no existir.
  const elegir = (cambio: { grupo?: string; fecha?: string }) => {
    setFiltros((actual) => ({ ...actual, ...cambio, pagina: 0 }));
  };
  const renglones = (lectura.data?.renglones ?? []).map((r) => ({
    ...r,
    dicho: describirAccion(r.accion, r.payload),
  }));

  return (
    <div className="flex flex-col gap-(--espacio-3)">
      <div className="flex flex-wrap items-end gap-(--espacio-3)">
        <label htmlFor={idGrupo} className="flex flex-col gap-(--espacio-1) text-sm">
          <span className="font-medium">Qué cambios</span>
          <select
            id={idGrupo}
            value={filtros.grupo}
            onChange={(evento) => {
              elegir({ grupo: evento.target.value });
            }}
            className={CLASE_DE_CONTROL}
          >
            <option value="">Todos</option>
            {IDS_DE_GRUPOS_DE_AUDITORIA.map((id) => (
              <option key={id} value={id}>
                {GRUPOS_DE_AUDITORIA[id].titulo}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={idFecha} className="flex flex-col gap-(--espacio-1) text-sm">
          <span className="font-medium">Día</span>
          <Input
            id={idFecha}
            type="date"
            value={filtros.fecha}
            onChange={(evento) => {
              elegir({ fecha: evento.target.value });
            }}
          />
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            elegir({ fecha: fechaDelNegocio(new Date()) });
          }}
        >
          Hoy
        </Button>
        {filtros.fecha !== '' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              elegir({ fecha: '' });
            }}
          >
            Todos los días
          </Button>
        )}
      </div>
      {lectura.isPending ? (
        <EsqueletoDeLista filas={5} />
      ) : lectura.isError ? (
        <Aviso tono="peligro" titulo="No se pudo leer la auditoría. Vuelve a abrir la pestaña." />
      ) : renglones.length === 0 ? (
        <Vacio tamano="compacto" icono={<History />} titulo="No hay cambios con esos filtros." />
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
      <div className="flex items-center justify-between gap-(--espacio-2)">
        <Button
          variant="outline"
          size="sm"
          disabled={filtros.pagina === 0}
          onClick={() => {
            setFiltros((actual) => ({ ...actual, pagina: paginaAnterior(actual.pagina) }));
          }}
        >
          Anterior
        </Button>
        <span className="text-xs text-texto-sutil">Página {filtros.pagina + 1}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={lectura.data?.hayMas !== true}
          onClick={() => {
            setFiltros((actual) => ({
              ...actual,
              pagina: paginaSiguiente(actual.pagina, lectura.data?.hayMas === true),
            }));
          }}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
