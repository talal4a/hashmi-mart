import React from 'react';
import { Svg, Path } from 'react-native-svg';

/**
 * Google's four-colour G.
 *
 * It was pasted verbatim into three files (Login, Signup and the onboarding
 * sheet), which is three chances for one of them to be resized or recoloured on
 * its own. Google's brand rules do not allow either, so there is one copy.
 *
 * The 48-unit viewBox is Google's own, so `size` is the only thing worth
 * exposing.
 */
export default function GoogleGlyph({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"
        fill="#FFC107"
      />
      <Path
        d="M2 24c0-3.8 1-7.4 2.7-10.5L11.8 19C11.3 20.6 11 22.3 11 24s.3 3.4.8 5l-7.1 5.5C2.9 31.4 2 27.9 2 24z"
        fill="#FF3D00"
      />
      <Path
        d="M24 46c5.4 0 10.3-1.8 14.1-5l-6.5-5.5C29.5 37.1 26.9 38 24 38c-6 0-11.1-4-12.8-9.5l-7.1 5.5C7.6 41 15.2 46 24 46z"
        fill="#4CAF50"
      />
      <Path
        d="M46 24c0-1.3-.2-2.7-.5-4H24v8.5h11.8c-.9 3-2.8 5.4-5.4 7l6.5 5.5C41.6 37.5 46 31.3 46 24z"
        fill="#1976D2"
      />
      <Path
        d="M24 11c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 15.2 2 7.6 7 4.7 14.5l7.1 5.5C13.5 15 18 11 24 11z"
        fill="#E53935"
      />
    </Svg>
  );
}
