'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Textarea } from '@morphiqpos/ui/primitivas/textarea';
import { Aviso } from '@morphiqpos/ui/sistema';
import { useId, useState } from 'react';

import ImageUploader from '@/components/common/ImageUploader';
import { SelectorDeFondo } from '~/portal/menu-digital/SelectorDeFondo';

import {
  conLaEdicion,
  LARGO_MAXIMO_DE_LA_DESCRIPCION,
  problemaDeLaDescripcion,
  type EdicionDelPlatillo,
} from './personalizar-menu';
import type { PlatilloDelEditor } from './use-personalizar-menu';

const BOTON = 'min-h-(--altura-control)';

/**
 * DP-18 · 1.3 · POR PLATILLO: la foto, la descripción corta y el fondo de la tarjeta (si no tiene
 * foto). Se busca el platillo, se edita y se ve al instante en el teléfono de al lado; «Guardar
 * platillo» manda sólo lo que cambió.
 */
export function EditorDelPlatillo({
  platillos,
  elegido,
  edicion,
  alElegir,
  alEditar,
  alGuardar,
  guardando,
  fallo,
}: {
  readonly platillos: readonly PlatilloDelEditor[];
  readonly elegido: PlatilloDelEditor | null;
  readonly edicion: EdicionDelPlatillo | undefined;
  readonly alElegir: (id: string) => void;
  readonly alEditar: (edicion: EdicionDelPlatillo) => void;
  readonly alGuardar: () => void;
  readonly guardando: boolean;
  readonly fallo: string | null;
}) {
  const idBuscar = useId();
  const idDescripcion = useId();
  const [buscar, setBuscar] = useState('');
  const termino = buscar.trim().toLocaleLowerCase('es-MX');
  const encontrados = platillos
    .filter((p) => termino === '' || p.nombre.toLocaleLowerCase('es-MX').includes(termino))
    .slice(0, 40);
  const visto = elegido === null ? null : conLaEdicion(elegido, edicion);
  const problema = problemaDeLaDescripcion(visto?.descripcion);

  return (
    <section aria-labelledby={`${idBuscar}-titulo`} className="flex flex-col gap-(--espacio-3)">
      <h3 id={`${idBuscar}-titulo`} className="text-lg font-semibold">
        Platillos
      </h3>
      <span className="flex flex-col gap-(--espacio-1)">
        <Label htmlFor={idBuscar}>Buscar platillo</Label>
        <Input
          id={idBuscar}
          value={buscar}
          placeholder="Barbacoa, consomé, pulque…"
          onChange={(e) => {
            setBuscar(e.target.value);
          }}
        />
      </span>
      <ul
        aria-label="Platillos encontrados"
        className="flex max-h-48 flex-wrap gap-(--espacio-2) overflow-y-auto"
      >
        {encontrados.map((p) => (
          <li key={p.id}>
            <Button
              type="button"
              size="sm"
              variant={elegido?.id === p.id ? 'default' : 'outline'}
              aria-pressed={elegido?.id === p.id}
              className={BOTON}
              onClick={() => {
                alElegir(p.id);
              }}
            >
              {p.nombre}
            </Button>
          </li>
        ))}
      </ul>
      {visto === null ? (
        <p className="text-sm text-texto-sutil">
          Elige un platillo para cambiar su foto, su descripción o su fondo.
        </p>
      ) : (
        <div className="flex flex-col gap-(--espacio-3) rounded-xl border border-borde p-(--espacio-3)">
          <p className="font-bold">{visto.nombre}</p>
          <ImageUploader
            value={visto.imagen_url ?? ''}
            label="Foto del platillo"
            height={120}
            onChange={(url: string) => {
              alEditar({ ...edicion, imagen_url: url });
            }}
          />
          <span className="flex flex-col gap-(--espacio-1)">
            <Label htmlFor={idDescripcion}>Descripción corta</Label>
            <Textarea
              id={idDescripcion}
              rows={2}
              value={visto.descripcion ?? ''}
              aria-invalid={problema !== null}
              onChange={(e) => {
                alEditar({ ...edicion, descripcion: e.target.value });
              }}
            />
            <span className="text-xs text-texto-sutil">
              {(visto.descripcion ?? '').trim().length} de {LARGO_MAXIMO_DE_LA_DESCRIPCION} letras
            </span>
          </span>
          {(visto.imagen_url ?? '') === '' ? (
            <SelectorDeFondo
              nombre={visto.nombre}
              valor={visto.fondo_tarjeta ?? null}
              alCambiar={(valor) => {
                alEditar({ ...edicion, fondo_tarjeta: valor });
              }}
            />
          ) : (
            <p className="text-xs text-texto-sutil">
              Con foto, la tarjeta usa la foto (el fondo es para los que no tienen).
            </p>
          )}
          {problema === null ? null : <Aviso tono="peligro" titulo={problema} />}
          {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
          <Button
            type="button"
            className={`${BOTON} self-start`}
            disabled={edicion === undefined || problema !== null}
            cargando={guardando}
            onClick={alGuardar}
          >
            Guardar platillo
          </Button>
        </div>
      )}
    </section>
  );
}
