import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config.js";

const app = defineApp();
// Insight emails (launch v1 Phase 15), see insights.ts and insightsSend.ts
app.use(resend);

export default app;
