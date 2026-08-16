# VivaFrame Designer

Standalone VivaFrame SS25 frame designer, built with Next.js and deployed on Netlify. The interface follows Vivad's brand system and intentionally has no login, Builder navigation, or cart UI.

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

The designer generates a product-neutral frame takeoff and connects to pricing only when authenticated context is supplied. This keeps credentials out of the standalone site and allows Vivalux Builder to host the designer later.

The preferred host contract is:

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

The fallback uses the established contracts:

- `GET /api/v1/config/vivalux?product=vivaframe`
- `POST /api/v1/pricing/vivalux/quote` with `{ product: "vivaframe", takeoff }`

Never commit a Pricing Engine token or expose a durable service credential in frontend code. Authentication and customer/account selection remain the responsibility of the host application.
