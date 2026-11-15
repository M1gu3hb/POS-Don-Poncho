/**
 * EL CAJÓN DE DINERO (DP-20 · Parte 3.4). Sólo navegador.
 *
 * Se abre solo al cobrar en efectivo (si el perfil del aparato lo tiene activado) o con el botón
 * «Abrir cajón» de la Caja. SIEMPRE en este orden: primero el servidor —que comprueba el puesto y
 * deja en la auditoría quién, cuándo y por qué— y sólo si contesta bien, el pulso a la impresora
 * que tiene conectado el cajón. Un cajón que no abre nunca deshace el cobro.
 *
 *   · al cobrar → `caja.cajon_por_cobro` (el rastro del cobro);
 *   · a mano    → `caja.abrir_cajon` (F-984): exige la caja abierta de esta terminal, pide el
 *                 motivo y lo anota en el turno, donde se lee el arqueo.
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
  | { readonly por: 'cobro'; readonly referencia?: string }
  | { readonly por: 'manual'; readonly motivo: MotivoSinVenta };

export type ResultadoDelCajon =
  | { readonly abierto: true }
  /** Este aparato no tiene cajón (o no hay app, o no se abre solo al cobrar): no se hizo nada. */
  | { readonly abierto: false; readonly sinCajon: true }
  | { readonly abierto: false; readonly sinCajon: false; readonly mensaje: string };

/** ¿Este aparato abre el cajón por ese motivo? */
export function abreElCajon(perfil: PerfilDeImpresion | null, por: Apertura['por']): boolean {
  if (!perfil?.cajon) return false;
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
    await invocarComando(
      '/api/caja/cajon-por-cobro',
      referencia === undefined || referencia === '' ? {} : { referencia },
    );
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
  });
}

export async function abrirCajonCon(
  app: MorphiqApp | null,
  apertura: Apertura,
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
  if (resultado.ok) return { abierto: true };
  const fallo = falloDelPuente(resultado.codigo, resultado.mensaje);
  return { abierto: false, sinCajon: false, mensaje: `${fallo.titulo}. ${fallo.queHacer}` };
}

/** Lo mismo, con el puente de esta página. */
export function abrirCajon(apertura: Apertura): Promise<ResultadoDelCajon> {
  return abrirCajonCon(puenteDeLaApp(window), apertura);
}
