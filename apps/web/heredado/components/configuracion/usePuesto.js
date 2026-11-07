'use client';
// El puesto REAL de quien tiene la sesión (DP-14, ronda 2).
//
// `posUser.rol` viaja en el vocabulario de cuatro roles de la pantalla, donde el dueño, el
// administrador y el gerente son los tres «administrador»: no sirve para decidir quién ve Caja y
// Descuentos ni qué puestos puede dar. El puesto real sale de la plantilla (que el puente sirve
// con el de la base). Mientras no llega, `null`: lo que depende del puesto no se enseña.
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/cliente';
import { usePOSAuth } from '@/lib/POSAuthContext';
import { claves } from '~/cliente/claves-de-consulta';

export function usePuesto() {
  const { posUser } = usePOSAuth();
  const { data: usuarios = [] } = useQuery({
    queryKey: claves.usuarios.activos(),
    queryFn: () => api.entidades.UsuarioPOS.filter({ activo: true }),
    initialData: [],
  });
  const yo = (Array.isArray(usuarios) ? usuarios : []).find((u) => u?.id === posUser?.id);
  return yo?.rol ?? null;
}
