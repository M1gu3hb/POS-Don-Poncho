import { describe, expect, it } from 'vitest';

import { evaluarDireccion, problemaDeLaDireccion } from './direccion-local.ts';

/**
 * DP-D125 · DP-20.1 · LA IMPRESORA DE RED VIVE EN LA RED LOCAL. Los mismos casos que prueban las
 * apps (`DireccionPrivadaTest.kt` en Android): la página, Windows y Android tienen que rechazar y
 * aceptar exactamente lo mismo.
 */

const todas = (direcciones: readonly string[], veredicto: string): void => {
  for (const direccion of direcciones)
    expect([direccion, evaluarDireccion(direccion)]).toEqual([direccion, veredicto]);
};

describe('IPv4', () => {
  it('las privadas, las de enlace local y las del propio aparato se permiten', () => {
    todas(
      [
        '10.0.0.1',
        '10.255.255.254',
        '172.16.0.1',
        '172.31.255.254',
        '192.168.0.1',
        '192.168.1.50',
        '169.254.1.1',
        '127.0.0.1',
        '127.255.255.254',
      ],
      'permitida',
    );
  });

  it('las públicas y las reservadas fuera de la lista se rechazan', () => {
    todas(
      [
        '8.8.8.8',
        '1.1.1.1',
        '9.255.255.255',
        '11.0.0.1',
        '172.15.255.255',
        '172.32.0.1',
        '192.167.1.1',
        '192.169.1.1',
        '169.253.1.1',
        '100.64.0.1',
        '192.0.2.10',
        '224.0.0.1',
        '255.255.255.255',
        '0.0.0.0',
      ],
      'publica',
    );
  });

  it('un nombre nunca se acepta: no se le pregunta a ningún DNS', () => {
    todas(
      [
        'localhost',
        'impresora-cocina',
        'impresora.local',
        'ticket.example.com',
        '192.168.1.1.evil.com',
        'evil.com/192.168.1.1',
        'http://192.168.1.1',
      ],
      'no-es-literal',
    );
  });

  it('las formas ambiguas de escribirla se rechazan', () => {
    todas(
      [
        '010.0.0.1',
        '0177.0.0.1',
        '192.168.001.001',
        '127.1',
        '127.0.1',
        '0x7f.1',
        '0x7f.0.0.1',
        '2130706433',
        '1',
        '1.1.1',
        '1.1.1.',
        '.1.1.1',
        '1..1.1',
        '1.1.1.1.1',
        '1.1.1.256',
        '+1.1.1.1',
        '-1.0.0.1',
        '٠.٠.٠.١',
      ],
      'no-es-literal',
    );
  });

  it('con puerto, con máscara o con texto pegado no es una dirección', () => {
    todas(
      ['192.168.1.1:9100', '192.168.1.1/24', '192.168.1.1 y otra', '192.168.1.1\n10.0.0.1'],
      'no-es-literal',
    );
  });

  it('los espacios de alrededor se ignoran', () => {
    todas(['  192.168.1.5 ', ' 10.1.2.3 '], 'permitida');
    todas(['', '   '], 'vacia');
  });
});

describe('IPv6', () => {
  it('la del propio aparato, las ULA y las de enlace local se permiten', () => {
    todas(
      [
        '::1',
        '0:0:0:0:0:0:0:1',
        '[::1]',
        'fc00::1',
        'fd00::1',
        '[fd00::5]',
        'fdff:ffff::1',
        'fe80::1',
        'FE80::A',
        'febf::1',
        'fe80::1234:5678:9abc:def0',
        'fe80::1%wlan0',
        'fe80::1%eth0',
      ],
      'permitida',
    );
  });

  it('una zona sólo vale en las de enlace local, y bien escrita', () => {
    todas(['fd00::1%wlan0', '2001:db8::1%wlan0', 'fe80::1%', 'fe80::1%wl an0'], 'no-es-literal');
  });

  it('las públicas, la no especificada y la «sitio local» vieja se rechazan', () => {
    todas(
      [
        '2001:db8::1',
        '2606:4700:4700::1111',
        '::',
        'fe00::1',
        'fec0::1',
        'ff02::1',
        '64:ff9b::808:808',
      ],
      'publica',
    );
  });

  it('una IPv4 metida en una IPv6 se juzga por la IPv4', () => {
    todas(
      ['::ffff:192.168.1.5', '::ffff:10.0.0.1', '::ffff:127.0.0.1', '::ffff:c0a8:0105'],
      'permitida',
    );
    todas(['::ffff:8.8.8.8', '0:0:0:0:0:ffff:8.8.8.8', '::ffff:808:808', '::8.8.8.8'], 'publica');
    todas(['::ffff:010.0.0.1', '::ffff:1.2.3.256', '::1.2.3'], 'no-es-literal');
  });

  it('una IPv6 mal escrita no es una dirección', () => {
    todas(
      [
        ':::1',
        '::1::',
        '1::2::3',
        'fe80::1::2',
        '1:2:3:4:5:6:7',
        '1:2:3:4:5:6:7:8:9',
        '12345::1',
        'g::1',
        '1:',
        'a:',
        ':1',
      ],
      'no-es-literal',
    );
    // `1::` sí está bien escrita (y es pública).
    todas(['1::'], 'publica');
  });

  it('un texto larguísimo se rechaza sin leerlo', () => {
    todas([`fe80::${'1:'.repeat(60)}1`], 'no-es-literal');
  });
});

describe('lo que se le dice a quien llena el formulario', () => {
  it('nada cuando sirve, y con palabras cuando no', () => {
    expect(problemaDeLaDireccion('192.168.1.50')).toBeNull();
    expect(problemaDeLaDireccion('')).toBe('Escribe la dirección IP de la impresora.');
    expect(problemaDeLaDireccion('8.8.8.8')).toBe(
      'Sólo se imprime en red hacia direcciones de tu red local (como 192.168.x.x o 10.x.x.x).',
    );
    expect(problemaDeLaDireccion('impresora-cocina')).toBe(
      'Escribe la dirección IP completa de la impresora (por ejemplo 192.168.1.50), no su nombre.',
    );
  });
});
