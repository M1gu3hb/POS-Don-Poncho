'use client';
import React, { useState } from 'react';
import { api } from '@/api/cliente';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePOSAuth } from '@/lib/POSAuthContext';
import { claves } from '~/cliente/claves-de-consulta';
import UsuarioPOSDialog from './UsuarioPOSDialog';
import { FilaDeUsuario, cuerpoDelEmpleado } from './FilaDeUsuario';
import { usePuesto } from './usePuesto';
import { esDeMando, puedeEditarA } from './puestos';

/**
 * Configuración → Usuarios POS (DP-14, ronda 2).
 *
 * · El puesto es el REAL de la base: el diálogo sólo ofrece los que quien edita puede dar, y uno
 *   mismo cambia su nombre y su PIN, nunca su puesto.
 * · Desactivar pide confirmación y no queda pegado al lápiz; «Ver desactivados» y «Reactivar».
 * · Al desactivar a un mesero, el servidor suelta sus mesas (las ve todo el salón).
 *
 * Todo se guarda con `identidad.guardar_empleado`, que escribe las cuatro tablas del empleado en
 * una transacción y hashea el PIN en el servidor (viaja hacia allá y no vuelve).
 */


export default function UsuariosPOSSection({ cfg }) {
  const queryClient = useQueryClient();
  const { posUser } = usePOSAuth();
  const miPuesto = usePuesto();
  const [verDesactivados, setVerDesactivados] = useState(false);
  const [dialogo, setDialogo] = useState({ abierto: false, usuario: null });
  const [aDesactivar, setADesactivar] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const { data: usuarios = [] } = useQuery({
    queryKey: claves.usuarios.activos(),
    queryFn: () => api.entidades.UsuarioPOS.filter({ activo: true }),
    initialData: [],
  });
  const { data: desactivados = [] } = useQuery({
    queryKey: claves.usuarios.inactivos(),
    queryFn: () => api.entidades.UsuarioPOS.filter({ activo: false }),
    enabled: verDesactivados,
  });

  const lista = Array.isArray(usuarios) ? usuarios : [];
  const puedeGestionar = esDeMando(miPuesto);
  const esUnoMismo = (u) => u?.id === posUser?.id;

  const refrescar = () => {
    // La raíz alcanza a todas las variantes (activos, meseros, desactivados): `claves-de-consulta.ts`.
    queryClient.invalidateQueries({ queryKey: ['usuarios_pos'] });
    queryClient.invalidateQueries({ queryKey: ['mesas'] });
  };

  const guardarUsuario = async (payload, prevUser) => {
    try {
      // Segunda barrera (la primera es el diálogo): un cocinero con estaciones activas necesita una.
      if (
        cfg?.estaciones_preparacion_activas === true &&
        payload?.rol === 'cocina' &&
        !payload?.estacion_preparacion_id &&
        payload?.puede_ver_todas_estaciones !== true
      ) {
        toast.error(
          'No se puede guardar: este usuario de cocina necesita una estación o "Todas las estaciones".',
        );
        return;
      }
      const edita = !!prevUser?.id;
      const propio = edita && esUnoMismo(prevUser);
      await api.comandos.ejecutar('/api/identidad/empleados', {
        ...(edita ? { empleado: prevUser.id } : {}),
        nombre: payload.nombre,
        // El puesto que eligió el diálogo; uno mismo, el que ya tiene (el servidor lo exige).
        puesto: propio ? prevUser.rol : payload.rol,
        telefono: payload.telefono || null,
        color: payload.color || null,
        estacionPreparacionId: payload.estacion_preparacion_id || null,
        veTodasLasEstaciones: payload.puede_ver_todas_estaciones === true,
        activo: edita && !propio ? payload.activo !== false : true,
        ...(payload.pin ? { pin: String(payload.pin) } : {}),
      });
      refrescar();
      setDialogo({ abierto: false, usuario: null });
      toast.success(edita ? 'Usuario actualizado' : 'Usuario creado');
    } catch (e) {
      toast.error('No se pudo guardar el usuario: ' + (e?.message || ''));
    }
  };

  const cambiarActivo = async (u, activo) => {
    setTrabajando(true);
    try {
      // Dar de baja es una edición del empleo, no un borrado: sus ventas, sus cortes y sus
      // propinas lo siguen referenciando.
      await api.comandos.ejecutar('/api/identidad/empleados', cuerpoDelEmpleado(u, { activo }));
      refrescar();
      toast.success(activo ? 'Usuario reactivado' : 'Usuario desactivado');
    } catch (e) {
      toast.error(e?.message || 'No se pudo cambiar el usuario');
    } finally {
      setTrabajando(false);
      setADesactivar(null);
    }
  };

  const acciones = (u) => {
    if (!puedeEditarA(miPuesto, u.rol, esUnoMismo(u))) return null;
    return (
      <div className="flex items-center gap-4 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => setDialogo({ abierto: true, usuario: u })}
          title="Editar usuario / cambiar NIP"
          aria-label={`Editar a ${u.nombre}`}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        {!esUnoMismo(u) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 ml-1 border-l rounded-none text-muted-foreground hover:text-destructive"
            onClick={() => setADesactivar(u)}
            title="Desactivar usuario"
            aria-label={`Desactivar a ${u.nombre}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  };

  const dialogoDeUnoMismo = dialogo.usuario ? esUnoMismo(dialogo.usuario) : false;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base font-heading">Usuarios POS</CardTitle>
          {puedeGestionar && (
            <Button size="sm" onClick={() => setDialogo({ abierto: true, usuario: null })}>
              <Plus className="w-4 h-4 mr-1" />
              Nuevo usuario
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {lista.map((u) => (
            <FilaDeUsuario key={u.id} u={u} cfg={cfg} acciones={acciones(u)} />
          ))}
          {lista.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin usuarios registrados</p>
          )}

          {puedeGestionar && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVerDesactivados((v) => !v)}
                aria-expanded={verDesactivados}
              >
                {verDesactivados ? 'Ocultar desactivados' : 'Ver desactivados'}
              </Button>
              {verDesactivados && (
                <div className="mt-3 space-y-2" aria-label="Usuarios desactivados">
                  {(Array.isArray(desactivados) ? desactivados : []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No hay usuarios desactivados.</p>
                  )}
                  {(Array.isArray(desactivados) ? desactivados : []).map((u) => (
                    <FilaDeUsuario
                      key={u.id}
                      u={u}
                      cfg={cfg}
                      acciones={
                        puedeEditarA(miPuesto, u.rol, false) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 h-10"
                            disabled={trabajando}
                            onClick={() => cambiarActivo(u, true)}
                            aria-label={`Reactivar a ${u.nombre}`}
                          >
                            <Undo2 className="w-4 h-4 mr-1" />
                            Reactivar
                          </Button>
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <UsuarioPOSDialog
        open={dialogo.abierto}
        user={dialogo.usuario}
        miPuesto={miPuesto}
        esPropio={dialogoDeUnoMismo}
        onClose={() => setDialogo({ abierto: false, usuario: null })}
        onSave={guardarUsuario}
      />

      <AlertDialog open={aDesactivar !== null} onOpenChange={(o) => !o && setADesactivar(null)}>
        <AlertDialogContent className="w-[calc(100%-1.5rem)] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar a {aDesactivar?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no podrá entrar al sistema. Sus ventas y su historial se conservan, y lo puedes
              reactivar en «Ver desactivados».
              {aDesactivar?.rol === 'mesero' &&
                ' Sus mesas quedan sin asignar: las verán todos los meseros hasta que las repartas.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={trabajando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={trabajando}
              onClick={(e) => {
                e.preventDefault();
                cambiarActivo(aDesactivar, false);
              }}
            >
              Sí, desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
