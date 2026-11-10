import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { confirmarEnvio, preguntaDeAgotados, type ToastConAcciones } from './apartar-agotados.ts';
import { puedeMoverLaCuenta } from './puede-mover-la-cuenta.ts';

/**
 * DP-16 (1.5) · Dos menores de la pantalla del mesero: el toque de confirmación antes de mandar lo
 * que queda tras un agotado, y no ofrecer «Cambiar de mesa» en una mesa unida.
 */

describe('el agotado pide un toque antes de mandar el resto', () => {
  it('la pregunta nombra lo agotado', () => {
    expect(preguntaDeAgotados(['Barbacoa de borrego'])).toBe(
      'Se agotó Barbacoa de borrego. ¿Envío lo demás?',
    );
    expect(preguntaDeAgotados(['Consomé', 'Pulque'])).toBe(
      'Se agotaron Consomé y Pulque. ¿Envío lo demás?',
    );
  });

  it('«Enviar» resuelve que sí; «No enviar» y cerrar el aviso, que no', async () => {
    const con = (tocar: (o: Parameters<ToastConAcciones>[1]) => void): ToastConAcciones => {
      return (_mensaje, opciones) => {
        tocar(opciones);
      };
    };
    expect(
      await confirmarEnvio(
        con((o) => {
          o.action.onClick();
        }),
        '¿?',
      ),
    ).toBe(true);
    expect(
      await confirmarEnvio(
        con((o) => {
          o.cancel.onClick();
        }),
        '¿?',
      ),
    ).toBe(false);
    expect(
      await confirmarEnvio(
        con((o) => {
          o.onDismiss();
        }),
        '¿?',
      ),
    ).toBe(false);
    expect(
      await confirmarEnvio(
        con((o) => {
          o.onAutoClose();
        }),
        '¿?',
      ),
    ).toBe(false);
  });

  it('el aviso espera: no se cierra solo', async () => {
    let duracion = 0;
    void confirmarEnvio((_m, o) => {
      duracion = o.duration;
    }, '¿?');
    expect(duracion).toBe(Number.POSITIVE_INFINITY);
  });

  it('Mesero.jsx espera la respuesta antes de mandar lo que queda', () => {
    const fuente = readFileSync(join(process.cwd(), 'apps/web/heredado/pages/Mesero.jsx'), 'utf8');
    expect(fuente).toMatch(/await confirmarEnvio\(toast, preguntaDeAgotados\(apartados\)\)/);
    expect(fuente).toMatch(/if \(!enviar\) \{[\s\S]{0,200}return \[\];/);
  });
});

describe('cambiar de mesa con las mesas unidas', () => {
  it('ni dirección ni el mesero ven el enlace si la mesa está unida', () => {
    for (const puesto of ['dueno', 'administrador', 'gerente', 'mesero']) {
      expect(puedeMoverLaCuenta({ puesto, yoId: 'u1', atiendeId: 'u1', unida: true })).toBe(false);
      expect(puedeMoverLaCuenta({ puesto, yoId: 'u1', atiendeId: 'u1', unida: false })).toBe(true);
    }
  });
});
