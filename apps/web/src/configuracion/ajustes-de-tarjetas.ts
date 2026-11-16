import { esRfcValido, normalizarRfc } from '@morphiqpos/domain/venta';

import { hayCambios, leidoDe, parcheDeLaSeccion } from './parche-de-la-seccion.ts';

/**
 * LOS AJUSTES SENCILLOS DE LA CONFIGURACIÓN, UNO POR TARJETA (DP-21 · Bloque 21). Puro.
 *
 * Eran los campos de «Operación» y de «Datos del negocio»: un solo formulario con un solo
 * «Guardar configuración». Ahora cada tarjeta lleva SUS campos y guarda sólo lo suyo
 * (`parche`): lo que no tocó no viaja, así que guardar una tarjeta nunca pisa lo que otra
 * pantalla u otro aparato cambió mientras tanto. Cada clave está en una sola tarjeta (lo vigila
 * `mudanza.contrato.test.ts`).
 */

interface CampoBase {
  readonly clave: string;
  readonly etiqueta: string;
  readonly ayuda?: string;
  /** El `id` del control, para quien lo busca por él. */
  readonly id?: string;
}

export interface CampoDeTexto extends CampoBase {
  readonly tipo: 'texto';
  readonly porOmision: string;
  readonly placeholder?: string;
  /** Ocupa todo el ancho de la tarjeta. */
  readonly ancho?: 'completo';
  /** Sólo se enseña si esta otra clave de la misma tarjeta está encendida. */
  readonly visibleSiEncendida?: string;
  /** Lo tecleado se pasa a mayúsculas y sin espacios (el RFC). */
  readonly comoRfc?: boolean;
}

export interface CampoInterruptor extends CampoBase {
  readonly tipo: 'interruptor';
  readonly porOmision: boolean;
}

export interface CampoDeSeleccion extends CampoBase {
  readonly tipo: 'seleccion';
  readonly opciones: readonly { readonly valor: number; readonly nombre: string }[];
  readonly porOmision: number;
}

export type Campo = CampoDeTexto | CampoInterruptor | CampoDeSeleccion;

export interface AjustesDeUnaTarjeta {
  readonly titulo: string;
  readonly descripcion?: string;
  readonly campos: readonly Campo[];
}

export const AJUSTES_DE_TARJETAS: Readonly<Record<string, AjustesDeUnaTarjeta>> = {
  'datos-del-negocio': {
    titulo: 'Datos del negocio',
    descripcion: 'Estos datos aparecen en tickets, PDFs y el corte.',
    campos: [
      {
        tipo: 'texto',
        clave: 'nombre_negocio',
        etiqueta: 'Nombre del negocio',
        porOmision: '',
        placeholder: 'Mi Restaurante',
      },
      {
        tipo: 'texto',
        clave: 'direccion',
        etiqueta: 'Dirección',
        porOmision: '',
        placeholder: 'Calle, número, colonia, ciudad',
        ancho: 'completo',
      },
      { tipo: 'texto', clave: 'telefono', etiqueta: 'Teléfono', porOmision: '' },
      { tipo: 'texto', clave: 'correo', etiqueta: 'Correo', porOmision: '' },
      {
        tipo: 'texto',
        clave: 'rfc',
        etiqueta: 'RFC',
        ayuda:
          'Sale en el corte como «RFC: …». 12 caracteres (persona moral) o 13 (persona física), en mayúsculas. Vacío, no sale.',
        porOmision: '',
        placeholder: 'Ej: ABC850101AB1',
        comoRfc: true,
      },
    ],
  },
  propinas: {
    titulo: 'Propinas',
    campos: [
      {
        tipo: 'interruptor',
        clave: 'propinas_activas',
        etiqueta: 'Activar propinas',
        ayuda:
          'Si está apagado, no se preguntará propina en ningún flujo (POS, mesero, caja). Las ventas no se ven afectadas. Las propinas nunca se suman a las ventas reales ni a la utilidad.',
        porOmision: true,
      },
      {
        tipo: 'texto',
        clave: 'propina_porcentajes_sugeridos',
        etiqueta: 'Porcentajes sugeridos (separados por coma)',
        ayuda: 'Hasta 6 valores. Estos aparecen como botones rápidos en el modal de propina.',
        porOmision: '5,10,15,20',
        placeholder: '5,10,15,20',
        visibleSiEncendida: 'propinas_activas',
      },
    ],
  },
  ticket: {
    titulo: 'Ticket',
    descripcion: 'Lo que dice el papel que se le da al cliente.',
    campos: [
      {
        tipo: 'texto',
        clave: 'mensaje_ticket',
        etiqueta: 'Mensaje en ticket',
        porOmision: '¡Gracias por tu visita!',
        ancho: 'completo',
      },
      {
        tipo: 'seleccion',
        clave: 'ancho_papel_ticket',
        id: 'ancho-papel-ticket',
        etiqueta: 'Ancho del papel del ticket',
        ayuda: 'El rollo de tu impresora térmica. En 58 mm el texto va más chico para que quepa.',
        opciones: [
          { valor: 58, nombre: '58 mm' },
          { valor: 80, nombre: '80 mm' },
        ],
        porOmision: 80,
      },
      {
        tipo: 'texto',
        clave: 'ticket_footer',
        etiqueta: 'Pie del ticket térmico',
        porOmision: '',
        placeholder: 'Ej: Visítanos pronto · @restaurante',
        ancho: 'completo',
      },
    ],
  },
  'pdf-y-reportes': {
    titulo: 'PDF del corte y reportes',
    campos: [
      {
        tipo: 'texto',
        clave: 'pdf_footer',
        etiqueta: 'Pie de los PDFs',
        porOmision: '',
        placeholder: 'Ej: Documento confidencial',
        ancho: 'completo',
      },
    ],
  },
  'pdf-al-cerrar': {
    titulo: 'PDF del corte al cerrar',
    campos: [
      {
        tipo: 'interruptor',
        clave: 'descargar_pdf_corte_auto',
        etiqueta: 'Abrir PDF automático al cerrar caja',
        ayuda: 'Muestra el reporte para imprimir/descargar al cerrar el corte.',
        porOmision: true,
      },
    ],
  },
  'asignacion-de-mesas': {
    titulo: 'Asignación de mesas a meseros',
    campos: [
      {
        tipo: 'interruptor',
        clave: 'asignacion_mesas_activa',
        etiqueta: 'Activar asignación de mesas a meseros',
        ayuda:
          'Si está apagado, todos los meseros ven todas las mesas y la mesa muestra "Atiende: …" cuando alguien la toma. Si está encendido, cada mesa tiene un mesero fijo y las solicitudes QR se rutean al mesero asignado.',
        porOmision: false,
      },
    ],
  },
  'avisos-del-administrador': {
    titulo: 'Avisos del administrador',
    campos: [
      {
        tipo: 'interruptor',
        clave: 'silenciar_notificaciones_admin',
        etiqueta: 'Silenciar notificaciones del administrador',
        ayuda:
          'Recomendado: encendido. El administrador no escucha sonidos ni voz; sigue viendo los badges e indicadores visuales.',
        porOmision: true,
      },
    ],
  },
  'usar-mesas': {
    titulo: 'Usar mesas',
    campos: [{ tipo: 'interruptor', clave: 'usa_mesas', etiqueta: 'Usar mesas', porOmision: true }],
  },
  'vender-sin-existencia': {
    titulo: 'Permitir venta sin stock',
    campos: [
      {
        tipo: 'interruptor',
        clave: 'permitir_venta_sin_stock',
        etiqueta: 'Permitir venta sin stock',
        ayuda:
          'Hoy manda la opción de cada producto («Permitir venta sin stock» en el producto); este interruptor del negocio no cambia lo que se cobra. Lo que pasó por cocina (mesa, para llevar o portal) se cobra aunque no haya existencia.',
        porOmision: false,
      },
    ],
  },
  'texto-legal': {
    titulo: 'Texto legal o pie general',
    campos: [
      {
        tipo: 'texto',
        clave: 'footer_text',
        etiqueta: 'Texto legal o pie general',
        porOmision: '',
        placeholder: 'Ej: RFC, dirección fiscal, etc.',
        ancho: 'completo',
      },
    ],
  },
};

type Configuracion = Readonly<Record<string, unknown>> | null | undefined;
export type Formulario = Readonly<Record<string, string | number | boolean>>;

export function clavesDe(ajustes: AjustesDeUnaTarjeta): readonly string[] {
  return ajustes.campos.map((c) => c.clave);
}

/** Lo que dice la configuración para cada campo; lo que falta, la omisión. Un `false` es un dato. */
export function formularioDe(
  ajustes: AjustesDeUnaTarjeta,
  configuracion: Configuracion,
): Formulario {
  const salida: Record<string, string | number | boolean> = {};
  for (const campo of ajustes.campos) {
    const guardado = configuracion?.[campo.clave];
    if (campo.tipo === 'interruptor') {
      salida[campo.clave] = typeof guardado === 'boolean' ? guardado : campo.porOmision;
    } else if (campo.tipo === 'seleccion') {
      const numero = Number(guardado);
      salida[campo.clave] = campo.opciones.some((o) => o.valor === numero)
        ? numero
        : campo.porOmision;
    } else {
      salida[campo.clave] = typeof guardado === 'string' ? guardado : campo.porOmision;
    }
  }
  return salida;
}

/**
 * Lo que se manda al guardar: sólo lo que cambió respecto de lo GUARDADO (crudo). Un campo que
 * nunca se guardó viaja la primera vez con lo que diga el formulario; uno que ya está guardado y
 * no se tocó, no viaja.
 */
export function parcheDe(
  ajustes: AjustesDeUnaTarjeta,
  formulario: Formulario,
  configuracion: Configuracion,
): Record<string, unknown> {
  return parcheDeLaSeccion(formulario, leidoDe(configuracion, clavesDe(ajustes)));
}

/** Lo que se teclea en un campo, ya como debe quedar (el RFC, en mayúsculas y sin espacios). */
export function comoSeGuarda(
  campo: Campo,
  valor: string | number | boolean,
): string | number | boolean {
  return campo.tipo === 'texto' && campo.comoRfc === true && typeof valor === 'string'
    ? normalizarRfc(valor)
    : valor;
}

/** Por qué todavía no se puede guardar la tarjeta, o `null` (hoy: el RFC con una forma que no es). */
export function errorDelFormulario(
  ajustes: AjustesDeUnaTarjeta,
  formulario: Formulario,
): string | null {
  for (const campo of ajustes.campos) {
    if (campo.tipo !== 'texto' || campo.comoRfc !== true) continue;
    const valor = formulario[campo.clave];
    if (typeof valor === 'string' && valor !== '' && !esRfcValido(valor)) {
      return 'El RFC lleva 12 caracteres (persona moral) o 13 (persona física), en mayúsculas y sin espacios.';
    }
  }
  return null;
}

export function hayCambiosEn(
  ajustes: AjustesDeUnaTarjeta,
  formulario: Formulario,
  configuracion: Configuracion,
): boolean {
  return hayCambios(parcheDe(ajustes, formulario, configuracion));
}
