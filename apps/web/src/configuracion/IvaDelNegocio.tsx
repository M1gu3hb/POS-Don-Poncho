'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Switch } from '@morphiqpos/ui/primitivas/switch';
import { Aviso, Esqueleto, Superficie } from '@morphiqpos/ui/sistema';
import { Percent } from 'lucide-react';

import { consultarPuente, invocarComando } from '~/cliente/api';

import {
  CLAVE_DEL_IVA,
  OPCIONES_DE_IVA,
  entradaDelIva,
  explicacionDelIva,
  ivaConIncluido,
  ivaConTasa,
  ivaIgual,
  ivaLeido,
  tasaConocida,
  tasaEnTexto,
  type IvaDelNegocio as Iva,
} from './iva-formulario.ts';
import { useCambiosSinGuardar } from '~/configuracion/cambios-sin-guardar';

/**
 * CONFIGURACIÓN → VENTAS Y COBRO · «IVA» (DP-21 · Bloque 1).
 *
 * Sin IVA, 8 % o 16 %; con IVA, si los precios de la carta ya lo incluyen. Lee y guarda la misma
 * clave con la que el servidor cobra (`impuesto`), por `configuracion.fijar_impuesto`: lo
 * cambian el dueño o el administrador (el servidor lo exige) y queda en la auditoría. Los demás
 * lo ven y no lo editan.
 *
 * Con «Sin IVA», ningún ticket, precuenta, corte ni reporte lo menciona: cada papel pinta el
 * renglón sólo si el IVA de lo que enseña no es 0 (`venta/se-menciona-el-iva.ts`).
 */
export function IvaDelNegocio({ puedeCambiar }: { readonly puedeCambiar: boolean }): ReactElement {
  const consultas = useQueryClient();
  const titulo = useId();
  const idIncluido = useId();
  const guardado = useQuery({
    queryKey: CLAVE_DEL_IVA,
    queryFn: async () => {
      const [configuracion] = await consultarPuente<{ impuesto?: unknown }>(
        'ConfiguracionNegocio',
        { limite: 1 },
      );
      return ivaLeido(configuracion);
    },
    staleTime: 60_000,
  });
  const [elegido, setElegido] = useState<Iva | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const actual = elegido ?? guardado.data;
  const hayCambios =
    actual !== undefined && guardado.data !== undefined && !ivaIgual(actual, guardado.data);
  // DP-21 · Bloque 21: salir con esto sin guardar avisa.
  useCambiosSinGuardar('iva', hayCambios);

  async function guardar(): Promise<void> {
    if (guardando || actual === undefined) return;
    const entrada = entradaDelIva(actual);
    if (entrada === null) {
      setFallo('Elige una de las tres: sin IVA, 8 % o 16 %.');
      return;
    }
    setGuardando(true);
    setFallo(null);
    setListo(false);
    try {
      await invocarComando('/api/configuracion/fijar-impuesto', entrada);
      await consultas.invalidateQueries({ queryKey: CLAVE_DEL_IVA });
      await consultas.invalidateQueries({ queryKey: ['config'] });
      setElegido(null);
      setListo(true);
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudo guardar el IVA.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={titulo}
      className="mt-(--espacio-4) flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex flex-col gap-(--espacio-1)">
        <h3 id={titulo} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
          <Percent aria-hidden className="size-5 shrink-0 text-primario" />
          IVA
        </h3>
        <p className="max-w-prose text-sm text-texto-sutil">
          Con esto se cobra cada cuenta desde que lo guardas. Las cuentas ya cobradas no cambian.
        </p>
      </div>
      {actual === undefined ? (
        guardado.isError ? (
          <Aviso tono="peligro" titulo="No se pudo leer el IVA guardado.">
            <p>Recarga la página; si sigue igual, avisa a tu proveedor.</p>
          </Aviso>
        ) : (
          <Esqueleto className="h-(--altura-control) w-full max-w-md rounded-lg" />
        )
      ) : (
        <form
          className="flex flex-col gap-(--espacio-4)"
          onSubmit={(evento) => {
            evento.preventDefault();
            void guardar();
          }}
        >
          <div
            role="radiogroup"
            aria-labelledby={titulo}
            className="flex flex-wrap gap-(--espacio-2)"
          >
            {OPCIONES_DE_IVA.map((opcion) => {
              const marcada = actual.puntosBase === opcion.puntosBase;
              return (
                <Button
                  key={opcion.puntosBase}
                  type="button"
                  size="lg"
                  role="radio"
                  aria-checked={marcada}
                  variant={marcada ? 'default' : 'outline'}
                  disabled={!puedeCambiar || guardando}
                  className="min-w-28"
                  onClick={() => {
                    setListo(false);
                    setFallo(null);
                    setElegido(ivaConTasa(actual, opcion.puntosBase));
                  }}
                >
                  {opcion.nombre}
                </Button>
              );
            })}
          </div>
          {tasaConocida(actual.puntosBase) ? null : (
            <Aviso tono="atencion" titulo={`Hoy se cobra con ${tasaEnTexto(actual.puntosBase)}.`}>
              <p>Esa tasa viene de antes. Para cambiarla, elige una de las tres y guarda.</p>
            </Aviso>
          )}
          {actual.puntosBase > 0 ? (
            <div className="flex items-center justify-between gap-(--espacio-3)">
              <label htmlFor={idIncluido} className="text-sm font-medium">
                Los precios ya incluyen el IVA
              </label>
              <Switch
                id={idIncluido}
                checked={actual.incluidoEnPrecio}
                disabled={!puedeCambiar || guardando}
                onCheckedChange={(incluido) => {
                  setListo(false);
                  setElegido(ivaConIncluido(actual, incluido));
                }}
              />
            </div>
          ) : null}
          <p className="max-w-prose text-sm" data-explicacion-del-iva>
            {explicacionDelIva(actual)}
          </p>
          {puedeCambiar ? (
            <div className="flex flex-wrap items-center gap-(--espacio-3)">
              <Button
                type="submit"
                variant="outline"
                disabled={guardando || !hayCambios}
                cargando={guardando}
              >
                Guardar
              </Button>
              {listo ? (
                <p role="status" className="text-sm font-medium">
                  ✓ Guardado
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-texto-sutil">Lo cambian el dueño o el administrador.</p>
          )}
        </form>
      )}
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </Superficie>
  );
}
