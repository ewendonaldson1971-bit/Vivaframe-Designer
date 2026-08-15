# Integration discovery

The live Vivalux Builder at `https://vivalux4-client.netlify.app/` is a route-based multi-app client. Its application navigation currently registers Backlit (`/`), Edgelit (`/edgelit`), R300 (`/r300/`), Palisade (`/palisade`), Cube (`/cube`) and Lanterns (`/lanterns/`). Each app shares the same top navigation, sign-in gate, left configuration panel, preview/summary area and shopping-cart link.

The Builder loads `auth.js` and `pricing-config.js`. The latter exposes `window.VivaluxPricing` with `register(product, apply)`, `reload(product)`, and `quote(product, takeoff)`. Authenticated configuration is retrieved with `GET /api/v1/config/vivalux?product={product}`. Quotes use `POST /api/v1/pricing/vivalux/quote` and the request body `{ product, takeoff }`. Both use the signed-in user's bearer `pricingToken`; the pricing service base is supplied by `pricingApiBase` or the production default. Configurations are cached for five minutes and quotes for one minute, scoped to the signed-in user.

The Pricing Configurator presents an “App tables” navigation and supports named tables made of typed variables and allowed values. Existing Vivalux product entries include Backlit, Edgelit, R300, Palisade, Cube and Lanterns. VivaFrame Designer should use the product key `vivaframe`; its table needs variables for extrusion profiles, finishes, corner components, straight joiners, other connectors, brackets, end caps, fasteners and accessories. Every allowed value should retain its QCode, JTCode/SKU or canonical product identifier.

The live Vivad App Style Guide defines `#478FE1` for controls and selected states, `#7CBF1D` for positive status, `#E4002B` for brand emphasis, and `#53565A` for primary content. Those exact tokens are used in this implementation.
