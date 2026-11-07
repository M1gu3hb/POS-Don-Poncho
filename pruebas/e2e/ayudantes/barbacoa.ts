import { expect, type Page } from '@playwright/test';

import { cabecerasDeEscrituraDePrueba, consultarPuente } from './sesion.ts';

/**
 * DP-14 · LA BARBACOA POR KILO EN LA DEMO.
 *
 * La demo no trae nada que se venda por peso: la dueña lo da de alta como en el menú real de Don
 * Poncho —`variable_medida` en kg, $795 el kilo, atajos de ¼, ½ y 1 kg—, en la categoría de los
 * platos fuertes para que salga a la cocina y se vea en el menú del portal.
 */

export const BARBACOA = { nombre: 'Barbacoa de horno', centavosPorKilo: 79_500 } as const;

/** Los pesos de la tabla de aceptación, con su importe exacto a $795/kg. */
export const PESOS = [
  { kilos: 0.25, dicho: '¼ kg', centavos: 19_875 },
  { kilos: 0.5, dicho: '½ kg', centavos: 39_750 },
  { kilos: 0.75, dicho: '¾ kg', centavos: 59_625 },
  { kilos: 1, dicho: '1 kg', centavos: 79_500 },
  { kilos: 1.5, dicho: '1.5 kg', centavos: 119_250 },
] as const;

export const TOTAL_DE_LOS_PESOS = PESOS.reduce((suma, p) => suma + p.centavos, 0);

/** Da de alta la barbacoa por kilo en el negocio de la demo (la dueña, por el puente). */
export async function altaDeLaBarbacoa(duena: Page): Promise<string> {
  const categorias = await consultarPuente<{ id: string; nombre: string }>(
    duena,
    'CategoriaProducto',
    { limite: 50 },
  );
  const fuerte = categorias.find((c) => /fuerte/i.test(c.nombre)) ?? categorias[0];
  expect(fuerte, 'La demo no tiene categorías.').toBeDefined();
  const respuesta = await duena.request.post('/api/datos/escribir', {
    headers: cabecerasDeEscrituraDePrueba(),
    data: {
      entidad: 'ProductoTerminado',
      operacion: 'create',
      datos: {
        nombre: BARBACOA.nombre,
        categoria_id: fuerte?.id,
        precio_venta: BARBACOA.centavosPorKilo / 100,
        tipo_venta: 'variable_medida',
        unidad_venta: 'kg',
        unidad_variable: 'kg',
        precio_por_unidad_variable: BARBACOA.centavosPorKilo / 100,
        presets_variable_qr: [0.25, 0.5, 1],
        estrategia_consumo: 'ninguno',
        permite_venta_sin_stock: true,
        area_preparacion: 'cocina',
        visible_en_pos: true,
        visible_en_menu_digital: true,
        activo: true,
      },
    },
  });
  expect(respuesta.status(), `alta de la barbacoa: ${await respuesta.text()}`).toBe(200);
  const [creada] = await consultarPuente<{ id: string }>(duena, 'ProductoTerminado', {
    filtro: { nombre: BARBACOA.nombre },
    limite: 1,
  });
  expect(creada, 'La barbacoa no quedó en el catálogo.').toBeDefined();
  return creada?.id ?? '';
}

/** Las líneas de una cuenta como las guarda el servidor: cantidad exacta e importe en centavos. */
export async function lineasDeBarbacoa(
  lector: Page,
  ordenId: string,
): Promise<readonly { readonly kilos: number; readonly centavos: number }[]> {
  const filas = await consultarPuente<{
    producto_nombre?: string | null;
    cantidad?: number | string | null;
    total?: number | null;
  }>(lector, 'DetalleVenta', { filtro: { venta_id: ordenId }, limite: 100 });
  return filas
    .filter((f) => f.producto_nombre === BARBACOA.nombre)
    .map((f) => ({
      kilos: Number(f.cantidad ?? 0),
      centavos: Math.round((f.total ?? 0) * 100),
    }))
    .sort((a, b) => a.kilos - b.kilos);
}
