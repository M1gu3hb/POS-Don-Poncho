'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Label } from '@morphiqpos/ui/primitivas/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@morphiqpos/ui/primitivas/select';
import { Textarea } from '@morphiqpos/ui/primitivas/textarea';
import { Aviso } from '@morphiqpos/ui/sistema';
import { ESTILOS } from '@morphiqpos/ui/tokens';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useId } from 'react';

import type { SeccionDelEditor } from './use-personalizar-menu';

const DEL_NEGOCIO = '__del_negocio__';
const BOTON = 'min-h-(--altura-control) min-w-(--altura-control)';

/**
 * DP-18 · 1.3 · DEL MENÚ: el encabezado (el mensaje de bienvenida), los colores (el estilo del portal)
 * y el orden de las secciones. Cada bloque se guarda por separado con lo que cambió.
 */
export function MenuEnGeneral({
  secciones,
  alMover,
  alGuardarOrden,
  hayOrdenNuevo,
  mensaje,
  alCambiarMensaje,
  estilo,
  alCambiarEstilo,
  alGuardarEncabezado,
  hayEncabezadoNuevo,
  guardando,
  fallo,
}: {
  readonly secciones: readonly SeccionDelEditor[];
  readonly alMover: (id: string, hacia: 'arriba' | 'abajo') => void;
  readonly alGuardarOrden: () => void;
  readonly hayOrdenNuevo: boolean;
  readonly mensaje: string;
  readonly alCambiarMensaje: (texto: string) => void;
  readonly estilo: string | null;
  readonly alCambiarEstilo: (estilo: string | null) => void;
  readonly alGuardarEncabezado: () => void;
  readonly hayEncabezadoNuevo: boolean;
  readonly guardando: 'orden' | 'encabezado' | null;
  readonly fallo: string | null;
}) {
  const idMensaje = useId();
  const idEstilo = useId();
  return (
    <div className="flex flex-col gap-(--espacio-5)">
      <section aria-labelledby={`${idMensaje}-titulo`} className="flex flex-col gap-(--espacio-3)">
        <h3 id={`${idMensaje}-titulo`} className="text-lg font-semibold">
          Encabezado y colores
        </h3>
        <span className="flex flex-col gap-(--espacio-1)">
          <Label htmlFor={idMensaje}>Mensaje de bienvenida</Label>
          <Textarea
            id={idMensaje}
            rows={2}
            maxLength={140}
            value={mensaje}
            onChange={(e) => {
              alCambiarMensaje(e.target.value);
            }}
          />
        </span>
        <span className="flex flex-col gap-(--espacio-1)">
          <Label htmlFor={idEstilo}>Colores de la marca</Label>
          <Select
            value={estilo ?? DEL_NEGOCIO}
            onValueChange={(v) => {
              alCambiarEstilo(v === DEL_NEGOCIO ? null : v);
            }}
          >
            <SelectTrigger id={idEstilo} className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEL_NEGOCIO}>Los del negocio</SelectItem>
              {Object.values(ESTILOS).map((e) => (
                <SelectItem key={e.clave} value={e.clave}>
                  {e.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
        <Button
          type="button"
          className={`${BOTON} self-start`}
          disabled={!hayEncabezadoNuevo}
          cargando={guardando === 'encabezado'}
          onClick={alGuardarEncabezado}
        >
          Guardar encabezado y colores
        </Button>
      </section>

      <section aria-labelledby={`${idMensaje}-orden`} className="flex flex-col gap-(--espacio-3)">
        <h3 id={`${idMensaje}-orden`} className="text-lg font-semibold">
          Orden de las secciones
        </h3>
        <ol className="flex flex-col gap-(--espacio-1)" aria-label="Secciones del menú, en orden">
          {secciones.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-(--espacio-2) rounded-lg border border-borde px-(--espacio-2)"
            >
              <span className="w-6 text-right text-sm tabular-nums text-texto-sutil">{i + 1}</span>
              <span className="flex-1 font-medium">{(s.nombre ?? '').trim() || 'Sin nombre'}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={BOTON}
                aria-label={`Subir ${s.nombre ?? 'la sección'}`}
                disabled={i === 0}
                onClick={() => {
                  alMover(s.id, 'arriba');
                }}
              >
                <ArrowUp aria-hidden className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={BOTON}
                aria-label={`Bajar ${s.nombre ?? 'la sección'}`}
                disabled={i === secciones.length - 1}
                onClick={() => {
                  alMover(s.id, 'abajo');
                }}
              >
                <ArrowDown aria-hidden className="size-4" />
              </Button>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          className={`${BOTON} self-start`}
          disabled={!hayOrdenNuevo}
          cargando={guardando === 'orden'}
          onClick={alGuardarOrden}
        >
          Guardar orden
        </Button>
      </section>
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </div>
  );
}
