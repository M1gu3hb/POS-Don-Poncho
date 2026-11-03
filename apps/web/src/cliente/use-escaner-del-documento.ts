'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  documentoConCamara,
  sinLaMarca,
  urlDeCargaDelDocumento,
  urlParaEscanear,
} from './escaner-del-documento';

/**
 * Abre y cierra el escáner de una pantalla que usa la cámara (`/mesero`, `/pos`), recargando
 * una vez si el documento se cargó en una ruta sin cámara (ver `escaner-del-documento.ts`).
 */
export function useEscanerDelDocumento(): {
  readonly abierto: boolean;
  readonly abrir: () => void;
  readonly cerrar: () => void;
} {
  const [abierto, setAbierto] = useState(false);

  // Llegó de la recarga: abre el escáner y deja la dirección sin la marca.
  useEffect(() => {
    const limpia = sinLaMarca(window.location.href);
    if (limpia === null) return;
    window.history.replaceState(window.history.state, '', limpia);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la marca sólo se lee en el navegador, al llegar
    setAbierto(true);
  }, []);

  const abrir = useCallback(() => {
    if (documentoConCamara(urlDeCargaDelDocumento())) {
      setAbierto(true);
      return;
    }
    window.location.assign(urlParaEscanear(window.location.href));
  }, []);
  const cerrar = useCallback(() => {
    setAbierto(false);
  }, []);

  return { abierto, abrir, cerrar };
}
