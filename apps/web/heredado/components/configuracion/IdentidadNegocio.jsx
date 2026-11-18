'use client';
import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/api/cliente';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  hayCambios,
  leidoDe,
  parcheDeLaSeccion,
  ponerAlDia,
  seToco,
} from '~/configuracion/parche-de-la-seccion';
import { Upload, Save, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCambiosSinGuardar } from '~/configuracion/cambios-sin-guardar';
import {
  MARCA_DE_PLATAFORMA,
  marcaVisibleDePlataforma,
  nombreVisibleDelSistema,
} from '~/marca/nombre-visible';

/** DP-21 · Bloque 21: la identidad se reparte en tarjetas; cada una guarda sólo estas claves. */
const CLAVES_DEL_GRUPO = {
  marca: ['nombre_sistema', 'platform_brand', 'logo_url'],
  'logos-de-papel': ['logo_ticket_url', 'logo_pdf_url'],
  fondo: ['background_image_url', 'background_logo_url', 'background_opacity', 'background_fit'],
  importes: ['colorear_importes_monetarios'],
};
const TITULOS_DEL_GRUPO = {
  marca: 'Logo y marca',
  'logos-de-papel': 'Logos del ticket y de los PDF',
  fondo: 'Fondo del sistema',
  importes: 'Importes en color',
};
const AYUDA_DEL_GRUPO = {
  marca: 'Los nombres y el logo con los que se ve el sistema por dentro (con sesión), en tickets y PDFs. La pantalla de acceso lleva siempre los de la casa.',
  'logos-de-papel': 'El logo que sale en el ticket térmico y el que sale en cortes y reportes.',
  fondo: 'La imagen o marca de agua de fondo de las pantallas.',
  importes: 'Si los importes de dinero llevan color o se ven sobrios.',
};

/**
 * Sección "Identidad del negocio".
 *
 * IMPORTANTE — Separación de logos vs fondo:
 * - "Logo del negocio" (logo_url): se usa en login, sidebar y como fallback.
 * - "Logo en documentos / tickets" (logo_ticket_url + logo_pdf_url).
 * - "Fondo del sistema" (background_image_url): IMAGEN DE FONDO real, cover.
 * - "Logo de fondo / marca de agua" (background_logo_url): comportamiento legacy
 *   (logo pequeño centrado). Solo se usa si NO hay background_image_url.
 *
 * Opacidad del fondo: 0% a 100%.
 */
export default function IdentidadNegocio({ cfg, grupo = 'marca' }) {
  const queryClient = useQueryClient();
  // DP-18: lo que se leyó al hidratar; al guardar sólo viaja lo que difiere de esto.
  const leido = useRef({});
  const alLlenar = useRef(null);
  const [form, setForm] = useState({
    nombre_negocio: '',
    nombre_sistema: '',
    platform_brand: MARCA_DE_PLATAFORMA,
    logo_url: '',
    logo_ticket_url: '',
    logo_pdf_url: '',
    background_logo_url: '',
    background_image_url: '',
    background_opacity: 0.12,
    background_fit: 'cover',
    ticket_footer: '',
    pdf_footer: '',
    footer_text: '',
    colorear_importes_monetarios: true,
  });
  const [uploading, setUploading] = useState(null); // 'logo'|'ticket'|'pdf'|'bg'|'bgimage'
  const [saving, setSaving] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // HOTFIX persistencia: solo hidratar cuando cfg ya viene del backend (tiene id).
  // Sin esta guarda, en el primer render cfg = {} y los || pisaban el form con
  // strings vacíos / defaults, causando que switches "se vuelvan a prender"
  // al regresar a la pantalla. Ahora si cfg aún no tiene id, el form mantiene
  // sus valores previos y se hidrata UNA sola vez cuando llega el cfg real.
  // También respondemos a cambios de updated_date (cuando el backend cambia
  // por otro tab/sesión) para no quedarnos con datos viejos.
  useEffect(() => {
    if (!cfg?.id) return; // ⛔ no pisar con {}
    setForm((f) => {
      const desdeLaConfig = {
      ...f,
      nombre_negocio: cfg.nombre_negocio ?? f.nombre_negocio ?? '',
      // El nombre del sistema y la marca traen de fábrica el texto de la plataforma anterior
      // («MH Astral …»): se muestran ya como Morphiq, y si se guarda, se guarda así. El NOMBRE
      // DEL NEGOCIO no se retoca: es el dato que el dueño edita.
      nombre_sistema: cfg.nombre_sistema
        ? nombreVisibleDelSistema(cfg.nombre_sistema)
        : (f.nombre_sistema ?? ''),
      platform_brand: marcaVisibleDePlataforma(cfg.platform_brand ?? f.platform_brand),
      logo_url: cfg.logo_url ?? '',
      logo_ticket_url: cfg.logo_ticket_url ?? '',
      logo_pdf_url: cfg.logo_pdf_url ?? '',
      background_logo_url: cfg.background_logo_url ?? '',
      background_image_url: cfg.background_image_url ?? '',
      background_opacity:
        typeof cfg.background_opacity === 'number' ? cfg.background_opacity : 0.12,
      background_fit: cfg.background_fit === 'contain' ? 'contain' : 'cover',
      ticket_footer: cfg.ticket_footer ?? '',
      pdf_footer: cfg.pdf_footer ?? '',
      footer_text: cfg.footer_text ?? '',
      // ⚠ CRÍTICO: usar ?? (no ||) porque `false` es valor válido.
      // Con `|| true` un switch apagado se volvía a prender solo.
      colorear_importes_monetarios: cfg.colorear_importes_monetarios ?? true,
      };
      // Contra lo GUARDADO (crudo): lo nunca guardado viaja la primera vez; lo no tocado, no.
      leido.current = leidoDe(cfg, Object.keys(desdeLaConfig));
      // DP-21 · Bloque 21: otra tarjeta que guarda no borra lo que aquí está a medias.
      const antes = alLlenar.current;
      alLlenar.current = desdeLaConfig;
      return ponerAlDia(f, antes, desdeLaConfig);
    });
  }, [cfg?.id, cfg?.updated_date]);

  const handleUpload = async (e, field, key) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5MB');
      return;
    }
    setUploading(key);
    try {
      const res = await api.archivos.subir({ file });
      const url = res?.file_url;
      if (url) {
        setForm((f) => ({ ...f, [field]: url }));
        toast.success('Imagen cargada');
      } else {
        toast.error('No se pudo subir el archivo');
      }
    } catch (err) {
      toast.error('Error al subir: ' + (err?.message || ''));
    }
    setUploading(null);
    e.target.value = '';
  };

  // DP-21 · Bloque 21: cada tarjeta guarda SÓLO lo suyo (sus claves), con su «Guardado».
  const clavesDelGrupo = CLAVES_DEL_GRUPO[grupo] ?? [];
  const seccionDelGrupo = Object.fromEntries(
    Object.entries({
      nombre_sistema: form.nombre_sistema,
      platform_brand: form.platform_brand,
      logo_url: form.logo_url,
      logo_ticket_url: form.logo_ticket_url,
      logo_pdf_url: form.logo_pdf_url,
      background_logo_url: form.background_logo_url,
      background_image_url: form.background_image_url,
      background_opacity: form.background_opacity,
      background_fit: form.background_fit,
      colorear_importes_monetarios: form.colorear_importes_monetarios,
    }).filter(([clave]) => clavesDelGrupo.includes(clave)),
  );
  // DP-21: «con cambios» es lo que se tocó desde que se llenó, no lo que nunca se guardó.
  const sucia = !!cfg?.id && seToco(seccionDelGrupo, alLlenar.current);
  useCambiosSinGuardar('identidad:' + grupo, sucia);

  const save = async () => {
    setSaving(true);
    setGuardado(false);
    try {
      const payload = parcheDeLaSeccion(seccionDelGrupo, cfg?.id ? leido.current : {});
      if (cfg?.id && !hayCambios(payload)) {
        toast.info('No hay cambios que guardar');
        setSaving(false);
        return;
      }
      await api.entidades.ConfiguracionNegocio.update(cfg?.id, payload);
      await queryClient.invalidateQueries({ queryKey: ['config'] });
      setGuardado(true);
    } catch (err) {
      toast.error('Error al guardar: ' + (err?.message || ''));
    }
    setSaving(false);
  };

  const ImageField = ({ field, label, helper, uploadKey, preview = 'logo' }) => (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        <div
          className={`rounded-lg border-2 border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0 ${preview === 'wide' ? 'w-28 h-16' : 'w-16 h-16'}`}
        >
          {form[field] ? (
            <img
              src={form[field]}
              alt=""
              className="w-full h-full"
              style={{ objectFit: preview === 'wide' ? 'cover' : 'contain' }}
            />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex gap-2 flex-wrap">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpload(e, field, uploadKey)}
              />
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-superficie hover:bg-muted transition-colors ${uploading === uploadKey ? 'opacity-60 pointer-events-none' : ''}`}
              >
                {uploading === uploadKey ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo…
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" /> Subir imagen
                  </>
                )}
              </span>
            </label>
            {form[field] && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setForm((f) => ({ ...f, [field]: '' }))}
                className="h-8 text-xs"
              >
                Quitar
              </Button>
            )}
          </div>
          {helper && <p className="text-[10px] text-muted-foreground">{helper}</p>}
        </div>
      </div>
    </div>
  );

  const opacityPct = Math.round((form.background_opacity || 0) * 100);
  const es = (g) => grupo === g;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base font-heading">{TITULOS_DEL_GRUPO[grupo]}</CardTitle>
        <p className="text-xs text-muted-foreground">{AYUDA_DEL_GRUPO[grupo]}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {es('marca') && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Nombre del sistema</Label>
                <Input
                  value={form.nombre_sistema}
                  onChange={(e) => setForm({ ...form, nombre_sistema: e.target.value })}
                  placeholder="POS Don Poncho"
                />
              </div>
              <div>
                <Label className="text-xs">Plataforma (marca)</Label>
                <Input
                  value={form.platform_brand}
                  onChange={(e) => setForm({ ...form, platform_brand: e.target.value })}
                  placeholder="POS Don Poncho"
                />
              </div>
            </div>
            <ImageField
              field="logo_url"
              label="Logo del negocio"
              helper="Se usa en la barra lateral y como respaldo de los demás logos (el acceso, sin sesión, lleva el de la casa)"
              uploadKey="logo"
            />
          </>
        )}

        {es('logos-de-papel') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageField
              field="logo_ticket_url"
              label="Logo en tickets"
              helper="Si está vacío, se usa el principal"
              uploadKey="ticket"
            />
            <ImageField
              field="logo_pdf_url"
              label="Logo en PDFs"
              helper="Cortes y reportes"
              uploadKey="pdf"
            />
          </div>
        )}

        {es('fondo') && (
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Imagen que se muestra como fondo de las pantallas del sistema. Si subes una imagen aquí
              se usará como <strong>fondo completo</strong> (cubre toda la pantalla). Si la dejas
              vacía, se usará el "Logo de fondo" como marca de agua.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ImageField
                field="background_image_url"
                label="Fondo del sistema (imagen completa)"
                helper="Se aplica como fondo a pantalla completa."
                uploadKey="bgimage"
                preview="wide"
              />
              <ImageField
                field="background_logo_url"
                label="Logo de fondo (marca de agua)"
                helper="Solo se usa si no hay imagen de fondo arriba."
                uploadKey="bg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <Label className="text-xs">Opacidad del fondo: {opacityPct}%</Label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form.background_opacity}
                  onChange={(e) =>
                    setForm({ ...form, background_opacity: parseFloat(e.target.value) })
                  }
                  className="w-full mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  0% = invisible · 100% = totalmente visible.
                </p>
              </div>
              <div>
                <Label className="text-xs">Ajuste del fondo</Label>
                <Select
                  value={form.background_fit}
                  onValueChange={(v) => setForm({ ...form, background_fit: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Cubrir toda la pantalla (recomendado)</SelectItem>
                    <SelectItem value="contain">Mostrar imagen completa</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Solo aplica al "Fondo del sistema".
                </p>
              </div>
            </div>
          </div>
        )}

        {es('importes') && (
          <div className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-muted/30">
            <div className="flex-1">
              <Label className="text-sm font-medium">Colorear importes monetarios</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Cuando está activado, los importes de dinero pueden usar colores de la marca o de
                sus tarjetas. Cuando está desactivado, los importes principales se muestran en negro
                o color neutro para una apariencia más sobria.
              </p>
            </div>
            <Switch
              checked={form.colorear_importes_monetarios}
              onCheckedChange={(v) => setForm({ ...form, colorear_importes_monetarios: v })}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={saving || !sucia} className="gap-2" variant="outline">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
          {guardado && (
            <p role="status" className="text-sm font-medium">
              ✓ Guardado
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
