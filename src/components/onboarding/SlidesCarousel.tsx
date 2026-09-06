/**
 * The photo slider, kept.
 *
 * This is the autoplay carousel that used to sit at the top of Onboarding, moved
 * out of the screen intact when the animated mart scene took its place. It is not
 * rendered anywhere right now, and that is deliberate: dropping <SlidesCarousel />
 * back into the scene's slot restores the old screen exactly, pagination, timing
 * and all.
 *
 * The image preload moved in here with it. The screen was paying to decode four
 * webp slides it no longer shows, and that work now belongs to whoever renders the
 * slides.
 */
import { useEffect } from 'react';
import { Dimensions, Image, View, StyleSheet } from 'react-native';
import { SwiperFlatList } from 'react-native-swiper-flatlist';
import { ONBOARDING_SLIDES } from '../../data/onboardingSlides';
import { c } from '../../theme/design';
import { preloadCarouselImages } from '../../utils/imageCache';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  height: number;
  /** Reported so a screen can drive its copy from the visible slide. */
  onIndexChange?: (index: number) => void;
};

export default function SlidesCarousel({ height, onIndexChange }: Props) {
  useEffect(() => {
    preloadCarouselImages();
  }, []);

  return (
    <View style={{ height }}>
      <SwiperFlatList
        autoplay
        autoplayDelay={4}
        autoplayLoop
        index={0}
        showPagination
        paginationStyle={styles.pagination}
        paginationActiveColor={c.white}
        paginationDefaultColor="rgba(255,255,255,0.4)"
        paginationStyleItem={styles.dot}
        paginationStyleItemActive={styles.dotActive}
        onChangeIndex={({ index }) => onIndexChange?.(index)}
        data={ONBOARDING_SLIDES}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH, height }}>
            <Image
              source={item.image}
              style={{ width: SCREEN_WIDTH, height }}
              resizeMode="cover"
            />
          </View>
        )}
        keyExtractor={item => item.key}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pagination: { bottom: 12, position: 'absolute' },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
  dotActive: { width: 24, height: 8, borderRadius: 4, marginHorizontal: 4 },
});
