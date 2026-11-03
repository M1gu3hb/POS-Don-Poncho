/**
 * EL CARRITO COMPARTIDO DE LA MESA, del lado del teléfono (DP-9.5): el id del teléfono, la
 * forma de lo que responde el servidor y lo que se le enseña al comensal. Puro salvo el id,
 * que se guarda en el navegador.
 *
 * DP-13.3 · El id del teléfono ya no lo inventa el navegador: lo EMITE el servidor, firmado, la
 * primera vez que el teléfono sondea sin uno válido (`dispositivoEmitido`), y aquí sólo se guarda.
 */

import { ErrorApi } from '~/cliente/api';

export interface LineaDelCarrito {
  readonly id: string;
  readonly productoId: string;
  readonly nombre: string;
  readonly cantidad: string;
  readonly notas: string;
  /** `null`: el negocio no enseña precios en el portal (DP-12.2). */
  readonly precioCentavos: string | null;
  readonly esMia: boolean;
  /** DP-12.2 · De qué teléfono es, numerados por orden de llegada. */
  readonly telefono?: number;
  /** `false`: el negocio ya no lo ofrece; al enviar se quita. Sin el campo, cuenta como sí. */
  readonly disponible?: boolean;
}

export interface EstadoDelCarrito {
  readonly lineas: readonly LineaDelCarrito[];
  readonly conectados: number;
  readonly personas: number;
  readonly esperarATodos: boolean;
  readonly ronda: number;
  readonly ultimoEnvio: { readonly en: string; readonly porEsteTelefono: boolean } | null;
  /** DP-12.2 · La mesa tiene cuenta. Sin ella el carrito se arma igual. */
  readonly cuentaAbierta?: boolean;
  /** DP-12.2 · Qué puede hacer el comensal con lo armado. Falta en un servidor anterior. */
  readonly envio?: ComoSeEnvia;
  /** DP-12.2 · Ya hay un «Pedido listo para confirmar» esperando al mesero. */
  readonly meseroAvisado?: boolean;
  /** DP-13.3 · La cuenta ya se pidió: es un estado, no un error. Falta en un servidor anterior. */
  readonly cuentaPedida?: boolean;
  /** DP-13.3 · El mesero vació el pedido mientras este teléfono estaba conectado. Una vez. */
  readonly vaciadoPorElMesero?: { readonly en: string } | null;
  /** DP-13.3 · El id que el servidor le emitió a este teléfono: se guarda y se manda de ahí en adelante. */
  readonly dispositivoEmitido?: string;
}

/** DP-12.2 · Quién manda a cocina, visto desde el teléfono (`portal/quien-envia.ts`). */
export type ComoSeEnvia =
  'llamar_mesero' | 'enviar' | 'abrir_y_enviar' | 'pedir_que_atiendan' | 'cuenta_pedida';

/** DP-13.3 · Lo que se le dice al comensal cuando su cuenta ya se pidió. */
export const CUENTA_PEDIDA = 'Tu cuenta ya se pidió: tu mesero lo revisa.';
/** DP-13.3 · Lo que se le dice cuando el mesero vació el pedido de su mesa. */
export const AVISO_DEL_VACIADO = 'Tu mesero vació el pedido';

/**
 * ¿Hay un vaciado nuevo que decir? `visto` es el último que ya se dijo en esta pantalla. El servidor
 * lo entrega una vez por teléfono; esto cuida además que dos respuestas seguidas no lo repitan.
 */
export function vaciadoNuevo(visto: string | null, estado: EstadoDelCarrito): string | null {
  const en = estado.vaciadoPorElMesero?.en ?? null;
  return en !== null && en !== visto ? en : null;
}

/** La regla de negocio con la que el servidor rechazó una llamada, si fue una (`datos.regla`). */
export function reglaDelError(error: unknown): string | null {
  const regla = error instanceof ErrorApi ? error.error.datos?.['regla'] : undefined;
  return typeof regla === 'string' ? regla : null;
}

/** Los datos con los que se abre la mesa al enviar (`entradaAbrirMesa` del servidor). */
export interface AperturaDeLaMesa {
  readonly personas: number;
  readonly clienteNombre: string;
  readonly notas: string;
  readonly notasAlergias: string;
  readonly celebracionEspecial: boolean;
  readonly tipoCelebracion: string;
}

/** Lo que captura el diálogo de abrir la mesa, con los nombres de la pantalla heredada. */
export interface DatosDelDialogoDeApertura {
  readonly personas?: unknown;
  readonly cliente_nombre?: unknown;
  readonly notas?: unknown;
  readonly notas_alergias?: unknown;
  readonly celebracion_especial?: unknown;
  readonly tipo_celebracion?: unknown;
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

/** El entero que escribió el comensal (llega como texto del campo o ya como número); `NaN` si no hay. */
function enteroDe(valor: unknown): number {
  if (typeof valor === 'number') return Math.trunc(valor);
  return typeof valor === 'string' ? Number.parseInt(valor, 10) : Number.NaN;
}

/** Los datos del diálogo de abrir la mesa, en la forma que el envío acepta. Mínimo una persona. */
export function aperturaDeLaMesa(datos: DatosDelDialogoDeApertura = {}): AperturaDeLaMesa {
  const personas = enteroDe(datos.personas);
  const celebracion = datos.celebracion_especial === true;
  return {
    personas: Number.isFinite(personas) && personas > 0 ? personas : 1,
    clienteNombre: texto(datos.cliente_nombre),
    notas: texto(datos.notas),
    // Información de seguridad: viaja primero y en instantánea.
    notasAlergias: texto(datos.notas_alergias),
    celebracionEspecial: celebracion,
    tipoCelebracion: celebracion ? texto(datos.tipo_celebracion) : '',
  };
}

export interface BotonDelCarrito {
  /** `llamar`: avisa al mesero; `abrir`: abre la mesa (y luego se envía); `enviar`: a cocina. */
  readonly accion: 'llamar' | 'abrir' | 'enviar';
  readonly texto: string;
  /** Lo que el comensal tiene que saber, en sus palabras. Nunca un texto para el personal. */
  readonly explicacion: string | null;
}

export const PEDIDO_GUARDADO =
  'Tu pedido está guardado. Tu mesero lo confirma y lo manda a cocina.';
const PIDE_QUE_TE_ATIENDAN = 'Pide a tu mesero que te atienda para enviar tu pedido.';
const TEXTO_DE_LLAMAR = 'Llamar a mi mesero';
const TEXTO_DE_VOLVER_A_LLAMAR = 'Volver a llamar a mi mesero';

/**
 * El botón del carrito y su explicación (DP-12.2). Un servidor anterior no dice `envio`: entonces
 * envía el comensal, como antes.
 */
export function botonDelCarrito(estado: EstadoDelCarrito): BotonDelCarrito {
  const avisado = estado.meseroAvisado === true;
  switch (estado.envio ?? 'enviar') {
    case 'llamar_mesero':
      return avisado
        ? { accion: 'llamar', texto: 'Volver a llamar a mi mesero', explicacion: PEDIDO_GUARDADO }
        : { accion: 'llamar', texto: 'Llamar a mi mesero para confirmar', explicacion: null };
    case 'pedir_que_atiendan':
      return {
        accion: 'llamar',
        texto: avisado ? TEXTO_DE_VOLVER_A_LLAMAR : TEXTO_DE_LLAMAR,
        explicacion: PIDE_QUE_TE_ATIENDAN,
      };
    case 'cuenta_pedida':
      return {
        accion: 'llamar',
        texto: avisado ? TEXTO_DE_VOLVER_A_LLAMAR : TEXTO_DE_LLAMAR,
        explicacion: CUENTA_PEDIDA,
      };
    case 'abrir_y_enviar':
      return { accion: 'abrir', texto: 'Abrir la mesa y enviar', explicacion: null };
    case 'enviar':
      return { accion: 'enviar', texto: 'Enviar a cocina', explicacion: null };
  }
}

/** Todas traen precio: si el negocio no los enseña, tampoco hay subtotal que enseñar. */
export function conPrecios(lineas: readonly LineaDelCarrito[]): boolean {
  return lineas.every((l) => l.precioCentavos !== null);
}

export interface ResultadoDelEnvio {
  readonly enviado: boolean;
  readonly ronda: number;
  /**
   * Lo que el servidor quitó del carrito porque ya no se podía pedir. Falta en la respuesta de un
   * servidor anterior, o en la de un reintento que se guardó antes de desplegar.
   */
  readonly noDisponibles?: readonly string[];
}

export interface AvisoDelEnvio {
  readonly tono: 'exito' | 'aviso';
  readonly texto: string;
}

/** «Taco», «Taco y Flan», «Taco, Flan y Café». */
function enLista(nombres: readonly string[]): string {
  return nombres.length <= 1
    ? (nombres[0] ?? '')
    : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1] ?? ''}`;
}

/**
 * Lo que se le dice al comensal después de «Enviar». Si el negocio ocultó algo que ya estaba en
 * el carrito, el servidor lo quita y manda lo demás: aquí se nombra lo que no se envió.
 */
export function avisoDelEnvio(resultado: ResultadoDelEnvio): AvisoDelEnvio {
  const fuera = resultado.noDisponibles ?? [];
  if (fuera.length === 0) {
    // Vacío al llegar: otro teléfono lo mandó, o el envío de otro quitó lo que ya no había.
    return {
      tono: 'exito',
      texto: resultado.enviado
        ? '¡Pedido enviado a cocina!'
        : 'Ya no había nada que enviar: lo mandó otro teléfono o se quitó del pedido.',
    };
  }
  const motivo =
    fuera.length === 1
      ? 'ya no está disponible y se quitó del pedido.'
      : 'ya no están disponibles y se quitaron del pedido.';
  return {
    tono: 'aviso',
    texto: resultado.enviado
      ? `Pedido enviado sin ${enLista(fuera)}: ${motivo}`
      : `No se envió nada: ${enLista(fuera)} ${motivo}`,
  };
}

/** Lo que se manda de un platillo: nunca su precio (lo pone el servidor). */
export interface ItemDelCarrito {
  readonly productoId: string;
  readonly cantidad: string;
  readonly notas: string;
}

const CLAVE = 'morphiqpos_portal_dispositivo';
/**
 * La forma de un id que emitió el servidor (`portal/telefono.ts`). Lo que el navegador guardó antes de
 * las firmas (un UUID sin guiones) no la tiene: se descarta y el servidor emite uno nuevo. Que la firma
 * valga lo decide siempre el servidor; esto sólo evita mandar lo que sabemos viejo.
 */
const FORMA = /^t1-[0-9a-f]{24}-[0-9a-f]{32}$/;
let enLaPestana: string | null = null;

function guardado(): string | null {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    return valor !== null && FORMA.test(valor) ? valor : null;
  } catch {
    // Navegación privada estricta: sin almacenamiento, el id vive sólo en esta pestaña.
    return null;
  }
}

/** El id de este teléfono, o `''` si todavía no tiene uno: entonces el sondeo pide que se le emita. */
export function dispositivoDelTelefono(): string {
  enLaPestana ??= guardado();
  return enLaPestana ?? '';
}

/** Guarda el id que el servidor emitió para este teléfono. */
export function recordarDispositivo(id: string): void {
  if (!FORMA.test(id)) return;
  enLaPestana = id;
  try {
    window.localStorage.setItem(CLAVE, id);
  } catch {
    // Sin almacenamiento sigue sirviendo en la pestaña; al recargar se le emite otro.
  }
}

/** El servidor no reconoció el id: se olvida, y el siguiente sondeo trae uno nuevo. */
export function olvidarDispositivo(): void {
  enLaPestana = null;
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

/**
 * `'0.25'` × `42000` → `10500`: el subtotal para enseñar; lo que se cobra lo decide la caja. Lo
 * que ya no está disponible no cuenta: no se va a enviar.
 */
export function subtotalAproximadoCentavos(lineas: readonly LineaDelCarrito[]): number {
  return lineas
    .filter((l) => l.disponible !== false)
    .reduce((suma, l) => suma + Math.round(Number(l.cantidad) * Number(l.precioCentavos ?? 0)), 0);
}

export function personasConectadas(n: number): string {
  return n === 1 ? '1 persona conectada' : `${String(n)} personas conectadas`;
}

/** Subió la ronda y no fue este teléfono: alguien más mandó el pedido. */
export function envioDeOtroTelefono(rondaVista: number | null, estado: EstadoDelCarrito): boolean {
  return (
    rondaVista !== null &&
    estado.ronda > rondaVista &&
    estado.ultimoEnvio !== null &&
    !estado.ultimoEnvio.porEsteTelefono
  );
}
