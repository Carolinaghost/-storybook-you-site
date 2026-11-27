/* ==========================================================================
   Crayonauts – site config
   --------------------------------------------------------------------------
   DEMO_MODE = true  → the pages work on their own with sample data
                       (no calls to api.crayonauts.com). Good for review.
   DEMO_MODE = false → api.js calls the real order system.
   ========================================================================== */
window.CRAYONAUTS_CONFIG = {
  DEMO_MODE: false,                        // connected to api.crayonauts.com
  API_BASE: "https://api.crayonauts.com",

  // Display prices only. The real amount is always decided by the server / Stripe.
  PRODUCTS: {
    pdf:          { name: "Printable PDF",       desc: "Arrives by email in minutes", book: 15, shipping: 0,    family: false },
    print:        { name: "Printed book",        desc: "Printed and mailed (US)",     book: 15, shipping: 9.95, family: false },
    family_pdf:   { name: "Family book PDF",     desc: "Up to 5 people, by email",    book: 25, shipping: 0,    family: true  },
    family_print: { name: "Printed family book", desc: "Printed and mailed (US)",     book: 25, shipping: 9.95, family: true  }
  },

  // "label" is also the theme name the order system uses (see /options).
  THEMES: [
    { id: "superhero",       label: "Superhero" },
    { id: "adventure-scene", label: "Adventure scene" },
    { id: "fairy-tale",      label: "Fairy tale" },
    { id: "portrait",        label: "Portrait" },
    { id: "firefighter",     label: "Firefighter" },
    { id: "police-officer",  label: "Police Officer" },
    { id: "doctor",          label: "Doctor" },
    { id: "birthday",        label: "Birthday" },
    { id: "christmas",       label: "Christmas" },
    { id: "halloween",       label: "Halloween" }
  ],
  LEVELS: [
    { id: "simple",   label: "Simple",   ages: "ages 3–4" },
    { id: "standard", label: "Standard", ages: "ages 5–7" },
    { id: "detailed", label: "Detailed", ages: "ages 8+" }
  ],
  MAX_FAMILY_PHOTOS: 5,
  MIN_FAMILY_PHOTOS: 2,   // a family book is two people or more (order system rule)
  FREE_PREVIEW_PAGES: 2
};
