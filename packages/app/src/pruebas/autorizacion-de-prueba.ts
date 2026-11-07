import { randomUUID } from 'node:crypto';

import { firmarAutorizacion } from '../identidad/supervisor.ts';

/**
 * LA AUTORIZACIÓN DE DESCUENTO DE LAS PRUEBAS (DP-14.2).
 *
 * Desde DP-14.2 todo descuento pide la clave de un gerente, administrador o dueño, firmada para la
 * cuenta y por el monto exacto. Las pruebas de integración que descuentan la firman aquí, con el
 * mismo secreto con que sustituyen `validarEntorno`:
 *
 *   vi.mock('@morphiqpos/contracts', async (original) => ({
 *     ...(await original<typeof import('@morphiqpos/contracts')>()),
 *     validarEntorno: () => ({ SESSION_SECRET: 'secreto_de_integracion_de_las_autorizaciones_2026' }),
 *   }));
 *
 * (El `vi.mock` se iza sobre los `import`: el secreto va escrito ahí, no importado de aquí.)
 */
export const SECRETO_DE_PRUEBA = 'secreto_de_integracion_de_las_autorizaciones_2026';

export interface AutorizacionDePrueba {
  readonly organizacionId: string;
  /** El empleo que teclea su PIN. */
  readonly supervisor: string;
  readonly rol: 'gerente' | 'administrador' | 'dueno';
  /** El empleo de la sesión que pide el descuento (puede ser el mismo supervisor). */
  readonly solicita: string;
  readonly ordenId: string;
  readonly montoCentavos: number | bigint;
}

/** Lo que firma `/api/identidad/supervisor` cuando el supervisor teclea su PIN. */
export function autorizacionDeDescuento(datos: AutorizacionDePrueba): string {
  return firmarAutorizacion(
    {
      org: datos.organizacionId,
      supervisor: datos.supervisor,
      rol: datos.rol,
      solicita: datos.solicita,
      exp: Math.floor(Date.now() / 1000) + 120,
      n: randomUUID(),
      cuenta: datos.ordenId,
      para: 'descuento',
      monto: String(datos.montoCentavos),
    },
    SECRETO_DE_PRUEBA,
  );
}
