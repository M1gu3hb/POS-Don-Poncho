'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Switch } from '@morphiqpos/ui/primitivas/switch';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';

import { invocarComando } from '~/cliente/api';

import {
  AJUSTES_DE_TARJETAS,
  formularioDe,
  hayCambiosEn,
  parcheDe,
  type Campo,
  type Formulario,
} from './ajustes-de-tarjetas.ts';
import { useCambiosSinGuardar } from './cambios-sin-guardar.ts';

/**
 * UNA TARJETA DE AJUSTES SENCILLOS (DP-21 · Bloque 21): sus campos, su «Guardar» y su «✓ Guardado».
 *
 * Guarda SÓLO lo suyo: el parche lleva únicamente los campos de esta tarjeta que cambiaron
 * (`ajustes-de-tarjetas.ts`), por la misma escritura del puente que usaba el formulario único de
 * Operación (`ConfiguracionNegocio` · `update`). Si otra tarjeta u otro aparato cambió otra cosa
 * mientras tanto, esto no la pisa. Quien no puede cambiarla la ve y se le dice quién puede.
 */
export function TarjetaDeAjustes({
  id,
  configuracion,
  puedeCambiar = true,
  quienPuede = 'el dueño o el administrador',
}: {
  readonly id: string;
  /** La configuración del negocio como la leyó la pantalla (`['config']`); `null` mientras llega. */
  readonly configuracion: Readonly<Record<string, unknown>> | null;
  readonly puedeCambiar?: boolean;
  readonly quienPuede?: string;
}): ReactElement | null {
  const ajustes = AJUSTES_DE_TARJETAS[id];
  const consultas = useQueryClient();
  const titulo = useId();
  const base = useId();
  const [formulario, setFormulario] = useState<Formulario>(() =>
    ajustes === undefined ? {} : formularioDe(ajustes, null),
  );
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const hidratadaCon = useRef<unknown>(null);

  const version = configuracion?.['updated_date'];
  useEffect(() => {
    if (ajustes === undefined || configuracion === null) return;
    // Sólo se vuelve a llenar cuando la configuración cambió en el servidor: no pisa lo que se tecleó.
    if (hidratadaCon.current === version) return;
    hidratadaCon.current = version;
    setFormulario(formularioDe(ajustes, configuracion));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const sucia =
    ajustes !== undefined &&
    configuracion !== null &&
    hayCambiosEn(ajustes, formulario, configuracion);
  useCambiosSinGuardar(`ajustes:${id}`, sucia);

  if (ajustes === undefined) return null;

  function cambiar(clave: string, valor: string | number | boolean): void {
    setListo(false);
    setFallo(null);
    setFormulario((actual) => ({ ...actual, [clave]: valor }));
  }

  async function guardar(): Promise<void> {
    if (ajustes === undefined || configuracion === null || guardando) return;
    const parche = parcheDe(ajustes, formulario, configuracion);
    if (Object.keys(parche).length === 0) return;
    setGuardando(true);
    setFallo(null);
    setListo(false);
    try {
      await invocarComando('/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: parche,
      });
      await consultas.invalidateQueries({ queryKey: ['config'] });
      setListo(true);
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  const encendida = (clave: string): boolean => formulario[clave] === true;
  const visibles = ajustes.campos.filter(
    (c) =>
      c.tipo !== 'texto' || c.visibleSiEncendida === undefined || encendida(c.visibleSiEncendida),
  );

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={titulo}
      className="mt-(--espacio-4) flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex flex-col gap-(--espacio-1)">
        <h3 id={titulo} className="text-lg font-semibold">
          {ajustes.titulo}
        </h3>
        {ajustes.descripcion === undefined ? null : (
          <p className="max-w-prose text-sm text-texto-sutil">{ajustes.descripcion}</p>
        )}
      </div>
      <form
        className="flex flex-col gap-(--espacio-4)"
        onSubmit={(evento) => {
          evento.preventDefault();
          void guardar();
        }}
      >
        <div className="grid grid-cols-1 gap-(--espacio-4) sm:grid-cols-2">
          {visibles.map((campo) => (
            <CampoDeLaTarjeta
              key={campo.clave}
              campo={campo}
              idBase={`${base}-${campo.clave}`}
              valor={formulario[campo.clave]}
              deshabilitado={!puedeCambiar || guardando || configuracion === null}
              alCambiar={(valor) => {
                cambiar(campo.clave, valor);
              }}
            />
          ))}
        </div>
        {puedeCambiar ? (
          <div className="flex flex-wrap items-center gap-(--espacio-3)">
            <Button
              type="submit"
              variant="outline"
              disabled={guardando || !sucia}
              cargando={guardando}
            >
              Guardar
            </Button>
            {listo ? (
              <p role="status" className="text-sm font-medium">
                ✓ Guardado
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-texto-sutil">Lo cambia {quienPuede}.</p>
        )}
      </form>
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </Superficie>
  );
}

function CampoDeLaTarjeta({
  campo,
  idBase,
  valor,
  deshabilitado,
  alCambiar,
}: {
  readonly campo: Campo;
  readonly idBase: string;
  readonly valor: string | number | boolean | undefined;
  readonly deshabilitado: boolean;
  readonly alCambiar: (valor: string | number | boolean) => void;
}): ReactElement {
  const idDelControl = campo.id ?? idBase;
  if (campo.tipo === 'interruptor') {
    return (
      <div className="flex items-start justify-between gap-3 sm:col-span-2">
        <div className="flex-1">
          <Label htmlFor={idDelControl} className="text-sm font-medium">
            {campo.etiqueta}
          </Label>
          {campo.ayuda === undefined ? null : (
            <p className="mt-0.5 text-xs text-texto-sutil">{campo.ayuda}</p>
          )}
        </div>
        <Switch
          id={idDelControl}
          checked={valor === true}
          disabled={deshabilitado}
          onCheckedChange={alCambiar}
        />
      </div>
    );
  }
  const completo = campo.tipo === 'texto' && campo.ancho === 'completo';
  return (
    <div className={completo || campo.tipo === 'seleccion' ? 'sm:col-span-2' : undefined}>
      <Label htmlFor={idDelControl} className="text-sm font-medium">
        {campo.etiqueta}
      </Label>
      {campo.tipo === 'seleccion' ? (
        <select
          id={idDelControl}
          className="mt-1 h-(--altura-control) w-full rounded-md border border-borde-fuerte bg-superficie px-3 text-sm"
          value={typeof valor === 'number' ? valor : campo.porOmision}
          disabled={deshabilitado}
          onChange={(evento) => {
            alCambiar(Number(evento.target.value));
          }}
        >
          {campo.opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.nombre}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={idDelControl}
          className="mt-1"
          value={typeof valor === 'string' ? valor : ''}
          placeholder={campo.placeholder}
          disabled={deshabilitado}
          onChange={(evento) => {
            alCambiar(evento.target.value);
          }}
        />
      )}
      {campo.ayuda === undefined ? null : (
        <p className="mt-1 text-xs text-texto-sutil">{campo.ayuda}</p>
      )}
    </div>
  );
}
