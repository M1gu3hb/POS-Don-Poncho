'use client';

import { useConfig } from '@/lib/ConfigContext';
import { getCurrentPackage, navegacionParaRolYPlantilla } from '@/lib/packageConfig';
import { etiquetaDeNavegacion, hasPermission } from '@/lib/permissions';
import { usePOSAuth } from '@/lib/POSAuthContext';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Superficie } from '@morphiqpos/ui/sistema';
import {
  BookOpen,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Package,
  QrCode,
  Receipt,
  ReceiptText,
  Settings,
  ShoppingCart,
  Tag,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useVocabulario } from '~/cliente/vocabulario';

import { esLaSeccionActual, seccionesDelDock } from './secciones-del-dock';

/**
 * DP-11.4 · EL DOCK, la navegación de la tableta y el teléfono.
 *
 * Una isla de vidrio abajo, al alcance del pulgar, con las secciones del puesto
 * (`seccionesDelDock`) y «Más», que es el «Abrir menú» de siempre: abre el cajón con el «Menú
 * principal» completo. Se ve sólo en táctil (`tactil:`, que también decide que la barra lateral
 * de la PC no se vea); el nombre del `nav` es «Secciones» para no confundirse con el menú.
 *
 * Mientras el cajón está abierto el dock queda inerte: el cajón lo tapa, y un lector de pantalla
 * no debe encontrar dos veces la misma sección.
 */

const ICONOS: Readonly<Record<string, LucideIcon>> = {
  BookOpen,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Package,
  QrCode,
  Receipt,
  ReceiptText,
  Settings,
  ShoppingCart,
  Tag,
  UtensilsCrossed,
};

interface DockDelPuestoProps {
  readonly menuAbierto: boolean;
  readonly alAbrirMenu: () => void;
}

export function DockDelPuesto({ menuAbierto, alAbrirMenu }: DockDelPuestoProps) {
  const { posUser } = usePOSAuth();
  const { config } = useConfig();
  const pathname = usePathname();
  const vocabulario = useVocabulario();

  const plantilla = getCurrentPackage(config);
  const entradas = navegacionParaRolYPlantilla(posUser?.rol, plantilla, hasPermission).map(
    (entrada) => ({
      ruta: entrada.ruta,
      icono: entrada.icono,
      // `etiquetaDeNavegacion` es del heredado (JS): devuelve la etiqueta como texto.
      etiqueta: String(
        etiquetaDeNavegacion(
          {
            path: entrada.ruta,
            label: entrada.etiqueta,
            icon: entrada.icono,
            entidad: entrada.entidad,
            pluralPropio: entrada.pluralPropio,
          },
          vocabulario,
        ),
      ),
    }),
  );
  const secciones = seccionesDelDock(entradas);

  return (
    <Superficie
      como="nav"
      nivel={4}
      radio="completo"
      relleno={0}
      aria-label="Secciones"
      aria-hidden={menuAbierto || undefined}
      inert={menuAbierto || undefined}
      className="no-print fixed inset-x-0 bottom-(--espacio-3) z-40 mx-auto hidden w-fit items-center gap-(--espacio-1) p-(--espacio-1) tactil:flex"
    >
      {secciones.map((seccion) => {
        const Icono = ICONOS[seccion.icono] ?? Tag;
        const actual = esLaSeccionActual(seccion.ruta, pathname);
        return (
          <Link
            key={seccion.ruta}
            href={seccion.ruta}
            title={seccion.etiqueta}
            aria-current={actual ? 'page' : undefined}
            className={`flex min-w-(--area-tactil-minima) flex-col items-center gap-(--espacio-1) rounded-full px-(--espacio-3) py-(--espacio-1) text-xs font-medium transition-colors duration-(--duracion-rapida) ${
              actual
                ? 'bg-acento-suave text-acento-suave-texto'
                : 'text-texto-sutil hover:text-texto'
            }`}
          >
            <Icono aria-hidden className="size-5" />
            <span>{seccion.corta}</span>
          </Link>
        );
      })}
      <Button
        size="icon"
        aria-label="Abrir menú"
        onClick={alAbrirMenu}
        className="size-(--area-tactil-minima) rounded-full"
      >
        <Menu aria-hidden className="size-5" />
      </Button>
    </Superficie>
  );
}
