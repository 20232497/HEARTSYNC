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

-- ════════════════════════════════════════════════════════════════════════════
-- 고객센터(2026-11-05): 관리자 · 공지사항 · 문의하기 — 위와 같이 SQL Editor에서 한 번 실행(여러 번 실행해도 됨)
-- 공지는 누구나(로그인 없이도) 공개된 것을 읽고, 관리자만 쓴다. 문의는 로그인한 본인 것만 쓰고·읽고·지우며, 관리자가 모든 문의를 보고 답한다.
-- 관리자는 앱에서 정할 수 없다 — 아래 admins 표에 계정 id를 SQL Editor에서만 넣는다(맨 아래 안내).

-- 관리자 목록(앱에서는 자기 행이 있는지만 볼 수 있음)
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admins: 본인 확인" on public.admins;
create policy "admins: 본인 확인" on public.admins for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

-- 이 요청의 계정이 관리자인가 — 정책에서 씀(security definer라 admins 표의 RLS와 상관없이 확인)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 고칠 때마다 updated_at을 지금으로(공지·문의 공통)
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 공지사항
create table if not exists public.notices (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 8000),
  pinned boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notices_list on public.notices (pinned desc, created_at desc);
drop trigger if exists notices_touch on public.notices;
create trigger notices_touch before update on public.notices for each row execute function public.touch_updated_at();

alter table public.notices enable row level security;
drop policy if exists "notices: 누구나 공개 공지 읽기" on public.notices;
drop policy if exists "notices: 로그인 읽기" on public.notices;
drop policy if exists "notices: 관리자 쓰기" on public.notices;
drop policy if exists "notices: 관리자 고치기" on public.notices;
drop policy if exists "notices: 관리자 지우기" on public.notices;
create policy "notices: 누구나 공개 공지 읽기" on public.notices for select to anon using (published);
create policy "notices: 로그인 읽기" on public.notices for select to authenticated using (published or (select public.is_admin()));
create policy "notices: 관리자 쓰기" on public.notices for insert to authenticated with check ((select public.is_admin()));
create policy "notices: 관리자 고치기" on public.notices for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "notices: 관리자 지우기" on public.notices for delete to authenticated using ((select public.is_admin()));
revoke all on public.notices from anon, authenticated;
grant select on public.notices to anon, authenticated;
grant insert (title, body, pinned, published) on public.notices to authenticated;
grant update (title, body, pinned, published) on public.notices to authenticated;
grant delete on public.notices to authenticated;

-- 문의하기: 사용자는 분류·제목·내용·답변 받을 이메일(선택)·앱 정보(선택)만 쓸 수 있고(열 권한), 답변·상태는 관리자만 고친다
create table if not exists public.inquiries (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null default 'etc' check (category in ('account', 'pay', 'chat', 'image', 'adult', 'bug', 'suggest', 'etc')),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 4000),
  reply_to text check (reply_to is null or char_length(reply_to) <= 120),
  meta jsonb check (meta is null or (jsonb_typeof(meta) = 'object' and pg_column_size(meta) <= 2048)),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  answer text check (answer is null or char_length(answer) <= 4000),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inquiries_user on public.inquiries (user_id, created_at desc);
create index if not exists inquiries_status on public.inquiries (status, created_at desc);

-- 넣을 때: 하루 5건까지(앱의 ASK_DAILY와 같은 값), 답변·상태는 늘 처음 값으로
-- 고칠 때: 답을 쓰면 answered_at을 채우고 답변 대기를 답변 완료로, 답을 지우면 answered_at도 비움
create or replace function public.inquiries_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.inquiries where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
      raise exception 'too_many_inquiries' using errcode = 'P0001', hint = '문의는 하루 5건까지';
    end if;
    new.status := 'open'; new.answer := null; new.answered_at := null;
  else
    if new.answer is distinct from old.answer then
      new.answered_at := case when new.answer is null or new.answer = '' then null else now() end;
      if new.answer = '' then new.answer := null; end if;
      if new.answer is not null and new.status = 'open' then new.status := 'answered'; end if;
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists inquiries_guard on public.inquiries;
create trigger inquiries_guard before insert or update on public.inquiries for each row execute function public.inquiries_guard();

alter table public.inquiries enable row level security;
drop policy if exists "inquiries: 본인·관리자 읽기" on public.inquiries;
drop policy if exists "inquiries: 본인 쓰기" on public.inquiries;
drop policy if exists "inquiries: 관리자 답변" on public.inquiries;
drop policy if exists "inquiries: 본인·관리자 지우기" on public.inquiries;
create policy "inquiries: 본인·관리자 읽기" on public.inquiries for select to authenticated using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "inquiries: 본인 쓰기" on public.inquiries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "inquiries: 관리자 답변" on public.inquiries for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "inquiries: 본인·관리자 지우기" on public.inquiries for delete to authenticated using ((select auth.uid()) = user_id or (select public.is_admin()));
revoke all on public.inquiries from anon, authenticated;
grant select, delete on public.inquiries to authenticated;
grant insert (category, title, body, reply_to, meta) on public.inquiries to authenticated;
grant update (status, answer) on public.inquiries to authenticated;

-- 관리자 정하기: 관리자로 쓸 계정으로 앱에 한 번 로그인한 뒤, 아래의 이메일을 바꿔 실행
--   insert into public.admins (user_id) select id from auth.users where email = '관리자 이메일' on conflict do nothing;
-- 소셜 로그인 계정(이메일 없음)은 Authentication → Users에서 User UID를 복사해:
--   insert into public.admins (user_id) values ('계정 UID') on conflict do nothing;
-- 관리자에서 빼기: delete from public.admins where user_id = '계정 UID';

-- 고정 관리자(2026-11-06, 사용자 요청 '어떤 작업을 하든 이 계정은 관리자'): admins는 계정 id를 보므로 계정을 지우고 다시 가입하면 id가 바뀌어 권한이 사라진다.
-- owner_emails에 있는 이메일의 '인증된' 계정은 늘 admins에 있게 한다 — 가입·인증·이메일 변경 때 자동으로 넣고, 지우기를 막고, 이 파일을 다시 실행하면 복구한다.
-- 이메일은 이 파일에 적지 않는다(공개 저장소). 이 파일을 실행한 뒤 SQL Editor에서 한 번만:
--   insert into public.owner_emails (email) values ('관리자 이메일(소문자)') on conflict do nothing;
-- 고정 풀기: delete from public.owner_emails where email = '관리자 이메일(소문자)'; (그 뒤에 admins에서 뺄 수 있음)
-- 전제: Authentication의 이메일 인증을 켜 둘 것 — 끄면 가입 즉시 인증된 것으로 처리돼, 그 이메일의 계정이 없을 때 남이 가입해 관리자가 될 수 있다.
create table if not exists public.owner_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.owner_emails enable row level security;
-- 정책·권한 없음: 앱(anon·authenticated)은 이 표를 읽지도 쓰지도 못한다 — 이메일이 API로 드러나지 않음
revoke all on public.owner_emails from anon, authenticated;

-- 가입·인증·이메일 변경 때: 인증된 고정 이메일이면 admins에 넣음(이 트리거가 실패하면 가입이 막히므로 이 일만 함)
create or replace function public.pin_owner_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and exists (select 1 from public.owner_emails where email = lower(new.email)) then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return null;
end $$;
revoke all on function public.pin_owner_admin() from public, anon, authenticated;
drop trigger if exists pin_owner_admin on auth.users;
create trigger pin_owner_admin after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.pin_owner_admin();

-- owner_emails에 넣는 순간: 이미 있는 계정도 admins로
create or replace function public.pin_owner_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admins (user_id)
    select id from auth.users where lower(email) = new.email and email_confirmed_at is not null
    on conflict do nothing;
  return null;
end $$;
revoke all on function public.pin_owner_email() from public, anon, authenticated;
drop trigger if exists pin_owner_email on public.owner_emails;
create trigger pin_owner_email after insert on public.owner_emails
  for each row execute function public.pin_owner_email();

-- 고정 관리자는 admins에서 뺄 수 없음(계정을 지울 때의 연쇄 삭제는 그 계정이 이미 없어 통과)
create or replace function public.keep_owner_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from auth.users u join public.owner_emails o on o.email = lower(u.email)
    where u.id = old.user_id and u.email_confirmed_at is not null
  ) then
    raise exception '고정 관리자는 뺄 수 없어요. 먼저 owner_emails에서 지우세요.';
  end if;
  return old;
end $$;
revoke all on function public.keep_owner_admin() from public, anon, authenticated;
drop trigger if exists keep_owner_admin on public.admins;
create trigger keep_owner_admin before delete on public.admins
  for each row execute function public.keep_owner_admin();

-- 이 파일을 다시 실행하면 복구(admins를 비웠거나(truncate — 행 트리거가 돌지 않아 막지 못함) 지우고 다시 만든 경우)
insert into public.admins (user_id)
  select u.id from auth.users u join public.owner_emails o on o.email = lower(u.email)
  where u.email_confirmed_at is not null
  on conflict do nothing;

-- 휴대폰 성인 인증(2026-11-05): 위와 같이 SQL Editor에서 한 번 실행(여러 번 실행해도 됨). 인증 결과는 Edge Function(docs/edge/verify-adult.ts)만 쓰고, 앱은 본인 것을 읽기만 한다.
-- 이름·전화번호·생년월일·CI는 저장하지 않는다 — 성인 여부·시각·만료일·시험 채널 여부뿐. 계정을 지우면 함께 지워진다.
create table if not exists public.adult_checks (
  id text primary key check (id ~ '^hs[0-9a-f]{32}$'), -- PortOne에 넘기는 인증 번호(함수가 만듦)
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  checked_at timestamptz, -- 판정한 시각(비어 있으면 인증창을 연 채 끝나지 않은 것)
  adult boolean,
  test boolean, -- 시험 채널의 결과(통신사 확인 없이 통과) — 앱의 live 모드는 인정하지 않음
  expires_at timestamptz,
  constraint adult_checks_done check ((checked_at is null) = (adult is null))
);
create index if not exists adult_checks_user on public.adult_checks (user_id, created_at desc);
alter table public.adult_checks enable row level security;
drop policy if exists "adult_checks: 본인 읽기" on public.adult_checks;
create policy "adult_checks: 본인 읽기" on public.adult_checks for select to authenticated using ((select auth.uid()) = user_id);
-- 쓰기 정책·권한 없음: 로그인한 사람도 자기 행을 만들거나 고치지 못한다(service_role을 쓰는 함수만)
revoke all on public.adult_checks from anon, authenticated;
grant select on public.adult_checks to authenticated;
grant all on public.adult_checks to service_role;
