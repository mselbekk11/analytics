"use client";

import { useState } from "react";

/** Every IANA timezone the browser knows. Client-only, since the list comes from Intl. */
export default function TimezoneSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (tz: string) => void;
}) {
  const [zones] = useState(() => Intl.supportedValuesOf("timeZone"));
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg border border-input bg-transparent px-2 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
    >
      {!zones.includes(value) && <option value={value}>{value}</option>}
      {zones.map((tz) => (
        <option key={tz} value={tz}>
          {tz}
        </option>
      ))}
    </select>
  );
}
