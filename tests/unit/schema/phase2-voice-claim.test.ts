import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202609280001_hostline_text_v1_phase2_voice_claim.sql"
  ),
  "utf8"
);

describe("Phase 2 missed-call claim migration", () => {
  it("serializes claims per business and caller before cooldown evaluation", () => {
    expect(migration).toMatch(/pg_advisory_xact_lock/i);
    expect(migration).toMatch(/cooldown_seconds/i);
    expect(migration).toMatch(/cooldown_suppressed/i);
  });

  it("does not let suppressed calls extend the SMS cooldown", () => {
    expect(migration).toMatch(
      /delivery_status in \('sms_queued', 'sms_sent'\)/i
    );
  });

  it("deduplicates CallSid before queueing the recovery SMS", () => {
    expect(migration).toMatch(/where ce\.call_sid = p_call_sid/i);
    expect(migration).toMatch(/'duplicate'::text/i);
    expect(migration).toMatch(
      /'call:' \|\| p_call_sid \|\| ':recovery-sms'/i
    );
  });

  it("queues but does not send the recovery SMS in Phase 2", () => {
    expect(migration).toMatch(/'outbound'/i);
    expect(migration).toMatch(/'queued'/i);
    expect(migration).not.toMatch(/messages\.create/i);
  });

  it("keeps the RPC invoker-secure and service-role only", () => {
    expect(migration).toMatch(/security invoker/i);
    expect(migration).not.toMatch(/security definer/i);
    expect(migration).toMatch(
      /revoke all on function[\s\S]*from public, anon, authenticated/i
    );
    expect(migration).toMatch(
      /grant execute on function[\s\S]*to service_role/i
    );
  });
});
