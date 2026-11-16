'use client';

import * as AccordionUi from '@morphiqpos/ui/primitivas/accordion';
import * as CheckboxUi from '@morphiqpos/ui/primitivas/checkbox';
import * as CollapsibleUi from '@morphiqpos/ui/primitivas/collapsible';
import * as MenuUi from '@morphiqpos/ui/primitivas/dropdown-menu';
import * as PopoverUi from '@morphiqpos/ui/primitivas/popover';
import * as RadioUi from '@morphiqpos/ui/primitivas/radio-group';
import * as SelectUi from '@morphiqpos/ui/primitivas/select';
import * as SheetUi from '@morphiqpos/ui/primitivas/sheet';
import * as SwitchUi from '@morphiqpos/ui/primitivas/switch';
import * as TabsUi from '@morphiqpos/ui/primitivas/tabs';
import { useEffect, type ElementType } from 'react';

import { montarTieneEnElNavegador } from '~/compatibilidad/tiene-de-respaldo';

import * as AccordionViejo from '@/components/ui/accordion';
import * as CheckboxViejo from '@/components/ui/checkbox';
import * as CollapsibleViejo from '@/components/ui/collapsible';
import * as MenuViejo from '@/components/ui/dropdown-menu';
import * as PopoverViejo from '@/components/ui/popover';
import * as RadioViejo from '@/components/ui/radio-group';
import * as SelectViejo from '@/components/ui/select';
import * as SheetViejo from '@/components/ui/sheet';
import * as SwitchViejo from '@/components/ui/switch';
import * as TabsViejo from '@/components/ui/tabs';

/**
 * LOS ESTADOS DE LAS PIEZAS DEL SISTEMA, A LA VISTA (DP-21 · Bloque 15).
 *
 * Una muestra de cada pieza de Radix en el estado donde el motor viejo del iMin pintaba mal los
 * colores: la pestaña activa, la lista y el menú que se abren con un renglón resaltado, el popover y
 * el panel lateral, el acordeón y el desplegable abiertos, el interruptor encendido, la casilla y la
 * opción marcadas, el anillo de foco y el texto seleccionado. Cada pieza va DOS veces: la del
 * sistema (`packages/ui`, de las pantallas nuevas) y la heredada (`heredado/components/ui`, de las
 * pantallas de siempre): usan los mismos colores del tema pero cada una escribe sus variantes.
 *
 * Se enseña con `/sistema?estados`; sin eso, la página del sistema es la de siempre. Los
 * `data-muestra*` son los accesos de `pruebas/e2e/ayudantes/recorrido-estados.ts`, que anda los
 * estados en el Chrome de hoy y en el Chromium viejo y compara los colores calculados.
 */

type Pieza = ElementType;
type Conjunto = Readonly<Record<string, Pieza>>;

const OPCIONES = ['uno', 'dos', 'tres'] as const;

function Muestra({ pieza, nombre, c }: { pieza: string; nombre: string; c: Conjunto }) {
  const get = (n: string): Pieza => c[n] ?? 'div';
  const [Tabs, TabsList, TabsTrigger, TabsContent] = [
    'Tabs',
    'TabsList',
    'TabsTrigger',
    'TabsContent',
  ].map(get) as [Pieza, Pieza, Pieza, Pieza];
  const [Select, SelectTrigger, SelectValue, SelectContent, SelectItem] = [
    'Select',
    'SelectTrigger',
    'SelectValue',
    'SelectContent',
    'SelectItem',
  ].map(get) as [Pieza, Pieza, Pieza, Pieza, Pieza];
  const [Menu, MenuTrigger, MenuContent, MenuItem] = [
    'DropdownMenu',
    'DropdownMenuTrigger',
    'DropdownMenuContent',
    'DropdownMenuItem',
  ].map(get) as [Pieza, Pieza, Pieza, Pieza];
  const [Popover, PopoverTrigger, PopoverContent] = [
    'Popover',
    'PopoverTrigger',
    'PopoverContent',
  ].map(get) as [Pieza, Pieza, Pieza];
  const [Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription] = [
    'Sheet',
    'SheetTrigger',
    'SheetContent',
    'SheetTitle',
    'SheetDescription',
  ].map(get) as [Pieza, Pieza, Pieza, Pieza, Pieza];
  const [Accordion, AccordionItem, AccordionTrigger, AccordionContent] = [
    'Accordion',
    'AccordionItem',
    'AccordionTrigger',
    'AccordionContent',
  ].map(get) as [Pieza, Pieza, Pieza, Pieza];
  const [Collapsible, CollapsibleTrigger, CollapsibleContent] = [
    'Collapsible',
    'CollapsibleTrigger',
    'CollapsibleContent',
  ].map(get) as [Pieza, Pieza, Pieza];
  const [Switch, Checkbox, RadioGroup, RadioGroupItem] = [
    'Switch',
    'Checkbox',
    'RadioGroup',
    'RadioGroupItem',
  ].map(get) as [Pieza, Pieza, Pieza, Pieza];
  const rotulo = (texto: string) => `${nombre} · ${texto}`;

  return (
    <section
      aria-label={nombre}
      data-muestra={pieza}
      className="flex flex-col gap-(--espacio-4) rounded-lg border p-(--espacio-4)"
    >
      <h2 className="text-lg font-semibold">{nombre}</h2>

      <Tabs defaultValue="dos">
        <TabsList>
          <TabsTrigger value="uno">Uno</TabsTrigger>
          <TabsTrigger value="dos">Dos</TabsTrigger>
        </TabsList>
        <TabsContent value="uno">Contenido uno</TabsContent>
        <TabsContent value="dos">Contenido dos</TabsContent>
      </Tabs>

      <Select defaultValue="dos">
        <SelectTrigger aria-label={rotulo('lista')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPCIONES.map((v) => (
            <SelectItem key={v} value={v}>
              Opción {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Menu>
        <MenuTrigger>{rotulo('menú')}</MenuTrigger>
        <MenuContent>
          {OPCIONES.map((v) => (
            <MenuItem key={v}>Acción {v}</MenuItem>
          ))}
        </MenuContent>
      </Menu>

      <Popover>
        <PopoverTrigger>{rotulo('popover')}</PopoverTrigger>
        <PopoverContent>Dentro del popover</PopoverContent>
      </Popover>

      <Sheet>
        <SheetTrigger>{rotulo('panel')}</SheetTrigger>
        <SheetContent>
          <SheetTitle>{rotulo('panel lateral')}</SheetTitle>
          <SheetDescription>Dentro del panel</SheetDescription>
        </SheetContent>
      </Sheet>

      <Accordion type="single" collapsible defaultValue="a">
        <AccordionItem value="a">
          <AccordionTrigger>{rotulo('acordeón')}</AccordionTrigger>
          <AccordionContent>Dentro del acordeón</AccordionContent>
        </AccordionItem>
      </Accordion>

      <Collapsible defaultOpen>
        <CollapsibleTrigger>{rotulo('desplegable')}</CollapsibleTrigger>
        <CollapsibleContent>Dentro del desplegable</CollapsibleContent>
      </Collapsible>

      <div className="flex items-center gap-(--espacio-4)">
        <Switch defaultChecked aria-label={rotulo('interruptor')} />
        <Checkbox defaultChecked aria-label={rotulo('casilla')} />
        <RadioGroup defaultValue="b" aria-label={rotulo('opciones')}>
          <RadioGroupItem value="a" aria-label={rotulo('opción a')} />
          <RadioGroupItem value="b" aria-label={rotulo('opción b')} />
        </RadioGroup>
      </div>

      {/* La tarjeta con la opción elegida: `:has(:checked)` y `:has(:focus-visible)`, que Chromium < 105 no lee. */}
      <label className="flex items-center gap-2 rounded-md border-2 border-transparent px-(--espacio-3) py-2 has-checked:border-primario has-checked:font-semibold has-focus-visible:ring-[3px] has-focus-visible:ring-anillo/60">
        <input type="radio" name={`tarjeta-${pieza}`} defaultChecked />
        {rotulo('tarjeta elegida')}
      </label>
      <p data-muestra-de="seleccion">Texto que se selecciona para ver su color</p>
      <button
        type="button"
        data-muestra-de="foco"
        className="rounded-md border px-(--espacio-3) py-2"
      >
        {rotulo('botón con foco')}
      </button>
    </section>
  );
}

export function EstadosDelSistema() {
  // Fuera del armazón del POS (aquí no hay), el relleno de `:has()` se monta por su cuenta.
  useEffect(() => montarTieneEnElNavegador(), []);
  return (
    <main
      className="grid gap-(--espacio-6) p-(--espacio-6) lg:grid-cols-2"
      aria-label="Estados de las piezas"
    >
      <Muestra
        pieza="sistema"
        nombre="Sistema"
        c={{
          ...TabsUi,
          ...SelectUi,
          ...MenuUi,
          ...PopoverUi,
          ...SheetUi,
          ...AccordionUi,
          ...CollapsibleUi,
          ...SwitchUi,
          ...CheckboxUi,
          ...RadioUi,
        }}
      />
      <Muestra
        pieza="heredado"
        nombre="Heredado"
        c={{
          ...TabsViejo,
          ...SelectViejo,
          ...MenuViejo,
          ...PopoverViejo,
          ...SheetViejo,
          ...AccordionViejo,
          ...CollapsibleViejo,
          ...SwitchViejo,
          ...CheckboxViejo,
          ...RadioViejo,
        }}
      />
    </main>
  );
}
