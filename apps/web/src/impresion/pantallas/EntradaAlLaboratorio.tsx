'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Esqueleto } from '@morphiqpos/ui/sistema';
import { ChevronDown, ChevronRight, KeyRound, Wrench } from 'lucide-react';

import { invocarComando, nuevaClave } from '~/cliente/api';

import {
  AVISO_DEL_LABORATORIO,
  CLAVE_DEL_PROVEEDOR,
  SIN_CONTRASENA_CONFIGURADA,
  type EstadoDelProveedor,
} from './acceso-al-laboratorio.ts';
import { CampoDeTexto } from './campos';
import { Laboratorio } from './Laboratorio';

/**
 * LA ENTRADA AL LABORATORIO, hasta abajo de Operación (DP-20 · refuerzo §2).
 *
 * Discreta, no escondida. El servidor dice si este aparato ya tiene el permiso del proveedor (la
 * cookie es `httpOnly`: la página no la puede leer). Si no, pide la contraseña, que sólo vive en el
 * estado del campo: se borra al enviarla y nunca va a `localStorage`, a un log ni a la consola.
 */

/** Cada llamada con su propia llave: ni la contraseña ni el estado se quedan en el registro de reintentos. */
const sinReintento = (): { readonly idempotencyKey: string } => ({ idempotencyKey: nuevaClave() });

function PedirLaContrasena({
  configurado,
  alEntrar,
}: {
  readonly configurado: boolean;
  readonly alEntrar: () => void;
}): ReactElement {
  const consultas = useQueryClient();
  const [clave, setClave] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function entrar(): Promise<void> {
    if (entrando || clave === '') return;
    // La contraseña sale del campo en el mismo instante en que se envía.
    const enviada = clave;
    setClave('');
    setEntrando(true);
    setFallo(null);
    try {
      await invocarComando('/api/proveedor/entrar', { clave: enviada }, sinReintento());
      await consultas.invalidateQueries({ queryKey: CLAVE_DEL_PROVEEDOR });
      alEntrar();
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudo entrar.');
    } finally {
      setEntrando(false);
    }
  }

  return (
    <form
      className="flex max-w-md flex-col gap-(--espacio-3)"
      onSubmit={(evento) => {
        evento.preventDefault();
        void entrar();
      }}
    >
      <p className="flex items-center gap-(--espacio-2) text-sm font-medium">
        <KeyRound aria-hidden className="size-4 shrink-0 text-primario" />
        {AVISO_DEL_LABORATORIO}
      </p>
      {configurado ? null : <Aviso tono="atencion" titulo={SIN_CONTRASENA_CONFIGURADA} />}
      <CampoDeTexto
        tipo="password"
        etiqueta="Contraseña del proveedor"
        valor={clave}
        alCambiar={setClave}
      />
      <Button
        type="submit"
        className="self-start"
        disabled={entrando || clave === ''}
        cargando={entrando}
      >
        Entrar
      </Button>
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </form>
  );
}

function PuertaDelLaboratorio(): ReactElement {
  const consultas = useQueryClient();
  const [saliendo, setSaliendo] = useState(false);
  const [falloAlSalir, setFalloAlSalir] = useState<string | null>(null);
  const estado = useQuery({
    queryKey: CLAVE_DEL_PROVEEDOR,
    queryFn: () => invocarComando<EstadoDelProveedor>('/api/proveedor/estado', {}, sinReintento()),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  async function salir(): Promise<void> {
    if (saliendo) return;
    setSaliendo(true);
    setFalloAlSalir(null);
    try {
      await invocarComando('/api/proveedor/salir', {}, sinReintento());
      await consultas.invalidateQueries({ queryKey: CLAVE_DEL_PROVEEDOR });
    } catch (error: unknown) {
      setFalloAlSalir(error instanceof Error ? error.message : 'No se pudo salir.');
    } finally {
      setSaliendo(false);
    }
  }

  if (estado.data === undefined) {
    return estado.isError ? (
      <Aviso tono="peligro" titulo="No se pudo saber si tienes el permiso del proveedor">
        <p>{estado.error.message}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-(--espacio-3)"
          onClick={() => {
            void estado.refetch();
          }}
        >
          Reintentar
        </Button>
      </Aviso>
    ) : (
      <Esqueleto className="h-32 w-full max-w-md rounded-lg" />
    );
  }
  if (!estado.data.dentro) {
    return <PedirLaContrasena configurado={estado.data.configurado} alEntrar={() => undefined} />;
  }
  return (
    <div className="flex flex-col gap-(--espacio-3)">
      {falloAlSalir === null ? null : <Aviso tono="peligro" titulo={falloAlSalir} />}
      <Laboratorio
        estado={estado.data}
        saliendo={saliendo}
        alSalir={() => {
          void salir();
        }}
      />
    </div>
  );
}

export function EntradaAlLaboratorio(): ReactElement {
  const [abierto, setAbierto] = useState(false);
  const panel = useId();
  return (
    <section
      aria-label="Hardware y pruebas de impresión"
      className="mt-(--espacio-8) flex flex-col gap-(--espacio-4) border-t border-borde pt-(--espacio-4)"
    >
      <Button
        type="button"
        variant="ghost"
        className="self-start text-texto-sutil"
        aria-expanded={abierto}
        aria-controls={panel}
        onClick={() => {
          setAbierto((ahora) => !ahora);
        }}
      >
        <Wrench aria-hidden className="size-4" />
        Hardware y pruebas de impresión
        {abierto ? (
          <ChevronDown aria-hidden className="size-4" />
        ) : (
          <ChevronRight aria-hidden className="size-4" />
        )}
      </Button>
      <div id={panel} hidden={!abierto}>
        {abierto ? <PuertaDelLaboratorio /> : null}
      </div>
    </section>
  );
}
