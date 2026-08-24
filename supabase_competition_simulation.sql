-- REDA1000IA: SIMULAÇÃO MANIPULADA PARA TESTES.
-- Não oferece prêmios, pagamentos, assinaturas ou competição reais.
-- Execute no SQL Editor do Supabase somente no ambiente de demonstração.

begin;

update public.plans set daily_limit = 10, price = 0, active = true where name = 'FREE';
update public.plans set daily_limit = 25, price = 29.99, active = true where name = 'PREMIUM';
update public.plans set daily_limit = 2147483647, price = 39.99, active = true where name = 'ULTRA_PREMIUM';

drop table if exists public.credit_transactions cascade;
drop table if exists public.billing_events cascade;
drop table if exists public.payments cascade;
alter table public.users drop column if exists bonus_credits;
alter table public.users drop column if exists stripe_customer_id;
alter table public.users drop column if exists stripe_subscription_id;
alter table public.users drop column if exists subscription_status;
drop type if exists public.paymentstatus;

create table if not exists public.competition_simulation_profiles (
  user_id integer primary key references public.users(id) on delete cascade,
  simulated_position integer not null default 17500 check (simulated_position between 1 and 20000),
  simulated_points integer not null default 0 check (simulated_points >= 0),
  position_boost integer not null default 0 check (position_boost >= 0),
  top3_until timestamptz,
  cycle_started_at timestamptz not null default now(),
  disclaimer_acknowledged boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.simulation_events (
  id bigint generated always as identity primary key,
  user_id integer not null references public.users(id) on delete cascade,
  event_type varchar(40) not null,
  simulated_price_cents integer not null default 0 check (simulated_price_cents >= 0),
  points_delta integer not null default 0,
  positions_delta integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_simulation_events_user_id
  on public.simulation_events (user_id, created_at desc);

comment on table public.competition_simulation_profiles is
  'Ranking manipulado exclusivamente para simulação; não representa competição real.';
comment on table public.simulation_events is
  'Eventos e compras fictícias, sem cobrança ou prêmio real.';

-- A aplicação usa autenticação própria e acessa estas tabelas somente pelo backend.
-- Não crie políticas baseadas em auth.uid(): os IDs locais são inteiros.
alter table public.competition_simulation_profiles enable row level security;
alter table public.simulation_events enable row level security;

commit;

select name, daily_limit, price, active from public.plans order by price;
