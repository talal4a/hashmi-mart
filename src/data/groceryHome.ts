import {
  ShoppingBasket,
  Croissant,
  Milk,
  Beef,
  Leaf,
  Soup,
  Store,
  Grid2X2,
} from 'lucide-react-native';

/** Static presentation data; no shopping or navigation behavior is connected. */
export const groceryCategories = [
  {
    name: 'Fresh Produce',
    icon: ShoppingBasket,
    color: '#0BA855',
    tint: '#E8F8E9',
  },
  { name: 'Bakery', icon: Croissant, color: '#E9A13C', tint: '#FFF4E4' },
  { name: 'Dairy', icon: Milk, color: '#6AA6CD', tint: '#E5F5FF' },
  { name: 'Meat', icon: Beef, color: '#EE646C', tint: '#FFEDF0' },
  { name: 'Organic', icon: Leaf, color: '#4B9824', tint: '#EAF7E7' },
  { name: 'Ready to Eat', icon: Soup, color: '#E9A400', tint: '#FFF7D6' },
  { name: 'Nearby Stores', icon: Store, color: '#926BE0', tint: '#F0E9FF' },
  { name: 'More', icon: Grid2X2, color: '#162239', tint: '#FFFFFF' },
];
/** The four big home tiles, shown as a 2×2 grid under the hero banner. */
export const quickActions = [
  {
    name: 'Food',
    detail: 'Order fast food',
    image: require('../assets/images/home/categories/food-scooter.png'),
    from: '#F58A26',
    to: '#C74612',
    accent: '#FFFFFF',
    detailColor: '#FFFFFF',
  },
  {
    name: 'Grocery',
    detail: 'Fresh everyday essentials',
    image: require('../assets/images/home/categories/grocery.png'),
    from: '#EEFAEF',
    to: '#D5EFD9',
    accent: '#236339',
    detailColor: '#425563',
  },
  {
    name: 'Vendors',
    detail: 'Your neighbourhood stores',
    image: require('../assets/images/home/categories/vendors.png'),
    from: '#EDF8FF',
    to: '#D4EBF9',
    accent: '#205D80',
    detailColor: '#425563',
  },
  {
    name: 'Offers',
    detail: 'More value in every basket',
    image: require('../assets/images/home/categories/offers.png'),
    from: '#F5F0FF',
    to: '#E7DDF8',
    accent: '#644191',
    detailColor: '#425563',
  },
];
export const nearbyVendors = [
  {
    id: 'al-haram',
    name: 'Al-Haram Mart',
    kinds: 'Grocery · Bakery',
    rating: '4.8',
    reviews: '1.2k',
    time: '15 min',
    distance: '1.2 km',
    delivery: 'Free delivery',
    free: true,
    open: true,
    color: '#187B32',
    colorDark: '#0C5A21',
    tint: '#E9F7EC',
    mark: 'AH',
  },
  {
    id: 'fresh-basket',
    name: 'Fresh Basket',
    kinds: 'Fruit · Veg',
    rating: '4.6',
    reviews: '860',
    time: '20 min',
    distance: '1.8 km',
    delivery: 'Free delivery',
    free: true,
    open: true,
    color: '#EAB64F',
    colorDark: '#C58D1E',
    tint: '#FDF4E3',
    mark: 'FB',
  },
  {
    id: 'daily-foods',
    name: 'Daily Foods',
    kinds: 'Pantry · Snacks',
    rating: '4.7',
    reviews: '2.1k',
    time: '18 min',
    distance: '2.4 km',
    delivery: 'Rs. 99 delivery',
    free: false,
    open: true,
    color: '#F14E25',
    colorDark: '#BE3410',
    tint: '#FDEDE8',
    mark: 'DF',
  },
  {
    id: 'organic-hub',
    name: 'Organic Hub',
    kinds: 'Organic · Dairy',
    rating: '4.9',
    reviews: '540',
    time: '25 min',
    distance: '3.1 km',
    delivery: 'Free delivery',
    free: true,
    open: false,
    color: '#68A939',
    colorDark: '#477A22',
    tint: '#EFF7E8',
    mark: 'OH',
  },
];
export const freshPicks = [
  {
    id: 'tomato',
    name: 'Tomato Organic',
    meta: 'Natural · 500 g',
    price: 120,
    was: 150,
    discount: 20,
    rating: '4.8',
    tag: 'Best seller',
    art: 0,
  },
  {
    id: 'banana',
    name: 'Banana Premium',
    meta: 'Fresh · 1 kg',
    price: 170,
    was: 200,
    discount: 15,
    rating: '4.6',
    art: 1,
  },
  {
    id: 'spinach',
    name: 'Spinach Fresh',
    meta: 'Natural · 250 g',
    price: 90,
    was: 100,
    discount: 10,
    rating: '4.7',
    tag: 'Low stock',
    art: 2,
  },
  {
    id: 'apple',
    name: 'Apple Red',
    meta: 'Fresh · 1 kg',
    price: 260,
    was: 350,
    discount: 25,
    rating: '4.9',
    art: 3,
  },
  {
    id: 'cucumber',
    name: 'Cucumber',
    meta: 'Fresh · 1 kg',
    price: 140,
    rating: '4.5',
    art: 4,
  },

  /* ------------------------------------------------------------------------
   * THE SHELF BEYOND FRESH PRODUCE
   *
   * PLACEHOLDER PRICES. Every `price` and `was` below is a guess at a
   * plausible Pakistani retail figure and not one of them came from the shop.
   * Correct them here, in this file, before anyone can buy anything: nothing
   * else in the app holds a price, so this is the only place to change.
   *
   * The reason these exist at all is that a grocery app that stocks five
   * vegetables understands every order perfectly and fills none of them. Voice
   * Order was heard "doodh do bread aik anday chay", read it exactly right, and
   * correctly answered that we sell none of those — which looks from the
   * outside like the AI failing, and is really an empty shop.
   *
   * Every one of these already had its Urdu, Roman Urdu, Devanagari and
   * Gurmukhi names in `voiceCatalog`'s alias table, written down against the
   * day it went on the shelf. That day is today, so they work in all four
   * scripts the moment they appear here.
   *
   * `art` cycles the six tiles of the produce contact sheet, so milk currently
   * shows a vegetable. Real photographs are the fix; nothing but this number
   * changes when they arrive.
   * --------------------------------------------------------------------- */

  {
    // Named for the brand and the category both, because customers say either
    // — "olpers do" and "doodh do" are the same order.
    id: 'milk',
    name: 'Olpers Milk 1L',
    meta: 'Dairy · 1 litre',
    price: 340,
    rating: '4.7',
    tag: 'Daily',
    art: 5,
  },
  {
    id: 'eggs',
    name: 'Eggs Farm Fresh',
    meta: 'Dairy · dozen',
    price: 380,
    was: 420,
    discount: 10,
    rating: '4.6',
    art: 0,
  },
  {
    id: 'bread',
    name: 'Bread Large',
    meta: 'Bakery · 700 g',
    price: 180,
    rating: '4.4',
    art: 1,
  },
  {
    id: 'rice',
    name: 'Rice Basmati',
    meta: 'Pantry · 5 kg',
    price: 1900,
    was: 2100,
    discount: 10,
    rating: '4.8',
    tag: 'Best seller',
    art: 2,
  },
  {
    id: 'flour',
    name: 'Flour Chakki Atta',
    meta: 'Pantry · 5 kg',
    price: 1150,
    rating: '4.6',
    art: 3,
  },
  {
    id: 'sugar',
    name: 'Sugar Refined',
    meta: 'Pantry · 1 kg',
    price: 175,
    rating: '4.5',
    art: 4,
  },
  {
    id: 'tea',
    name: 'Tea Lipton Yellow Label',
    meta: 'Pantry · 190 g',
    price: 520,
    rating: '4.7',
    art: 5,
  },
  {
    id: 'oil',
    name: 'Oil Cooking Dalda',
    meta: 'Pantry · 1 litre',
    price: 640,
    was: 700,
    discount: 8,
    rating: '4.5',
    art: 0,
  },
  {
    id: 'yoghurt',
    name: 'Yoghurt Fresh Dahi',
    meta: 'Dairy · 500 g',
    price: 190,
    rating: '4.6',
    art: 1,
  },
  {
    id: 'potato',
    name: 'Potato Fresh',
    meta: 'Vegetable · 1 kg',
    price: 90,
    rating: '4.4',
    art: 2,
  },
  {
    id: 'onion',
    name: 'Onion Fresh',
    meta: 'Vegetable · 1 kg',
    price: 120,
    rating: '4.3',
    art: 3,
  },
  {
    id: 'orange',
    name: 'Orange Kinnow',
    meta: 'Fruit · 1 kg',
    price: 220,
    rating: '4.6',
    tag: 'In season',
    art: 4,
  },
  {
    id: 'chicken',
    name: 'Chicken Fresh',
    meta: 'Meat · 1 kg',
    price: 620,
    rating: '4.7',
    art: 5,
  },
  {
    id: 'lentils',
    name: 'Lentils Masoor Daal',
    meta: 'Pantry · 1 kg',
    price: 340,
    rating: '4.5',
    art: 0,
  },
  {
    id: 'salt',
    name: 'Salt Iodised',
    meta: 'Pantry · 800 g',
    price: 60,
    rating: '4.4',
    art: 1,
  },
  {
    id: 'garlic',
    name: 'Garlic Fresh',
    meta: 'Vegetable · 250 g',
    price: 150,
    rating: '4.5',
    art: 2,
  },
  {
    id: 'ginger',
    name: 'Ginger Fresh',
    meta: 'Vegetable · 250 g',
    price: 190,
    rating: '4.4',
    art: 3,
  },
  {
    id: 'surf',
    name: 'Surf Excel Washing Powder',
    meta: 'Household · 1 kg',
    price: 780,
    was: 850,
    discount: 8,
    rating: '4.6',
    art: 4,
  },
  {
    id: 'coke',
    // The alias table is keyed on the word people say. A name of "Coca-Cola"
    // alone never reaches it, because the lookup is per name-word and nobody
    // filed the aliases under "coca-cola".
    name: 'Coke Coca-Cola',
    meta: 'Drinks · 1.5 litre',
    price: 220,
    rating: '4.7',
    art: 5,
  },
];
