import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { relevarResponsable } from '@morphiqpos/app/restaurante';
import { describe, expect, it } from 'vitest';

import { puedePasarLaMesa } from './pasar-la-mesa.ts';

/**
 * DP-D156 · «Pasar la mesa a otro mesero» es de quien el comando deja, y nadie más.
 *
 * Dos garantías que no se ven en una prueba de la función pura:
 *   1. La pantalla no inventa permisos: los puestos que la ven son EXACTAMENTE los del comando.
 *   2. Está cableada de punta a punta: el botón sólo existe con la regla, el diálogo llama a
 *      `/api/restaurante/relevar` con ESTA cuenta y relee el plano, y la mesa activa sólo lo ofrece
 *      a quien `puedePasarLaMesa` deja. Se comprueba sobre el código fuente porque aquí no se pinta.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (archivo: string): string =>
  readFileSync(join(RAIZ_WEB, 'src', 'restaurante', archivo), 'utf8').replace(/\s+/g, ' ');

/** Los nombres de la sesión → los puestos de la base que cada uno cubre (`puente/roles.ts`). */
const PUESTOS_DE_LA_SESION: Readonly<Record<string, readonly string[]>> = {
  administrador: ['dueno', 'administrador', 'gerente'],
  caja: ['cajero'],
  mesero: ['mesero'],
  cocina: ['cocina'],
  almacen: ['almacen'],
};

describe('no inventa permisos', () => {
  it('los roles de la sesión que ven el botón cubren exactamente los puestos del comando', () => {
    const ven = Object.entries(PUESTOS_DE_LA_SESION)
      .filter(([rol]) => puedePasarLaMesa(rol, 'ana'))
      .flatMap(([, puestos]) => puestos)
      .sort();
    expect(ven).toEqual([...relevarResponsable.roles].sort());
  });
});

describe('cableado de la pantalla', () => {
  it('«Pasar la mesa» sólo se pinta si la mesa activa lo ofrece', () => {
    const c = leer('AccionesDeLaMesa.tsx');
    expect(c).toContain('const pasar = props.pasarLaMesa ?? null;');
    expect(c).toContain('{pasar === null ? null : ( <Button');
    expect(c).toContain('setPasando(true)');
    expect(c).toContain('{pasar === null || !pasando ? null : ( <PasarLaMesaDialog');
  });

  it('el diálogo pasa ESTA cuenta con el comando de siempre y relee el plano de los meseros', () => {
    const c = leer('PasarLaMesaDialog.tsx');
    expect(c).toContain(
      "invocarComando( '/api/restaurante/relevar', entradaDelRelevo({ ordenId: props.ordenId, saleId: props.atiendeId, entraId: entra.id }), )",
    );
    expect(c).toContain('invalidateQueries({ queryKey: claves.mesas.raiz() })');
    // Confirma antes de pasar: elegir no escribe nada.
    expect(c).toContain('preguntaDelRelevo(');
    expect(c).toContain('setElegido');
  });

  it('los blancos del diálogo son de 44 px o más', () => {
    const c = leer('PasarLaMesaDialog.tsx');
    expect(c).toContain('min-h-[max(3.5rem,var(--altura-control))] w-full');
    expect(c.split('min-h-[max(2.75rem,var(--altura-control))]')).toHaveLength(3);
  });

  it('la mesa activa lo ofrece sólo a quien puedePasarLaMesa deja, con quien la atiende hoy', () => {
    const c = leer('MesaActiva.tsx');
    expect(c).toContain('pasarLaMesa={ puedePasarLaMesa(rol, mesa.atendido_por_id) ?');
    expect(c).toContain('atiendeId: mesa.atendido_por_id ??');
    expect(c).toContain('atiendeNombre: mesa.atendido_por_nombre ?? null');
    expect(c).toContain('toast.success(avisoDelRelevo(');
  });
});
