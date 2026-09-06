import { Offer } from '../components/home/OfferCard';
import { Product } from '../components/home/ProductCard';
import { IconName } from '../components/ui/icons';

/**
 * UI-only mock data. No fetching, no state management.
 *
 * Product art: each item carries a `glyph` (emoji) that renders today, plus an
 * optional `image` for real cut-outs. Drop artwork in with either form:
 *   image: require('../assets/images/products/banana.png')
 *   image: { uri: 'https://cdn.example.com/banana.png' }
 * If a remote image fails to load, the card falls back to the glyph.
 */

export const CATEGORIES: { id: string; label: string; icon: IconName }[] = [
  { id: 'all', label: 'All', icon: 'all' },
  { id: 'fresh', label: 'Fresh', icon: 'fresh' },
  { id: 'electronics', label: 'Electronics', icon: 'electronics' },
  { id: 'beauty', label: 'Beauty', icon: 'beauty' },
];

export const OFFERS: Offer[] = [
  {
    id: 'o1',
    prefix: 'Up to',
    discount: '50% OFF',
    category: 'Kitchenware',
    glyph: '🍽️',
  },
  {
    id: 'o2',
    prefix: 'Up to',
    discount: '70% OFF',
    category: 'Travel',
    glyph: '🧳',
  },
  {
    id: 'o3',
    prefix: 'Min',
    discount: '40% OFF',
    category: 'Groceries',
    glyph: '🛍️',
  },
  {
    id: 'o4',
    prefix: 'Up to',
    discount: '60% OFF',
    category: 'Fragrance',
    glyph: '🧴',
  },
];

export const REPEAT_TABS = [
  'Best prices',
  'Order again',
  'Trending now',
] as const;

export const REPEAT_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Organic Beetroot',
    meta: 'Natural • 500 g',
    price: '$0.42',
    wasPrice: '$0.55',
    badge: '20% OFF',
    glyph: '🫒',
  },
  {
    id: 'p2',
    name: 'Capsicum Green',
    meta: 'FreshO! • 500 g',
    price: '$0.55',
    wasPrice: '$0.69',
    badge: '20% OFF',
    glyph: '🫑',
  },
  {
    id: 'p3',
    name: 'Robusta Banana',
    meta: 'FreshO! • 500 g',
    price: '$0.19',
    wasPrice: '$0.59',
    soldOut: true,
    glyph: '🍌',
  },
  {
    id: 'p4',
    name: 'Cauliflower Fresh',
    meta: 'FreshO! • 1 pc',
    price: '$0.51',
    wasPrice: '$0.64',
    badge: '15% OFF',
    glyph: '🥬',
  },
];

export const ESSENTIALS: Product[] = [
  {
    id: 'e1',
    name: 'Coriander Organic',
    meta: 'FreshO! • 100 g',
    price: '$0.13',
    wasPrice: '$0.16',
    badge: '25% OFF',
    glyph: '🌿',
  },
  {
    id: 'e2',
    name: 'Tomato Organic',
    meta: 'FreshO! • 500 g',
    price: '$0.38',
    wasPrice: '$0.48',
    badge: '15% OFF',
    glyph: '🍅',
  },
  {
    id: 'e3',
    name: 'Onion Organic',
    meta: 'Red Onion • 500 g',
    price: '$0.34',
    wasPrice: '$0.42',
    badge: '30% OFF',
    glyph: '🧅',
  },
  {
    id: 'e4',
    name: 'Avocado Hass',
    meta: 'FreshO! • 2 pc',
    price: '$1.20',
    wasPrice: '$1.60',
    badge: '25% OFF',
    glyph: '🥑',
  },
];
