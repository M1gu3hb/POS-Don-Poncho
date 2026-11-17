'use client';

import { useState } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { Megaphone } from 'lucide-react';

import { avisarCambioDelAparato, useTextoDelAparato } from '~/cliente/texto-del-aparato';
import { almacenDelAparato } from '~/restaurante/vista-de-solicitudes';
import {
  CLAVE_DEL_ANUNCIO,
  guardarAnuncioDelAparato,
  hayQuePreguntar,
  leerEleccionDelAparato,
  type QuienMira,
} from '~/voz/anuncio-del-aparato';

/**
 * LA PREGUNTA DE UNA SOLA VEZ (DP-22): la primera vez que un aparato abre Cocina con el puesto de
 * cocina sin haber elegido nunca, se le pregunta si esta pantalla anuncia las comandas. No tapa la
 * pantalla: es una tarjeta arriba, con dos botones grandes. La respuesta se guarda en el aparato
 * (la misma llave de Configuración → Este aparato) y no se vuelve a preguntar. Mientras no
 * conteste, la pantalla anuncia.
 */
export function PreguntaDelAnuncio({ puesto }: { readonly puesto: QuienMira }) {
  const texto = useTextoDelAparato(CLAVE_DEL_ANUNCIO);
  const elegido = leerEleccionDelAparato({ getItem: () => texto });
  const [noGuardo, setNoGuardo] = useState(false);

  if (!hayQuePreguntar({ puesto, elegido })) return null;

  const responder = (anuncia: boolean): void => {
    setNoGuardo(!guardarAnuncioDelAparato(almacenDelAparato(), anuncia));
    avisarCambioDelAparato();
  };

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-label="Esta pantalla anuncia las comandas"
      className="flex flex-col gap-(--espacio-3) p-(--espacio-4)"
    >
      <div className="flex items-start gap-(--espacio-3)">
        <Megaphone aria-hidden className="mt-0.5 size-5 shrink-0 text-primario" />
        <div className="flex flex-col gap-(--espacio-1)">
          <p className="font-semibold">¿Esta pantalla anuncia las comandas en voz?</p>
          <p className="max-w-prose text-sm text-texto-sutil">
            Si otra pantalla de esta estación ya las anuncia, elige No para que no se oigan doble.
            Mientras no contestes, anuncia.{' '}
            {/* En un solo renglón: el contrato de los textos lee el destino línea por línea. */}
            {'Después lo cambia la gerencia en Configuración → Este aparato.'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-(--espacio-3)">
        <Button
          type="button"
          size="lg"
          className="min-h-(--altura-tactil) grow sm:grow-0"
          onClick={() => {
            responder(true);
          }}
        >
          Sí, anunciar aquí
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-h-(--altura-tactil) grow sm:grow-0"
          onClick={() => {
            responder(false);
          }}
        >
          No, ya hay otra
        </Button>
      </div>
      {noGuardo ? (
        <Aviso tono="peligro" titulo="Este navegador no deja guardar ajustes" anuncio="alerta">
          Pasa en una ventana privada o con los datos del sitio bloqueados. Se queda como estaba.
        </Aviso>
      ) : null}
    </Superficie>
  );
}
