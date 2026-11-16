'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Aviso } from '@morphiqpos/ui/sistema';

import { useConfig } from '@/lib/ConfigContext';

import { invocarComando } from '~/cliente/api';

import {
  hayCambios,
  hayNombresRepetidos,
  nombrePorOmision,
  nombresGuardados,
  nombresParaGuardar,
} from './nombres-de-cajas';

/**
 * EL NOMBRE DE CADA CAJA (DP-21 · Bloque 5 · M1 y O9). Configuración → Caja.
 *
 * Lo que vio Miguel: «las cajas se suman (Caja 28, Caja 32, Caja 37…)». El nombre era el del
 * aparato. Ahora la caja es un lugar de la sucursal —tantos como «Cajas abiertas a la vez»— y aquí
 * el dueño o el administrador le pone nombre a cada uno («Caja principal», «Caja barra»). Ese
 * nombre es el que sale en el ticket, el corte y los Registros, y no cambia por el aparato que la
 * abra ni al trasladarla. El de los aparatos se pone en Configuración → Este aparato.
 */
interface ConfiguracionDelNegocio {
  readonly config: { readonly nombres_de_cajas?: unknown };
}

export function NombresDeLasCajas({ lugares }: { readonly lugares: number }): ReactElement {
  const consultas = useQueryClient();
  const idTitulo = useId();
  const idCampos = useId();
  const { config } = useConfig() as unknown as ConfiguracionDelNegocio;
  const guardados = nombresGuardados(config.nombres_de_cajas, lugares);
  const [escritos, setEscritos] = useState<readonly string[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const nombres = Array.from(
    { length: guardados.length },
    (_, i) => (escritos ?? guardados)[i] ?? '',
  );
  const repetidos = hayNombresRepetidos(nombres);
  const cambiado = hayCambios(nombres, guardados);

  async function guardar(): Promise<void> {
    if (guardando || !cambiado || repetidos) return;
    setGuardando(true);
    setFallo(null);
    setListo(false);
    try {
      await invocarComando('/api/caja/nombrar-cajas', { nombres: nombresParaGuardar(nombres) });
      await consultas.invalidateQueries({ queryKey: ['config'] });
      await consultas.invalidateQueries({ queryKey: ['cortes_caja_estado'] });
      setEscritos(null);
      setListo(true);
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudieron guardar los nombres.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-(--espacio-2)">
      <h4 id={idTitulo} className="text-base font-semibold">
        El nombre de cada caja
      </h4>
      <p className="max-w-prose text-sm text-texto-sutil">
        Así sale en el ticket, el corte y los Registros. No cambia por el aparato que la abra ni al
        trasladarla. Sin nombre se llama «Caja 1», «Caja 2».
      </p>
      <ul aria-labelledby={idTitulo} className="flex flex-col gap-(--espacio-3)">
        {nombres.map((nombre, i) => {
          const lugar = i + 1;
          const idCampo = `${idCampos}-${String(lugar)}`;
          return (
            <li key={lugar} className="flex flex-col gap-(--espacio-1)">
              <label htmlFor={idCampo} className="text-sm font-medium">
                {nombrePorOmision(lugar)}
              </label>
              <Input
                id={idCampo}
                value={nombre}
                maxLength={40}
                placeholder={lugar === 1 ? 'Caja principal' : nombrePorOmision(lugar)}
                onChange={(e) => {
                  const nuevos = [...nombres];
                  nuevos[i] = e.target.value;
                  setEscritos(nuevos);
                  setListo(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void guardar();
                }}
              />
            </li>
          );
        })}
      </ul>
      {repetidos ? <Aviso tono="atencion" titulo="Dos cajas no pueden llamarse igual." /> : null}
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
      <div className="flex items-center gap-(--espacio-3)">
        <Button
          type="button"
          variant="outline"
          disabled={!cambiado || repetidos || guardando}
          onClick={() => {
            void guardar();
          }}
        >
          {guardando ? 'Guardando…' : 'Guardar nombres'}
        </Button>
        {listo ? (
          <span role="status" className="text-sm text-texto-sutil">
            Guardado.
          </span>
        ) : null}
      </div>
    </div>
  );
}
