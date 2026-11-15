'use client';

import { useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso } from '@morphiqpos/ui/sistema';
import { Eye } from 'lucide-react';

import { useConfig } from '@/lib/ConfigContext';

import { armarDocumento } from '../imprimir-en-la-app.ts';
import { PAPEL } from '../termico/colores-del-papel.ts';
import { mapaComoPng } from '../termico/dibujar-elemento.ts';
import { emular } from '../termico/emulador.ts';
import type { PerfilDeImpresion } from '../termico/perfil.ts';
import { Casilla, SeccionDelLab } from './campos';
import { ticketDeEjemplo } from './ejemplos';
import { resultadoDeUnError } from './resultado-de-prueba.ts';
import { resumenDeLaVista, type ResumenDeLaVista } from './resumen-de-la-vista.ts';

/**
 * 8 · VISTA PREVIA DE IMPRESIÓN, SIN GASTAR PAPEL (DP-20 · laboratorio).
 *
 * Lado a lado: el ticket de ejemplo como se ve en pantalla y la imagen de 1 bit EXACTA que
 * saldría. Esa imagen no es una maqueta: se arma el trabajo con los valores del formulario, se
 * pasa por la impresora falsa (`emular`) y se pinta el papel que ella leyó de los bytes, con sus
 * cortes. No necesita impresora ni la app.
 */

type ConfiguracionDelNegocio = Record<string, unknown> | null | undefined;

interface VistaGenerada {
  readonly imagen: string;
  readonly resumen: ResumenDeLaVista;
  readonly avisos: readonly string[];
}

export function LabVistaPrevia({
  perfil,
}: {
  /** Las medidas del formulario (no hace falta impresora elegida), o `null` si no son válidas. */
  readonly perfil: PerfilDeImpresion | null;
}): ReactElement {
  const { config } = useConfig() as unknown as { config: ConfiguracionDelNegocio };
  const [conLogo, setConLogo] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [vista, setVista] = useState<VistaGenerada | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  async function generar(): Promise<void> {
    if (perfil === null || trabajando) return;
    setTrabajando(true);
    setFallo(null);
    try {
      const armado = await armarDocumento(
        perfil,
        [ticketDeEjemplo({ config, puntos: perfil.puntos, conLogo })],
        false,
      );
      const papel = emular(armado.bytes, perfil.puntos);
      setVista({
        imagen: mapaComoPng(papel),
        resumen: resumenDeLaVista(papel, armado.bytes.length, perfil.dpi),
        avisos: armado.avisos,
      });
    } catch (error: unknown) {
      setVista(null);
      setFallo(resultadoDeUnError(error).texto);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <SeccionDelLab
      titulo="8 · Vista previa de impresión"
      icono={<Eye aria-hidden className="size-5 shrink-0 text-primario" />}
      descripcion="Sin gastar papel: a la izquierda, el ticket como se ve en pantalla; a la derecha, los puntos exactos que saldrían, leídos de los bytes por una impresora falsa."
    >
      <div className="flex flex-wrap items-center gap-(--espacio-4)">
        <Button
          type="button"
          disabled={perfil === null || trabajando}
          cargando={trabajando}
          onClick={() => {
            void generar();
          }}
        >
          {trabajando ? 'Dibujando…' : vista === null ? 'Ver la vista previa' : 'Volver a dibujar'}
        </Button>
        <Casilla etiqueta="Con logo" marcada={conLogo} alCambiar={setConLogo} />
      </div>
      {perfil === null ? (
        <p className="text-sm text-texto-sutil">
          Corrige los datos marcados arriba para ver la vista previa.
        </p>
      ) : null}
      {fallo === null ? null : (
        <Aviso tono="peligro" titulo="No se pudo armar la vista previa">
          <p>{fallo}</p>
        </Aviso>
      )}

      <div className="grid gap-(--espacio-6) lg:grid-cols-2">
        <figure className="flex flex-col gap-(--espacio-2)">
          <figcaption className="text-sm font-medium">Como se ve en pantalla</figcaption>
          <div
            className="max-h-[70vh] overflow-auto rounded-md border border-borde p-(--espacio-2)"
            style={{ background: PAPEL }}
          >
            {perfil === null
              ? null
              : ticketDeEjemplo({ config, puntos: perfil.puntos, conLogo, soloLienzo: false })}
          </div>
        </figure>
        <figure className="flex flex-col gap-(--espacio-2)">
          <figcaption className="text-sm font-medium">Lo que saldría (1 bit)</figcaption>
          <div
            className="max-h-[70vh] overflow-auto rounded-md border border-borde p-(--espacio-2)"
            style={{ background: PAPEL }}
          >
            {vista === null ? (
              <p className="p-(--espacio-4) text-sm text-texto-sutil">
                Toca «Ver la vista previa» para dibujarla.
              </p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- es un data: URL del lienzo, no una imagen de red
              <img
                src={vista.imagen}
                alt="Los puntos exactos que saldrían en el papel, en blanco y negro"
                className="block w-full"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
          </div>
        </figure>
      </div>

      {vista === null ? null : (
        <div className="flex flex-col gap-(--espacio-2)" role="status">
          <ul className="list-disc pl-(--espacio-5) text-sm">
            <li>{vista.resumen.medidas}</li>
            <li>{vista.resumen.bytes}</li>
            <li>{vista.resumen.cortes}</li>
            {vista.resumen.cajon === null ? null : <li>{vista.resumen.cajon}</li>}
          </ul>
          {vista.avisos.length === 0 ? (
            <p className="text-sm text-texto-sutil">El dibujo no tuvo avisos.</p>
          ) : (
            <Aviso tono="atencion" titulo="Avisos del dibujo">
              <ul className="list-disc pl-(--espacio-5)">
                {vista.avisos.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            </Aviso>
          )}
        </div>
      )}
    </SeccionDelLab>
  );
}
