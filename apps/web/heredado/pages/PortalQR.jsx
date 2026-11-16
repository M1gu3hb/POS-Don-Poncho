'use client';
import React from 'react';
import { QrCode } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePOSAuth } from '@/lib/POSAuthContext';
import { useConfig } from '@/lib/ConfigContext';
import PageHeader from '@/components/common/PageHeader';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import MesasQRTab from '@/components/portalqr/MesasQRTab';
import MenuQRTab from '@/components/portalqr/MenuQRTab';
import SolicitudesQRTab from '@/components/portalqr/SolicitudesQRTab';
import { Link } from '@/enrutado';
import { PersonalizarMenu } from '~/restaurante/personalizar-menu/PersonalizarMenu';

/**
 * Página interna Portal QR — solo administrador.
 * Cinco pestañas: Mesas QR, Menú QR, Personalizar menú (DP-18: foto, descripción y fondo de cada
 * platillo, orden de las secciones, encabezado y colores, con la vista previa del teléfono),
 * Solicitudes y Configuración.
 */
export default function PortalQRPage() {
  const { posUser } = usePOSAuth();
  const { config } = useConfig();

  if (posUser?.rol !== 'administrador') {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <QrCode className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p>El Portal QR solo está disponible para administradores.</p>
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallbackTitle="Ocurrió un error en Portal QR."
      fallbackMessage="Recarga la página para reintentar."
    >
      <div className="space-y-4">
        <PageHeader
          title="Portal QR"
          description="Administra los QR de cada mesa, el menú digital y las solicitudes de comensales."
        />

        <Tabs defaultValue="mesas">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="mesas">Mesas QR</TabsTrigger>
            <TabsTrigger value="menu">Menú QR</TabsTrigger>
            <TabsTrigger value="personalizar">Personalizar menú</TabsTrigger>
            <TabsTrigger value="solicitudes">Solicitudes</TabsTrigger>
            <TabsTrigger value="config">Ajustes del portal</TabsTrigger>
          </TabsList>

          <TabsContent value="mesas" className="mt-4">
            <MesasQRTab config={config} />
          </TabsContent>
          <TabsContent value="menu" className="mt-4">
            <MenuQRTab />
          </TabsContent>
          <TabsContent value="personalizar" className="mt-4">
            <PersonalizarMenu />
          </TabsContent>
          <TabsContent value="solicitudes" className="mt-4">
            {/* Sin `posUser`: la atribución de quién atendió el aviso sale de la
                sesión en el servidor, no de quien hace la llamada. */}
            <SolicitudesQRTab />
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            {/* DP-21 · Bloque 21: los ajustes del portal viven en Configuración → Portal de comensales
                (un solo lugar, nunca el mismo ajuste en dos). Aquí queda lo operativo. */}
            <div className="rounded-xl border bg-superficie p-4 max-w-2xl space-y-2">
              <p className="text-sm font-bold">Los ajustes del portal están en Configuración</p>
              <p className="text-xs text-muted-foreground">
                Activar el portal, cómo se ve el menú, quién manda a cocina, los botones de
                atención, la cuenta y la propina. Aquí sigues administrando los QR, el menú y las
                solicitudes.
              </p>
              <Link
                to="/configuracion?seccion=portal"
                className="inline-flex text-sm font-medium underline underline-offset-2"
              >
                Ir a Configuración → Portal de comensales
              </Link>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}
