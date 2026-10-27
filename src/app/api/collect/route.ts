import { geolocation } from "@vercel/functions";
import { ConvexHttpClient } from "convex/browser";
import { isbot } from "isbot";
import { UAParser } from "ua-parser-js";
import { api } from "../../../../convex/_generated/api";
import {
  MAX_BODY_BYTES,
  detectDevice,
  normalizePath,
  normalizeReferrer,
  parsePayload,
  requestHostname,
} from "@/lib/collect";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

// Tracked sites must never see a failure, so every path ends in a 204
const done = () => new Response(null, { status: 204, headers: HEADERS });

export function OPTIONS() {
  return done();
}

export async function POST(request: Request) {
  try {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) return done();

    const payload = parsePayload(await request.text());
    if (payload === null) return done();

    const ua = request.headers.get("user-agent") ?? "";
    if (!ua || isbot(ua)) return done();

    const secret = process.env.INGEST_SECRET;
    if (!secret) {
      console.error("[collect] INGEST_SECRET is not set");
      return done();
    }

    const hostname = requestHostname(
      request.headers.get("origin"),
      request.headers.get("referer"),
      payload.t === "pv" ? payload.host : undefined,
    );

    if (payload.t === "pv") {
      const parsed = new UAParser(ua).getResult();
      await convex.mutation(api.ingest.pageview, {
        secret,
        site: payload.site,
        hostname,
        path: normalizePath(payload.path),
        referrer: normalizeReferrer(payload.ref, payload.host),
        unique: payload.unique,
        device: detectDevice(parsed.device.type, payload.sw),
        browser: parsed.browser.name ?? "Unknown",
        country: geolocation(request).country ?? "Unknown",
        pvId: payload.pvId,
        visitorId: payload.vid,
        sessionId: payload.sid,
        cookieless: payload.nc,
        campaign: payload.campaign,
      });
    } else if (payload.t === "ping") {
      await convex.mutation(api.ingest.ping, {
        secret,
        site: payload.site,
        hostname,
        pvId: payload.pvId,
        ms: payload.ms,
      });
    } else {
      await convex.mutation(api.ingest.duration, {
        secret,
        site: payload.site,
        hostname,
        pvId: payload.pvId,
        ms: payload.ms,
      });
    }
  } catch (error) {
    console.error("[collect]", error);
  }
  return done();
}
