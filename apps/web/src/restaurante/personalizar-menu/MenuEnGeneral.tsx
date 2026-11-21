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
import { useId } from 'react';

const DEL_NEGOCIO = '__del_negocio__';
const BOTON = 'min-h-(--altura-tactil) min-w-(--altura-tactil)';

/**
 * DP-18 · 1.3 · DEL MENÚ: el encabezado (el mensaje de bienvenida) y los colores (el estilo del portal).
 * El orden de las secciones y de los platillos pasó a `OrdenDelMenu` (DP-24), que guarda con un comando.
 */
export function MenuEnGeneral({
  mensaje,
  alCambiarMensaje,
  estilo,
  alCambiarEstilo,
  alGuardarEncabezado,
  hayEncabezadoNuevo,
  guardando,
  fallo,
}: {
  readonly mensaje: string;
  readonly alCambiarMensaje: (texto: string) => void;
  readonly estilo: string | null;
  readonly alCambiarEstilo: (estilo: string | null) => void;
  readonly alGuardarEncabezado: () => void;
  readonly hayEncabezadoNuevo: boolean;
  readonly guardando: 'encabezado' | null;
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

      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </div>
  );
}
