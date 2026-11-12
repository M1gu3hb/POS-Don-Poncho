'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { consultarPuente, invocarComando } from '~/cliente/api';
import type { ProductoDelMenu } from '~/portal/menu-digital/menu-digital';

import { temaDelPortal, type TemaDelPortal } from '../menu-qr/tema-del-portal';
import type { EdicionDelPlatillo } from './personalizar-menu';

/**
 * DP-18 · 1.3 · Lo que lee y escribe «Personalizar menú»: los platillos (foto, descripción corta y
 * fondo), las secciones (su orden) y el encabezado (el mensaje de bienvenida y el estilo del portal).
 * Cada cosa se guarda con SU parche por el puente (`/api/datos/escribir`) y refresca las consultas
 * que la leen (la prueba de contrato de las llaves lo exige).
 */

export interface PlatilloDelEditor extends ProductoDelMenu {
  readonly activo?: boolean;
  readonly visible_en_menu_digital?: boolean | null;
}

export interface SeccionDelEditor {
  readonly id: string;
  readonly nombre?: string | null;
  readonly orden?: number | null;
}

const RAIZ = 'personalizar_menu';
const CLAVE_PLATILLOS = [RAIZ, 'platillos'] as const;
const CLAVE_SECCIONES = [RAIZ, 'secciones'] as const;
/** La misma llave y la misma lectura que `AspectoDelPortal`: los dos editan el tema del portal. */
const CLAVE_TEMA = ['portal_qr_tema'] as const;
const ESCRIBIR = '/api/datos/escribir';

async function leerTema(): Promise<TemaDelPortal> {
  const [configuracion] = await consultarPuente<{ portal_qr_tema?: unknown }>(
    'ConfiguracionNegocio',
    {
      limite: 1,
    },
  );
  return temaDelPortal(configuracion?.portal_qr_tema);
}

export function usePersonalizarMenu() {
  const cliente = useQueryClient();
  const platillos = useQuery({
    queryKey: CLAVE_PLATILLOS,
    queryFn: () =>
      consultarPuente<PlatilloDelEditor>('ProductoTerminado', {
        filtro: { activo: true },
        limite: 500,
      }),
  });
  const secciones = useQuery({
    queryKey: CLAVE_SECCIONES,
    queryFn: () =>
      consultarPuente<SeccionDelEditor>('CategoriaProducto', {
        filtro: { activo: true },
        limite: 200,
      }),
  });
  const tema = useQuery({ queryKey: CLAVE_TEMA, queryFn: leerTema });

  async function guardarPlatillo(id: string, parche: EdicionDelPlatillo): Promise<void> {
    await invocarComando(ESCRIBIR, {
      entidad: 'ProductoTerminado',
      operacion: 'update',
      id,
      datos: parche,
    });
    await Promise.all([
      cliente.invalidateQueries({ queryKey: CLAVE_PLATILLOS }),
      cliente.invalidateQueries({ queryKey: ['productos_all'] }),
      cliente.invalidateQueries({ queryKey: ['productos_pos'] }),
      cliente.invalidateQueries({ queryKey: ['menu_qr_platillos'] }),
    ]);
  }

  async function guardarOrden(
    cambios: readonly { readonly id: string; readonly orden: number }[],
  ): Promise<void> {
    for (const c of cambios) {
      await invocarComando(ESCRIBIR, {
        entidad: 'CategoriaProducto',
        operacion: 'update',
        id: c.id,
        datos: { orden: c.orden },
      });
    }
    await Promise.all([
      cliente.invalidateQueries({ queryKey: CLAVE_SECCIONES }),
      cliente.invalidateQueries({ queryKey: ['categorias_producto'] }),
      cliente.invalidateQueries({ queryKey: ['menu_qr_categorias'] }),
    ]);
  }

  async function guardarEncabezado(cambios: {
    readonly mensaje?: string;
    readonly estilo?: string | null;
    readonly temaActual: TemaDelPortal;
  }): Promise<void> {
    if (cambios.mensaje !== undefined) {
      await invocarComando(ESCRIBIR, {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { portal_qr_mensaje_bienvenida: cambios.mensaje },
      });
      await cliente.invalidateQueries({ queryKey: ['config'] });
    }
    if (cambios.estilo !== undefined) {
      await invocarComando(ESCRIBIR, {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { portal_qr_tema: { ...cambios.temaActual, estilo: cambios.estilo } },
      });
      await cliente.invalidateQueries({ queryKey: CLAVE_TEMA });
    }
  }

  return { platillos, secciones, tema, guardarPlatillo, guardarOrden, guardarEncabezado };
}
