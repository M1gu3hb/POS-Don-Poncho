import { verElPin } from '@morphiqpos/app/identidad';

import { ejecutarComandoHttp } from '~/servidor/http';

/**
 * DP-25 · Parte 7 · El dueño ve el PIN de una persona, con la firma de SU PIN (`para: 'ver_pin'`).
 *
 * Va por `ejecutarComandoHttp`, como poner el PIN: es una ruta de gestión y lleva la validación de
 * origen de escritura. El puesto lo comprueba el comando: sólo el dueño. Cada vista queda en la
 * auditoría; el PIN viaja sólo en la respuesta, con `no-store`.
 */
export const POST = (peticion: Request): Promise<Response> =>
  ejecutarComandoHttp(verElPin, peticion);

export const runtime = 'nodejs';
