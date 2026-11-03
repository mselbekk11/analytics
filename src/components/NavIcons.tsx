import type { ReactNode } from "react";

/**
 * The site and account tabs' icons, from Nucleo's Micro Bold set (licensed; copied from nucleoapp.com).
 * Drawn on a 20px grid in currentColor, so they follow the tab's text colour.
 */
type IconProps = { className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
} as const;

function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden className={className}>
      {children}
    </svg>
  );
}

/** Nucleo "chart-line" */
export function ChartLineIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <polyline points="3 13 8 8 11 11 16 6" {...stroke} />
      <path d="m17,17H6c-1.6569,0-3-1.3431-3-3V3" {...stroke} />
    </Icon>
  );
}

/** Nucleo "page" */
export function PageIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="4" y="3" width="12" height="14" rx="3" ry="3" transform="translate(20 20) rotate(180)" {...stroke} />
      <rect x="7" y="6" width="2" height="2" {...stroke} fill="currentColor" />
      <path
        d="m13.25,9h-1.5c-.4141,0-.75-.3359-.75-.75s.3359-.75.75-.75h1.5c.4141,0,.75.3359.75.75s-.3359.75-.75.75Z"
        fill="currentColor"
      />
      <path
        d="m13.25,11.5h-6.5c-.4141,0-.75-.3359-.75-.75s.3359-.75.75-.75h6.5c.4141,0,.75.3359.75.75s-.3359.75-.75.75Z"
        fill="currentColor"
      />
      <path
        d="m11.25,14h-4.5c-.4141,0-.75-.3359-.75-.75s.3359-.75.75-.75h4.5c.4141,0,.75.3359.75.75s-.3359.75-.75.75Z"
        fill="currentColor"
      />
    </Icon>
  );
}

/** Nucleo "users" */
export function UsersIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="6.5" cy="8.5" r="2.5" {...stroke} />
      <circle cx="13.5" cy="5.5" r="2.5" {...stroke} />
      <path d="m10.875,11.845c.739-.532,1.645-.845,2.625-.845,1.959,0,3.626,1.252,4.244,3" {...stroke} />
      <path d="m2.256,17c.618-1.748,2.285-3,4.244-3s3.626,1.252,4.244,3" {...stroke} />
    </Icon>
  );
}

/** Nucleo "radio" */
export function RadioIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m4.9997,14.8986c-1.237-1.2625-1.9997-2.9915-1.9997-4.8986s.7627-3.6361,1.9997-4.8986" {...stroke} />
      <path d="m15.0003,14.8986c1.237-1.2625,1.9997-2.9915,1.9997-4.8986,0-1.9071-.7627-3.6361-1.9997-4.8986" {...stroke} />
      <circle cx="10" cy="10" r="3" {...stroke} />
    </Icon>
  );
}

/** Nucleo "globe" */
export function GlobeIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <ellipse cx="10" cy="10" rx="7" ry="2.5" {...stroke} />
      <ellipse cx="10" cy="10" rx="2.5" ry="7" {...stroke} />
      <circle cx="10" cy="10" r="7" {...stroke} />
    </Icon>
  );
}

/** Nucleo "credit-card" */
export function CreditCardIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <line x1="3" y1="8" x2="17" y2="8" {...stroke} />
      <line x1="6" y1="12" x2="9" y2="12" {...stroke} />
      <line x1="13.75" y1="12" x2="14" y2="12" {...stroke} />
      <rect x="3" y="4" width="14" height="12" rx="3" ry="3" {...stroke} />
    </Icon>
  );
}

/** Nucleo "gear" */
export function GearIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path
        d="m17.447,8.605l-1.278-.639c-.101-.307-.227-.602-.371-.887l.453-1.359c.12-.359.026-.756-.241-1.023l-.707-.707c-.267-.268-.664-.362-1.023-.242l-1.36.453c-.285-.144-.58-.269-.887-.371l-.639-1.278c-.17-.339-.516-.553-.895-.553h-1c-.379,0-.725.214-.895.553l-.639,1.278c-.307.101-.602.227-.887.371l-1.36-.453c-.359-.12-.756-.026-1.023.242l-.707.707c-.268.268-.361.664-.241,1.023l.453,1.359c-.144.285-.269.58-.371.887l-1.278.639c-.339.169-.553.516-.553.895v1c0,.379.214.725.553.895l1.278.639c.101.307.227.602.371.887l-.453,1.359c-.12.359-.026.756.241,1.023l.707.707c.19.191.446.293.707.293.105,0,.213-.017.316-.051l1.36-.453c.285.144.58.269.887.371l.639,1.278c.17.339.516.553.895.553h1c.379,0,.725-.214.895-.553l.639-1.278c.307-.101.602-.227.887-.371l1.36.453c.104.035.211.051.316.051.261,0,.517-.103.707-.293l.707-.707c.268-.268.361-.664.241-1.023l-.453-1.359c.144-.285.269-.58.371-.887l1.278-.639c.339-.169.553-.516.553-.895v-1c0-.379-.214-.725-.553-.895Zm-7.447,4.395c-1.657,0-3-1.343-3-3s1.343-3,3-3,3,1.343,3,3-1.343,3-3,3Z"
        fill="currentColor"
      />
    </Icon>
  );
}
