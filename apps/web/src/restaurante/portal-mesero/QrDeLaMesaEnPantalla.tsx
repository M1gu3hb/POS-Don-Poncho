'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';
import { Aviso } from '@morphiqpos/ui/sistema';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

import { qrDeLaMesa } from './api-del-carrito-del-mesero';

/**
 * «VER QR DE LA MESA» (DP-12.2): la pantalla de la estación se vuelve el QR de la mesa, grande y
 * en blanco y negro, para escanearlo con el teléfono del mesero sin ir a la mesa física.
 * «Cancelar» la regresa a la normalidad. Se dibuja aquí mismo, sin servicios externos.
 */

/** La misma dirección que lleva el QR pegado en la mesa (`heredado/utils/qrUtils.js`). */
function direccionDelQr(token: string): string {
  const publica = document.documentElement.dataset['urlPublica'];
  const origen = publica !== undefined && publica !== '' ? publica : window.location.origin;
  return `${origen.replace(/\/+$/, '')}/qr/${token}`;
}

function useImagen(direccion: string | null): string | null {
  const [imagen, setImagen] = useState<string | null>(null);
  useEffect(() => {
    if (direccion === null) return;
    let vigente = true;
    QRCode.toDataURL(direccion, { width: 480, margin: 2, errorCorrectionLevel: 'M' }).then(
      (url) => {
        if (vigente) setImagen(url);
      },
      () => {
        if (vigente) setImagen(null);
      },
    );
    return () => {
      vigente = false;
    };
  }, [direccion]);
  return direccion === null ? null : imagen;
}

export function QrDeLaMesaEnPantalla({
  mesa,
  alCerrar,
}: {
  readonly mesa: { readonly id: string; readonly numero: number } | null;
  readonly alCerrar: () => void;
}) {
  const consulta = useQuery({
    queryKey: ['qr_de_la_mesa', mesa?.id ?? null],
    queryFn: () => qrDeLaMesa(mesa?.id ?? ''),
    enabled: mesa !== null,
  });
  const token = consulta.data?.token ?? null;
  const imagen = useImagen(token === null ? null : direccionDelQr(token));

  return (
    <Dialog
      open={mesa !== null}
      onOpenChange={(abierto) => {
        if (!abierto) alCerrar();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR de la mesa {mesa?.numero}</DialogTitle>
          <DialogDescription>
            Escanéalo con tu teléfono para abrir el pedido de la mesa.
          </DialogDescription>
        </DialogHeader>
        {consulta.isError ? (
          <Aviso tono="peligro" titulo="No pudimos leer el QR de esta mesa." />
        ) : consulta.data !== undefined && token === null ? (
          <Aviso tono="atencion" titulo="Esta mesa todavía no tiene QR. Genéralo en Portal QR." />
        ) : imagen === null ? (
          <div className="mx-auto aspect-square w-full max-w-80 animate-pulse rounded-lg bg-superficie-hundida" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- un QR dibujado aquí (data:), fuera de `next/image`
          <img
            src={imagen}
            alt={`QR de la mesa ${String(mesa?.numero ?? '')}`}
            width={480}
            height={480}
            className="mx-auto aspect-square w-full max-w-80 rounded-lg bg-white"
            data-qr-de-la-mesa={mesa?.id}
          />
        )}
        <Button variant="outline" onClick={alCerrar}>
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
