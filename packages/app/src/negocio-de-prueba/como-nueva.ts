import { DUENO_DE_PRUEBA } from '@morphiqpos/contracts/negocios/equipo';

import type { AparienciaGuardada } from '../configuracion/apariencia.ts';

/**
 * CÓMO ES UN RESTAURANTE DE PRUEBA RECIÉN NACIDO · lo que el reseteo repone (bloque B.2).
 *
 * El reseteo borraba ventas, catálogo e inventario y dejaba TODO lo demás como lo había
 * dejado la última prueba: el PIN que `humo-accesos` cambió, la credencial bloqueada por
 * intentos, el IVA que `humo-impuesto` movió, la plantilla que la suite cambió para
 * comparar vocabularios, el estilo que alguien probó en el selector y las terminales que
 * cada corrida de Playwright deja. La siguiente corrida empezaba sobre eso.
 *
 * Aquí está escrito, en un solo sitio, a qué se devuelve cada cosa.
 */

/**
 * EL ESTILO DEL RESTAURANTE DE PRUEBA, con las perillas que el propio estilo declara en
 * `packages/ui/src/tokens/estilos.ts` (la prueba lo compara, para que no se desfasen).
 */
export const APARIENCIA_DE_PRUEBA: AparienciaGuardada = {
  estilo: 'noche',
  densidad: 'comoda',
  redondeo: 'media',
  elevacion: 'sombra',
  movimiento: 'sutil',
};

/** El IVA del restaurante de prueba: el general de México, incluido en el precio. */
export const IMPUESTO_DE_PRUEBA = { puntosBase: 1600, incluidoEnPrecio: true } as const;

/**
 * CUÁNTAS CAJAS ABRE A LA VEZ (F-235, 179): el restaurante tiene un cajón (§8.1 de su
 * `02-DINERO-Y-CAJA`). Una prueba que suba el cupo queda deshecha al resetear.
 */
export const CAJAS_SIMULTANEAS_DE_PRUEBA = 1;

/**
 * Los topes de descuento por rol, los mismos que la migración 078 siembra para todo
 * negocio. Hay que reponerlos porque un tope que no existe se lee como CERO: sin ellos,
 * tras un reseteo nadie podría descontar nada, ni el dueño.
 */
export const TOPES_DE_DESCUENTO: readonly {
  readonly rol: string;
  readonly topeCentavos: bigint;
  readonly topeBp: number;
}[] = [
  { rol: 'dueno', topeCentavos: 100_000_000n, topeBp: 10_000 },
  { rol: 'administrador', topeCentavos: 500_000n, topeBp: 5_000 },
  { rol: 'gerente', topeCentavos: 200_000n, topeBp: 3_000 },
  { rol: 'cajero', topeCentavos: 5_000n, topeBp: 1_000 },
  { rol: 'mesero', topeCentavos: 0n, topeBp: 0 },
  { rol: 'cocina', topeCentavos: 0n, topeBp: 0 },
  { rol: 'almacen', topeCentavos: 0n, topeBp: 0 },
];

/** El PIN del dueño de cada demo, el que pone `db:bootstrap` (ACCESOS-DEMO §2). */
export const PIN_DEL_DUENO_DE_PRUEBA: string = DUENO_DE_PRUEBA.pin;
