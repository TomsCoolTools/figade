// Everything about the shop that isn't a design: name, prices, products and
// payment settings. Read by the site build, the browser code and the Worker.

export default {
  name: '[SITE NAME]',
  domain: 'sitename.com', // shown in the watermark
  supportEmail: 'hello@sitename.com',
  currency: 'USD',

  // Lemon Squeezy. Fill these in from the dashboard (see README.md).
  lemonSqueezy: {
    storeSlug: 'your-store', // https://your-store.lemonsqueezy.com
    storeId: 0,
  },

  // A licence key can unlock this many browsers before support has to reset it.
  activationLimit: 10,

  // One product per design and one per pack. checkoutId is the variant's checkout
  // link id (the part after /buy/), variantId its numeric id. The dev server's
  // mock checkout uses the ids below as they are.
  products: [
    { id: 'subscribe-pop', kind: 'design', price: 4, variantId: 1001, checkoutId: 'mock-subscribe-pop' },
    { id: 'like-bell', kind: 'design', price: 4, variantId: 1002, checkoutId: 'mock-like-bell' },
    { id: 'follow-card', kind: 'design', price: 4, variantId: 1003, checkoutId: 'mock-follow-card' },
    { id: 'lower-third', kind: 'design', price: 4, variantId: 1004, checkoutId: 'mock-lower-third' },
    { id: 'studio', kind: 'pack', price: 9, variantId: 2001, checkoutId: 'mock-studio' },
  ],
};
