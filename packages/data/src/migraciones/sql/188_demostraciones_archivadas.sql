-- ─────────────────────────────────────────────────────────────────────────────
-- 188 · LOS NEGOCIOS DE DEMOSTRACIÓN DE LA 042, ARCHIVADOS EN LA BASE PROPIA (DP-10.5, fase B).
--
-- La 042 siembra tres negocios de demostración —Abarrotes Don Chuy, Ferretería La Broca y Café
-- Jacaranda— en CUALQUIER base nueva. En la base propia de Don Poncho sobran: se apagan
-- (`activa = false`). Nadie entra a ellos (el ámbito exige un negocio activo), su gente no sale en
-- la pantalla de acceso y las guardas los siguen negando (`NEGOCIOS_AJENOS`). No se borran: una
-- migración no tira datos, y apagados no estorban.
--
-- SÓLO en una base que no tiene más negocios que esos tres y, si acaso, Don Poncho: una base
-- nueva. En la compartida de la Fase A —con otros clientes— no hace nada: este repositorio nunca
-- migra esa base, y si alguien la migrara, no tocaría a nadie.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1
    from organizaciones
    where id not in (
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003',
      '617ec3ad-cdc5-46d4-8d71-a1ed479c496b'
    )
  ) then
    raise notice '188: la base tiene otros negocios; las demostraciones se quedan como están.';
    return;
  end if;

  update organizaciones
     set activa = false,
         updated_at = now()
   where id in (
     '10000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000002',
     '10000000-0000-4000-8000-000000000003'
   )
     and activa;
end $$;
