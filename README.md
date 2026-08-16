# VivaFrame Designer

Standalone VivaFrame SS25 frame designer, built with Next.js and deployed on Netlify. The interface follows Vivad's brand system and has no Builder navigation or cart UI.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Use `npm test` for geometry, pricing-contract, production-build, and rendered-page checks. Use `npm run lint` for static analysis.

## Netlify

The repository is linked to Netlify. A push to `main` runs the production build defined in `netlify.toml` and publishes the site.

## Pricing Engine integration

The designer uses the same temporary authentication pattern as SAV Builder. A user connects with their existing Apps Script credentials; the Pricing Engine returns a short-lived bearer token which is kept only in browser session storage. Passwords are never stored by the designer.

After login the client loads the eligible extrusion list configured in the Pricing Engine's Frame Designer tab from `GET /api/v1/config/vivaframe`. The Material selector, cut list and BOM use those live options. Product-neutral frame takeoffs are sent to `POST /api/v1/pricing/vivaframe/quote`; eligibility, prices, accessory mappings, account discounting and the authoritative total remain server-side.

For another host, the equivalent provider contract is:

```js
window.VivaFramePricingProvider = {
  async loadConfig(product) {
    // Return { config, version } for product === "vivaframe".
  },
  async quote(product, takeoff) {
    // Return the customer-specific quote.
  },
};
```

As a direct-integration fallback, a trusted host may inject a short-lived customer token before the designer loads:

```js
window.VivaFramePricingContext = {
  token: "short-lived-bearer-token",
  apiBase: "https://vivadpricing-app.calmtree-53cc02bb.australiasoutheast.azurecontainerapps.io",
};
```

The direct integration uses these contracts:

- `POST /api/auth/token`
- `GET /api/v1/config/vivaframe`
- `POST /api/v1/pricing/vivaframe/quote` with `{ takeoff }`

Never commit a Pricing Engine token or expose a durable service credential in frontend code. Authentication and customer/account selection remain the responsibility of the host application.
