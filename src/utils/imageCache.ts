import { Image } from 'react-native';

const SLIDE_IMAGES = [
  require('../assets/slider/fruits-640.webp'),
  require('../assets/slider/vegetables-640.webp'),
  require('../assets/slider/dairy-640.webp'),
  require('../assets/slider/meat-640.webp'),
];

let preloaded = false;

/**
 * Preload all carousel images into memory cache.
 * Safe to call multiple times — only runs once.
 */
export function preloadCarouselImages(): void {
  if (preloaded) return;
  preloaded = true;

  SLIDE_IMAGES.forEach((img) => {
    const resolved = Image.resolveAssetSource(img);
    if (resolved?.uri) {
      Image.prefetch(resolved.uri).catch(() => {});
    }
  });
}

/**
 * Get a preloaded image source for a given index.
 */
export function getSlideImage(index: number) {
  return SLIDE_IMAGES[index] ?? SLIDE_IMAGES[0];
}
