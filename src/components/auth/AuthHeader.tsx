import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import BrandMark from './BrandMark';

/**
 * Logo, headline and whatever line goes under it — the top third of every auth
 * screen, so the three cannot drift apart on logo size or heading scale.
 *
 * The mark comes from BrandMark, which is also what the banded screens use, so
 * "the same size everywhere" is now enforced by there being one number rather
 * than by three files agreeing. It replaces a 56dp box of the uncropped square,
 * which drew 46dp of actual artwork; at 86dp of cropped artwork the lockup is
 * 2.1× the linear size it was here, and its wordmark is legible for the first
 * time.
 *
 * This screen pays 30dp for that on a card that was shortened to clear the fold,
 * which is a real cost and worth naming. The 16dp under the mark is where the
 * saving would have come from and it is not available: the raster is cropped to
 * its alpha bounds, so the wordmark's baseline is the mark's last row, and at
 * 12dp the blue "HASHMI MART" and the dark headline read as two competing
 * titles — rendered side by side at 12/16/20 before settling here. It is
 * affordable instead because the page scrolls and the mark is above the first
 * screenful either way: what moves down is the bottom of a form people are
 * already scrolling to finish.
 */
export default function AuthHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <View>
      <View className="items-center">
        <BrandMark />
      </View>

      <Text className="mt-4 text-center text-[22px] font-bold leading-tight text-[#0B2027]">
        {title}
      </Text>

      {children ? <View className="mt-2">{children}</View> : null}
    </View>
  );
}