import { fraseNuevoPedidoCocina } from './frase-de-la-comanda';

/**
 * DP-21 · Bloque 8 · «ASÍ SE OYE UNA COMANDA»: el ejemplo de Configuración → Sonidos.
 *
 * Una comanda inventada con cantidades, un platillo con opciones y otro por peso, dicha con la
 * MISMA función que usa la cocina: lo que se oye en la prueba es lo que dirá la pantalla.
 */
export function fraseDeLaComandaDeEjemplo(): string {
  return fraseNuevoPedidoCocina(
    4,
    [
      { producto_id: 'ej-consome', producto_nombre: 'Consomé de carnero', cantidad: 1 },
      { producto_id: 'ej-consome', producto_nombre: 'Consomé de carnero', cantidad: 1 },
      { producto_id: 'ej-consome', producto_nombre: 'Consomé de carnero', cantidad: 1 },
      {
        producto_id: 'ej-mixiote',
        producto_nombre: 'Mixiote',
        cantidad: 2,
        opciones: [{ grupo: 'Picor', opciones: ['Sin picante'] }],
      },
      {
        producto_id: 'ej-barbacoa',
        producto_nombre: 'Barbacoa de horno',
        cantidad: 0.5,
        tipo_venta: 'variable_medida',
        unidad_variable: 'kg',
        cantidad_variable: 0.5,
      },
    ],
    '',
  );
}
