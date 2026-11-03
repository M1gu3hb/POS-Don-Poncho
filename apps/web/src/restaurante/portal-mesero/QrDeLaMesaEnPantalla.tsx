'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';
import { Aviso, Esqueleto, Vacio } from '@morphiqpos/ui/sistema';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

import { qrDeLaMesa } from './api-del-carrito-del-mesero';
import { programarCierre, tituloDelQr } from './qr-en-pantalla';

/**
 * «VER QR DE LA MESA» (DP-12.2): la pantalla de la estación se vuelve el QR de la mesa, grande y
 * en blanco y negro, para escanearlo con el teléfono del mesero sin ir a la mesa física.
 * «Cancelar» la regresa a la normalidad. Se dibuja aquí mismo, sin servicios externos.
 *
 * DP-13.4 · Si nadie la cierra, se cierra sola a los 60 s (`qr-en-pantalla.ts`): el QR de una mesa
 * no se queda en una pantalla que ya nadie mira. El plazo corre por la MESA abierta, no por la
 * función `alCerrar` (la pantalla del mesero se vuelve a pintar cada pocos segundos y, con
 * `alCerrar` en las dependencias, el minuto empezaría de nuevo cada vez). Y el título lleva el
 * número de la mesa desde que abre y mientras se cierra: se recuerda la última mesa abierta.
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
  // La mesa que se enseña: la abierta o, mientras el diálogo se cierra, la última. Sin esto el
  // título perdía su número en cuanto `mesa` volvía a ser `null`. Se ajusta al pintar, no en un
  // efecto (así no hay un cuadro con el título a medias).
  const [recordada, setRecordada] = useState(mesa);
  if (mesa !== null && mesa !== recordada) setRecordada(mesa);
  const enPantalla = mesa ?? recordada;
  const id = mesa?.id ?? null;

  const alCerrarVigente = useRef(alCerrar);
  useEffect(() => {
    alCerrarVigente.current = alCerrar;
  });
  useEffect(() => {
    if (id === null) return;
    return programarCierre(() => {
      alCerrarVigente.current();
    });
  }, [id]);

  const consulta = useQuery({
    queryKey: ['qr_de_la_mesa', id],
    queryFn: () => qrDeLaMesa(id ?? ''),
    enabled: id !== null,
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
          <DialogTitle>{tituloDelQr(enPantalla)}</DialogTitle>
          <DialogDescription>
            Escanéalo con tu teléfono para abrir el pedido de la mesa.
          </DialogDescription>
        </DialogHeader>
        {consulta.isError ? (
          <Aviso tono="peligro" titulo="No pudimos leer el QR de esta mesa." />
        ) : consulta.data !== undefined && token === null ? (
          <Vacio
            tamano="compacto"
            titulo="Esta mesa todavía no tiene QR."
            explicacion="Genéralo en Portal QR → Mesas QR."
          />
        ) : imagen === null ? (
          <Esqueleto className="mx-auto aspect-square w-full max-w-80" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- un QR dibujado aquí (data:), fuera de `next/image`
          <img
            src={imagen}
            alt={tituloDelQr(enPantalla)}
            width={480}
            height={480}
            className="mx-auto aspect-square w-full max-w-80 rounded-lg"
            data-qr-de-la-mesa={enPantalla?.id}
          />
        )}
        <Button variant="outline" onClick={alCerrar}>
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
