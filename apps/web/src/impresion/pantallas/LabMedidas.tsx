'use client';

import type { ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Ruler, Scissors } from 'lucide-react';

import { CORTES, type Corte } from '../termico/escpos.ts';
import { PUNTOS_POR_PAPEL } from '../termico/perfil.ts';
import { CampoDeElegir, CampoDeTexto, SeccionDelLab, type OpcionDeElegir } from './campos';
import { conPapel } from './cambios-del-formulario.ts';
import { poniendo, type PropsDelFormulario } from './lab-tipos.ts';
import { ayudaDelCorte, NOMBRES_DE_CORTES, OPCIONES_DE_LENGUAJE } from './nombres.ts';

/**
 * 3 · LENGUAJE Y MEDIDAS y 4 · EL CORTE (DP-20 · laboratorio). Valen con o sin la app: son lo que
 * decide cómo sale el papel, y la vista previa los usa.
 */

const LENGUAJES: readonly OpcionDeElegir[] = OPCIONES_DE_LENGUAJE.map((opcion) => ({
  valor: opcion.valor,
  nombre: opcion.nota === undefined ? opcion.nombre : `${opcion.nombre} — ${opcion.nota}`,
  desactivada: !opcion.disponible,
}));

const PAPELES: readonly OpcionDeElegir[] = [
  { valor: '80', nombre: '80 mm' },
  { valor: '58', nombre: '58 mm' },
];

const DPIS: readonly OpcionDeElegir[] = [
  { valor: '203', nombre: '203 dpi (8 puntos por mm)' },
  { valor: '180', nombre: '180 dpi' },
];

export function LabMedidas({ formulario, errores, actualizar }: PropsDelFormulario): ReactElement {
  const usuales = PUNTOS_POR_PAPEL[formulario.papelMm];
  return (
    <SeccionDelLab
      titulo="3 · Lenguaje y medidas"
      icono={<Ruler aria-hidden className="size-5 shrink-0 text-primario" />}
      descripcion="Imprimir por imagen es lo recomendado: sale idéntico a la pantalla. La regla de calibración dice cuántos puntos imprime de verdad esta impresora."
    >
      <div className="grid gap-(--espacio-4) sm:grid-cols-2 lg:grid-cols-3">
        <CampoDeElegir
          etiqueta="Lenguaje"
          valor={formulario.lenguaje}
          opciones={LENGUAJES}
          error={errores.lenguaje}
          alCambiar={(valor) => {
            const elegido = OPCIONES_DE_LENGUAJE.find((o) => o.valor === valor && o.disponible);
            if (elegido !== undefined) actualizar(poniendo({ lenguaje: elegido.valor }));
          }}
        />
        <CampoDeElegir
          etiqueta="Papel"
          valor={String(formulario.papelMm)}
          opciones={PAPELES}
          alCambiar={(valor) => {
            actualizar((f) => conPapel(f, valor === '58' ? 58 : 80));
          }}
        />
        <CampoDeElegir
          etiqueta="Resolución"
          valor={String(formulario.dpi)}
          opciones={DPIS}
          alCambiar={(valor) => {
            actualizar(poniendo({ dpi: valor === '180' ? 180 : 203 }));
          }}
        />
      </div>

      <div className="flex flex-col gap-(--espacio-2)">
        <CampoDeTexto
          etiqueta="Puntos de ancho"
          numerico
          valor={formulario.puntos}
          error={errores.puntos}
          ayuda="Los de siempre de este rollo, o el valor que midas con la regla."
          alCambiar={(puntos) => {
            actualizar(poniendo({ puntos }));
          }}
        />
        <div className="flex flex-wrap gap-(--espacio-2)" role="group" aria-label="Puntos usuales">
          {usuales.map((valor) => (
            <Button
              key={valor}
              type="button"
              size="sm"
              variant={formulario.puntos === String(valor) ? 'default' : 'outline'}
              aria-pressed={formulario.puntos === String(valor)}
              className="min-h-(--altura-control)"
              onClick={() => {
                actualizar(poniendo({ puntos: String(valor) }));
              }}
            >
              {valor} puntos
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-(--espacio-4) sm:grid-cols-2 lg:grid-cols-4">
        <CampoDeTexto
          etiqueta="Umbral"
          numerico
          valor={formulario.umbral}
          error={errores.umbral}
          ayuda="Más alto, la letra sale más gruesa."
          alCambiar={(umbral) => {
            actualizar(poniendo({ umbral }));
          }}
        />
        <CampoDeTexto
          etiqueta="Filas por franja"
          numerico
          valor={formulario.franjaFilas}
          error={errores.franjaFilas}
          ayuda="Menos filas, menos búfer en la impresora."
          alCambiar={(franjaFilas) => {
            actualizar(poniendo({ franjaFilas }));
          }}
        />
        <CampoDeTexto
          etiqueta="Bloque (bytes)"
          numerico
          valor={formulario.bloqueBytes}
          error={errores.bloqueBytes}
          ayuda="Cuántos bytes se mandan de golpe."
          alCambiar={(bloqueBytes) => {
            actualizar(poniendo({ bloqueBytes }));
          }}
        />
        <CampoDeTexto
          etiqueta="Pausa entre bloques (ms)"
          numerico
          valor={formulario.pausaMs}
          error={errores.pausaMs}
          ayuda="Súbela si la impresora pierde renglones."
          alCambiar={(pausaMs) => {
            actualizar(poniendo({ pausaMs }));
          }}
        />
      </div>
    </SeccionDelLab>
  );
}

const CORTES_A_ELEGIR: readonly OpcionDeElegir[] = CORTES.map((corte) => ({
  valor: corte,
  nombre: NOMBRES_DE_CORTES[corte],
}));

function comoCorte(valor: string): Corte | null {
  return CORTES.find((corte) => corte === valor) ?? null;
}

export function LabCorte({ formulario, errores, actualizar }: PropsDelFormulario): ReactElement {
  return (
    <SeccionDelLab
      titulo="4 · El corte"
      icono={<Scissors aria-hidden className="size-5 shrink-0 text-primario" />}
      descripcion="Cómo y cuándo corta la impresora, y cuántas líneas avanza antes para no comerse el final del ticket."
    >
      <div className="grid gap-(--espacio-4) sm:grid-cols-2">
        <CampoDeElegir
          etiqueta="Corte"
          valor={formulario.corte}
          opciones={CORTES_A_ELEGIR}
          ayuda={ayudaDelCorte(formulario.corte)}
          alCambiar={(valor) => {
            const corte = comoCorte(valor);
            if (corte !== null) actualizar(poniendo({ corte }));
          }}
        />
        <CampoDeTexto
          etiqueta="Líneas antes del corte"
          numerico
          valor={formulario.lineasAntesDelCorte}
          error={errores.lineasAntesDelCorte}
          ayuda="De 0 a 20."
          alCambiar={(lineasAntesDelCorte) => {
            actualizar(poniendo({ lineasAntesDelCorte }));
          }}
        />
      </div>
    </SeccionDelLab>
  );
}
