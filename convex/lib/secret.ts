/** Every call from the Next.js routes (/api/collect, /api/payments) carries INGEST_SECRET. */
export function checkSecret(secret: string): void {
  const expected = process.env.INGEST_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Invalid ingest secret");
  }
}
