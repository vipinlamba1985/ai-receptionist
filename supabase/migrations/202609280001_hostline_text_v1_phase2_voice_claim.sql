begin;

create or replace function public.claim_missed_call_recovery(
  p_call_sid text,
  p_from_e164 text,
  p_to_e164 text,
  p_provider text,
  p_raw_payload jsonb
)
returns table (
  outcome text,
  business_id uuid,
  customer_id uuid,
  conversation_id uuid,
  call_event_id uuid,
  message_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_business public.businesses%rowtype;
  v_customer public.customers%rowtype;
  v_existing public.call_events%rowtype;
  v_call_event public.call_events%rowtype;
  v_conversation public.conversations%rowtype;
  v_message public.messages%rowtype;
  v_recent_call_event_id uuid;
begin
  if p_provider not in ('twilio', 'simulation') then
    raise exception 'Unsupported provider: %', p_provider
      using errcode = '22023';
  end if;

  select b.*
  into v_business
  from public.phone_numbers pn
  join public.businesses b on b.id = pn.business_id
  where pn.e164 = p_to_e164
    and pn.is_active
    and b.is_active
  limit 1;

  if not found then
    return query
      select
        'unknown_number'::text,
        null::uuid,
        null::uuid,
        null::uuid,
        null::uuid,
        null::uuid;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_business.id::text),
    pg_catalog.hashtext(p_from_e164)
  );

  select ce.*
  into v_existing
  from public.call_events ce
  where ce.call_sid = p_call_sid
  limit 1;

  if found then
    return query
      select
        'duplicate'::text,
        v_existing.business_id,
        v_existing.customer_id,
        v_existing.conversation_id,
        v_existing.id,
        (
          select m.id
          from public.messages m
          where m.idempotency_key =
            'call:' || p_call_sid || ':recovery-sms'
          limit 1
        );
    return;
  end if;

  insert into public.customers (
    business_id,
    phone_e164,
    updated_at
  )
  values (
    v_business.id,
    p_from_e164,
    pg_catalog.now()
  )
  on conflict on constraint customers_business_id_phone_e164_key
  do update
    set updated_at = excluded.updated_at
  returning *
  into v_customer;

  if v_customer.is_opted_out then
    insert into public.call_events (
      business_id,
      customer_id,
      call_sid,
      from_e164,
      to_e164,
      provider,
      delivery_status,
      raw_payload
    )
    values (
      v_business.id,
      v_customer.id,
      p_call_sid,
      p_from_e164,
      p_to_e164,
      p_provider,
      'sms_suppressed',
      coalesce(p_raw_payload, '{}'::jsonb)
    )
    returning *
    into v_call_event;

    return query
      select
        'opted_out'::text,
        v_business.id,
        v_customer.id,
        null::uuid,
        v_call_event.id,
        null::uuid;
    return;
  end if;

  select ce.id
  into v_recent_call_event_id
  from public.call_events ce
  where ce.business_id = v_business.id
    and ce.from_e164 = p_from_e164
    and ce.delivery_status in ('sms_queued', 'sms_sent')
    and ce.received_at >=
      pg_catalog.now() -
      pg_catalog.make_interval(secs => v_business.cooldown_seconds)
  order by ce.received_at desc
  limit 1;

  if found then
    insert into public.call_events (
      business_id,
      customer_id,
      call_sid,
      from_e164,
      to_e164,
      provider,
      delivery_status,
      raw_payload
    )
    values (
      v_business.id,
      v_customer.id,
      p_call_sid,
      p_from_e164,
      p_to_e164,
      p_provider,
      'sms_suppressed',
      coalesce(p_raw_payload, '{}'::jsonb)
    )
    returning *
    into v_call_event;

    return query
      select
        'cooldown_suppressed'::text,
        v_business.id,
        v_customer.id,
        null::uuid,
        v_call_event.id,
        null::uuid;
    return;
  end if;

  insert into public.call_events (
    business_id,
    customer_id,
    call_sid,
    from_e164,
    to_e164,
    provider,
    delivery_status,
    raw_payload
  )
  values (
    v_business.id,
    v_customer.id,
    p_call_sid,
    p_from_e164,
    p_to_e164,
    p_provider,
    'received',
    coalesce(p_raw_payload, '{}'::jsonb)
  )
  returning *
  into v_call_event;

  insert into public.conversations (
    business_id,
    customer_id,
    source_call_event_id,
    status
  )
  values (
    v_business.id,
    v_customer.id,
    v_call_event.id,
    'received'
  )
  returning *
  into v_conversation;

  update public.call_events
  set
    conversation_id = v_conversation.id,
    delivery_status = 'sms_queued'
  where id = v_call_event.id;

  insert into public.messages (
    business_id,
    conversation_id,
    customer_id,
    direction,
    channel,
    provider,
    idempotency_key,
    body,
    status
  )
  values (
    v_business.id,
    v_conversation.id,
    v_customer.id,
    'outbound',
    'sms',
    p_provider,
    'call:' || p_call_sid || ':recovery-sms',
    v_business.default_sms_body,
    'queued'
  )
  returning *
  into v_message;

  return query
    select
      'queued'::text,
      v_business.id,
      v_customer.id,
      v_conversation.id,
      v_call_event.id,
      v_message.id;
end;
$$;

revoke all on function public.claim_missed_call_recovery(
  text,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.claim_missed_call_recovery(
  text,
  text,
  text,
  text,
  jsonb
) to service_role;

comment on function public.claim_missed_call_recovery(
  text,
  text,
  text,
  text,
  jsonb
) is
  'Atomically records a missed call, applies CallSid/caller cooldown dedupe, and queues one recovery SMS.';

commit;
