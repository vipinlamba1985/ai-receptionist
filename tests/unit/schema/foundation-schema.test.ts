import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202609270001_hostline_text_v1_foundation.sql"
  ),
  "utf8"
);

const requiredTables = [
  "businesses",
  "phone_numbers",
  "call_events",
  "customers",
  "conversations",
  "messages",
  "callback_requests",
  "consent_events",
  "audit_logs"
] as const;

describe("Hostline foundation migration", () => {
  it("creates every required phase-1 table", () => {
    for (const table of requiredTables) {
      expect(migration).toContain(`create table public.${table}`);
    }
  });

  it("enables RLS on every Hostline table", () => {
    for (const table of requiredTables) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`
      );
    }
  });

  it("contains the required conversation state machine", () => {
    for (const status of [
      "received",
      "sms_sent",
      "customer_replied",
      "qualified",
      "callback_requested",
      "resolved"
    ]) {
      expect(migration).toContain(`'${status}'`);
    }
  });

  it("has database-level dedupe constraints for provider IDs", () => {
    expect(migration).toMatch(/call_sid text not null unique/i);
    expect(migration).toMatch(/provider_message_sid text unique/i);
    expect(migration).toMatch(/idempotency_key text not null unique/i);
  });

  it("keeps anon blocked and adds explicit Data API grants", () => {
    expect(migration).toMatch(/from anon;/i);
    expect(migration).toMatch(/to authenticated;/i);
    expect(migration).toMatch(/to service_role;/i);
  });
});
