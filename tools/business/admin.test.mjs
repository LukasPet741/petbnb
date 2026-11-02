import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCommand, formatClaims, formatPromotions, outreachCsv, USAGE } from "./lib.mjs";

const UUID = "3f6c2a1e-9b7d-4c1a-8e2f-0a1b2c3d4e5f";

describe("parseCommand", () => {
  it("lists claims by default and on request", () => {
    expect(parseCommand([])).toEqual({ kind: "claims" });
    expect(parseCommand(["claims"])).toEqual({ kind: "claims" });
    expect(parseCommand(["promotions"])).toEqual({ kind: "promotions" });
    expect(parseCommand(["outreach"])).toEqual({ kind: "outreach" });
  });

  it("approves one claim by id", () => {
    expect(parseCommand(["approve", UUID])).toEqual({ kind: "approve", claimId: UUID });
  });

  it("rejects one claim with the reason the claimant will read", () => {
    expect(parseCommand(["reject", UUID, "We", "could", "not", "reach", "you"])).toEqual({ kind: "reject", claimId: UUID, reason: "We could not reach you" });
  });

  it("refuses a reject without a reason, an id that is not a uuid, and unknown commands", () => {
    expect(parseCommand(["reject", UUID])).toEqual({ kind: "error", message: expect.stringMatching(/reason/) });
    expect(parseCommand(["approve", "42"])).toEqual({ kind: "error", message: expect.stringMatching(/claim id/) });
    expect(parseCommand(["approve"])).toEqual({ kind: "error", message: expect.stringMatching(/claim id/) });
    expect(parseCommand(["delete-everything"])).toEqual({ kind: "error", message: expect.stringMatching(/Unknown command/) });
  });

  it("documents every command it accepts", () => {
    for (const word of ["claims", "approve", "reject", "promotions", "outreach"]) expect(USAGE).toContain(word);
  });
});

describe("formatClaims", () => {
  it("says so when nothing waits", () => {
    expect(formatClaims([])).toBe("No claims waiting.");
  });

  it("shows what Lukas needs to decide: place, who, role, their message, and the id to act on", () => {
    const out = formatClaims([
      { id: UUID, placeName: "Dogiday", email: "owner@example.com", role: "owner", message: "Call 860000000", createdAt: "2026-11-02T10:00:00Z" },
    ]);
    expect(out).toContain("Dogiday");
    expect(out).toContain("owner@example.com");
    expect(out).toContain("owner");
    expect(out).toContain("Call 860000000");
    expect(out).toContain(UUID);
    expect(out).toContain("2026-11-02");
  });
});

describe("formatPromotions", () => {
  it("lists each subscription with its place and status, and counts the paying ones", () => {
    const out = formatPromotions([
      { placeName: "Dogiday", status: "active", subscriptionId: "sub_1", since: "2026-11-01T00:00:00Z" },
      { placeName: "Kika", status: "canceled", subscriptionId: "sub_2", since: "2026-10-01T00:00:00Z" },
    ]);
    expect(out).toContain("Dogiday");
    expect(out).toContain("sub_2");
    expect(out).toMatch(/1 paying/);
  });

  it("says so when nobody has paid yet", () => {
    expect(formatPromotions([])).toBe("No promotions yet.");
  });
});

describe("the claim decisions migration", () => {
  const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261103110000_place_claim_decisions.sql"), "utf8").replace(/--.*$/gm, "");

  it("gives a place to its claimant only while it has no owner", () => {
    expect(sql).toMatch(/set owner_user_id = v_user,[^;]*where id = v_place and owner_user_id is null/);
  });

  it("makes a claimed listed place a partner, so it stops saying it is not one", () => {
    expect(sql).toMatch(/tier = case when tier = 'listed' then 'partner' else tier end/);
  });

  it("does the same for places claimed before it, by hand", () => {
    expect(sql).toMatch(/update public\.places set tier = 'partner'\s+where tier = 'listed' and owner_user_id is not null/);
  });

  it("closes the other open claims for that place, with a reason", () => {
    expect(sql).toMatch(/status = 'rejected', decided_reason = '[^']+'/);
  });

  it("tells the claimant in the app, never by email (booking-notify skips these types)", () => {
    expect(sql).toMatch(/'claim_approved', 'claim_rejected'/);
    expect(sql).toMatch(/insert into public\.notifications \(user_id, type\)[\s\S]*'claim_approved'/);
    expect(sql).toMatch(/insert into public\.notifications \(user_id, type\)[\s\S]*'claim_rejected'/);
  });

  it("is for the service role alone", () => {
    for (const fn of ["approve_place_claim(uuid)", "reject_place_claim(uuid, text)"]) {
      expect(sql).toContain(`revoke all on function public.${fn} from public, anon, authenticated`);
      expect(sql).toContain(`grant execute on function public.${fn} to service_role`);
    }
    expect(sql).not.toMatch(/to (anon|authenticated)\b/);
  });
});

describe("outreachCsv", () => {
  const rows = [
    { slug: "8-drambliai", name: "8 Drambliai", categories: ["vet"], city: "Vilnius", website: "https://8drambliai.lt/" },
    { slug: "kika", name: 'Kika, "Zoo"', categories: ["shop", "grooming"], city: "Kaunas", website: null },
  ];

  it("gives each business its claim link on the live site", () => {
    const [header, first] = outreachCsv(rows, "https://petbnb.lt").split("\n");
    expect(header).toBe("name,city,categories,website,claim_link");
    expect(first).toBe("8 Drambliai,Vilnius,vet,https://8drambliai.lt/,https://petbnb.lt/partners?p=8-drambliai&claim=1");
  });

  it("quotes fields that hold commas or quotes", () => {
    const second = outreachCsv(rows, "https://petbnb.lt").split("\n")[2];
    expect(second).toBe('"Kika, ""Zoo""",Kaunas,shop grooming,,https://petbnb.lt/partners?p=kika&claim=1');
  });

  it("neutralises a cell a spreadsheet would run as a formula", () => {
    const out = outreachCsv([{ slug: "x", name: "=HYPERLINK(1)", categories: [], city: "+Vilnius", website: null }], "https://petbnb.lt");
    expect(out.split("\n")[1].startsWith("'=HYPERLINK(1),'+Vilnius")).toBe(true);
  });
});
