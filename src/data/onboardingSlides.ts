/**
 * Copy for the four carousel slides.
 *
 * Lifted out of OnboardingScreen when the mart scene replaced the slider, so the
 * slider could be kept whole rather than deleted. Nothing renders these today —
 * SlidesCarousel does, and it is on the shelf. Leave them here.
 */
export type OnboardingSlide = {
  key: string;
  image: number;
  title: string;
  subtitle: string;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    key: '1',
    image: require('../assets/slider/fruits-640.webp'),
    title: 'Eat Your Way.\nAnytime.',
    subtitle:
      'Personalized meals, fresh and easy\n—delivered on your schedule.',
  },
  {
    key: '2',
    image: require('../assets/slider/vegetables-640.webp'),
    title: 'Farm Fresh.\nAlways.',
    subtitle: 'Handpicked vegetables from local farms\ndelivered to your door.',
  },
  {
    key: '3',
    image: require('../assets/slider/dairy-640.webp'),
    title: 'Pure Goodness.\nDaily.',
    subtitle: 'Creamy dairy products straight\nfrom the source.',
  },
  {
    key: '4',
    image: require('../assets/slider/meat-640.webp'),
    title: 'Premium Quality.\nEvery Cut.',
    subtitle: 'Quality meat selections for\nevery meal you love.',
  },
];

/**
 * What the screen leads with now. It was the first slide's line and the fallback
 * the old screen used whenever the slider index was out of range, so the words on
 * the screen have not changed — only what is above them.
 */
export const ONBOARDING_COPY = {
  title: 'Eat Your Way.\nAnytime.',
  subtitle: 'Personalized meals, fresh and easy\n—delivered on your schedule.',
} as const;
