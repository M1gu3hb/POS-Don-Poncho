import 'server-only';

import { PAQUETES_PORTAL, plantillaDeOrganizacion } from '@morphiqpos/contracts';
import { conTransaccion } from '@morphiqpos/data';

import { cuerpoDentroDelLimite } from '../http/limite-cuerpo.ts';
import { origenDe } from '../http/limite.ts';
import { correlationIdDe } from '../observabilidad.ts';
import { buscadorDeProduccion, resolverAmbitoPortal } from './ambito.ts';
import { banderasDe } from './banderas.ts';
import {
  aperturaDeLaCuenta,
  entradaDelSondeo,
  estadoDelCarrito,
  latir,
  ultimoLatido,
  type EstadoDelCarrito,
} from './carrito.ts';
import {
  errorHttp,
  peticionPropia,
  resolverDespliegue,
  respuesta,
  respuestaDeError,
  type PeticionDelPortal,
  type RespuestaDelPortal,
} from './http.ts';
import { permitirPortal, type Permiso } from './limite.ts';
import { exigirPortalAbierto, leerContextoDelNegocio, puedeOrdenarDesdeQR } from './negocio.ts';
import { emitirTelefono, huellaDelTelefono, telefonoFirmado } from './telefono.ts';

/**
 * El latido del teléfono y el carrito de su mesa, en una transacción. `null`: este negocio no
 * acepta pedidos desde el teléfono, y entonces no hay carrito ni latido.
 *
 * DP-13.3 · El id tiene que ser uno que el servidor firmó (`QR_TELEFONO_NO_RECONOCIDO` si no): el
 * sondeo le emite uno al que llega sin él (`resolverElTelefono`) antes de llegar aquí. Y este es el
 * único sitio que entrega la noticia de «el mesero vació el pedido»: se lee el latido de antes, se
 * escribe el de ahora y, si la noticia le tocaba, el latido se reescribe aunque fuera reciente —
 * eso es lo que la vuelve de UNA vez (`vaciadoQueLeToca`).
 */
export async function leerElCarrito(peticion: {
  readonly token: string;
  readonly organizacionId: string;
  readonly pimienta: string;
  readonly dispositivo: string;
  readonly ahora: Date;
}): Promise<EstadoDelCarrito | null> {
  const { token, organizacionId, pimienta, dispositivo, ahora } = peticion;
  const huella = huellaDelTelefono(pimienta, dispositivo);
  return conTransaccion(async (tx) => {
    const ambito = await resolverAmbitoPortal(
      buscadorDeProduccion(organizacionId, tx),
      organizacionId,
      token,
    );
    const negocio = await leerContextoDelNegocio(tx, organizacionId);
    if (negocio === null) return null;
    const banderas = banderasDe(negocio.valores);
    exigirPortalAbierto(banderas);
    const paquete = plantillaDeOrganizacion(negocio.giro, negocio.paquete);
    const delPortal: readonly string[] = PAQUETES_PORTAL;
    if (!delPortal.includes(paquete) || !puedeOrdenarDesdeQR(paquete, banderas)) return null;
    const latidoAnterior = await ultimoLatido(tx, ambito, huella);
    await latir(tx, ambito, huella, ahora);
    const desde = await aperturaDeLaCuenta(tx, ambito);
    const estado = await estadoDelCarrito(tx, ambito, huella, {
      desde,
      ahora,
      banderas,
      latidoAnterior,
    });
    if (estado.vaciadoPorElMesero !== null) {
      await latir(tx, ambito, huella, ahora, { sinEspera: true });
    }
    return estado;
  });
}

export type ResultadoDelTelefono =
  | { readonly ok: true; readonly dispositivo: string; readonly emitido: boolean }
  | { readonly ok: false; readonly esperaSegundos: number };

/**
 * DP-13.3 (punto 11) · ¿Con qué id sondea este teléfono? Si trae uno que el servidor firmó, ese (y
 * no gasta nada). Si no trae ninguno, o trae uno que no verifica —se lo inventó el navegador, lo
 * cambió alguien, o es de antes de las firmas—, el servidor le EMITE uno nuevo. Emitir es lo que
 * hace crecer la mesa, así que tiene su límite: por mesa y, aparte, por IP (`limite.ts`). El token
 * ya se validó en `resolverDespliegue`: un código inventado no llega a contar.
 */
export async function resolverElTelefono(peticion: {
  readonly token: string;
  readonly ip: string;
  readonly pimienta: string;
  readonly dispositivo: string | undefined;
  readonly contexto: { readonly correlationId: string; readonly organizacionId: string };
}): Promise<ResultadoDelTelefono> {
  const { token, ip, pimienta, dispositivo, contexto } = peticion;
  if (telefonoFirmado(pimienta, dispositivo)) return { ok: true, dispositivo, emitido: false };
  for (const [accion, clave] of [
    ['telefono_nuevo_ip', ip],
    // DP-14.6 · Antes que el de la mesa: lo que él niega no gasta el cupo de los demás.
    ['telefono_nuevo_mesa_ip', `${token}:${ip}`],
    ['telefono_nuevo_mesa', token],
  ] as const) {
    const permiso = await permitirPortal(accion, clave, pimienta, contexto);
    if (!permiso.ok) return { ok: false, esperaSegundos: permiso.esperaSegundos };
  }
  return { ok: true, dispositivo: emitirTelefono(pimienta), emitido: true };
}

/**
 * DP-12.2 · El límite del sondeo es por TELÉFONO y mesa: con un solo cubo por mesa, diez teléfonos
 * sondeando cada 2.5 s (240 al minuto) cortaban el carrito a todos. Y uno por mesa, más alto, para
 * que inventar teléfonos con un código válido no sea gratis. El token ya se validó en
 * `resolverDespliegue`: un código inventado no llega a contar.
 */
export async function permitirElSondeo(
  token: string,
  dispositivo: string,
  pimienta: string,
  contexto: { readonly correlationId: string; readonly organizacionId: string },
): Promise<Permiso> {
  const delTelefono = await permitirPortal(
    'carrito_estado',
    `${token}:${dispositivo}`,
    pimienta,
    contexto,
  );
  return delTelefono.ok ? permitirPortal('carrito_mesa', token, pimienta, contexto) : delTelefono;
}

function demasiadasPeticiones(esperaSegundos: number): RespuestaDelPortal {
  return respuesta(429, {
    ok: false,
    error: {
      codigo: 'REGLA_DE_NEGOCIO',
      mensaje: 'Demasiadas peticiones desde este código. Espera un momento.',
      datos: { regla: 'QR_DEMASIADAS_PETICIONES', esperaSegundos },
    },
  });
}

/**
 * `POST /api/publico/qr/:token/carrito` — EL SONDEO DEL CARRITO COMPARTIDO (DP-9.5).
 *
 * Cada teléfono de la mesa lo llama cada 2-3 s con su id: deja su latido (así se cuentan las
 * «personas conectadas») y recibe el carrito de la mesa. NO es un comando: el latido es
 * presencia, no un hecho del negocio, y auditar cada sondeo escribiría una fila por teléfono
 * cada tres segundos. Lo que cambia el carrito —agregar, quitar, enviar— sí son comandos, con su
 * auditoría y su idempotencia. Mismo límite por token, misma frontera de origen que el resto.
 */
export async function servirElCarrito(
  token: string,
  peticion: PeticionDelPortal,
): Promise<RespuestaDelPortal> {
  if (peticion.method !== 'POST') return errorHttp(405, 'METODO', 'Usa POST.');
  if (!peticionPropia(peticion)) {
    return errorHttp(403, 'SIN_PERMISO', 'Petición de escritura rechazada.');
  }
  if (!cuerpoDentroDelLimite(peticion.headers)) {
    return errorHttp(413, 'CUERPO_DEMASIADO_GRANDE', 'El cuerpo supera 256 KiB.');
  }
  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return errorHttp(400, 'ENTRADA_INVALIDA', 'El cuerpo de la petición no es JSON.');
  }
  const entrada = entradaDelSondeo.safeParse(cuerpo);
  if (!entrada.success) {
    return errorHttp(400, 'ENTRADA_INVALIDA', 'No se pudo reconocer este teléfono.');
  }
  const correlationId = correlationIdDe(peticion.headers.get('x-correlation-id'));
  try {
    const { organizacionId, pimienta } = await resolverDespliegue(
      token,
      peticion.headers.get('host'),
    );
    const contexto = { correlationId, organizacionId };
    const telefono = await resolverElTelefono({
      token,
      ip: origenDe(peticion.headers) ?? 'sin-ip',
      pimienta,
      dispositivo: entrada.data.dispositivo,
      contexto,
    });
    if (!telefono.ok) return demasiadasPeticiones(telefono.esperaSegundos);
    const permiso = await permitirElSondeo(token, telefono.dispositivo, pimienta, contexto);
    if (!permiso.ok) return demasiadasPeticiones(permiso.esperaSegundos);
    const datos = await leerElCarrito({
      token,
      organizacionId,
      pimienta,
      dispositivo: telefono.dispositivo,
      ahora: new Date(),
    });
    // El teléfono guarda el id que se le emitió y lo manda en cada petición (`dispositivoEmitido`).
    const respuestaDelSondeo =
      datos !== null && telefono.emitido
        ? { ...datos, dispositivoEmitido: telefono.dispositivo }
        : datos;
    return respuesta(200, { ok: true, datos: respuestaDelSondeo }, correlationId);
  } catch (error) {
    return respuestaDeError(error, 'publico.qr.carrito', { correlationId });
  }
}
