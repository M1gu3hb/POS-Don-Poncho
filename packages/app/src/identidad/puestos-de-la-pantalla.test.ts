import { describe, expect, it } from 'vitest';

import { PUEDE_OTORGAR } from './empleados.ts';

/**
 * La tabla de la pantalla de Usuarios es el ESPEJO de `PUEDE_OTORGAR` (DP-14, ronda 2).
 *
 * El diálogo sólo OFRECE los puestos que quien edita puede dar; el servidor es quien decide. Si las
 * dos tablas se separan, o la pantalla promete un puesto que el servidor rechaza, o esconde uno que
 * sí podría dar. Esta prueba las ata.
 */

interface PuestosDeLaPantalla {
  readonly PUEDE_OTORGAR: Readonly<Record<string, readonly string[]>>;
  readonly PUESTOS: readonly { valor: string; etiqueta: string }[];
  readonly PUESTOS_DE_MANDO: readonly string[];
}

const RUTA = new URL(
  '../../../../apps/web/heredado/components/configuracion/puestos.js',
  import.meta.url,
);

async function cargar(): Promise<PuestosDeLaPantalla> {
  return (await import(/* @vite-ignore */ RUTA.href)) as PuestosDeLaPantalla;
}

describe('los puestos de la pantalla de Usuarios', () => {
  it('quién da qué es idéntico al servidor', async () => {
    const pantalla = await cargar();
    expect(pantalla.PUEDE_OTORGAR).toEqual(PUEDE_OTORGAR);
  });

  it('los de mando son quienes pueden dar puestos, y están los siete con su nombre', async () => {
    const pantalla = await cargar();
    expect([...pantalla.PUESTOS_DE_MANDO].sort()).toEqual(Object.keys(PUEDE_OTORGAR).sort());
    expect(pantalla.PUESTOS.map((p) => p.valor)).toEqual([
      'dueno',
      'administrador',
      'gerente',
      'cajero',
      'mesero',
      'cocina',
      'almacen',
    ]);
    expect(pantalla.PUESTOS.map((p) => p.etiqueta)).toEqual([
      'Dueño',
      'Administrador',
      'Gerente',
      'Cajero',
      'Mesero',
      'Cocina',
      'Almacén',
    ]);
  });
});
