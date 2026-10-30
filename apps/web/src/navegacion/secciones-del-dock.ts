/**
 * DP-11.4 · LAS SECCIONES DEL DOCK, la navegación de la tableta y el teléfono.
 *
 * El menú lo declara el servidor (`navegacionParaRolYPlantilla`), en el orden del día de trabajo
 * de cada puesto. El dock pinta las CUATRO primeras —en el restaurante del dueño: inicio, mesas,
 * cocina y caja; la mesera sólo tiene sus mesas— y «Más» abre el menú completo de siempre. Nada
 * se ordena aquí: volver a ordenar sería la segunda lista que se queda atrás.
 */

export interface EntradaDeNavegacion {
  readonly ruta: string;
  readonly etiqueta: string;
  readonly icono: string;
}

export interface SeccionDelDock extends EntradaDeNavegacion {
  /** Lo que cabe debajo del ícono. La etiqueta completa queda en el menú y en el título. */
  readonly corta: string;
}

export const SECCIONES_EN_EL_DOCK = 4;

/** Las palabras de las rutas del restaurante. Una ruta nueva usa la primera de su etiqueta. */
const CORTAS: Readonly<Record<string, string>> = {
  '/': 'Inicio',
  '/mesero': 'Mesas',
  '/cocina': 'Cocina',
  '/caja': 'Caja',
  '/ventas': 'Ventas',
  '/restaurante/cierre-diario-y-arqueo': 'Cierre',
  '/recetas': 'Recetas',
  '/productos': 'Platillos',
  '/inventario': 'Inventario',
  '/compras': 'Compras',
  '/registros': 'Registros',
  '/portal-qr': 'Portal QR',
  '/configuracion': 'Ajustes',
};

const LETRAS_MAXIMAS = 10;

export function rotuloCorto(ruta: string, etiqueta: string): string {
  const conocida = CORTAS[ruta];
  if (conocida !== undefined) return conocida;
  const primera = etiqueta.trim().split(/\s+/)[0] ?? etiqueta;
  return primera.slice(0, LETRAS_MAXIMAS);
}

export function seccionesDelDock(entradas: readonly EntradaDeNavegacion[]): SeccionDelDock[] {
  return entradas
    .slice(0, SECCIONES_EN_EL_DOCK)
    .map((entrada) => ({ ...entrada, corta: rotuloCorto(entrada.ruta, entrada.etiqueta) }));
}

/** El inicio sólo en el inicio; una sección, también en sus pantallas de adentro. */
export function esLaSeccionActual(ruta: string, actual: string): boolean {
  if (ruta === '/') return actual === '/';
  return actual === ruta || actual.startsWith(`${ruta}/`);
}
