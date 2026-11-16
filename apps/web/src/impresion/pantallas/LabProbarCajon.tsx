'use client';

import { useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso } from '@morphiqpos/ui/sistema';
import { Banknote, Check, CircleCheck, X } from 'lucide-react';

import type { Destino } from '../termico/perfil.ts';
import type { MorphiqApp } from '../puente/contrato.ts';
import { aBase64, bytesDelCajon } from '../termico/trabajo.ts';
import { BotonDePrueba } from './BotonDePrueba';
import { pulsoDelFormulario } from './formulario.ts';
import type { PropsDelFormulario } from './lab-tipos.ts';
import { conElCajonApagado, conLaRespuestaDelCajon } from './prueba-del-cajon.ts';
import { resultadoDelPuente } from './resultado-de-prueba.ts';
import { useCorredorDePruebas } from './use-pruebas.ts';

/**
 * «PROBAR CAJÓN» Y «¿SE ABRIÓ EL CAJÓN?» (DP-21 · Bloque 7).
 *
 * El interruptor «Este aparato tiene cajón de dinero» sólo se enciende aquí: se manda el pulso de
 * prueba y la persona confirma con «Sí». Con «No» queda apagado y se dice qué revisar. Una prueba
 * no pasa por el servidor de caja ni queda anotada en ningún turno.
 */

/** Con qué pulso y hacia qué impresora se probó: si algo cambia, lo confirmado ya no vale. */
function firmaDeLaPrueba(destino: Destino, bytes: Uint8Array): string {
  return `${JSON.stringify(destino)}|${aBase64(bytes)}`;
}

export function LabProbarCajon({
  app,
  destino,
  formulario,
  actualizar,
}: PropsDelFormulario & {
  readonly app: MorphiqApp;
  /** La impresora del formulario, o `null` si todavía no está completa. */
  readonly destino: Destino | null;
}): ReactElement {
  const corredor = useCorredorDePruebas();
  const [probado, setProbado] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const pulso = pulsoDelFormulario(formulario);
  const firma =
    pulso.ok && destino !== null ? firmaDeLaPrueba(destino, bytesDelCajon(pulso.cajon)) : null;
  const preguntando = firma !== null && probado === firma && !formulario.tieneCajon;
  const razon =
    destino === null
      ? 'Completa la impresora y los datos marcados arriba para probar.'
      : !pulso.ok
        ? 'Corrige el pulso del cajón (marcado arriba) para probar.'
        : undefined;

  function responder(seAbrio: boolean): void {
    actualizar((previo) => conLaRespuestaDelCajon(previo, seAbrio).formulario);
    setAviso(conLaRespuestaDelCajon(formulario, seAbrio).mensaje);
    setProbado(null);
  }

  return (
    <div className="flex flex-col gap-(--espacio-3)">
      <BotonDePrueba
        etiqueta="Probar cajón"
        icono={<Banknote aria-hidden className="size-4" />}
        estado={corredor.estados['cajon']}
        ocupado={corredor.ocupado}
        razon={razon}
        alPulsar={() => {
          if (destino === null || !pulso.ok || firma === null) return;
          setAviso('');
          void corredor.correr('cajon', async () => {
            const resultado = resultadoDelPuente(
              await app.abrirCajon({ destino, base64: aBase64(bytesDelCajon(pulso.cajon)) }),
            );
            if (resultado.ok) setProbado(firma);
            return resultado;
          });
        }}
      />
      {preguntando ? (
        <fieldset className="flex flex-col gap-(--espacio-2) rounded-lg border border-borde p-(--espacio-4)">
          <legend className="px-(--espacio-1) text-sm font-semibold">¿Se abrió el cajón?</legend>
          <p className="text-sm text-texto-sutil">
            Se mandó la señal. Mira el cajón: si saltó, di que sí; sólo así este aparato queda con
            cajón.
          </p>
          <div className="flex flex-wrap gap-(--espacio-2)">
            <Button
              type="button"
              onClick={() => {
                responder(true);
              }}
            >
              <Check aria-hidden className="size-4" />
              Sí, se abrió
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                responder(false);
              }}
            >
              <X aria-hidden className="size-4" />
              No se abrió
            </Button>
          </div>
        </fieldset>
      ) : null}
      {aviso === '' ? null : (
        <Aviso tono="atencion" titulo="El cajón no abrió: este aparato sigue SIN cajón">
          <p>{aviso}</p>
        </Aviso>
      )}
      {formulario.tieneCajon ? (
        <div className="flex flex-wrap items-center gap-(--espacio-3)">
          <p role="status" className="flex items-center gap-(--espacio-1) text-sm font-medium">
            <CircleCheck aria-hidden className="size-4 shrink-0 text-exito" />
            Este aparato tiene cajón de dinero
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              actualizar(conElCajonApagado);
            }}
          >
            Quitar el cajón
          </Button>
        </div>
      ) : (
        <p role="status" className="text-sm text-texto-sutil">
          Este aparato todavía no tiene cajón: sin él no aparece «Abrir cajón» ni se abre al cobrar.
        </p>
      )}
    </div>
  );
}
