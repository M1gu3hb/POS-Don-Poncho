/** Imprime el catálogo que conoce el simulador (sólo lectura). */
import { leerCatalogo } from '../catalogo.ts';
import { leerEntorno } from '../entorno.ts';
import { mundoVacio } from '../mundo.ts';

const m = mundoVacio();
await leerCatalogo(m, leerEntorno().baseUrl);
for (const p of m.catalogo)
  process.stdout.write(
    `${p.nombre} | ${p.tipoVenta} | ${String(p.precioCentavos)} | grupos ${String(p.grupos.length)} | ${p.estacion}\n`,
  );
