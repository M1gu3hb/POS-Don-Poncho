/**
 * EL CAJÓN DE DINERO (DP-20 · Parte 3.4; DP-21 · Bloque 7). Sólo navegador… dentro de la app.
 *
 * Sólo hay cajón si el perfil del aparato dice que lo tiene (`tieneCajon`, el interruptor que
 * enciende el laboratorio) y se está dentro de la app. Se abre solo al cobrar en efectivo (si el
 * perfil lo tiene activado) o con el botón «Abrir cajón» de la Caja. SIEMPRE en este orden:
 * primero el servidor —que comprueba el cobro o el PIN y deja en la auditoría quién, cuándo y por
 * qué— y sólo si contesta bien, el pulso a la impresora que tiene conectado el cajón. Un cajón que
 * no abre nunca deshace el cobro.
 *
 *   · al cobrar → `caja.cajon_por_cobro` (exige un cobro en efectivo de esta terminal; sin PIN);
 *   · a mano    → `caja.abrir_cajon` (F-984): exige la caja abierta de esta terminal, el motivo
 *                 —que se anota en el turno, donde se lee el arqueo— y la autorización de un
 *                 gerente, administrador o dueño (su PIN), siempre.
 *
 * EL MENSAJE DICE LA VERDAD: «Cajón abierto» sólo si la impresora lo confirma por su estado
 * (DLE EOT, `cajonAbierto`); si no, «Se mandó la señal al cajón».
 */
import { invocarComando } from '~/cliente/api';

import { puenteDeLaApp, type MorphiqApp } from './puente/contrato.ts';
import { leerPerfil, type PerfilDeImpresion } from './termico/perfil.ts';
import { falloDelPuente } from './trabajos.ts';

/** Por qué se abre sin venta: los motivos del comando del servidor. */
export const MOTIVOS_SIN_VENTA = [
  { valor: 'dar_cambio', nombre: 'Dar cambio' },
  { valor: 'guardar_billete', nombre: 'Guardar un billete' },
  { valor: 'conteo', nombre: 'Conteo' },
  { valor: 'otro', nombre: 'Otro motivo' },
] as const;
export type MotivoSinVenta = (typeof MOTIVOS_SIN_VENTA)[number]['valor'];

export type Apertura =
  /** La orden que se acaba de cobrar: el servidor comprueba que hubo un pago en efectivo. */
  | { readonly por: 'cobro'; readonly ordenId: string; readonly referencia?: string }
  /** La autorización firmada del supervisor (`/api/identidad/supervisor`, `para: 'cajon'`). */
  | {
      readonly por: 'manual';
      readonly motivo: MotivoSinVenta;
      readonly autorizacion: string;
    };

export type ResultadoDelCajon =
  /** `confirmado`: la impresora dijo —por su estado— que el cajón está abierto. */
  | { readonly abierto: true; readonly confirmado: boolean }
  /** Este aparato no tiene cajón (o no hay app, o no se abre solo al cobrar): no se hizo nada. */
  | { readonly abierto: false; readonly sinCajon: true }
  | { readonly abierto: false; readonly sinCajon: false; readonly mensaje: string };

export const TEXTO_SENAL_AL_CAJON = 'Se mandó la señal al cajón';
export const TEXTO_CAJON_ABIERTO = 'Cajón abierto';

/** Lo que se le dice a la persona tras una apertura buena: sin afirmar de más. */
export function textoDeLaApertura(
  resultado: Extract<ResultadoDelCajon, { readonly abierto: true }>,
): string {
  return resultado.confirmado ? TEXTO_CAJON_ABIERTO : TEXTO_SENAL_AL_CAJON;
}

/** ¿Este aparato abre el cajón por ese motivo? Sin el interruptor del perfil, nunca. */
export function abreElCajon(perfil: PerfilDeImpresion | null, por: Apertura['por']): boolean {
  if (perfil?.tieneCajon !== true || perfil.cajon === null) return false;
  return por === 'manual' || perfil.cajon.alCobrarEnEfectivo;
}

/** Los puestos que ven el botón «Abrir cajón» (el servidor es quien lo exige). */
export const PUESTOS_QUE_ABREN_EL_CAJON: readonly string[] = [
  'cajero',
  'gerente',
  'administrador',
  'dueno',
];

/** El rastro en el servidor. Lanza con el motivo si el servidor dice que no. */
async function registrar(apertura: Apertura): Promise<void> {
  if (apertura.por === 'cobro') {
    const referencia = apertura.referencia?.trim().slice(0, 40);
    await invocarComando('/api/caja/cajon-por-cobro', {
      ordenId: apertura.ordenId,
      ...(referencia === undefined || referencia === '' ? {} : { referencia }),
    });
    return;
  }
  const estado = await invocarComando<{ abierta: boolean; sesionCajaId: string | null }>(
    '/api/caja/estado',
    {},
  );
  if (!estado.abierta || estado.sesionCajaId === null) {
    throw new Error('Abre la caja en este aparato antes de abrir el cajón.');
  }
  await invocarComando('/api/caja/cajon', {
    sesionCajaId: estado.sesionCajaId,
    motivo: apertura.motivo,
    autorizacion: apertura.autorizacion,
  });
}

/** Lo que tarda un cajón en saltar tras el pulso: antes de eso su sensor aún dice «cerrado». */
const ESPERA_ANTES_DE_PREGUNTAR_MS = 500;
type Esperar = (ms: number) => Promise<void>;
const esperarDeVerdad: Esperar = (ms) =>
  new Promise((resolver) => {
    setTimeout(resolver, ms);
  });

/**
 * ¿La impresora confirma que el cajón se abrió? Pregunta su estado (DLE EOT) y sólo cree un
 * `cajonAbierto: true`. Muchos cajones no tienen el cable del sensor y muchas conexiones no
 * devuelven estado: ahí la respuesta es «no sé», que es `false`, nunca un «sí» inventado.
 */
async function confirmadoPorLaImpresora(app: MorphiqApp, esperar: Esperar): Promise<boolean> {
  try {
    await esperar(ESPERA_ANTES_DE_PREGUNTAR_MS);
    const estado = await app.estado();
    return estado.soportado && estado.cajonAbierto === true;
  } catch {
    // Preguntar el estado es un extra: si falla, la apertura ya salió y se dice sin confirmación.
    return false;
  }
}

export async function abrirCajonCon(
  app: MorphiqApp | null,
  apertura: Apertura,
  esperar: Esperar = esperarDeVerdad,
): Promise<ResultadoDelCajon> {
  if (app === null) return { abierto: false, sinCajon: true };
  const perfil = leerPerfil((await app.ajustes()).perfil);
  if (!abreElCajon(perfil, apertura.por)) return { abierto: false, sinCajon: true };
  try {
    await registrar(apertura);
  } catch (error: unknown) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo registrar la apertura.';
    return { abierto: false, sinCajon: false, mensaje };
  }
  const resultado = await app.abrirCajon();
  if (!resultado.ok) {
    const fallo = falloDelPuente(resultado.codigo, resultado.mensaje);
    return { abierto: false, sinCajon: false, mensaje: `${fallo.titulo}. ${fallo.queHacer}` };
  }
  // Al cobrar nadie espera el mensaje: no se gasta una consulta ni un medio segundo.
  const confirmado = apertura.por === 'manual' && (await confirmadoPorLaImpresora(app, esperar));
  return { abierto: true, confirmado };
}

/** Lo mismo, con el puente de esta página. */
export function abrirCajon(apertura: Apertura): Promise<ResultadoDelCajon> {
  return abrirCajonCon(puenteDeLaApp(window), apertura);
}
