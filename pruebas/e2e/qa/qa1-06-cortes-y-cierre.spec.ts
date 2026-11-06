import { readFileSync, writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { cancelacionesDelCorte } from '../ayudantes/cancelar-desde-la-mesa.ts';
import { vigilarFallos } from '../ayudantes/sesion.ts';

import {
  anotar,
  dinero,
  esperadoDelCajon,
  Jornada,
  leerEstado,
  leerLibro,
  sesionDeLaCaja,
} from './ayudantes-qa.ts';
import {
  cerrarElDia,
  cerrarLaCaja,
  comparar,
  corteDeTurno,
  de,
  elAlmacenCuadra,
  diferencias,
  hojaDe,
  porMetodo,
  suma,
  type Cobro,
  verPdfDeLosCortes,
} from './cierre-qa.ts';

/**
 * QA-1 · 06 · EL CORTE DE CADA CAJA, EL CIERRE DEL DÍA Y LA TABLA «ESPERADO CONTRA LO QUE DICE EL SISTEMA».
 * Lo esperado se calcula del LIBRO (lo que cada escena hizo, al centavo) y se compara con el corte de
 * cada caja, el efectivo del cajón, las cancelaciones del Cierre del día, Ventas, Registros y el almacén.
 * Cada comparación queda en el libro (`tipo: comparacion`) y las diferencias hacen fallar la prueba.
 */

test.describe('QA-1 · 06 · cortes, cierre y conciliación', () => {
  test('cada caja cuenta lo suyo, el día cierra y todo cuadra contra el libro', async ({
    browser,
  }, info) => {
    test.setTimeout(20 * 60_000);
    const j = new Jornada(browser, info);
    const fallos: (() => void)[] = [];
    try {
      const estado = leerEstado();
      const [duena, caja, gerente] = [
        await j.pagina('Dueño Don Poncho', 'pc'),
        await j.pagina('Caja', 'pc'),
        await j.pagina('Gerente', 'tableta'),
      ];
      for (const p of [duena, caja, gerente]) fallos.push(vigilarFallos(p));
      const libro = leerLibro();
      const cobros = libro
        .filter((a) => a.datos?.['tipo'] === 'cobro')
        .map((a) => a.datos as unknown as Cobro);
      const cancelaciones = libro
        .filter((a) => a.datos?.['tipo'] === 'cancelacion')
        .map((a) => a.datos ?? {});
      const mermas = libro.filter((a) => a.datos?.['tipo'] === 'merma').map((a) => a.datos ?? {});
      const cajas = [
        { quien: 'Caja', pagina: caja, sesion: String(estado['cajaCaja']) },
        { quien: 'Gerente', pagina: gerente, sesion: String(estado['cajaGerente']) },
      ] as const;

      await test.step('el corte de cada caja: lo suyo, y sólo lo suyo', async () => {
        for (const c of cajas) {
          const suyos = cobros.filter((x) => x.caja === c.quien);
          const fondo = Number(estado[`fondo${c.quien}`]);
          expect(await sesionDeLaCaja(c.pagina), `La caja de ${c.quien} no está abierta.`).toBe(
            c.sesion,
          );
          const hoja = await hojaDe(duena, c.sesion);
          comparar(`${c.quien}: tickets del corte`, suyos.length, hoja.resumen.tickets);
          comparar(
            `${c.quien}: ventas del corte (sin propina)`,
            suma(suyos.map((x) => x.venta)),
            Number(hoja.resumen.totalCentavos),
          );
          comparar(
            `${c.quien}: efectivo (venta + propina)`,
            suma(suyos.map((x) => x.efectivo)),
            porMetodo(hoja, 'efectivo'),
          );
          comparar(
            `${c.quien}: tarjeta (venta + propina)`,
            suma(suyos.map((x) => x.tarjeta)),
            porMetodo(hoja, 'tarjeta'),
          );
          comparar(
            `${c.quien}: transferencia`,
            suma(suyos.map((x) => x.transferencia)),
            porMetodo(hoja, 'transferencia'),
          );
          comparar(
            `${c.quien}: propinas`,
            suma(suyos.map((x) => x.propina)),
            suma(hoja.metodos.map((m) => Number(m.propinasCentavos))),
          );
          const esperado = fondo + suma(suyos.map((x) => x.efectivo));
          comparar(
            `${c.quien}: efectivo esperado en el cajón`,
            esperado,
            await esperadoDelCajon(c.pagina),
          );
          await corteDeTurno(c.pagina, esperado);
          anotar({
            aparato: c.quien === 'Caja' ? 'pc' : 'tableta',
            quien: c.quien,
            accion: `Corte de turno con ${dinero(esperado)} contados`,
            esperado: 'La caja sigue abierta; el corte no cierra nada',
          });
          expect(await sesionDeLaCaja(c.pagina), 'El corte de turno cerró la caja.').toBe(c.sesion);
        }
      });

      const contados: Record<string, number> = {};
      await test.step('la gerente cierra su caja con $10 de menos; Caja, la última, cierra el día con $20 de más', async () => {
        const esperadoG = await esperadoDelCajon(gerente);
        contados['Gerente'] = esperadoG - 1_000;
        const archivoGerente = await cerrarLaCaja(gerente, esperadoG - 1_000);
        anotar({
          aparato: 'tableta',
          quien: 'Gerente',
          accion: 'Cierre diario: cuenta $10.00 de menos, baja el PDF',
          esperado: 'diferencia −1000',
          detalle: archivoGerente,
        });
        const hojaG = await hojaDe(duena, String(estado['cajaGerente']));
        comparar('Gerente: diferencia del cierre', -1_000, Number(hojaG.sesion.diferenciaCentavos));
        const esperadoC = await esperadoDelCajon(caja);
        contados['Caja'] = esperadoC + 2_000;
        await cerrarElDia(caja, esperadoC + 2_000);
        anotar({
          aparato: 'pc',
          quien: 'Caja',
          accion:
            'Cierre del día (entrada «Cierre del día» del menú): cuenta $20.00 de más, baja el PDF con las cancelaciones',
          esperado: 'diferencia +2000',
          detalle: 'por la entrada «Cierre del día» del menú',
        });
        const hojaC = await hojaDe(duena, String(estado['cajaCaja']));
        comparar('Caja: diferencia del cierre', 2_000, Number(hojaC.sesion.diferenciaCentavos));
        comparar(
          'Caja: alcance de las cancelaciones del Cierre del día',
          'dia',
          hojaC.alcanceDeCancelaciones,
        );
        expect(await sesionDeLaCaja(caja)).toBeNull();
        expect(await sesionDeLaCaja(gerente)).toBeNull();
      });

      await test.step('las cancelaciones del Cierre del día: todas, cada una una vez, con su pérdida', async () => {
        const del = await cancelacionesDelCorte(duena, String(estado['cajaCaja']));
        comparar(
          'Cierre del día: filas de cancelación',
          cancelaciones.length,
          del.cancelaciones.length,
        );
        comparar(
          'Cierre del día: monto cancelado',
          suma(cancelaciones.map((c) => de(c, 'monto'))),
          suma(del.cancelaciones.map((c) => Number(c.montoCentavos))),
        );
        comparar(
          'Cierre del día: pérdida (lo ya preparado)',
          suma(cancelaciones.map((c) => de(c, 'perdida'))),
          suma(del.cancelaciones.map((c) => Number(c.perdidaCentavos))),
        );
      });

      await test.step('el almacén: existencia inicial − lo cobrado − lo cancelado ya hecho', async () => {
        await elAlmacenCuadra(duena, mermas);
      });
      await test.step('Ventas, Registros y su exportación', async () => {
        const totalVentas = suma(cobros.map((c) => c.venta));
        await duena.goto('/ventas');
        await expect(duena.getByText(/Cobrado:/)).toBeVisible({ timeout: 30_000 });
        const texto = (await duena.locator('body').innerText()).replace(/\s+/g, ' ');
        const cobrado = /Cobrado:\s*\$([\d,]+\.\d{2})/.exec(texto)?.[1];
        comparar(
          'Ventas: «Cobrado» del día',
          dinero(totalVentas),
          cobrado === undefined ? '(sin cifra)' : `$${cobrado}`,
        );
        await duena.goto('/registros?tab=cancelaciones');
        const perdidas = cancelaciones.filter((c) => de(c, 'perdida') > 0).length;
        await expect(duena.getByText(/^Pérdida .+ · ya preparado$/)).toHaveCount(perdidas, {
          timeout: 30_000,
        });
        await expect(duena.getByText('Antes de prepararse')).toHaveCount(
          cancelaciones.length - perdidas,
        );
        anotar({
          aparato: 'pc',
          quien: 'Dueño',
          accion: 'Registros → Cancelaciones',
          esperado: `${String(perdidas)} con pérdida y ${String(cancelaciones.length - perdidas)} antes de prepararse`,
        });

        await duena.goto('/registros');
        // «Exportar» es un menú (CSV o XLSX) que arma el archivo en el navegador con los cortes cerrados.
        const descarga = duena.waitForEvent('download', { timeout: 30_000 });
        await duena
          .getByRole('button', { name: /Exportar/ })
          .first()
          .click();
        await duena.getByRole('menuitem', { name: /CSV/ }).click();
        const exportado = await descarga;
        const ruta = `docs/qa/evidencia/${exportado.suggestedFilename()}`;
        await exportado.saveAs(ruta);
        const csv = readFileSync(ruta, 'utf8');
        writeFileSync(
          'docs/qa/evidencia/exportacion-registros.txt',
          `${exportado.suggestedFilename()}\n${csv.slice(0, 4000)}`,
        );
        const filas = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
        comparar('Exportación de cortes (CSV): filas de datos', 2, filas.length - 1);
        const columnas = (filas[0] ?? '').replace(/^\uFEFF/, '').split(',');
        for (const c of cajas) {
          const fila = filas
            .slice(1)
            .map((l) => l.split(','))
            .find((x) => x[columnas.indexOf('Cajero')] === c.quien);
          const hoja = await hojaDe(duena, c.sesion);
          const dos = (v: number | string | undefined): string =>
            Number(v ?? Number.NaN).toFixed(2);
          const celda = (col: string): string => dos(fila?.[columnas.indexOf(col)]);
          const por = (m: string): number =>
            suma(hoja.metodos.filter((x) => x.metodo === m).map((x) => Number(x.ventasCentavos)));
          const csvDe = `Exportación de cortes (CSV) · ${c.quien}`;
          comparar(
            `${csvDe}: N° ventas`,
            String(hoja.resumen.tickets),
            String(Number(fila?.[columnas.indexOf('N° ventas')])),
          );
          comparar(
            `${csvDe}: Total`,
            dos(Number(hoja.resumen.totalCentavos) / 100),
            celda('Total'),
          );
          comparar(`${csvDe}: Efectivo`, dos(por('efectivo') / 100), celda('Efectivo'));
          comparar(`${csvDe}: Tarjeta`, dos(por('tarjeta') / 100), celda('Tarjeta'));
          comparar(
            `${csvDe}: Transferencia`,
            dos(por('transferencia') / 100),
            celda('Transferencia'),
          );
          comparar(
            `${csvDe}: Efectivo contado`,
            dos(Number(hoja.sesion.contadoCentavos) / 100),
            celda('Efectivo contado'),
          );
          comparar(
            `${csvDe}: Efectivo esperado`,
            dos(Number(hoja.sesion.esperadoCentavos) / 100),
            celda('Efectivo esperado'),
          );
          comparar(
            `${csvDe}: Diferencia`,
            dos(Number(hoja.sesion.diferenciaCentavos) / 100),
            celda('Diferencia'),
          );
        }
        anotar({
          aparato: 'pc',
          quien: 'Dueño',
          accion: `Registros → Exportar → CSV (${exportado.suggestedFilename()}, ${String(filas.length - 1)} filas)`,
          esperado: 'Un CSV con los dos cortes cerrados del día, con lo mismo que dice su hoja',
          detalle: filas.slice(0, 3).join(' ⏎ ').slice(0, 300),
        });
      });

      await test.step('«Ver PDF» de cada corte: el del Cierre del día trae las cancelaciones y su pérdida', async () => {
        await verPdfDeLosCortes(duena);
      });

      for (const exigir of fallos) exigir();
      expect(diferencias, `HAY DIFERENCIAS CONTRA LO ESPERADO:\n${diferencias.join('\n')}`).toEqual(
        [],
      );
    } finally {
      await j.cerrar();
    }
  });
});
