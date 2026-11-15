/**
 * EL PUENTE CON LA APP: `window.MorphiqApp` (DP-20 · Parte 2).
 *
 * La app de Windows (Electron) y la de Android (Capacitor) exponen la MISMA interfaz, sólo a la
 * página de producción. La fuente de este contrato es `puente/contrato.d.ts` del repositorio
 * `M1gu3hb/morphiq-pos-apps`; aquí va lo que la página usa. Si el puente no existe (navegador o
 * PWA), todo sigue como antes: el diálogo del navegador.
 */
import type { Conexion, Destino } from '../termico/perfil.ts';

export type { Conexion, Destino };

export type Plataforma = 'windows' | 'android';

export interface Impresora {
  readonly id: string;
  readonly nombre: string;
  readonly destino: Destino;
  readonly detalle?: string;
  readonly predeterminada?: boolean;
  readonly esImpresora?: boolean;
  readonly conPermiso?: boolean;
}

export interface ModoLigero {
  readonly activo: boolean;
  readonly origen: 'auto' | 'manual';
  readonly motivo: string;
}

export interface Diagnostico {
  readonly app: { readonly nombre: string; readonly version: string; readonly cliente: string };
  readonly plataforma: Plataforma;
  readonly sistema: {
    readonly nombre: string;
    readonly version: string;
    readonly bits: 32 | 64;
    readonly marca?: string;
    readonly modelo?: string;
  };
  readonly memoria: { readonly totalMb: number; readonly libreMb: number };
  readonly procesador: {
    readonly nombre: string;
    readonly nucleos: number;
    readonly arquitectura: string;
  };
  readonly pantalla: {
    readonly anchoPx: number;
    readonly altoPx: number;
    readonly escala: number;
    readonly tactil: boolean;
  };
  readonly navegador: { readonly nombre: string; readonly version: string };
  readonly impresoras: readonly Impresora[];
  readonly bluetooth?: readonly {
    readonly nombre: string;
    readonly direccion: string;
    readonly esInnerPrinter: boolean;
  }[];
  readonly usb?: readonly {
    readonly nombre: string;
    readonly vendorId: number;
    readonly productId: number;
    readonly clase: number;
    readonly esImpresora: boolean;
  }[];
  readonly serviciosDeMarca?: readonly string[];
  readonly modoLigero: ModoLigero;
  readonly avisos: readonly string[];
}

export interface Ajustes {
  readonly version: 1;
  /** El perfil de impresión de este aparato, como lo guardó el laboratorio. */
  readonly perfil: unknown;
  readonly modoLigero: boolean | null;
  readonly arrancarConElSistema?: boolean;
  readonly pantallaCompleta?: boolean;
  readonly aceleracionGpu?: boolean;
  readonly [otra: string]: unknown;
}

export interface DocumentoCrudo {
  readonly tipo: 'crudo';
  readonly base64: string;
  readonly bloqueBytes?: number;
  readonly pausaMs?: number;
}

export interface DocumentoHtml {
  readonly tipo: 'html';
  readonly html: string;
  readonly anchoMm: number;
}

export interface Trabajo {
  readonly id: string;
  readonly destino?: Destino;
  readonly documento: DocumentoCrudo | DocumentoHtml;
  readonly copias?: number;
  readonly esperaMs?: number;
  readonly recordar?: { readonly titulo: string; readonly documento: DocumentoCrudo };
}

export type CodigoDeError =
  | 'ORIGEN'
  | 'SIN_PERFIL'
  | 'NO_SOPORTADO'
  | 'SIN_PERMISO'
  | 'DESCONECTADA'
  | 'SIN_PAPEL'
  | 'TAPA_ABIERTA'
  | 'TIEMPO'
  | 'CANCELADO'
  | 'DESCONOCIDO';

export interface Resultado {
  readonly ok: boolean;
  readonly id: string;
  readonly estado: 'impreso' | 'enviado' | 'duplicado' | 'error';
  readonly codigo?: CodigoDeError;
  readonly mensaje?: string;
  readonly bytes?: number;
  readonly ms?: number;
}

export interface EstadoDeImpresora {
  readonly soportado: boolean;
  readonly enLinea?: boolean;
  readonly sinPapel?: boolean;
  readonly tapaAbierta?: boolean;
  readonly cajonAbierto?: boolean;
  readonly mensaje?: string;
}

export interface Actualizacion {
  readonly estado: 'al-dia' | 'disponible' | 'descargando' | 'lista' | 'error';
  readonly versionActual: string;
  readonly versionNueva?: string;
  readonly avance?: number;
  readonly mensaje?: string;
}

export interface CapacidadDeConexion {
  readonly conexion: Conexion;
  readonly disponible: boolean;
  readonly motivo?: string;
}

export type Evento = 'progreso' | 'actualizacion' | 'modo-ligero';

export interface MorphiqApp {
  readonly contrato: 1;
  version(): Promise<string>;
  plataforma(): Promise<Plataforma>;
  diagnostico(): Promise<Diagnostico>;
  impresoras(): Promise<readonly Impresora[]>;
  conexiones(): Promise<readonly CapacidadDeConexion[]>;
  pedirPermiso(
    destino: Destino,
  ): Promise<{ readonly concedido: boolean; readonly mensaje?: string }>;
  ajustes(): Promise<Ajustes>;
  guardarAjustes(parche: Partial<Ajustes>): Promise<Ajustes>;
  imprimir(trabajo: Trabajo): Promise<Resultado>;
  abrirCajon(opciones?: {
    readonly destino?: Destino;
    readonly base64?: string;
  }): Promise<Resultado>;
  paginaDePrueba(opciones?: { readonly destino?: Destino }): Promise<Resultado>;
  estado(opciones?: { readonly destino?: Destino }): Promise<EstadoDeImpresora>;
  reimprimirUltimo(): Promise<Resultado>;
  ultimoTicket(): Promise<{ readonly titulo: string; readonly guardadoEn: string } | null>;
  buscarActualizacion(): Promise<Actualizacion>;
  instalarActualizacion(): Promise<Actualizacion>;
  modoLigero(): Promise<ModoLigero>;
  abrirPos(): Promise<void>;
  abrirDiagnostico(): Promise<void>;
  escuchar(evento: Evento, alLlegar: (datos: unknown) => void): () => void;
}

declare global {
  interface Window {
    MorphiqApp?: MorphiqApp;
  }
}

/** La versión del contrato que esta página sabe hablar. */
export const CONTRATO = 1;

/** El puente, o `null` si esto es un navegador o una PWA (o una app con otro contrato). */
export function puenteDeLaApp(ventana: { MorphiqApp?: unknown } | undefined): MorphiqApp | null {
  const app = ventana?.MorphiqApp;
  if (typeof app !== 'object' || app === null) return null;
  return (app as { contrato?: unknown }).contrato === CONTRATO ? (app as MorphiqApp) : null;
}
