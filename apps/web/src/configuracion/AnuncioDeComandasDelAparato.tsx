'use client';

import { useId, useState } from 'react';

import { Switch } from '@morphiqpos/ui/primitivas/switch';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { Megaphone } from 'lucide-react';

import { avisarCambioDelAparato, useTextoDelAparato } from '~/cliente/texto-del-aparato';
import { almacenDelAparato } from '~/restaurante/vista-de-solicitudes';
import {
  anunciaEsteAparato,
  CLAVE_DEL_ANUNCIO,
  guardarAnuncioDelAparato,
  leerEleccionDelAparato,
  type QuienMira,
  reglaDeEsteAparato,
} from '~/voz/anuncio-del-aparato';

/**
 * «ESTA PANTALLA ANUNCIA LAS COMANDAS» (DP-21 · Bloque 8), en Configuración → Este aparato y en el
 * ajuste de sonido del teléfono de cocina. Vive en el aparato y no en el negocio: con dos
 * pantallas en la misma estación, la principal anuncia y la secundaria se queda callada. Se guarda
 * al tocar, sin botón.
 *
 * DP-22 · Dice la verdad de ESE aparato: si nunca eligió, lo que vale por el puesto de quien lo usa
 * (`puesto`; el teléfono de cocina pasa el suyo), y una línea con la regla.
 */
export function AnuncioDeComandasDelAparato({ puesto }: { readonly puesto: QuienMira }) {
  const texto = useTextoDelAparato(CLAVE_DEL_ANUNCIO);
  const elegido = leerEleccionDelAparato({ getItem: () => texto });
  const anuncia = anunciaEsteAparato({ puesto, elegido });
  const [noGuardo, setNoGuardo] = useState(false);
  const titulo = useId();

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-label="Esta pantalla anuncia las comandas"
      className="flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex items-start justify-between gap-(--espacio-4)">
        <div className="flex flex-col gap-(--espacio-1)">
          <h3 id={titulo} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
            <Megaphone aria-hidden className="size-5 shrink-0 text-primario" />
            Esta pantalla anuncia las comandas
          </h3>
          <p className="max-w-prose text-sm text-texto-sutil">
            Encendido, esta pantalla dice cada comanda nueva de su estación en voz alta. Si hay dos
            pantallas en la misma estación, déjalo encendido en la principal y apágalo en la
            secundaria: así cada comanda se oye una sola vez. Las comandas se siguen viendo igual.
          </p>
          <p className="max-w-prose text-sm text-texto-sutil">
            {reglaDeEsteAparato({ puesto, elegido })}
          </p>
        </div>
        <Switch
          checked={anuncia}
          aria-labelledby={titulo}
          onCheckedChange={(valor) => {
            setNoGuardo(!guardarAnuncioDelAparato(almacenDelAparato(), valor));
            avisarCambioDelAparato();
          }}
        />
      </div>
      {noGuardo ? (
        <Aviso tono="peligro" titulo="Este navegador no deja guardar ajustes" anuncio="alerta">
          Pasa en una ventana privada o con los datos del sitio bloqueados. Se queda como estaba.
        </Aviso>
      ) : null}
    </Superficie>
  );
}
