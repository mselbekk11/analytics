# Privacy-policy text for tracked sites

Paste the section below into the privacy policy of each site that loads the analytics snippet. Replace `[Site]` with the site's name and `[contact email]` with your address. Sites that use `data-cookieless` should use the second version instead.

These texts describe what the script does as of Phase 5e. The sentence about signing in applies only to sites that call `identify()`, and the paragraph about purchases only to sites whose revenue source is Stripe or the payments API; leave them out elsewhere.

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
> With each page you view, we record the page address (without any query string), the website you came from (its domain only), your browser, device type and operating system, your approximate location (country, region and city) derived by our hosting provider, and how long the page was open in a visible tab. If the link you arrived from carries campaign tags (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ref` or `via`), we record those tags too, but nothing else from the address. For each visit we also keep a rough position (accurate to about 10 km) to show where visitors are on a map. We also record when you complete actions such as signing up or booking, and which links to other websites you click (their address without any query string). Your IP address is used by our hosting provider only to work out this location and is never stored by us.
>
> If you sign in or create an account, we link your user ID, email address and name to the browser ID above, so we can see which pages and sources led to your sign-up.
>
> If you buy something, we record the payment's amount, currency and date, the customer and payment IDs from our payment provider, and the email address you paid with, and link them to the browser ID above, so we can see which pages and sources led to the purchase. We never receive or store your card or bank details.
>
> You can delete the cookies at any time in your browser settings, and blocking cookies does not stop the site from working.
>
> If you have questions about this, contact [contact email].

## Cookieless snippet (`data-cookieless`)

> **Analytics**
>
> [Site] uses its own privacy-friendly analytics to understand how the site is used, for example which pages are read and where visitors come from. The analytics sets no cookies and stores nothing on your device. We do not use Google Analytics or any advertising trackers, and we do not sell or share this data.
>
> With each page you view, we record the page address (without any query string), the website you came from (its domain only), your browser, device type and operating system, your approximate location (country, region and city) derived by our hosting provider, and how long the page was open in a visible tab. If the link you arrived from carries campaign tags (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ref` or `via`), we record those tags too, but nothing else from the address. We also record when actions such as a sign-up are completed, and which links to other websites are clicked (their address without any query string). Your IP address is used by our hosting provider only to work out this location and is never stored by us. None of this is linked to you or to your other visits.
>
> If you buy something, we record the payment's amount, currency and date, the customer and payment IDs from our payment provider, and the email address you paid with, to count our revenue. We never receive or store your card or bank details.
>
> If you have questions about this, contact [contact email].
