import { resolverMotor, type MotorId, type MotorResuelto } from './motores.ts';

/**
 * LOS APARATOS DEL RESTAURANTE (DP-22). Cada perfil es un aparato que existe o puede existir en
 * Don Poncho, con TACTO DE VERDAD (`hasTouch`, `(any-pointer: coarse)` y sin ratón), su tamaño en
 * píxeles de CSS (físico ÷ escala de Windows), su densidad y su motor.
 *
 * Qué NO es un perfil: no es el aparato. No trae la app de Electron ni la de Android (no hay puente
 * de impresión, ni cajón, ni modo espera nativo), ni el teclado de Windows ni el de Android, ni su
 * GPU. Lo que sí trae: el motor de render (la misma versión mayor), el tamaño, la densidad, los
 * eventos de tacto y las media queries de puntero. Ver `LEEME.md`.
 */

/** Cómo se emula el teclado en pantalla de este aparato (ver `teclado.ts`). */
export type ModoDeTeclado = 'encoge' | 'tapa';

export type FamiliaDeAparato = 'windows' | 'imin' | 'tableta' | 'telefono';

export interface Aparato {
  readonly id: string;
  readonly nombre: string;
  readonly familia: FamiliaDeAparato;
  /** La pantalla física, en píxeles. */
  readonly fisico: { readonly ancho: number; readonly alto: number };
  /** La escala de Windows o la densidad del aparato (`devicePixelRatio`). */
  readonly escala: number;
  /** El viewport en píxeles de CSS: físico ÷ escala, redondeado como lo hace Windows. */
  readonly viewport: { readonly width: number; readonly height: number };
  readonly motor: MotorId;
  /** `<html data-ligero>`: el modo ligero que la app de Android le pone a los aparatos justos. */
  readonly ligero: boolean;
  /** Teléfonos y tableta: `isMobile` (meta viewport, desplazamiento por pellizco). */
  readonly esMovil: boolean;
  readonly teclado: ModoDeTeclado;
}

function windows(ancho: number, alto: number, escala: number): Aparato {
  const porCiento = Math.round(escala * 100);
  return {
    id: `win-${String(ancho)}x${String(alto)}-${String(porCiento)}`,
    nombre: `Windows 10 táctil ${String(ancho)}×${String(alto)} al ${String(porCiento)} %`,
    familia: 'windows',
    fisico: { ancho, alto },
    escala,
    viewport: { width: Math.round(ancho / escala), height: Math.round(alto / escala) },
    motor: 'electron-156',
    ligero: false,
    esMovil: false,
    teclado: 'tapa',
  };
}

function imin(motor: 'chromium-99' | 'chromium-103', escala: 1 | 1.5): Aparato {
  const ancho = Math.round(1920 / escala);
  const alto = Math.round(1080 / escala);
  const version = motor === 'chromium-99' ? '99' : '103';
  return {
    id: `imin-${String(ancho)}x${String(alto)}-c${version}`,
    nombre: `iMin D4-503 (${String(ancho)}×${String(alto)} a escala ${String(escala)}) con Chromium ${version}`,
    familia: 'imin',
    fisico: { ancho: 1920, alto: 1080 },
    escala,
    viewport: { width: ancho, height: alto },
    motor,
    ligero: true,
    esMovil: false,
    teclado: 'encoge',
  };
}

function telefono(ancho: number, alto: number, escala: number): Aparato {
  return {
    id: `telefono-${String(ancho)}x${String(alto)}`,
    nombre: `Teléfono ${String(ancho)}×${String(alto)}`,
    familia: 'telefono',
    fisico: { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) },
    escala,
    viewport: { width: ancho, height: alto },
    motor: 'playwright',
    ligero: false,
    esMovil: true,
    teclado: 'encoge',
  };
}

export const APARATOS: readonly Aparato[] = [
  windows(1920, 1080, 1),
  windows(1920, 1080, 1.25),
  windows(1920, 1080, 1.5),
  windows(1366, 768, 1),
  windows(1366, 768, 1.25),
  windows(1280, 800, 1),
  windows(1024, 768, 1),
  imin('chromium-99', 1),
  imin('chromium-103', 1),
  imin('chromium-99', 1.5),
  imin('chromium-103', 1.5),
  {
    id: 'tableta-800x1280',
    nombre: 'Tableta vertical 800×1280',
    familia: 'tableta',
    fisico: { ancho: 1600, alto: 2560 },
    escala: 2,
    viewport: { width: 800, height: 1280 },
    motor: 'playwright',
    ligero: false,
    esMovil: true,
    teclado: 'encoge',
  },
  telefono(390, 844, 3),
  telefono(360, 800, 2.625),
];

export function aparatoPorId(id: string): Aparato {
  const encontrado = APARATOS.find((a) => a.id === id);
  if (encontrado === undefined) {
    throw new Error(
      `No hay un aparato «${id}». Los que hay: ${APARATOS.map((a) => a.id).join(', ')}.`,
    );
  }
  return encontrado;
}

/** El User-Agent que declara el aparato, con la versión REAL del binario cuando se conoce. */
export function agenteDeUsuario(aparato: Aparato, motor: MotorResuelto): string {
  const version = motor.version ?? '153.0.0.0';
  if (aparato.familia === 'imin') {
    // El WebView de Android 7.1.2 de una tableta de mostrador: «wv» y sin «Mobile».
    return `Mozilla/5.0 (Linux; Android 7.1.2; D4-503 Build/N2G47H; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${version} Safari/537.36`;
  }
  if (aparato.familia === 'windows') {
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Electron/45.3.2 Safari/537.36`;
  }
  const movil = aparato.familia === 'telefono' ? ' Mobile' : '';
  return `Mozilla/5.0 (Linux; Android 14; ${aparato.id}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}${movil} Safari/537.36`;
}

/** Las opciones de un contexto de navegador para este aparato (lo mismo que lleva `use` del proyecto). */
export function opcionesDeContexto(aparato: Aparato, motor: MotorResuelto) {
  return {
    viewport: aparato.viewport,
    deviceScaleFactor: aparato.escala,
    hasTouch: true,
    isMobile: aparato.esMovil,
    userAgent: agenteDeUsuario(aparato, motor),
  } as const;
}

export function motorDe(aparato: Aparato): MotorResuelto {
  return resolverMotor(aparato.motor);
}
