/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("me.whoami", () => {
  test("returns null when signed out", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.me.whoami, {})).toBeNull();
  });

  test("returns the Clerk user id when signed in", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "user_123" });
    const me = await asUser.query(api.me.whoami, {});
    expect(me?.subject).toBe("user_123");
  });
});
