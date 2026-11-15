/**
 * DEL FORMULARIO DEL LABORATORIO AL PERFIL, Y DE VUELTA (DP-20 · laboratorio). Puro.
 *
 * Los campos numéricos son TEXTO mientras se teclean; aquí se vuelven un perfil válido o una lista
 * de errores con su mensaje en español, campo por campo. Lo que el esquema del perfil
 * (`esquemaDelPerfil`) rechazaría no pasa nunca: es la última puerta.
 */
import type { Corte } from '../termico/escpos.ts';
import {
  cajonPorOmision,
  esquemaDelPerfil,
  perfilPorOmision,
  type Conexion,
  type Destino,
  type Lenguaje,
  type PaginaDeCodigos,
  type PerfilDeImpresion,
} from '../termico/perfil.ts';
import { problemaDeLaDireccion } from '../termico/direccion-local.ts';
import {
  BAUDIOS_POR_OMISION,
  entero,
  LARGO_MAXIMO_DEL_NOMBRE,
  PUERTO_DE_RED_POR_OMISION,
  RANGOS,
  type Rango,
} from './rangos.ts';

export interface FormularioDelPerfil {
  readonly nombre: string;
  readonly conexion: Conexion;
  /** La impresora elegida de la lista (spooler, driver, USB o Bluetooth). */
  readonly elegida: Destino | null;
  readonly host: string;
  readonly puerto: string;
  readonly puertoSerie: string;
  readonly baudios: string;
  readonly lenguaje: Lenguaje;
  readonly papelMm: 58 | 80;
  readonly puntos: string;
  readonly dpi: 203 | 180;
  readonly umbral: string;
  readonly franjaFilas: string;
  readonly bloqueBytes: string;
  readonly pausaMs: string;
  readonly lineasAntesDelCorte: string;
  readonly corte: Corte;
  readonly paginaDeCodigos: PaginaDeCodigos;
  readonly hayCajon: boolean;
  readonly cajonPin: 2 | 5;
  readonly cajonModo: 'esc-p' | 'tiempo-real';
  readonly cajonEncendidoMs: string;
  readonly cajonApagadoMs: string;
  readonly cajonAlCobrar: boolean;
  readonly imprimeTicket: boolean;
  readonly imprimePrecuenta: boolean;
  readonly imprimeCorte: boolean;
  readonly imprimeCierre: boolean;
  readonly estacion: string;
}

export type CampoDelFormulario = keyof FormularioDelPerfil | 'general';
export type Errores = Readonly<Partial<Record<CampoDelFormulario, string>>>;

export type PerfilDelFormulario =
  | { readonly ok: true; readonly perfil: PerfilDeImpresion }
  | { readonly ok: false; readonly errores: Errores };

export function formularioDesdePerfil(perfil: PerfilDeImpresion): FormularioDelPerfil {
  const destino = perfil.destino;
  const cajon = perfil.cajon ?? cajonPorOmision();
  return {
    nombre: perfil.nombre,
    conexion: destino.conexion,
    elegida: destino.conexion === 'red' || destino.conexion === 'serial' ? null : destino,
    host: destino.host ?? '',
    puerto: String(destino.puerto ?? PUERTO_DE_RED_POR_OMISION),
    puertoSerie: destino.puertoSerie ?? '',
    baudios: String(destino.baudios ?? BAUDIOS_POR_OMISION),
    lenguaje: perfil.lenguaje,
    papelMm: perfil.papelMm,
    puntos: String(perfil.puntos),
    dpi: perfil.dpi,
    umbral: String(perfil.umbral),
    franjaFilas: String(perfil.franjaFilas),
    bloqueBytes: String(perfil.bloqueBytes),
    pausaMs: String(perfil.pausaMs),
    lineasAntesDelCorte: String(perfil.lineasAntesDelCorte),
    corte: perfil.corte,
    paginaDeCodigos: perfil.paginaDeCodigos,
    hayCajon: perfil.cajon !== null,
    cajonPin: cajon.pin,
    cajonModo: cajon.modo,
    cajonEncendidoMs: String(cajon.encendidoMs),
    cajonApagadoMs: String(cajon.apagadoMs),
    cajonAlCobrar: cajon.alCobrarEnEfectivo,
    imprimeTicket: perfil.imprime.ticket,
    imprimePrecuenta: perfil.imprime.precuenta,
    imprimeCorte: perfil.imprime.corte,
    imprimeCierre: perfil.imprime.cierre,
    estacion: perfil.imprime.estacion ?? '',
  };
}

/** Con lo que arranca el laboratorio en un aparato sin perfil: lo común en un rollo de 80 mm. */
export function formularioInicial(): FormularioDelPerfil {
  return {
    ...formularioDesdePerfil(perfilPorOmision(80, { conexion: 'spooler' })),
    elegida: null,
  };
}

type Anotar = (campo: CampoDelFormulario, mensaje: string) => void;

function numero(
  texto: string,
  etiqueta: string,
  rango: Rango,
  campo: keyof FormularioDelPerfil,
  anotar: Anotar,
): number {
  const leido = entero(texto, etiqueta, rango);
  if (leido.ok) return leido.valor;
  anotar(campo, leido.mensaje);
  return rango[0];
}

function destinoDelFormulario(
  f: FormularioDelPerfil,
  sinDestino: boolean,
  anotar: Anotar,
): Destino {
  if (sinDestino) return { conexion: f.conexion };
  if (f.conexion === 'red') {
    const host = f.host.trim();
    // DP-D125: sólo a la red local, y dicho aquí en lugar de al imprimir (las apps lo exigen).
    const problema = problemaDeLaDireccion(host);
    if (problema !== null) anotar('host', problema);
    const puerto =
      f.puerto.trim() === ''
        ? PUERTO_DE_RED_POR_OMISION
        : numero(f.puerto, 'Puerto', RANGOS.puerto, 'puerto', anotar);
    return { conexion: 'red', host: host === '' ? '-' : host, puerto };
  }
  if (f.conexion === 'serial') {
    const puertoSerie = f.puertoSerie.trim().toUpperCase();
    if (!/^COM\d{1,3}$/.test(puertoSerie)) {
      anotar('puertoSerie', 'El puerto serie se escribe así: COM3.');
    }
    const baudios =
      f.baudios.trim() === ''
        ? BAUDIOS_POR_OMISION
        : numero(f.baudios, 'Baudios', RANGOS.baudios, 'baudios', anotar);
    return { conexion: 'serial', puertoSerie, baudios };
  }
  if (f.elegida?.conexion === f.conexion) return f.elegida;
  anotar('elegida', 'Elige una impresora de la lista.');
  return { conexion: f.conexion };
}

export interface OpcionesDelPerfil {
  /** Para la vista previa: no se exige impresora, sólo las medidas. */
  readonly sinDestino?: boolean;
}

export function perfilDesdeFormulario(
  f: FormularioDelPerfil,
  opciones: OpcionesDelPerfil = {},
): PerfilDelFormulario {
  const errores: Partial<Record<CampoDelFormulario, string>> = {};
  const anotar: Anotar = (campo, mensaje) => {
    errores[campo] ??= mensaje;
  };

  const nombre = f.nombre.trim();
  if (nombre === '' || nombre.length > LARGO_MAXIMO_DEL_NOMBRE) {
    anotar('nombre', `Ponle un nombre de 1 a ${String(LARGO_MAXIMO_DEL_NOMBRE)} caracteres.`);
  }
  if (f.lenguaje === 'escpos-texto') {
    anotar('lenguaje', 'El texto ESC/POS por página de códigos todavía no está disponible.');
  }
  const destino = destinoDelFormulario(f, opciones.sinDestino === true, anotar);

  const puntos = numero(f.puntos, 'Puntos', RANGOS.puntos, 'puntos', anotar);
  const umbral = numero(f.umbral, 'Umbral', RANGOS.umbral, 'umbral', anotar);
  const franjaFilas = numero(
    f.franjaFilas,
    'Filas por franja',
    RANGOS.franjaFilas,
    'franjaFilas',
    anotar,
  );
  const bloqueBytes = numero(f.bloqueBytes, 'Bloque', RANGOS.bloqueBytes, 'bloqueBytes', anotar);
  const pausaMs = numero(f.pausaMs, 'Pausa', RANGOS.pausaMs, 'pausaMs', anotar);
  const lineasAntesDelCorte = numero(
    f.lineasAntesDelCorte,
    'Líneas antes del corte',
    RANGOS.lineasAntesDelCorte,
    'lineasAntesDelCorte',
    anotar,
  );

  const cajon = f.hayCajon
    ? {
        pin: f.cajonPin,
        modo: f.cajonModo,
        encendidoMs: numero(
          f.cajonEncendidoMs,
          'Pulso encendido',
          RANGOS.pulsoMs,
          'cajonEncendidoMs',
          anotar,
        ),
        apagadoMs: numero(
          f.cajonApagadoMs,
          'Pulso apagado',
          RANGOS.pulsoMs,
          'cajonApagadoMs',
          anotar,
        ),
        alCobrarEnEfectivo: f.cajonAlCobrar,
      }
    : null;

  const estacion = f.estacion.trim();
  if (estacion.length > LARGO_MAXIMO_DEL_NOMBRE) {
    anotar(
      'estacion',
      `La estación no puede pasar de ${String(LARGO_MAXIMO_DEL_NOMBRE)} caracteres.`,
    );
  }

  const validado = esquemaDelPerfil.safeParse({
    version: 1,
    nombre,
    destino,
    lenguaje: f.lenguaje,
    papelMm: f.papelMm,
    puntos,
    dpi: f.dpi,
    umbral,
    franjaFilas,
    bloqueBytes,
    pausaMs,
    lineasAntesDelCorte,
    corte: f.corte,
    paginaDeCodigos: f.paginaDeCodigos,
    cajon,
    imprime: {
      ticket: f.imprimeTicket,
      precuenta: f.imprimePrecuenta,
      corte: f.imprimeCorte,
      cierre: f.imprimeCierre,
      estacion: estacion === '' ? null : estacion,
    },
  });

  if (Object.keys(errores).length === 0 && validado.success) {
    return { ok: true, perfil: validado.data };
  }
  if (Object.keys(errores).length === 0 && !validado.success) {
    const donde = validado.error.issues[0]?.path.join('.') ?? '';
    anotar('general', `Hay un dato que el perfil no acepta${donde === '' ? '' : ` (${donde})`}.`);
  }
  return { ok: false, errores };
}
