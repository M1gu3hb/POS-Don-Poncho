import { resetearNegocioDePrueba } from '@morphiqpos/app/negocio-de-prueba';

import { ejecutarComandoHttp } from '../../../../src/servidor/http';

/**
 * El reseteo del RESTAURANTE DE PRUEBA, para las corridas de navegador en una base desechable.
 * En la base compartida contesta 403 siempre: el comando se niega por ID fuera de
 * `NEGOCIOS_DE_PRUEBA` y se niega si `DATABASE_URL` es de un proyecto intocable.
 */
export function POST(peticion: Request): Promise<Response> {
  return ejecutarComandoHttp(resetearNegocioDePrueba, peticion);
}
