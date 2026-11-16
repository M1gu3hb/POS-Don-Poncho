#!/usr/bin/env node
/**
 * LA FOTOGRAFÍA DE LA CONFIGURACIÓN (DP-21 · Bloque 21): qué controles tiene, archivo por archivo.
 *
 *   node scripts/inventariar-configuracion.mjs --desde-git <commit> --escribir docs/configuracion-inventario-antes.json
 *
 * Lee del repositorio (`git show <commit>:<ruta>`), no del disco: así la fotografía de «antes» es la
 * de ese commit aunque el árbol ya esté a medio mudar. El archivo que escribe NO se vuelve a
 * generar: es contra lo que la prueba de la mudanza (`mudanza.contrato.test.ts`) compara.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import { argumento } from './lib/guion.mjs';

const { escanear } = await import('../apps/web/src/configuracion/inventario/escanear.ts');

/** Todo lo que compone la pantalla de Configuración antes de la mudanza. */
export const ARCHIVOS_DE_LA_CONFIGURACION_DE_HOY = [
  'apps/web/heredado/pages/Configuracion.jsx',
  'apps/web/heredado/components/configuracion/IdentidadNegocio.jsx',
  'apps/web/heredado/components/configuracion/ColoresSistemaSection.jsx',
  'apps/web/heredado/components/configuracion/ConfiguracionDeVoz.jsx',
  'apps/web/heredado/components/configuracion/UsuariosPOSSection.jsx',
  'apps/web/heredado/components/configuracion/IntegracionesRespaldos.jsx',
  'apps/web/heredado/components/configuracion/ReiniciarSistemaSection.jsx',
  'apps/web/heredado/components/configuracion/CategoriasProductoSection.jsx',
  'apps/web/heredado/components/configuracion/EstacionesPreparacionSection.jsx',
  'apps/web/heredado/components/configuracion/UnidadesMedidaSection.jsx',
  'apps/web/heredado/components/configuracion/ProveedoresSection.jsx',
  'apps/web/heredado/components/datos/DatosSection.jsx',
  'apps/web/heredado/components/datos/ExportarDatos.jsx',
  'apps/web/heredado/components/datos/ImportarDatos.jsx',
  'apps/web/heredado/components/portalqr/ConfiguracionQRTab.jsx',
  'apps/web/src/configuracion/SelectorDeApariencia.tsx',
  'apps/web/src/configuracion/ExperienciaDelNegocio.tsx',
  'apps/web/src/configuracion/SonidosDelNegocio.tsx',
  'apps/web/src/configuracion/PruebaDeLaVozDeComandas.tsx',
  'apps/web/src/configuracion/SonidoDelAparato.tsx',
  'apps/web/src/configuracion/ModoEsperaDelAparato.tsx',
  'apps/web/src/configuracion/AnuncioDeComandasDelAparato.tsx',
  'apps/web/src/configuracion/TerminalesDeLaSucursal.tsx',
  'apps/web/src/configuracion/CajaYDescuentos.tsx',
  'apps/web/src/configuracion/NombresDeLasCajas.tsx',
  'apps/web/src/configuracion/UmbralDeRetiro.tsx',
  'apps/web/src/configuracion/CandadoDeMando.tsx',
  'apps/web/src/configuracion/QuienEligeLaPropina.tsx',
  'apps/web/src/configuracion/IvaDelNegocio.tsx',
  'apps/web/src/configuracion/FoliosDelNegocio.tsx',
  'apps/web/src/impresion/pantallas/ImpresionDelAparato.tsx',
  'apps/web/src/impresion/pantallas/CopiasDeImpresion.tsx',
  'apps/web/src/impresion/pantallas/EntradaAlLaboratorio.tsx',
  'apps/web/src/impresion/pantallas/AjustesDeLaApp.tsx',
  'apps/web/src/impresion/pantallas/LabProbarCajon.tsx',
  'apps/web/src/cocina/AlertasDeEspera.tsx',
];

const commit = argumento('desde-git') ?? 'HEAD';
const destino = argumento('escribir');

const controles = [];
for (const archivo of ARCHIVOS_DE_LA_CONFIGURACION_DE_HOY) {
  let codigo;
  try {
    codigo = execFileSync('git', ['show', `${commit}:${archivo}`], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    console.error(`✗ ${archivo} no existe en ${commit}.`);
    process.exit(1);
  }
  controles.push(...escanear(archivo, codigo));
}

const salida = {
  _comentario:
    'Fotografía de la Configuración ANTES de la mudanza del Bloque 21. No se regenera: la prueba mudanza.contrato.test.ts busca cada control en su lugar nuevo.',
  generadoDe: commit,
  archivos: ARCHIVOS_DE_LA_CONFIGURACION_DE_HOY,
  controles,
};
const texto = `${JSON.stringify(salida, null, 2)}\n`;
if (destino === null) {
  process.stdout.write(texto);
} else {
  writeFileSync(destino, texto);
  console.log(
    `✓ ${String(controles.length)} controles de ${String(ARCHIVOS_DE_LA_CONFIGURACION_DE_HOY.length)} archivos en ${destino}`,
  );
}
