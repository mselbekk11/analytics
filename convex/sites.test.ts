/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("sites.create", () => {
  test("stores a normalised domain owned by the caller's tokenIdentifier", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity({ subject: "user_1", tokenIdentifier: "clerk|user_1" });
    const { siteId, domain } = await asOwner.mutation(api.sites.create, {
      domain: "https://www.PicAI.so/",
      timezone: "Europe/Oslo",
    });
    expect(domain).toBe("picai.so");
    const site = await t.run((ctx) => ctx.db.get("sites", siteId));
    expect(site).toMatchObject({
      domain: "picai.so",
      ownerId: "clerk|user_1",
      timezone: "Europe/Oslo",
    });
  });

  test("rejects a duplicate domain, even in another form", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity({ tokenIdentifier: "clerk|user_1" });
    await asOwner.mutation(api.sites.create, { domain: "picai.so", timezone: "UTC" });
    await expect(
      asOwner.mutation(api.sites.create, { domain: "www.picai.so", timezone: "UTC" }),
    ).rejects.toThrow(/already been added/);
  });

  test("rejects invalid input and signed-out callers", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity({ tokenIdentifier: "clerk|user_1" });
    await expect(
      asOwner.mutation(api.sites.create, { domain: "not a domain", timezone: "UTC" }),
    ).rejects.toThrow(/domain/);
    await expect(
      asOwner.mutation(api.sites.create, { domain: "picai.so", timezone: "Nowhere/Land" }),
    ).rejects.toThrow(/timezone/);
    await expect(
      t.mutation(api.sites.create, { domain: "picai.so", timezone: "UTC" }),
    ).rejects.toThrow(/Not signed in/);
  });
});
