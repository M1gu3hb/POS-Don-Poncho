'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@morphiqpos/ui/primitivas/select';
import { Switch } from '@morphiqpos/ui/primitivas/switch';
import { Aviso } from '@morphiqpos/ui/sistema';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

import {
  etiquetaDePrecio,
  moverAbajo,
  moverArriba,
  opcionNueva,
  precioEsValido,
  productosQueLoUsan,
  type GrupoEditable,
  type OpcionEditable,
  type TipoDeGrupo,
} from './editor-de-grupos.ts';

const BOTON_TACTIL = 'min-h-(--altura-control) min-w-(--altura-control)';

interface EditorDeGrupoProps {
  readonly grupo: GrupoEditable;
  readonly productoId: string;
  readonly deshabilitado: boolean;
  readonly errores: readonly string[];
  readonly alCambiar: (grupo: GrupoEditable) => void;
}

/** El formulario de UN grupo de opciones: sus datos y la lista de sus opciones. */
export function EditorDeGrupo({
  grupo,
  productoId,
  deshabilitado,
  errores,
  alCambiar,
}: EditorDeGrupoProps) {
  const prefijo = `grupo-${grupo.clave}`;
  const varias = grupo.tipo === 'multiple';
  const otros = productosQueLoUsan(grupo.productoIds, productoId);

  function cambiarOpcion(indice: number, cambios: Partial<OpcionEditable>): void {
    alCambiar({
      ...grupo,
      opciones: grupo.opciones.map((o, i) => (i === indice ? { ...o, ...cambios } : o)),
    });
  }

  return (
    <div className="flex flex-col gap-(--espacio-4)">
      {otros > 0 ? (
        <Aviso
          tono="atencion"
          titulo={`Este grupo también lo usan ${String(otros)} ${otros === 1 ? 'producto' : 'productos'}: el cambio aplica a todos.`}
        />
      ) : null}
      {errores.length > 0 ? (
        <Aviso tono="peligro" titulo="Corrige esto para continuar">
          <ul className="list-disc pl-(--espacio-4)">
            {errores.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      <div className="flex flex-col gap-(--espacio-1)">
        <Label htmlFor={`${prefijo}-nombre`}>Nombre del grupo</Label>
        <Input
          id={`${prefijo}-nombre`}
          value={grupo.nombre}
          maxLength={80}
          disabled={deshabilitado}
          placeholder="Ej. Término de la carne"
          onChange={(evento) => {
            alCambiar({ ...grupo, nombre: evento.target.value });
          }}
        />
      </div>

      <div className="flex flex-col gap-(--espacio-1)">
        <Label htmlFor={`${prefijo}-tipo`}>Cuántas se pueden elegir</Label>
        <Select
          value={grupo.tipo}
          disabled={deshabilitado}
          onValueChange={(valor) => {
            alCambiar({ ...grupo, tipo: valor as TipoDeGrupo });
          }}
        >
          <SelectTrigger id={`${prefijo}-tipo`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unica">Elige una</SelectItem>
            <SelectItem value="multiple">Elige varias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {varias ? (
        <div className="grid grid-cols-2 gap-(--espacio-3)">
          <div className="flex flex-col gap-(--espacio-1)">
            <Label htmlFor={`${prefijo}-minimo`}>Mínimo (opcional)</Label>
            <Input
              id={`${prefijo}-minimo`}
              inputMode="numeric"
              value={grupo.minimo}
              disabled={deshabilitado}
              onChange={(evento) => {
                alCambiar({ ...grupo, minimo: evento.target.value });
              }}
            />
          </div>
          <div className="flex flex-col gap-(--espacio-1)">
            <Label htmlFor={`${prefijo}-maximo`}>Máximo (opcional)</Label>
            <Input
              id={`${prefijo}-maximo`}
              inputMode="numeric"
              value={grupo.maximo}
              disabled={deshabilitado}
              onChange={(evento) => {
                alCambiar({ ...grupo, maximo: evento.target.value });
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-(--espacio-4)">
        <div className="flex min-h-(--altura-control) items-center gap-(--espacio-2)">
          <Switch
            id={`${prefijo}-obligatorio`}
            checked={grupo.obligatorio}
            disabled={deshabilitado}
            onCheckedChange={(valor) => {
              alCambiar({ ...grupo, obligatorio: valor });
            }}
          />
          <Label htmlFor={`${prefijo}-obligatorio`}>Obligatorio</Label>
        </div>
        <div className="flex min-h-(--altura-control) items-center gap-(--espacio-2)">
          <Switch
            id={`${prefijo}-activo`}
            checked={grupo.activo}
            disabled={deshabilitado}
            onCheckedChange={(valor) => {
              alCambiar({ ...grupo, activo: valor });
            }}
          />
          <Label htmlFor={`${prefijo}-activo`}>Activo</Label>
        </div>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-(--espacio-3)">
        <legend className="mb-(--espacio-1) text-sm font-semibold">Opciones</legend>
        {grupo.opciones.map((opcion, indice) => {
          const id = `${prefijo}-${opcion.clave}`;
          const etiqueta = etiquetaDePrecio(opcion.precio);
          const nombre =
            opcion.nombre.trim() === '' ? `opción ${String(indice + 1)}` : opcion.nombre;
          return (
            <div
              key={opcion.clave}
              className="flex min-w-0 flex-col gap-(--espacio-2) rounded-md border border-borde p-(--espacio-3)"
            >
              <div className="flex flex-col gap-(--espacio-1)">
                <Label htmlFor={`${id}-nombre`}>Nombre de la opción {indice + 1}</Label>
                <Input
                  id={`${id}-nombre`}
                  value={opcion.nombre}
                  maxLength={80}
                  disabled={deshabilitado}
                  onChange={(evento) => {
                    cambiarOpcion(indice, { nombre: evento.target.value });
                  }}
                />
              </div>
              <div className="flex flex-wrap items-end gap-(--espacio-3)">
                <div className="flex w-32 flex-col gap-(--espacio-1)">
                  <Label htmlFor={`${id}-precio`}>Precio en pesos</Label>
                  <Input
                    id={`${id}-precio`}
                    inputMode="decimal"
                    value={opcion.precio}
                    placeholder="0"
                    aria-invalid={!precioEsValido(opcion.precio)}
                    disabled={deshabilitado}
                    onChange={(evento) => {
                      cambiarOpcion(indice, { precio: evento.target.value });
                    }}
                  />
                </div>
                <span
                  className="flex min-h-(--altura-control) items-center text-sm text-texto-suave"
                  aria-live="polite"
                >
                  {etiqueta === '' ? 'Precio inválido' : etiqueta}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-(--espacio-2)">
                <div className="flex min-h-(--altura-control) items-center gap-(--espacio-2)">
                  <Switch
                    id={`${id}-activa`}
                    checked={opcion.activa}
                    disabled={deshabilitado}
                    onCheckedChange={(valor) => {
                      cambiarOpcion(indice, { activa: valor });
                    }}
                  />
                  <Label htmlFor={`${id}-activa`}>Activa</Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className={BOTON_TACTIL}
                  aria-label={`Subir ${nombre}`}
                  disabled={deshabilitado || indice === 0}
                  onClick={() => {
                    alCambiar({ ...grupo, opciones: moverArriba(grupo.opciones, indice) });
                  }}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={BOTON_TACTIL}
                  aria-label={`Bajar ${nombre}`}
                  disabled={deshabilitado || indice === grupo.opciones.length - 1}
                  onClick={() => {
                    alCambiar({ ...grupo, opciones: moverAbajo(grupo.opciones, indice) });
                  }}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={BOTON_TACTIL}
                  aria-label={`Quitar ${nombre}`}
                  disabled={deshabilitado}
                  onClick={() => {
                    alCambiar({
                      ...grupo,
                      opciones: grupo.opciones.filter((_, i) => i !== indice),
                    });
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          className={BOTON_TACTIL}
          disabled={deshabilitado}
          onClick={() => {
            alCambiar({ ...grupo, opciones: [...grupo.opciones, opcionNueva()] });
          }}
        >
          <Plus aria-hidden />
          Agregar opción
        </Button>
      </fieldset>
    </div>
  );
}
