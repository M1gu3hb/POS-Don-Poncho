'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso } from '@morphiqpos/ui/sistema';
import { useState, type ReactElement } from 'react';

import { ErrorApi } from '~/cliente/api';

import { crearAlmacenPrincipal } from './almacen-de-la-sucursal.ts';

/**
 * DP-18 (A4) · «Esta sucursal todavía no tiene almacén» con el botón que lo crea.
 *
 * Lo pintan Inventario y Compras cuando el resumen de inventario no trae ningún almacén. Se crea una
 * sola vez, con el nombre «Almacén principal», y la pantalla sigue con su id (`onCreado`). Un fallo
 * no se traga: se queda escrito en el aviso para volver a intentar.
 */
export function FaltaElAlmacen({
  onCreado,
}: {
  readonly onCreado: (id: string) => void;
}): ReactElement {
  const [creando, setCreando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function crear(): Promise<void> {
    setCreando(true);
    setFallo(null);
    try {
      const id = await crearAlmacenPrincipal();
      onCreado(id);
    } catch (error: unknown) {
      setFallo(
        error instanceof ErrorApi
          ? error.error.mensaje
          : error instanceof Error
            ? error.message
            : 'No se pudo crear el almacén.',
      );
    } finally {
      setCreando(false);
    }
  }

  return (
    <Aviso
      tono="atencion"
      titulo="Esta sucursal todavía no tiene almacén."
      accion={
        <Button
          type="button"
          disabled={creando}
          onClick={() => {
            void crear();
          }}
        >
          {creando ? 'Creando…' : 'Crear el almacén principal'}
        </Button>
      }
    >
      Sin él no se pueden recibir compras ni guardar el inventario. Se crea una sola vez.
      {fallo === null ? null : <span className="mt-(--espacio-1) block text-peligro">{fallo}</span>}
    </Aviso>
  );
}
