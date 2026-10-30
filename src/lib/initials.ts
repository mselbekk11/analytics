/**
 * Up to two letters for the user's avatar: the first letters of the first and last
 * name, else the first two letters of the email's local part ("jo@x.com" → "JO").
 */
export function initials(firstName?: string | null, lastName?: string | null, email?: string | null): string {
  const first = firstName?.trim().charAt(0) ?? "";
  const last = lastName?.trim().charAt(0) ?? "";
  if (first || last) return (first + last).toUpperCase();
  const local = email?.split("@")[0]?.trim() ?? "";
  return local.slice(0, 2).toUpperCase();
}
