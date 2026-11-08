import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ordenDeLaZonaNueva, problemaDelNombreDeZona } from './zonas-del-salon.ts';

const zonas = [
  { id: 'z1', nombre: 'Salón', orden: 1 },
  { id: 'z2', nombre: 'Terraza', orden: 2 },
  { id: 'z3', nombre: 'Jardín', orden: 3, activo: false },
];

describe('DP-15 · el nombre de una zona', () => {
  it('uno nuevo y distinto se puede', () => {
    expect(problemaDelNombreDeZona('Barra', zonas, null)).toBeNull();
  });

  it('vacío o larguísimo, no', () => {
    expect(problemaDelNombreDeZona('   ', zonas, null)).toBe('Escribe el nombre de la zona.');
    expect(problemaDelNombreDeZona('x'.repeat(41), zonas, null)).toContain('40 letras');
  });

  it('repetido (sin importar mayúsculas ni espacios), no; el de una zona apagada, sí', () => {
    expect(problemaDelNombreDeZona('  terraza ', zonas, null)).toBe('Ya hay una zona «terraza».');
    expect(problemaDelNombreDeZona('Jardín', zonas, null)).toBeNull();
  });

  it('al renombrar, su propio nombre no cuenta como repetido', () => {
    expect(problemaDelNombreDeZona('TERRAZA', zonas, 'z2')).toBeNull();
    expect(problemaDelNombreDeZona('Salón', zonas, 'z2')).toBe('Ya hay una zona «Salón».');
  });

  it('una zona nueva va al final', () => {
    expect(ordenDeLaZonaNueva(zonas)).toBe(4);
    expect(ordenDeLaZonaNueva([])).toBe(1);
  });
});

describe('DP-15 · la pantalla de zonas', () => {
  it('Configuración → Mesas tiene «Zonas» para quien las escribe, y el diálogo usa la regla', () => {
    const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
    const config = readFileSync(
      join(raiz, 'heredado', 'pages', 'Configuracion.jsx'),
      'utf8',
    ).replace(/\s+/g, '');
    expect(config).toContain("constPUEDEN_EDITAR_ZONAS=['dueno','administrador','gerente'];");
    expect(config).toContain(
      '{PUEDEN_EDITAR_ZONAS.includes(miPuesto)&&(<Buttonsize="sm"variant="outline"onClick={()=>setShowZonas(true)}>',
    );
    const dialogo = readFileSync(
      join(raiz, 'heredado', 'components', 'mesas', 'ZonasDelSalonDialog.jsx'),
      'utf8',
    ).replace(/\s+/g, '');
    expect(dialogo).toContain('problemaDelNombreDeZona(nombre,activas,zona.id)');
    expect(dialogo).toContain('problemaDelNombreDeZona(nombre,activas,null)');
    expect(dialogo).toContain(
      'api.entidades.Zona.create({nombre,orden:ordenDeLaZonaNueva(activas),activo:true})',
    );
  });
});
