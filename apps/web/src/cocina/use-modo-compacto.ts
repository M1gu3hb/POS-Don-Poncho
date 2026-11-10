import { useCallback, useSyncExternalStore } from 'react';

/**
 * DP-16 · 2.2 · EL MODO COMPACTO SE RECUERDA EN EL APARATO.
 *
 * Cada pantalla de la cocina decide cómo se lee desde donde está (la de la pared, la tableta de la
 * plancha): es una preferencia de ESE aparato, no del negocio, y por eso vive en el navegador. Si
 * el navegador no deja guardar (ventana privada, datos bloqueados), la pantalla sigue funcionando y
 * recuerda la elección mientras esté abierta.
 */

export const CLAVE_MODO_COMPACTO = 'pdp.cocina.modo-compacto';

let enMemoria: boolean | null = null;
const oyentes = new Set<() => void>();

function leer(): boolean {
  if (enMemoria !== null) return enMemoria;
  try {
    return window.localStorage.getItem(CLAVE_MODO_COMPACTO) === '1';
  } catch {
    // Sin almacenamiento del navegador: vale lo que se haya elegido en esta sesión (nada = normal).
    return false;
  }
}

function guardar(valor: boolean): void {
  enMemoria = valor;
  try {
    window.localStorage.setItem(CLAVE_MODO_COMPACTO, valor ? '1' : '0');
  } catch {
    // Se queda sólo en memoria (ver arriba): no es un fallo de la cocina.
  }
  oyentes.forEach((avisar) => {
    avisar();
  });
}

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  const alCambiarOtraPestana = (e: StorageEvent): void => {
    if (e.key === CLAVE_MODO_COMPACTO) {
      enMemoria = null;
      avisar();
    }
  };
  window.addEventListener('storage', alCambiarOtraPestana);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener('storage', alCambiarOtraPestana);
  };
}

export function useModoCompacto(): readonly [boolean, (valor: boolean) => void] {
  const compacto = useSyncExternalStore(suscribir, leer, () => false);
  const cambiar = useCallback((valor: boolean) => {
    guardar(valor);
  }, []);
  return [compacto, cambiar];
}
