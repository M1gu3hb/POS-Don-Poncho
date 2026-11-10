/**
 * DP-16 · La lógica pura del editor de «Opciones del platillo».
 *
 * Sin React ni red: valida un grupo de opciones, convierte el precio (texto en pesos con signo
 * <-> centavos del servidor), arma las entradas de los dos comandos
 * (`/api/catalogo/guardar-grupo-de-opciones` y `/api/catalogo/asignar-grupos-de-opciones`)
 * y mueve elementos de una lista. El diálogo (`OpcionesDelPlatilloDialog.tsx`) sólo la pinta.
 */

export type TipoDeGrupo = 'unica' | 'multiple';

/** Un grupo tal como lo devuelve la lectura `/api/catalogo/grupos-de-opciones`. */
export interface GrupoDeLectura {
  readonly id: string;
  readonly nombre: string;
  readonly tipo: TipoDeGrupo;
  readonly obligatorio: boolean;
  readonly minimo: number | null;
  readonly maximo: number | null;
  readonly activo: boolean;
  readonly opciones: readonly {
    readonly id: string;
    readonly nombre: string;
    /** Centavos con signo, en texto. */
    readonly precioCentavos: string;
    readonly activa: boolean;
  }[];
  readonly productoIds: readonly string[];
}

export interface OpcionEditable {
  /** Llave local para pintar la lista; no viaja al servidor. */
  readonly clave: string;
  readonly id?: string;
  readonly nombre: string;
  /** Pesos con signo, como se escribe: «», «15», «-5», «12.50». */
  readonly precio: string;
  readonly activa: boolean;
}

export interface GrupoEditable {
  readonly clave: string;
  readonly id?: string;
  readonly nombre: string;
  readonly tipo: TipoDeGrupo;
  readonly obligatorio: boolean;
  /** Vacío = sin mínimo. Sólo vale para «varias». */
  readonly minimo: string;
  readonly maximo: string;
  readonly activo: boolean;
  readonly opciones: readonly OpcionEditable[];
  /** Los productos que ya usan el grupo (vacío si es nuevo). */
  readonly productoIds: readonly string[];
}

export interface EntradaDeOpcion {
  readonly id?: string;
  readonly nombre: string;
  readonly precio: string;
  readonly activa: boolean;
}

export interface EntradaGuardarGrupo {
  readonly grupoId?: string;
  readonly nombre: string;
  readonly tipo: TipoDeGrupo;
  readonly obligatorio: boolean;
  readonly minimo: number | null;
  readonly maximo: number | null;
  readonly activo: boolean;
  readonly opciones: readonly EntradaDeOpcion[];
}

export interface EntradaAsignarGrupos {
  readonly productoId: string;
  readonly grupoIds: readonly string[];
}

const PRECIO_VALIDO = /^-?\d{1,7}(\.\d{1,2})?$/;
const ENTERO = /^\d+$/;

let contador = 0;
function claveLocal(): string {
  contador += 1;
  return `local-${String(contador)}`;
}

/** ¿Es un precio que el servidor acepta? Vacío vale: es «sin costo». */
export function precioEsValido(texto: string): boolean {
  const limpio = texto.trim();
  return limpio === '' || PRECIO_VALIDO.test(limpio);
}

/** Centavos con signo (texto del servidor) -> pesos para el campo. 0 queda vacío. */
export function precioDesdeCentavos(centavos: string): string {
  const total = Number(centavos);
  if (!Number.isFinite(total) || total === 0) return '';
  const negativo = total < 0;
  const absoluto = Math.abs(Math.trunc(total));
  const pesos = Math.floor(absoluto / 100);
  const resto = absoluto % 100;
  const cuerpo = resto === 0 ? String(pesos) : `${String(pesos)}.${String(resto).padStart(2, '0')}`;
  return negativo ? `-${cuerpo}` : cuerpo;
}

/** El precio tal como viaja al servidor: vacío o cero son «0». */
export function precioAPesos(texto: string): string {
  const limpio = texto.trim();
  if (limpio === '' || Number(limpio) === 0) return '0';
  return limpio;
}

/** «sin costo», «+$15.00» o «−$5.00»; vacía si el precio no es válido. */
export function etiquetaDePrecio(texto: string): string {
  if (!precioEsValido(texto)) return '';
  const valor = Number(precioAPesos(texto));
  if (valor === 0) return 'sin costo';
  const cifra = Math.abs(valor).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${valor < 0 ? '−' : '+'}$${cifra}`;
}

export function opcionNueva(): OpcionEditable {
  return { clave: claveLocal(), nombre: '', precio: '', activa: true };
}

export function grupoNuevo(): GrupoEditable {
  return {
    clave: claveLocal(),
    nombre: '',
    tipo: 'unica',
    obligatorio: false,
    minimo: '',
    maximo: '',
    activo: true,
    opciones: [],
    productoIds: [],
  };
}

export function grupoDesdeLectura(grupo: GrupoDeLectura): GrupoEditable {
  return {
    clave: claveLocal(),
    id: grupo.id,
    nombre: grupo.nombre,
    tipo: grupo.tipo,
    obligatorio: grupo.obligatorio,
    minimo: grupo.minimo === null ? '' : String(grupo.minimo),
    maximo: grupo.maximo === null ? '' : String(grupo.maximo),
    activo: grupo.activo,
    opciones: grupo.opciones.map((o) => ({
      clave: claveLocal(),
      id: o.id,
      nombre: o.nombre,
      precio: precioDesdeCentavos(o.precioCentavos),
      activa: o.activa,
    })),
    productoIds: grupo.productoIds,
  };
}

function normalizado(nombre: string): string {
  return nombre.trim().toLowerCase();
}

function erroresDeLimites(grupo: GrupoEditable): string[] {
  if (grupo.tipo !== 'multiple') return [];
  const errores: string[] = [];
  const minimo = grupo.minimo.trim();
  const maximo = grupo.maximo.trim();
  const minimoOk = minimo === '' || ENTERO.test(minimo);
  const maximoOk = maximo === '' || (ENTERO.test(maximo) && Number(maximo) >= 1);
  if (!minimoOk) errores.push('El mínimo debe ser un número entero de 0 o más.');
  if (!maximoOk) errores.push('El máximo debe ser un número entero de 1 o más.');
  if (minimoOk && maximoOk && minimo !== '' && maximo !== '' && Number(minimo) > Number(maximo)) {
    errores.push('El mínimo no puede ser mayor que el máximo.');
  }
  if (minimoOk && minimo !== '') {
    const activas = grupo.opciones.filter((o) => o.activa && o.nombre.trim() !== '').length;
    if (Number(minimo) > activas) {
      errores.push(
        `El mínimo (${minimo}) no puede pasar de las opciones activas (${String(activas)}).`,
      );
    }
  }
  return errores;
}

/** Los errores que impiden guardar el grupo, en español; vacío si está bien. */
export function validarGrupo(grupo: GrupoEditable): string[] {
  const errores: string[] = [];
  if (grupo.nombre.trim() === '') errores.push('Ponle nombre al grupo.');
  if (grupo.opciones.length === 0) errores.push('Agrega al menos una opción.');
  if (grupo.opciones.some((o) => o.nombre.trim() === '')) {
    errores.push('Hay una opción sin nombre.');
  }
  const vistos = new Set<string>();
  for (const opcion of grupo.opciones) {
    const nombre = normalizado(opcion.nombre);
    if (nombre === '') continue;
    if (vistos.has(nombre)) {
      errores.push(`La opción «${opcion.nombre.trim()}» está repetida.`);
    }
    vistos.add(nombre);
    if (!precioEsValido(opcion.precio)) {
      errores.push(
        `La opción «${opcion.nombre.trim()}» tiene un precio inválido (usa 15, -5 o 12.50).`,
      );
    }
  }
  return [...errores, ...erroresDeLimites(grupo)];
}

export function entradaDeGuardar(grupo: GrupoEditable): EntradaGuardarGrupo {
  const varias = grupo.tipo === 'multiple';
  const numero = (texto: string): number | null =>
    varias && texto.trim() !== '' ? Number(texto.trim()) : null;
  return {
    ...(grupo.id === undefined ? {} : { grupoId: grupo.id }),
    nombre: grupo.nombre.trim(),
    tipo: grupo.tipo,
    obligatorio: grupo.obligatorio,
    minimo: numero(grupo.minimo),
    maximo: numero(grupo.maximo),
    activo: grupo.activo,
    opciones: grupo.opciones.map((o) => ({
      ...(o.id === undefined ? {} : { id: o.id }),
      nombre: o.nombre.trim(),
      precio: precioAPesos(o.precio),
      activa: o.activa,
    })),
  };
}

/** ¿Hay algo que guardar? Un grupo nuevo siempre; uno existente, si su entrada difiere. */
export function cambiosDelGrupo(
  actual: GrupoEditable,
  original: GrupoEditable | undefined,
): boolean {
  if (original === undefined || actual.id === undefined) return true;
  return JSON.stringify(entradaDeGuardar(actual)) !== JSON.stringify(entradaDeGuardar(original));
}

export function entradaDeAsignar(
  productoId: string,
  grupoIds: readonly string[],
): EntradaAsignarGrupos {
  return { productoId, grupoIds: [...grupoIds] };
}

/** Cuántos OTROS productos usan el grupo (sin contar el que se edita). */
export function productosQueLoUsan(productoIds: readonly string[], productoId: string): number {
  return productoIds.filter((id) => id !== productoId).length;
}

function intercambiar<T>(lista: readonly T[], a: number, b: number): readonly T[] {
  if (a < 0 || b < 0 || a >= lista.length || b >= lista.length) return lista;
  const copia = [...lista];
  const x = copia[a] as T;
  copia[a] = copia[b] as T;
  copia[b] = x;
  return copia;
}

export function moverArriba<T>(lista: readonly T[], indice: number): readonly T[] {
  return intercambiar(lista, indice, indice - 1);
}

export function moverAbajo<T>(lista: readonly T[], indice: number): readonly T[] {
  return intercambiar(lista, indice, indice + 1);
}
