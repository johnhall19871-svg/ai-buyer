/** AI Buyer configuration — override via .env */

export const HOME_POSTCODE = process.env.HOME_POSTCODE || 'DN22 0QG';
export const HOME = {
  postcode: HOME_POSTCODE,
  latitude: 53.280323,
  longitude: -0.936815,
  label: 'Gamston (DN22 0QG)',
};

/** John Pye buyer premium: 25% + VAT on hammer = 50% total on hammer */
export const JOHN_PYE_BUYER_MULTIPLIER = Number(process.env.JOHN_PYE_BUYER_MULTIPLIER || 1.5);

export const FUEL_PENCE_PER_MILE = Number(process.env.FUEL_PENCE_PER_MILE || 13);
export const FUEL_PER_MILE = FUEL_PENCE_PER_MILE / 100;

export const EBAY_FEE_RATE = Number(process.env.EBAY_FEE_RATE || 0.13);
export const MIN_NET_PROFIT_RATE = Number(process.env.MIN_NET_PROFIT_RATE || 0.35);
export const MAX_STOCK_DAYS = Number(process.env.MAX_STOCK_DAYS || 60);
export const EBAY_LOOKBACK_DAYS = Number(process.env.EBAY_LOOKBACK_DAYS || 90);

export const SHIPPING = {
  under5kg: Number(process.env.SHIP_UNDER_5KG || 4.99),
  from5to30kg: Number(process.env.SHIP_5_TO_30KG || 13.61),
  over30kg: Number(process.env.SHIP_OVER_30KG || 49.99),
};

/** Collection sites only — Staffordshire = Marchington (ST14 8LP) */
export const COLLECTION_SITES = {
  nottingham: {
    id: 'nottingham',
    label: 'Nottingham',
    postcode: 'NG7 7EA',
    latitude: 52.9702,
    longitude: -1.1698,
  },
  chesterfield: {
    id: 'chesterfield',
    label: 'Chesterfield',
    postcode: 'S41 9BN',
    latitude: 53.2354,
    longitude: -1.4244,
  },
  birmingham: {
    id: 'birmingham',
    label: 'Birmingham',
    postcode: 'B64 5RE',
    latitude: 52.4748,
    longitude: -2.0827,
  },
  staffordshire: {
    id: 'staffordshire',
    label: 'Staffordshire (Marchington)',
    postcode: 'ST14 8LP',
    latitude: 52.948,
    longitude: -1.875,
  },
};

export const ALLOWED_LOCATIONS = new Set(Object.keys(COLLECTION_SITES));

export const PORT = Number(process.env.PORT) || 3003;
export const TOP_N = Number(process.env.TOP_N || 25);
