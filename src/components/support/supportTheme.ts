/**
 * Support's slice of the HashmiMart palette.
 *
 * Nothing new is invented here — every value is either lifted from
 * `theme/design.ts` or from the home screen's `groceryTheme`, because PRD
 * section 1 asks for the chat to sit inside the same cyan/white/glass language
 * as Home rather than beside it. What this file adds is *names for the roles*:
 * "the surface an AI bubble sits on" is a decision worth stating once, since it
 * appears in five components and has to stay the same in all of them.
 */
import { c } from '../../theme/design';

export const support = {
  /** Page wash, top to bottom. */
  washTop: '#E4F5FF',
  canvas: '#F7FCFF',

  ink: '#0B1F2A',
  muted: '#69818D',
  faint: '#94A9B5',

  /** Hashmi AI's colour. Same cyan as the home mic and the tab indicator. */
  accent: '#0EA5E9',
  accentDeep: c.cyanDeep,
  accentWash: '#E8F7FE',

  /** AI messages: white card. User messages: filled cyan. */
  aiSurface: '#FFFFFF',
  aiBorder: '#DCEFF8',
  userSurface: '#0EA5E9',
  userInk: '#FFFFFF',

  /** WhatsApp's own green; the one colour in the app that is not ours to pick. */
  whatsapp: '#25D366',

  /** Errors stay warm rather than alarming — a retry is not a crash. */
  error: '#D8543F',
  errorWash: '#FDF0EC',
} as const;

export const supportRadius = {
  bubble: 20,
  chip: 18,
  card: 24,
} as const;
