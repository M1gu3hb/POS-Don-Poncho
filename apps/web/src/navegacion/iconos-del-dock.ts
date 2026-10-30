import {
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
  ShoppingBag,
  Tag,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

/**
 * DP-11.4 · LOS ÍCONOS DEL DOCK, por el nombre que manda el menú: el `icono` de cada entrada de
 * la plantilla (`navegacionDePlantilla`) y el `icon` de `NAV_ITEMS` de heredado. La barra lateral
 * de la PC tiene su propio mapa (`Sidebar.jsx`), más largo; éste lleva sólo los nombres que el
 * menú puede mandar, y la prueba exige que no falte ninguno.
 */
export const ICONOS_DEL_DOCK: Readonly<Record<string, LucideIcon>> = {
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
  ShoppingBag,
  Tag,
  UtensilsCrossed,
};

/** El ícono de una sección del dock; un nombre que no conoce cae en la etiqueta. */
export function iconoDeLaSeccion(nombre: string): LucideIcon {
  return ICONOS_DEL_DOCK[nombre] ?? Tag;
}
