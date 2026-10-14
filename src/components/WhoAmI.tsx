"use client";

import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

function Identity() {
  const me = useQuery(api.me.whoami);
  if (me === undefined) return <p>Loading…</p>;
  if (me === null) return <p>Convex sees no identity.</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
      <dt className="text-zinc-500">subject</dt>
      <dd>{me.subject}</dd>
      <dt className="text-zinc-500">tokenIdentifier</dt>
      <dd className="break-all">{me.tokenIdentifier}</dd>
    </dl>
  );
}

export default function WhoAmI() {
  return (
    <>
      <AuthLoading>
        <p>Connecting to Convex…</p>
      </AuthLoading>
      <Unauthenticated>
        <p>Signed in to Clerk, but Convex has no token yet.</p>
      </Unauthenticated>
      <Authenticated>
        <Identity />
      </Authenticated>
    </>
  );
}
