'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Label } from '@morphiqpos/ui/primitivas/label';
import { Aviso, Esqueleto, Superficie } from '@morphiqpos/ui/sistema';
import { ArrowUpFromLine } from 'lucide-react';

import { invocarComando } from '~/cliente/api';
import { CampoDePesos } from '~/venta/CampoDePesos';
import { aCentavos } from '~/venta/importe-tecleado';
import { CLAVE_DEL_UMBRAL_DE_RETIRO } from '~/venta/pin-en-retiros';
import { useUmbralDeRetiro } from '~/venta/use-umbral-de-retiro';

/**
 * CONFIGURACIÓN → CAJA · «Pedir PIN de gerente en retiros mayores a $____» (DP-16, encargo 1.4).
 *
 * Vacío = no se pide PIN en ningún retiro (el valor por omisión). Con un monto, el retiro de la
 * cajera que lo pasa lleva la autorización de un gerente, administrador o dueño. Lo cambian sólo
 * el dueño o el administrador (el servidor lo exige) y queda en la auditoría, antes y después.
 */

/** El monto como se teclea en el campo: «1500» o «800.50»; vacío si no hay umbral. */
function comoSeTeclea(centavos: number | null): string {
  if (centavos === null) return '';
  const enteros = Math.trunc(centavos / 100);
  const resto = centavos % 100;
  return resto === 0 ? String(enteros) : `${String(enteros)}.${String(resto).padStart(2, '0')}`;
}

export function UmbralDeRetiro() {
  const consultas = useQueryClient();
  const guardado = useUmbralDeRetiro();
  const idTitulo = useId();
  // Lo que la persona tecleó; mientras no teclee nada, se muestra lo guardado.
  const [tecleado, setTecleado] = useState<string | null>(null);
  const texto = tecleado ?? comoSeTeclea(guardado ?? null);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function guardar(): Promise<void> {
    if (guardando) return;
    const centavos = aCentavos(texto);
    if (centavos === null) {
      setFallo('No entiendo ese monto. Escríbelo en pesos, por ejemplo 1,500 o 800.50.');
      return;
    }
    setGuardando(true);
    setFallo(null);
    try {
      await invocarComando('/api/caja/fijar-umbral-de-retiro', {
        umbralCentavos: centavos === 0 ? null : centavos,
      });
      await consultas.invalidateQueries({ queryKey: CLAVE_DEL_UMBRAL_DE_RETIRO });
      setTecleado(null);
      await consultas.invalidateQueries({ queryKey: ['config'] });
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Superficie
      como="section"
      relleno={0}
      aria-labelledby={idTitulo}
      className="flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
    >
      <div className="flex flex-col gap-(--espacio-1)">
        <h3 id={idTitulo} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
          <ArrowUpFromLine aria-hidden className="size-5 shrink-0 text-primario" />
          Pedir PIN de gerente en retiros mayores a
        </h3>
        <p className="max-w-prose text-sm text-texto-sutil">
          Si la cajera retira más de este monto, un gerente, administrador o dueño teclea su PIN en
          su pantalla; sirve una sola vez y para ese monto, y el corte dice quién lo autorizó.
          Déjalo vacío para no pedir PIN en los retiros.
        </p>
      </div>
      {guardado === undefined ? (
        <Esqueleto className="h-(--altura-control) w-48 rounded-lg" />
      ) : (
        <form
          className="flex items-end gap-(--espacio-2)"
          onSubmit={(evento) => {
            evento.preventDefault();
            void guardar();
          }}
        >
          <div className="flex w-48 flex-col gap-(--espacio-1)">
            <Label htmlFor="umbral-de-retiro">Monto en pesos</Label>
            <CampoDePesos
              id="umbral-de-retiro"
              value={texto}
              placeholder="vacío = no se pide"
              onChange={(evento) => {
                setTecleado(evento.target.value);
              }}
            />
          </div>
          <Button type="submit" variant="outline" disabled={guardando} cargando={guardando}>
            Guardar
          </Button>
        </form>
      )}
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </Superficie>
  );
}
