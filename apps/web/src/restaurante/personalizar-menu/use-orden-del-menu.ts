'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { consultarPuente, invocarComando } from '~/cliente/api';

import type { CambioDeVisibilidad } from './donde-se-ve';

/**
 * DP-24 · 3.2 · Lo que lee y escribe «El orden del menú» (Configuración → Portal de comensales):
 * las categorías, sus platillos y cuáles se ven en el menú digital. Todo se GUARDA con comandos de
 * catálogo (`catalogo.ordenar_categorias`, `catalogo.ordenar_productos`, `catalogo.mostrar_en_menu`),
 * con su auditoría; las pantallas sólo leen por el puente.
 *
 * Cada guardado refresca TODO lo que lee ese orden: la vista previa del teléfono, las rejillas del
 * mesero y de la Caja, el portal y esta misma pantalla (la prueba de contrato de las llaves lo exige).
 */

export interface CategoriaDelOrden {
  readonly id: string;
  readonly nombre?: string | null;
  readonly color?: string | null;
  readonly orden?: number | null;
}

export interface PlatilloDelOrden {
  readonly id: string;
  readonly nombre?: string | null;
  readonly categoria_id?: string | null;
  readonly orden_en_categoria?: number | null;
  readonly visible_en_menu_digital?: boolean | null;
  /** DP-D227 · El mesero y la Caja (aparte del portal QR). */
  readonly visible_en_pos?: boolean | null;
}

export const RUTAS_DEL_ORDEN = {
  categorias: '/api/catalogo/ordenar-categorias',
  productos: '/api/catalogo/ordenar-productos',
  mostrar: '/api/catalogo/mostrar-en-menu',
} as const;

const RAIZ = 'personalizar_menu';
/** Las llaves que lee esta pantalla; las demás las comparte con la vista previa y las rejillas. */
export const CLAVE_CATEGORIAS_DEL_ORDEN = [RAIZ, 'secciones'] as const;
export const CLAVE_PLATILLOS_DEL_ORDEN = [RAIZ, 'platillos'] as const;

const LLAVES_QUE_LEEN_EL_ORDEN = [
  CLAVE_CATEGORIAS_DEL_ORDEN,
  CLAVE_PLATILLOS_DEL_ORDEN,
  ['productos_pos'],
  ['productos_all'],
  ['categorias'],
  ['categorias_producto'],
  ['menu_qr_platillos'],
  ['menu_qr_categorias'],
] as const;

export function useOrdenDelMenu() {
  const cliente = useQueryClient();
  const categorias = useQuery({
    queryKey: CLAVE_CATEGORIAS_DEL_ORDEN,
    queryFn: () =>
      consultarPuente<CategoriaDelOrden>('CategoriaProducto', {
        filtro: { activo: true },
        limite: 200,
      }),
  });
  const platillos = useQuery({
    queryKey: CLAVE_PLATILLOS_DEL_ORDEN,
    queryFn: () =>
      consultarPuente<PlatilloDelOrden>('ProductoTerminado', {
        filtro: { activo: true },
        limite: 500,
      }),
  });

  async function refrescar(): Promise<void> {
    await Promise.all(
      LLAVES_QUE_LEEN_EL_ORDEN.map((queryKey) => cliente.invalidateQueries({ queryKey })),
    );
  }

  /** `antes` es el orden que se VIO: si otra persona ordenó mientras tanto, el servidor lo rechaza. */
  async function guardarCategorias(ids: readonly string[], antes: readonly string[]) {
    await invocarComando(RUTAS_DEL_ORDEN.categorias, { categoriaIds: ids, antes });
    await refrescar();
  }

  async function guardarProductos(
    categoriaId: string,
    ids: readonly string[],
    antes: readonly string[],
  ) {
    await invocarComando(RUTAS_DEL_ORDEN.productos, { categoriaId, productoIds: ids, antes });
    await refrescar();
  }

  /** DP-D227 · `visible` es el portal QR y `visibleEnPos` el POS: sólo se manda lo que cambia. */
  async function mostrar(productoId: string, cambio: CambioDeVisibilidad) {
    await invocarComando(RUTAS_DEL_ORDEN.mostrar, { productoId, ...cambio });
    await refrescar();
  }

  return { categorias, platillos, guardarCategorias, guardarProductos, mostrar, refrescar };
}
