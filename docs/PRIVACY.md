# Privacy-policy text for tracked sites

Paste the section below into the privacy policy of each site that loads the analytics snippet. Replace `[Site]` with the site's name and `[contact email]` with your address. Sites that use `data-cookieless` should use the second version instead.

These texts describe what the script does as of Phase 5a. Update them when later phases store more: campaign tags (5b), operating system, region and city (5c), goals and `identify()` (5d) and payments (5e).

This is plain-language wording, not legal advice. If a site gets meaningful traffic from the EU or UK, a cookie used for analytics generally needs consent there: add a consent banner that loads the script only after consent, or switch that site to `data-cookieless`.

## Standard snippet (with cookies)

> **Analytics**
>
> [Site] uses its own privacy-friendly analytics to understand how the site is used, for example which pages are read and where visitors come from. We do not use Google Analytics or any advertising trackers, and we do not sell or share this data.
>
> To recognise returning visitors and group page visits into one visit, the analytics script sets two first-party cookies on this site:
>
> | Cookie | What it holds | How long it lasts |
> | --- | --- | --- |
> | `_va_vid` | A random ID for your browser | 400 days, renewed on each visit |
> | `_va_sid` | A random ID for your current visit | 30 minutes after your last activity |
>
> These IDs are random. They do not contain your name, email address or any other personal details, and they are not used on other websites.
>
> With each page you view, we record the page address (without any query string), the website you came from (its domain only), your browser and device type, your approximate location (country) derived by our hosting provider, and how long the page was open in a visible tab. Your IP address is used by our hosting provider only to work out the country and is never stored by us.
>
> You can delete the cookies at any time in your browser settings, and blocking cookies does not stop the site from working.
>
> If you have questions about this, contact [contact email].

## Cookieless snippet (`data-cookieless`)

> **Analytics**
>
> [Site] uses its own privacy-friendly analytics to understand how the site is used, for example which pages are read and where visitors come from. The analytics sets no cookies and stores nothing on your device. We do not use Google Analytics or any advertising trackers, and we do not sell or share this data.
>
> With each page you view, we record the page address (without any query string), the website you came from (its domain only), your browser and device type, your approximate location (country) derived by our hosting provider, and how long the page was open in a visible tab. Your IP address is used by our hosting provider only to work out the country and is never stored by us. None of this is linked to you or to your other visits.
>
> If you have questions about this, contact [contact email].
