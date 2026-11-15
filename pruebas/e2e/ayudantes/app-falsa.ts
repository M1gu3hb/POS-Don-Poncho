/**
 * UNA APP FALSA PARA EL NAVEGADOR DE LAS PRUEBAS (DP-20).
 *
 * En los POS, la app (Electron o Capacitor) pone `window.MorphiqApp` en la página. Aquí lo pone la
 * prueba: el mismo contrato, con una «impresora» que no imprime —guarda cada trabajo en
 * `window.__appFalsa.trabajos` para que la prueba lea los bytes— y unos ajustes que viven en el
 * `localStorage` de la página (como el aparato, que recuerda su perfil).
 *
 * Se instala con `contexto.addInitScript(instalarAppFalsa)`: corre antes que la página, y por eso
 * no puede usar nada de fuera de la función.
 */

export interface TrabajoRecibido {
  readonly id: string;
  readonly documento: { readonly tipo: string; readonly base64?: string };
}

export interface EstadoDeLaAppFalsa {
  readonly trabajos: TrabajoRecibido[];
  cajon: number;
  paginasDePrueba: number;
}

export function instalarAppFalsa(): void {
  const CLAVE = 'app-falsa:ajustes';
  const POR_OMISION = { version: 1, perfil: null, modoLigero: null };
  const leer = (): Record<string, unknown> => {
    try {
      const guardado: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
      return typeof guardado === 'object' && guardado !== null
        ? (guardado as Record<string, unknown>)
        : { ...POR_OMISION };
    } catch {
      // Unos ajustes ilegibles son un aparato recién instalado.
      return { ...POR_OMISION };
    }
  };
  const estado: { trabajos: unknown[]; cajon: number; paginasDePrueba: number } = {
    trabajos: [],
    cajon: 0,
    paginasDePrueba: 0,
  };
  const enviado = (id: string): Record<string, unknown> => ({
    ok: true,
    id,
    estado: 'enviado',
    bytes: 0,
    ms: 1,
  });
  const red = { conexion: 'red', host: '192.0.2.10', puerto: 9100 };
  const impresoras = [
    {
      id: 'spooler:POS-80',
      nombre: 'POS-80',
      destino: { conexion: 'spooler', nombre: 'POS-80' },
      detalle: 'USB001 · POS-80 Printer',
      predeterminada: true,
    },
    { id: 'red:192.0.2.10:9100', nombre: 'Cocina (red)', destino: red },
  ];
  const app = {
    contrato: 1,
    version: () => Promise.resolve('0.1.0'),
    plataforma: () => Promise.resolve('windows'),
    diagnostico: () =>
      Promise.resolve({
        app: { nombre: 'POS Don Poncho', version: '0.1.0', cliente: 'don-poncho' },
        plataforma: 'windows',
        sistema: { nombre: 'Windows 10 Pro', version: '10.0.19045', bits: 64, marca: 'Prueba' },
        memoria: { totalMb: 4096, libreMb: 1800 },
        procesador: { nombre: 'Intel Celeron J1900', nucleos: 4, arquitectura: 'x64' },
        pantalla: { anchoPx: 1366, altoPx: 768, escala: 1, tactil: true },
        navegador: { nombre: 'Chromium', version: '156.0' },
        impresoras,
        modoLigero: { activo: false, origen: 'auto', motivo: 'El aparato tiene de sobra' },
        avisos: [],
      }),
    impresoras: () => Promise.resolve(impresoras),
    conexiones: () =>
      Promise.resolve([
        { conexion: 'spooler', disponible: true },
        { conexion: 'driver', disponible: true },
        { conexion: 'red', disponible: true },
        { conexion: 'serial', disponible: true },
        { conexion: 'usb', disponible: false, motivo: 'El USB directo es de Android.' },
        { conexion: 'bluetooth', disponible: false, motivo: 'El Bluetooth es de Android.' },
      ]),
    pedirPermiso: () => Promise.resolve({ concedido: true }),
    ajustes: () => Promise.resolve(leer()),
    guardarAjustes: (parche: Record<string, unknown>) => {
      const nuevos = { ...leer(), ...parche };
      localStorage.setItem(CLAVE, JSON.stringify(nuevos));
      return Promise.resolve(nuevos);
    },
    imprimir: (trabajo: { id: string }) => {
      estado.trabajos.push(trabajo);
      return Promise.resolve(enviado(trabajo.id));
    },
    abrirCajon: () => {
      estado.cajon += 1;
      return Promise.resolve(enviado('cajon'));
    },
    paginaDePrueba: () => {
      estado.paginasDePrueba += 1;
      return Promise.resolve(enviado('prueba'));
    },
    estado: () =>
      Promise.resolve({ soportado: true, enLinea: true, sinPapel: false, tapaAbierta: false }),
    reimprimirUltimo: () => Promise.resolve(enviado('ultimo')),
    ultimoTicket: () => Promise.resolve(null),
    buscarActualizacion: () => Promise.resolve({ estado: 'al-dia', versionActual: '0.1.0' }),
    instalarActualizacion: () => Promise.resolve({ estado: 'al-dia', versionActual: '0.1.0' }),
    modoLigero: () =>
      Promise.resolve({ activo: false, origen: 'auto', motivo: 'El aparato tiene de sobra' }),
    abrirPos: () => Promise.resolve(),
    abrirDiagnostico: () => Promise.resolve(),
    escuchar: () => () => undefined,
  };
  const ventana = window as unknown as { MorphiqApp: unknown; __appFalsa: unknown };
  ventana.MorphiqApp = app;
  ventana.__appFalsa = estado;
}
