'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';
import { Input } from '@morphiqpos/ui/primitivas/input';
import { Switch } from '@morphiqpos/ui/primitivas/switch';
import { Aviso, EsqueletoDeLista, Vacio } from '@morphiqpos/ui/sistema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { useState } from 'react';

import { consultarPuente, invocarComando } from '~/cliente/api';

import { ordenarParaAgotar, type Platillo } from './agotados-orden.ts';

/**
 * DP-15 · «AGOTADOS DEL DÍA»: el botón de la cocina (y de Productos) para decir que algo se acabó.
 *
 * Un interruptor por platillo, con buscador. Marcado, el mesero lo ve «Agotado hoy» y no lo puede
 * agregar, el portal QR lo enseña apagado y el servidor lo niega en todos los caminos
 * (`catalogo.marcar_agotado`, `catalogo/agotado.ts`). Al empezar el día siguiente vuelve solo: nadie
 * tiene que acordarse de desmarcarlo. Lo marcan la cocina, la gerente, el administrador y el dueño.
 */

const CLAVE = ['agotados-del-dia'] as const;

export function AgotadosDelDia() {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const cliente = useQueryClient();
  const platillos = useQuery({
    queryKey: CLAVE,
    queryFn: () =>
      consultarPuente<Platillo>('ProductoTerminado', { filtro: { activo: true }, limite: 500 }),
    enabled: abierto,
  });
  const lista = ordenarParaAgotar(platillos.data ?? [], busqueda);
  const cuantos = (platillos.data ?? []).filter((p) => p.agotado_hoy === true).length;

  async function cambiar(platillo: Platillo, agotado: boolean): Promise<void> {
    setEnCurso(platillo.id);
    setFallo(null);
    try {
      await invocarComando('/api/catalogo/marcar-agotado', { productoId: platillo.id, agotado });
      await cliente.invalidateQueries({ queryKey: CLAVE });
      // El mesero de ESTE aparato también lo ve al momento (los demás, en su siguiente lectura).
      await cliente.invalidateQueries({ queryKey: ['productos_pos'] });
    } catch (error: unknown) {
      setFallo(error instanceof Error ? error.message : 'No se pudo cambiar. Intenta otra vez.');
    } finally {
      setEnCurso(null);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setBusqueda('');
          setFallo(null);
          setAbierto(true);
        }}
      >
        <Ban aria-hidden />
        Agotados
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agotados del día</DialogTitle>
            <DialogDescription>
              Lo que marques ya no se puede pedir hoy (ni el mesero ni desde el QR). Mañana vuelve
              solo.
              {cuantos > 0 ? ` Agotados ahora: ${String(cuantos)}.` : ''}
            </DialogDescription>
          </DialogHeader>
          {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
          <Input
            type="search"
            placeholder="Buscar platillo…"
            aria-label="Buscar platillo"
            value={busqueda}
            onChange={(evento) => {
              setBusqueda(evento.target.value);
            }}
          />
          {platillos.isPending ? (
            <EsqueletoDeLista filas={4} />
          ) : platillos.isError ? (
            <Aviso tono="peligro" titulo="No se pudo leer el menú. Cierra y vuelve a abrir." />
          ) : lista.length === 0 ? (
            <Vacio
              tamano="compacto"
              icono={<Ban />}
              titulo="Ningún platillo coincide con la búsqueda."
            />
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-(--espacio-1) overflow-y-auto">
              {lista.map((platillo) => {
                const agotado = platillo.agotado_hoy === true;
                const id = `agotado-${platillo.id}`;
                return (
                  <li
                    key={platillo.id}
                    className="flex items-center justify-between gap-(--espacio-2) py-(--espacio-1)"
                  >
                    <label htmlFor={id} className={agotado ? 'font-semibold text-peligro' : ''}>
                      {platillo.nombre}
                      {agotado ? ' · agotado hoy' : ''}
                    </label>
                    <Switch
                      id={id}
                      checked={agotado}
                      disabled={enCurso !== null}
                      aria-label={`${platillo.nombre}: agotado hoy`}
                      onCheckedChange={(valor) => {
                        void cambiar(platillo, valor);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
