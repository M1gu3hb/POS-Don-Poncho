/**
 * DÍA 0 · LA CAJA QUE QUEDÓ ABIERTA: la copia de Don Poncho trae una caja abierta en otro aparato
 * («Caja 27», la de la prueba en producción). Con el cupo de 2 cajas ocuparía una de las dos de la
 * semana. El dueño la trae a su pantalla, cuenta lo que hay y la cierra, como al abrir el negocio.
 *
 * Con una sola caja abierta y cupo para otra, la pantalla NO ofrece «Traer esta caja aquí» (sólo lo
 * ofrece con el cupo lleno): no hay forma de cerrar la caja de otro aparato desde la pantalla. Se
 * registra como observación de UX y se usa la misma llamada que haría el botón (`/api/caja/traer`).
 */
import { llamar } from '../api-app.ts';
import { estadoDeLaCaja, irACaja, traerLaCaja } from '../pantallas/caja.ts';
import { cierreDeLaCaja } from '../pantallas/corte.ts';
import type { Dia0 } from './contexto.ts';

export async function pasoCajaHeredada(d: Dia0): Promise<void> {
  const { pagina } = d;
  const estado = await llamar(pagina, '/api/caja/estado', { efectivoContadoCentavos: 0 });
  const otra = estado.datos['enOtraTerminal'] as
    { sesionCajaId?: string; terminalNombre?: string; puedoTraerla?: boolean } | null | undefined;
  if (estado.datos['abierta'] !== true && (otra === null || otra === undefined)) {
    d.nota('caja', 'no hay caja heredada');
    return;
  }
  await irACaja(pagina, d.entorno.appUrl);
  if ((await estadoDeLaCaja(pagina)) === 'en-otro-aparato') {
    await traerLaCaja(pagina);
  } else if (estado.datos['abierta'] !== true && otra?.sesionCajaId !== undefined) {
    await d.incidente({
      pantalla: 'Caja',
      hizo: `Entré a Caja como dueño con la «${otra.terminalNombre ?? 'otra'}» abierta en otro aparato y un cupo de 2 cajas`,
      esperaba: 'Una forma de traerla o cerrarla desde la pantalla',
      paso: 'Sólo dice «Caja cerrada» y «Abrir caja»; «Traer esta caja aquí» aparece únicamente con el cupo lleno',
      gravedad: 'bajo',
      clase: 'ux',
    });
    const traida = await llamar(pagina, '/api/caja/traer', { sesionCajaId: otra.sesionCajaId });
    if (!traida.ok)
      throw new Error(
        `No se pudo traer la caja heredada: ${String(traida.estado)} ${traida.mensaje}`,
      );
    d.nota(
      'caja',
      `trajo «${otra.terminalNombre ?? 'la caja'}» a su pantalla (por la API: la pantalla no lo ofrece)`,
    );
    await irACaja(pagina, d.entorno.appUrl);
  }
  const despues = await llamar(pagina, '/api/caja/estado', { efectivoContadoCentavos: 0 });
  const esperado = Number(despues.datos['efectivoEsperadoCentavos']);
  if (!Number.isFinite(esperado))
    throw new Error('El estado de la caja no dijo cuánto efectivo debería haber.');
  const r = await cierreDeLaCaja(pagina, esperado);
  if (r.bloqueadoPorMesas)
    throw new Error('No se pudo cerrar la caja heredada: hay mesas pendientes.');
  d.nota('caja', `cerrada la caja heredada contando ${(esperado / 100).toFixed(2)} (justo)`);
}
