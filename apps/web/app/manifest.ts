import type { MetadataRoute } from 'next';

/**
 * LA APP INSTALABLE de POS Don Poncho (DP-3): el mesero la pone en la pantalla de inicio de su
 * teléfono y la caja en la de su tablet, con el logo de la casa.
 *
 * Los íconos salen de `public/iconos/` y los genera el logo que entregó Miguel. El fondo y el
 * color de la barra son el negro de sus letras (`#161614`), el mismo de la barra lateral del
 * estilo `don-poncho`; el `maskable` deja su margen de seguridad para que Android lo recorte
 * en círculo sin comerse el letrero.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'POS Don Poncho',
    short_name: 'Don Poncho',
    description: 'Punto de venta de La Tradicional Barbacoa de Don Poncho.',
    lang: 'es-MX',
    start_url: '/login-pos',
    display: 'standalone',
    background_color: '#161614',
    theme_color: '#161614',
    icons: [
      { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/iconos/icono-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
