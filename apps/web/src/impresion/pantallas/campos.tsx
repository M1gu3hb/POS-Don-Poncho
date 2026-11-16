'use client';

import { useId, type ReactElement, type ReactNode } from 'react';

import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Superficie } from '@morphiqpos/ui/sistema';
import { CircleAlert } from 'lucide-react';

/**
 * LAS PIEZAS DE FORMULARIO DEL LABORATORIO (DP-20). Todas con su etiqueta real, su ayuda y su
 * error dicho con palabras y un icono —el color nunca va solo—. Los objetivos táctiles son los
 * del sistema (`--altura-control`).
 */

const CLASE_DEL_SELECT =
  'h-(--altura-control) w-full rounded-md border border-borde-fuerte bg-superficie px-(--espacio-2) text-base text-texto outline-none focus-visible:border-anillo focus-visible:ring-[3px] focus-visible:ring-anillo/50 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm';

export function SeccionDelLab({
  titulo,
  descripcion,
  icono,
  children,
}: {
  readonly titulo: string;
  readonly descripcion?: string;
  readonly icono?: ReactNode;
  readonly children: ReactNode;
}): ReactElement {
  const id = useId();
  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={id}
      className="flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex flex-col gap-(--espacio-1)">
        <h3 id={id} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
          {icono}
          {titulo}
        </h3>
        {descripcion === undefined ? null : (
          <p className="max-w-prose text-sm text-texto-sutil">{descripcion}</p>
        )}
      </div>
      {children}
    </Superficie>
  );
}

function Mensajes({
  id,
  ayuda,
  error,
}: {
  readonly id: string;
  readonly ayuda: string | undefined;
  readonly error: string | undefined;
}): ReactElement | null {
  if (error !== undefined) {
    return (
      <p id={id} className="flex items-start gap-(--espacio-1) text-sm text-peligro">
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{error}</span>
      </p>
    );
  }
  return ayuda === undefined ? null : (
    <p id={id} className="text-xs text-texto-sutil">
      {ayuda}
    </p>
  );
}

export function CampoDeTexto({
  etiqueta,
  valor,
  alCambiar,
  error,
  ayuda,
  numerico = false,
  deshabilitado = false,
  marcador,
  tipo = 'text',
}: {
  readonly etiqueta: string;
  readonly valor: string;
  readonly alCambiar: (valor: string) => void;
  readonly error?: string | undefined;
  readonly ayuda?: string | undefined;
  readonly numerico?: boolean;
  readonly deshabilitado?: boolean;
  readonly marcador?: string;
  readonly tipo?: 'text' | 'password';
}): ReactElement {
  const id = useId();
  const idDelMensaje = `${id}-mensaje`;
  return (
    <div className="flex flex-col gap-(--espacio-1)">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input
        id={id}
        type={tipo}
        value={valor}
        disabled={deshabilitado}
        inputMode={numerico ? 'numeric' : undefined}
        placeholder={marcador}
        autoComplete="off"
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined && ayuda === undefined ? undefined : idDelMensaje}
        onChange={(evento) => {
          alCambiar(evento.target.value);
        }}
      />
      <Mensajes id={idDelMensaje} ayuda={ayuda} error={error} />
    </div>
  );
}

export interface OpcionDeElegir {
  readonly valor: string;
  readonly nombre: string;
  readonly desactivada?: boolean;
}

export function CampoDeElegir({
  etiqueta,
  valor,
  opciones,
  alCambiar,
  error,
  ayuda,
  deshabilitado = false,
}: {
  readonly etiqueta: string;
  readonly valor: string;
  readonly opciones: readonly OpcionDeElegir[];
  readonly alCambiar: (valor: string) => void;
  readonly error?: string | undefined;
  readonly ayuda?: string | undefined;
  readonly deshabilitado?: boolean;
}): ReactElement {
  const id = useId();
  const idDelMensaje = `${id}-mensaje`;
  return (
    <div className="flex flex-col gap-(--espacio-1)">
      <Label htmlFor={id}>{etiqueta}</Label>
      <select
        id={id}
        className={CLASE_DEL_SELECT}
        value={valor}
        disabled={deshabilitado}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined && ayuda === undefined ? undefined : idDelMensaje}
        onChange={(evento) => {
          alCambiar(evento.target.value);
        }}
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor} disabled={opcion.desactivada === true}>
            {opcion.nombre}
          </option>
        ))}
      </select>
      <Mensajes id={idDelMensaje} ayuda={ayuda} error={error} />
    </div>
  );
}

export function Casilla({
  etiqueta,
  marcada,
  alCambiar,
  ayuda,
  deshabilitada = false,
}: {
  readonly etiqueta: string;
  readonly marcada: boolean;
  readonly alCambiar: (marcada: boolean) => void;
  readonly ayuda?: string;
  readonly deshabilitada?: boolean;
}): ReactElement {
  const id = useId();
  return (
    <div className="flex flex-col gap-(--espacio-1)">
      <label
        htmlFor={id}
        className={`flex min-h-(--altura-control) items-center gap-(--espacio-3) text-sm font-medium ${
          deshabilitada ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
      >
        <input
          id={id}
          type="checkbox"
          className="size-5 accent-primario"
          checked={marcada}
          disabled={deshabilitada}
          aria-describedby={ayuda === undefined ? undefined : `${id}-ayuda`}
          onChange={(evento) => {
            alCambiar(evento.target.checked);
          }}
        />
        {etiqueta}
      </label>
      {ayuda === undefined ? null : (
        <p id={`${id}-ayuda`} className="pl-(--espacio-8) text-xs text-texto-sutil">
          {ayuda}
        </p>
      )}
    </div>
  );
}
