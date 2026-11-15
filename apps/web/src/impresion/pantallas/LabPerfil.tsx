'use client';

import { useRef, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso } from '@morphiqpos/ui/sistema';
import { Download, Save, Trash2, Upload } from 'lucide-react';

import { exportarPerfil, importarPerfil, type PerfilDeImpresion } from '../termico/perfil.ts';
import { nombreDelArchivo, problemaDelArchivo } from './archivo-del-perfil.ts';
import { CampoDeTexto, SeccionDelLab } from './campos';
import type { PerfilDelFormulario } from './formulario.ts';
import { resultadoDeUnError } from './resultado-de-prueba.ts';

/**
 * 10 · EL PERFIL DE ESTE APARATO (DP-20 · laboratorio): guardar lo que funcionó, llevarlo a otro
 * POS como archivo y quitarlo. El perfil se guarda EN EL APARATO, no en el servidor: cada punto de
 * venta tiene su impresora.
 */

interface Mensaje {
  readonly ok: boolean;
  readonly texto: string;
}

function descargar(perfil: PerfilDeImpresion): void {
  const archivo = new Blob([exportarPerfil(perfil)], { type: 'application/json' });
  const direccion = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = direccion;
  enlace.download = nombreDelArchivo(perfil.nombre);
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(direccion);
}

export function LabPerfil({
  nombre,
  alCambiarElNombre,
  errorDelNombre,
  armado,
  guardado,
  guardar,
  alImportar,
}: {
  readonly nombre: string;
  readonly alCambiarElNombre: (nombre: string) => void;
  readonly errorDelNombre: string | undefined;
  /** El perfil que sale del formulario, ya validado con el esquema, o sus errores. */
  readonly armado: PerfilDelFormulario;
  /** Lo que tiene guardado el aparato: `undefined` leyendo, `null` sin perfil. */
  readonly guardado: PerfilDeImpresion | null | undefined;
  readonly guardar: (perfil: PerfilDeImpresion | null) => Promise<void>;
  readonly alImportar: (perfil: PerfilDeImpresion) => void;
}): ReactElement {
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const selector = useRef<HTMLInputElement>(null);
  const sinPerfil = armado.ok ? undefined : 'Corrige los datos marcados arriba.';

  async function conAviso(trabajo: () => Promise<string>): Promise<void> {
    if (ocupado) return;
    setOcupado(true);
    setMensaje(null);
    try {
      setMensaje({ ok: true, texto: await trabajo() });
    } catch (error: unknown) {
      setMensaje({ ok: false, texto: resultadoDeUnError(error).texto });
    } finally {
      setOcupado(false);
      setConfirmando(false);
    }
  }

  async function leerArchivo(archivo: File): Promise<string> {
    const problema = problemaDelArchivo(archivo);
    if (problema !== null) throw new Error(problema);
    const leido = importarPerfil(await archivo.text());
    if (!leido.ok) throw new Error(leido.motivo);
    alImportar(leido.perfil);
    return `Perfil «${leido.perfil.nombre}» cargado en el formulario. Falta guardarlo en este aparato.`;
  }

  return (
    <SeccionDelLab
      titulo="10 · El perfil de este aparato"
      icono={<Save aria-hidden className="size-5 shrink-0 text-primario" />}
      descripcion="Guarda lo que funcionó: desde ese momento este punto de venta imprime con él. Exportarlo deja listo otro POS idéntico en un minuto."
    >
      <p className="text-sm" role="status">
        {guardado === undefined
          ? 'Leyendo el perfil guardado…'
          : guardado === null
            ? 'Este aparato todavía no tiene perfil guardado.'
            : `Perfil guardado en este aparato: «${guardado.nombre}».`}
      </p>
      <div className="sm:max-w-md">
        <CampoDeTexto
          etiqueta="Nombre del perfil"
          valor={nombre}
          error={errorDelNombre}
          marcador="Mostrador 80 mm"
          alCambiar={alCambiarElNombre}
        />
      </div>
      <div className="flex flex-wrap items-center gap-(--espacio-3)">
        <Button
          type="button"
          disabled={!armado.ok || ocupado}
          cargando={ocupado}
          onClick={() => {
            if (!armado.ok) return;
            void conAviso(async () => {
              await guardar(armado.perfil);
              return `Perfil «${armado.perfil.nombre}» guardado en este aparato ✓`;
            });
          }}
        >
          <Save aria-hidden className="size-4" />
          Guardar como perfil de este aparato
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!armado.ok || ocupado}
          onClick={() => {
            if (!armado.ok) return;
            descargar(armado.perfil);
            setMensaje({ ok: true, texto: 'Archivo descargado ✓' });
          }}
        >
          <Download aria-hidden className="size-4" />
          Exportar
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={ocupado}
          onClick={() => {
            selector.current?.click();
          }}
        >
          <Upload aria-hidden className="size-4" />
          Importar
        </Button>
        <input
          ref={selector}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Archivo de perfil de impresión"
          onChange={(evento) => {
            const archivo = evento.target.files?.[0];
            evento.target.value = '';
            if (archivo !== undefined) void conAviso(() => leerArchivo(archivo));
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={guardado == null || ocupado}
          onClick={() => {
            setConfirmando(true);
          }}
        >
          <Trash2 aria-hidden className="size-4" />
          Quitar el perfil
        </Button>
      </div>
      {sinPerfil === undefined ? null : <p className="text-xs text-texto-sutil">{sinPerfil}</p>}
      {confirmando ? (
        <Aviso tono="atencion" titulo="¿Quitar el perfil de este aparato?" anuncio="alerta">
          <p>Este aparato dejará de imprimir directo y volverá al diálogo del navegador.</p>
          <div className="mt-(--espacio-3) flex flex-wrap gap-(--espacio-2)">
            <Button
              type="button"
              variant="destructive"
              disabled={ocupado}
              onClick={() => {
                void conAviso(async () => {
                  await guardar(null);
                  return 'Perfil quitado de este aparato.';
                });
              }}
            >
              Sí, quitar el perfil
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmando(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </Aviso>
      ) : null}
      {mensaje === null ? null : (
        <p role={mensaje.ok ? 'status' : 'alert'} className="text-sm font-medium">
          {mensaje.ok ? '✓ ' : '× '}
          {mensaje.texto}
        </p>
      )}
    </SeccionDelLab>
  );
}
