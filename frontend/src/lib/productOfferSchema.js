/** Shared Product Offer extras for Google merchant listing warnings. */

export const SHIP_COUNTRIES = [
  'US', 'CA', 'GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'CH',
  'AU', 'HT', 'DO', 'MX', 'BR', 'JP',
];

/**
 * Fields Google Search Console flags as missing under Offer:
 * hasMerchantReturnPolicy + shippingDetails.
 * Aligned with /refund-policy (30 days) and /terms (free standard shipping).
 */
export function offerMerchantFields(siteOrigin = 'https://kayee01.com') {
  const site = String(siteOrigin || 'https://kayee01.com').replace(/\/$/, '');
  return {
    itemCondition: 'https://schema.org/NewCondition',
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: [...SHIP_COUNTRIES],
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 30,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      url: `${site}/refund-policy`,
    },
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: 0,
        currency: 'USD',
      },
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: [...SHIP_COUNTRIES],
      },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: {
          '@type': 'QuantitativeValue',
          minValue: 1,
          maxValue: 3,
          unitCode: 'DAY',
        },
        transitTime: {
          '@type': 'QuantitativeValue',
          minValue: 7,
          maxValue: 15,
          unitCode: 'DAY',
        },
      },
    },
  };
}
