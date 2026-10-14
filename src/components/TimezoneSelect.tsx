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
      className="rounded-md border border-line bg-panel px-3 py-2"
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
