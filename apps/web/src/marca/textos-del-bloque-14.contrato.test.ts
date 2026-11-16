import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { debeEscucharAudio } from '../../heredado/lib/asignacionMesas.js';
import { tituloDeLosAjustes } from './nombre-visible.ts';

/**
 * DP-21 · Bloque 14 · LA CONFIGURACIÓN LIMPIA: textos con el nombre de la casa, no con la marca de la
 * plataforma, y «Silenciar notificaciones del administrador» conectado a las solicitudes.
 *
 * Pantallas heredadas: el contrato lee su texto (se valida mutándolo).
 */
const RAIZ = join(__dirname, '..', '..');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

describe('el subtítulo de Configuración', () => {
  it('dice «Ajustes de» + el nombre del negocio, o el de la casa si no hay uno que mostrar', () => {
    expect(tituloDeLosAjustes('Tacos El Güero')).toBe('Ajustes de Tacos El Güero');
    expect(tituloDeLosAjustes('')).toBe('Ajustes de Don Poncho');
    expect(tituloDeLosAjustes(undefined)).toBe('Ajustes de Don Poncho');
    // Nunca la marca de la plataforma como si fuera el negocio.
    expect(tituloDeLosAjustes('Morphiq')).toBe('Ajustes de Don Poncho');
  });

  it('Configuracion.jsx lo usa en sus dos encabezados y ya no trae el texto fijo', () => {
    const pantalla = leer('heredado/pages/Configuracion.jsx');
    expect(pantalla.split('tituloDeLosAjustes(cfg?.nombre_negocio)')).toHaveLength(3);
    expect(pantalla).not.toContain('Ajustes de POS Don Poncho');
    expect(pantalla).not.toContain('Ajustes de Morphiq');
  });
});

describe('ningún texto visible dice Morphiq como si fuera la marca', () => {
  it('los placeholders de Identidad, las migas de /sistema y el acceso', () => {
    expect(leer('heredado/components/configuracion/IdentidadNegocio.jsx')).not.toMatch(
      /placeholder="Morphiq/,
    );
    expect(leer('src/sistema/PaginaDelSistema.tsx')).not.toContain("rotulo: 'MorphiqPOS'");
    expect(leer('app/api/auth/empleados/route.ts')).not.toContain("'Morphiq POS'");
  });

  it('«Módulo no incluido» ya no manda a una pestaña que no existe', () => {
    expect(leer('heredado/components/common/RestrictedRoute.jsx')).not.toContain(
      'Configuración → Presentación',
    );
  });
});

describe('Primeros pasos', () => {
  it('dice PIN, y cada paso abre la sección que le toca', () => {
    const card = leer('heredado/components/dashboard/PrimerosPasosCard.jsx');
    expect(card).not.toContain('NIPs');
    expect(card).toContain('Crea usuarios y PIN');
    for (const seccion of ['el-negocio', 'personas', 'salon', 'productos']) {
      expect(card).toContain(`direccionDeLaSeccion('${seccion}')`);
    }
    expect(card).not.toMatch(/to: '\/configuracion' \}/);
  });

  it('el paso del negocio no se da por hecho sólo porque el nombre de la casa ya viene puesto', () => {
    const tablero = leer('heredado/pages/Dashboard.jsx');
    expect(tablero).not.toContain("nombreNeg === 'MH Astral Systems'");
    expect(tablero).toMatch(/const negocioOk = escrito\('direccion'\)/);
  });
});

describe('los ejemplos y las ayudas son de un restaurante', () => {
  it('las plantillas descargables y los placeholders ya no son de una cafetería', () => {
    const ejemplos = [
      'heredado/components/datos/PlantillasDescargables.jsx',
      'heredado/components/compras/RegistrarCompraDialog.jsx',
      'heredado/components/inventario/RegistrarInventarioInicialDialog.jsx',
      'heredado/components/configuracion/ProveedoresSection.jsx',
      'heredado/components/recetas/RecetaFormDialog.jsx',
    ];
    for (const ruta of ejemplos) {
      expect(leer(ruta), ruta).not.toMatch(/Capuchino|Café molido|Panadería San José/);
    }
  });

  it('la ayuda de «Quiero ordenar» manda a donde de verdad se apagan los pedidos', () => {
    const portal = leer('heredado/components/portalqr/ConfiguracionQRTab.jsx');
    expect(portal).not.toContain('NO puede mandar pedidos a cocina');
    expect(portal).toContain('Configuración → Ventas y cobro');
    expect(portal).not.toContain('Configuración general');
  });
});

describe('«Silenciar notificaciones del administrador» manda también en las solicitudes', () => {
  it('el administrador silenciado no oye el aviso ni la voz de las solicitudes; los demás sí', () => {
    const silenciado = { silenciar_notificaciones_admin: true };
    const oye = { silenciar_notificaciones_admin: false };
    expect(debeEscucharAudio({ rol: 'administrador' }, silenciado)).toBe(false);
    expect(debeEscucharAudio({ rol: 'administrador' }, {})).toBe(false);
    expect(debeEscucharAudio({ rol: 'administrador' }, oye)).toBe(true);
    expect(debeEscucharAudio({ rol: 'mesero' }, silenciado)).toBe(true);
  });

  it('Mesero.jsx lo consulta antes de anunciar', () => {
    const mesero = leer('heredado/pages/Mesero.jsx');
    expect(mesero).toMatch(
      /const anunciarSolicitudes = \(nuevas\) => \{[\s\S]{0,400}if \(!debeEscucharAudio\(posUser, config\)\) return;/,
    );
  });
});
