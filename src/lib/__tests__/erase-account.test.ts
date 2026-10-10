import { describe, it, expect, vi, beforeEach } from "vitest";
import { eraseMyAccount } from "@/lib/erase-account";

/**
 * "Delete my account": the database empties the account (erase_my_account), then the app
 * removes the person's photos and forgets the session on this device. A refusal touches nothing.
 */

const h = vi.hoisted(() => ({
  rpcError: null as { message: string } | null,
  files: [] as { name: string }[],
  calls: [] as unknown[][],
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (name: string, args: unknown) => {
      h.calls.push(["rpc", name, args]);
      return Promise.resolve({ data: null, error: h.rpcError });
    },
    storage: {
      from: (bucket: string) => ({
        list: (folder: string) => {
          h.calls.push(["list", bucket, folder]);
          return Promise.resolve({ data: h.files, error: null });
        },
        remove: (paths: string[]) => {
          h.calls.push(["remove", bucket, paths]);
          return Promise.resolve({ error: null });
        },
      }),
    },
    auth: {
      signOut: (opts: unknown) => {
        h.calls.push(["signOut", opts]);
        return Promise.resolve({ error: null });
      },
    },
  },
}));

beforeEach(() => {
  h.rpcError = null;
  h.files = [];
  h.calls = [];
});

describe("eraseMyAccount", () => {
  it("empties the account, then removes the photos, then signs out here", async () => {
    h.files = [{ name: "avatar-1.jpg" }, { name: "pet-2.jpg" }];
    expect(await eraseMyAccount("u1", "Rūta Petraitė")).toBe("erased");
    expect(h.calls).toEqual([
      ["rpc", "erase_my_account", { p_confirm_name: "Rūta Petraitė" }],
      ["list", "photos", "u1"],
      ["remove", "photos", ["u1/avatar-1.jpg", "u1/pet-2.jpg"]],
      ["signOut", { scope: "local" }],
    ]);
  });

  it("skips the photo removal when there are none", async () => {
    expect(await eraseMyAccount("u1", "x")).toBe("erased");
    expect(h.calls.some((c) => c[0] === "remove")).toBe(false);
  });

  it.each([
    ["open_bookings", "open-bookings"],
    ["name_mismatch", "name-mismatch"],
    ["permission denied", "failed"],
  ])("touches nothing else when the database says %s", async (message, outcome) => {
    h.rpcError = { message };
    expect(await eraseMyAccount("u1", "x")).toBe(outcome);
    expect(h.calls).toHaveLength(1);
  });
});
