'use client';

import { useId, useState } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { Play } from 'lucide-react';

import { speakSample } from '@/lib/voiceAlert';
import { fraseDeLaComandaDeEjemplo } from '~/voz/comanda-de-ejemplo';

/**
 * «ASÍ SE OYE UNA COMANDA» (DP-21 · Bloque 8), en Configuración → Sonidos: una comanda de ejemplo
 * con cantidades, una opción y un peso, dicha con la misma frase que usa la cocina. Suena aunque
 * la voz de Cocina esté apagada: quien pulsa quiere oírla. El primer `speak` va en la misma pila
 * que el toque (sin `await`), como pide el navegador.
 */
export function PruebaDeLaVozDeComandas() {
  const titulo = useId();
  const [noSono, setNoSono] = useState(false);
  const ejemplo = fraseDeLaComandaDeEjemplo();

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={titulo}
      className="flex flex-col gap-(--espacio-3) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <h3 id={titulo} className="text-lg font-semibold">
        Así se oye una comanda
      </h3>
      <p className="max-w-prose text-sm text-texto-sutil">
        Cocina dice primero cuántos de cada platillo, junta los renglones iguales y lee el peso y
        las opciones. «{ejemplo}»
      </p>
      <Button
        variant="outline"
        className="self-start"
        data-sonido="ninguno"
        onClick={() => {
          setNoSono(!speakSample(ejemplo));
        }}
      >
        <Play aria-hidden />
        Así se oye una comanda
      </Button>
      {noSono ? (
        <Aviso tono="atencion" titulo="Este navegador no pudo hablar">
          Toca la pantalla una vez y vuelve a probar. Revisa que el aparato no esté en silencio.
        </Aviso>
      ) : null}
    </Superficie>
  );
}
