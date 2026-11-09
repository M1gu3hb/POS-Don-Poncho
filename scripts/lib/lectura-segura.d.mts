/** Los tipos de `lectura-segura.mjs`, para que los guiones y sus pruebas no lean `any`. */

export declare const PUERTO_DEL_POOLER_DE_TRANSACCION: '6543';

export declare function exigirConexionDirecta(cadena: string | undefined): URL;

export interface ClienteQueLee {
  query(texto: string): Promise<unknown>;
}

export declare function leerEnSoloLectura<C extends ClienteQueLee, T>(
  cliente: C,
  leer: (cliente: C) => Promise<T>,
  opciones?: { readonly aislamiento?: 'read committed' | 'repeatable read' },
): Promise<T>;
