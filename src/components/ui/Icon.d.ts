/**
 * Type surface for the platform-split Icon (Icon.ios.tsx / Icon.android.tsx).
 * Metro picks the implementation at bundle time; TypeScript reads this.
 */
import { ReactElement } from 'react';
import { IconProps } from './icons';

declare function Icon(props: IconProps): ReactElement;
export default Icon;
