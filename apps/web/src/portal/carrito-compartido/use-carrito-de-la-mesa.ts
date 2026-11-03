'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import {
  agregarAlCarrito,
  enviarElCarrito,
  leerElCarrito,
  llamarAlMesero,
  quitarDelCarrito,
  type ResultadoDelLlamado,
} from './api-del-carrito';
import {
  AVISO_DEL_VACIADO,
  dispositivoDelTelefono,
  envioDeOtroTelefono,
  olvidarDispositivo,
  recordarDispositivo,
  reglaDelError,
  vaciadoNuevo,
  type AperturaDeLaMesa,
  type EstadoDelCarrito,
  type ItemDelCarrito,
  type ResultadoDelEnvio,
} from './carrito-de-la-mesa';

/** Cada cuánto mira el teléfono el carrito de su mesa. */
const SONDEO_MS = 2_500;

export interface CarritoDeLaMesa {
  /** `null` mientras carga, o si el negocio no acepta pedidos desde el teléfono. */
  readonly estado: EstadoDelCarrito | null;
  /**
   * DP-12.2 · La última lectura falló: el teléfono enseña «Sin conexión, reintentando» y sigue
   * con lo último que vio (el sondeo vuelve a intentar solo).
   */
  readonly sinConexion: boolean;
  /** DP-12.2 · «Llamar a mi mesero para confirmar». */
  llamar(): Promise<ResultadoDelLlamado>;
  agregar(item: ItemDelCarrito): Promise<void>;
  quitar(lineaId: string): Promise<void>;
  enviar(datos: {
    readonly confirmado: boolean;
    readonly notaGeneral: string;
    /** DP-13.3 · Con la mesa cerrada: abrirla y enviar en el mismo comando. */
    readonly apertura?: AperturaDeLaMesa;
  }): Promise<ResultadoDelEnvio>;
}

/**
 * El sondeo trae el id que el servidor le emitió a este teléfono (DP-13.3): se guarda para mandarlo
 * de ahí en adelante. Una sola petición de emisión a la vez, aunque varias acciones lo necesiten.
 */
let emitiendo: Promise<string> | null = null;

async function lecturaDelSondeo(token: string): Promise<EstadoDelCarrito | null> {
  const estado = await leerElCarrito(token, dispositivoDelTelefono());
  if (estado?.dispositivoEmitido !== undefined) recordarDispositivo(estado.dispositivoEmitido);
  return estado;
}

/** El id de este teléfono; si aún no tiene, el servidor le emite uno (ver arriba). */
function telefonoListo(token: string): Promise<string> {
  const conocido = dispositivoDelTelefono();
  if (conocido !== '') return Promise.resolve(conocido);
  emitiendo ??= lecturaDelSondeo(token)
    .then(() => {
      const emitido = dispositivoDelTelefono();
      if (emitido === '') throw new Error('No pudimos conectar tu teléfono. Intenta de nuevo.');
      return emitido;
    })
    .finally(() => {
      emitiendo = null;
    });
  return emitiendo;
}

/**
 * Hace `accion` con el id del teléfono. Si el servidor no lo reconoce (la pimienta cambió, o era un id
 * viejo), se olvida, se pide uno nuevo y se repite UNA vez: el comensal no ve nada de eso.
 */
async function conTelefono<T>(
  token: string,
  accion: (dispositivo: string) => Promise<T>,
): Promise<T> {
  try {
    return await accion(await telefonoListo(token));
  } catch (error: unknown) {
    if (reglaDelError(error) !== 'QR_TELEFONO_NO_RECONOCIDO') throw error;
    olvidarDispositivo();
    return accion(await telefonoListo(token));
  }
}

/**
 * EL CARRITO DE LA MESA en un teléfono (DP-9.5): lo mira cada 2.5 s (y con eso late), y cuando
 * otro teléfono —o el mesero— lo manda, avisa «Pedido enviado». DP-12.2: también con la mesa
 * cerrada, y si una lectura falla lo dice en vez de quedarse callado. DP-13.3: el id del teléfono
 * lo emite el servidor, y si el mesero vacía el pedido, el teléfono lo dice una vez.
 */
export function useCarritoDeLaMesa(token: string, activo: boolean): CarritoDeLaMesa {
  const clienteDeConsultas = useQueryClient();
  const clave = ['carrito_de_la_mesa', token];
  const consulta = useQuery({
    queryKey: clave,
    queryFn: () => lecturaDelSondeo(token),
    enabled: activo && token !== '',
    refetchInterval: SONDEO_MS,
    staleTime: SONDEO_MS / 2,
  });
  const rondaVista = useRef<number | null>(null);
  const vaciadoVisto = useRef<string | null>(null);
  const estado = consulta.data ?? null;

  useEffect(() => {
    if (estado === null) return;
    if (envioDeOtroTelefono(rondaVista.current, estado)) {
      toast.success('Pedido enviado: la cocina ya lo tiene. Pueden seguir pidiendo.');
    }
    rondaVista.current = estado.ronda;
    const vaciado = vaciadoNuevo(vaciadoVisto.current, estado);
    if (vaciado !== null) {
      vaciadoVisto.current = vaciado;
      toast.info(AVISO_DEL_VACIADO);
    }
  }, [estado]);

  const poner = (nuevo: EstadoDelCarrito) => {
    clienteDeConsultas.setQueryData(clave, nuevo);
  };

  return {
    estado,
    sinConexion: consulta.isError,
    async llamar() {
      const resultado = await conTelefono(token, (d) => llamarAlMesero(token, d));
      await clienteDeConsultas.invalidateQueries({ queryKey: clave });
      return resultado;
    },
    async agregar(item) {
      poner(await conTelefono(token, (d) => agregarAlCarrito(token, d, item)));
    },
    async quitar(lineaId) {
      poner(await conTelefono(token, (d) => quitarDelCarrito(token, d, lineaId)));
    },
    async enviar(datos) {
      const resultado = await conTelefono(token, (d) => enviarElCarrito(token, d, datos));
      rondaVista.current = resultado.ronda;
      await clienteDeConsultas.invalidateQueries({ queryKey: clave });
      return resultado;
    },
  };
}
