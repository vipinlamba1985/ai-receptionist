begin;

create extension if not exists pgcrypto;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Toronto',
  default_sms_body text not null default 'Sorry we missed your call. Reply here and we will help you.',
  cooldown_seconds integer not null default 10800 check (cooldown_seconds between 60 and 86400),
  is_demo boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  e164 text not null unique check (e164 ~ '^\+[1-9][0-9]{7,14}$'),
  provider text not null check (provider in ('twilio', 'simulation')),
  provider_number_sid text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  display_name text,
  is_opted_out boolean not null default false,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, phone_e164)
);

create table public.call_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  conversation_id uuid,
  call_sid text not null unique,
  from_e164 text not null check (from_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  to_e164 text not null check (to_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  provider text not null check (provider in ('twilio', 'simulation')),
  event_type text not null default 'missed_call' check (event_type in ('missed_call')),
  delivery_status text not null default 'received' check (
    delivery_status in ('received', 'sms_queued', 'sms_sent', 'sms_suppressed', 'failed')
  ),
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  source_call_event_id uuid unique references public.call_events(id) on delete set null,
  status text not null default 'received' check (
    status in (
      'received',
      'sms_sent',
      'customer_replied',
      'qualified',
      'callback_requested',
      'resolved'
    )
  ),
  last_activity_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.call_events
  add constraint call_events_conversation_id_fkey
  foreign key (conversation_id) references public.conversations(id) on delete set null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  channel text not null default 'sms' check (channel in ('sms')),
  provider text not null check (provider in ('twilio', 'simulation')),
  provider_message_sid text unique,
  idempotency_key text not null unique,
  body text not null,
  status text not null check (
    status in ('queued', 'sent', 'delivered', 'failed', 'received', 'suppressed')
  ),
  error_code text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  requested_for timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  event_type text not null check (
    event_type in ('consent_recorded', 'opt_in', 'opt_out', 'help')
  ),
  source text not null check (source in ('twilio', 'simulation', 'manual')),
  keyword text,
  provider_message_sid text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  actor_type text not null check (actor_type in ('system', 'customer', 'user', 'provider')),
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index phone_numbers_business_active_idx
  on public.phone_numbers (business_id, is_active);

create index customers_business_phone_idx
  on public.customers (business_id, phone_e164);

create index call_events_cooldown_lookup_idx
  on public.call_events (business_id, from_e164, received_at desc);

create index conversations_business_activity_idx
  on public.conversations (business_id, last_activity_at desc);

create index conversations_business_status_idx
  on public.conversations (business_id, status);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

create index messages_retry_idx
  on public.messages (created_at)
  where direction = 'outbound' and status in ('queued', 'failed');

create unique index callback_requests_one_pending_per_conversation_idx
  on public.callback_requests (conversation_id)
  where status = 'pending';

create index callback_requests_business_status_idx
  on public.callback_requests (business_id, status, created_at);

create unique index consent_events_provider_dedupe_idx
  on public.consent_events (source, provider_message_sid, event_type)
  where provider_message_sid is not null;

create index audit_logs_business_created_idx
  on public.audit_logs (business_id, created_at desc);

alter table public.businesses enable row level security;
alter table public.phone_numbers enable row level security;
alter table public.call_events enable row level security;
alter table public.customers enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.callback_requests enable row level security;
alter table public.consent_events enable row level security;
alter table public.audit_logs enable row level security;

create policy business_owner_read
  on public.businesses
  for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy phone_numbers_owner_read
  on public.phone_numbers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = phone_numbers.business_id
        and b.owner_user_id = auth.uid()
    )
  );

create policy call_events_owner_read
  on public.call_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = call_events.business_id
        and b.owner_user_id = auth.uid()
    )
  );

create policy customers_owner_read
  on public.customers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = customers.business_id
        and b.owner_user_id = auth.uid()
    )
  );

create policy conversations_owner_read
  on public.conversations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = conversations.business_id
        and b.owner_user_id = auth.uid()
    )
  );

create policy messages_owner_read
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = messages.business_id
        and b.owner_user_id = auth.uid()
    )
  );

create policy callback_requests_owner_read
  on public.callback_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = callback_requests.business_id
        and b.owner_user_id = auth.uid()
    )
  );

create policy consent_events_owner_read
  on public.consent_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = consent_events.business_id
        and b.owner_user_id = auth.uid()
    )
  );

create policy audit_logs_owner_read
  on public.audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = audit_logs.business_id
        and b.owner_user_id = auth.uid()
    )
  );

revoke all on table
  public.businesses,
  public.phone_numbers,
  public.call_events,
  public.customers,
  public.conversations,
  public.messages,
  public.callback_requests,
  public.consent_events,
  public.audit_logs
from anon;

grant usage on schema public to authenticated, service_role;

grant select on table
  public.businesses,
  public.phone_numbers,
  public.call_events,
  public.customers,
  public.conversations,
  public.messages,
  public.callback_requests,
  public.consent_events,
  public.audit_logs
to authenticated;

grant all on table
  public.businesses,
  public.phone_numbers,
  public.call_events,
  public.customers,
  public.conversations,
  public.messages,
  public.callback_requests,
  public.consent_events,
  public.audit_logs
to service_role;

commit;
