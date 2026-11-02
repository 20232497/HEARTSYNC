-- HEART SYNC 계정 저장(Supabase) — SQL Editor에 붙여 넣고 한 번 실행
-- 앱은 로그인한 사람의 데이터를 public.kv 한 표에 키-값으로 저장한다(대화방·작품·설정·그림 등).
-- RLS(행 수준 보안)로 본인 행만 읽고 쓸 수 있으므로, 앱에 들어 있는 publishable 키가 공개돼도 남의 데이터는 볼 수 없다.

create table if not exists public.kv (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 120),
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- API 키는 평문으로 두지 않음: 앱은 키를 로그인 비밀번호로 기기에서 암호화해 "vault" 행에만 올린다.
-- settings 행에 키 칸이 들어오면(예전·잘못된 앱) 거부하고, vault 행은 암호문 모양({kid, iv, ct})만 받는다.
alter table public.kv drop constraint if exists kv_no_plain_keys;
alter table public.kv add constraint kv_no_plain_keys check (
  key <> 'settings' or jsonb_typeof(value) <> 'object' or not (value ?| array['apiKey', 'runwareKey', 'openRouterKey'])
);
alter table public.kv drop constraint if exists kv_vault_sealed;
alter table public.kv add constraint kv_vault_sealed check (
  key <> 'vault' or (jsonb_typeof(value) = 'object' and value ?& array['kid', 'iv', 'ct'])
);

-- 바뀐 것만 받아 오기(updated_at 기준)
create index if not exists kv_user_updated on public.kv (user_id, updated_at);

-- 고칠 때마다 updated_at을 지금으로
create or replace function public.kv_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists kv_touch on public.kv;
create trigger kv_touch before insert or update on public.kv
  for each row execute function public.kv_touch();

alter table public.kv enable row level security;

drop policy if exists "kv: 본인 읽기" on public.kv;
drop policy if exists "kv: 본인 쓰기" on public.kv;
drop policy if exists "kv: 본인 고치기" on public.kv;
drop policy if exists "kv: 본인 지우기" on public.kv;
create policy "kv: 본인 읽기" on public.kv for select to authenticated using ((select auth.uid()) = user_id);
create policy "kv: 본인 쓰기" on public.kv for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "kv: 본인 고치기" on public.kv for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "kv: 본인 지우기" on public.kv for delete to authenticated using ((select auth.uid()) = user_id);

-- 로그인하지 않은 요청(anon)은 표에 손대지 못하게
revoke all on public.kv from anon;
grant select, insert, update, delete on public.kv to authenticated;

-- MY → 계정 삭제: 본인 계정만 지움(kv 행은 on delete cascade로 같이 지워짐)
create or replace function public.delete_me() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.delete_me() to authenticated;
