import axios from 'axios';

// Fallback used when the backend is unreachable so the support button never
// disappears entirely for customers.
export const DEFAULT_WHATSAPP = {
  enabled: true,
  title: 'Chat with us on WhatsApp',
  buttons: [
    {
      id: '1',
      label: 'Customer Support',
      number: '+12393293813',
      message: 'Hello Kayee01, I need assistance.',
    },
  ],
};

export const buildWaLink = (number, message) => {
  const clean = (number || '').replace(/[^0-9]/g, '');
  if (!clean) return '#';
  const base = `https://wa.me/${clean}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};

// Returns { enabled, title, buttons } for the public storefront. Buttons that
// are disabled or missing a number are filtered out server-side.
export const fetchWhatsappSettings = async (apiBase) => {
  try {
    const res = await axios.get(`${apiBase}/settings/whatsapp`);
    const data = res.data;
    if (data && data.enabled === false) {
      return { enabled: false, title: data.title || '', buttons: [] };
    }
    if (data && Array.isArray(data.buttons) && data.buttons.length > 0) {
      return { enabled: true, title: data.title || DEFAULT_WHATSAPP.title, buttons: data.buttons };
    }
    // Enabled but no buttons configured -> nothing to show.
    if (data && data.enabled) {
      return { enabled: true, title: data.title || DEFAULT_WHATSAPP.title, buttons: [] };
    }
    return DEFAULT_WHATSAPP;
  } catch (error) {
    return DEFAULT_WHATSAPP;
  }
};
