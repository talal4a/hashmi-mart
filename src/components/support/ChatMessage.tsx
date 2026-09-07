import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import ProfileAvatar from '../profile/ProfileAvatar';
import type { AvatarPreset } from '../profile/avatars/catalog';
import type { SupportMessage } from '../../types/support';
import HashmiAvatar from './HashmiAvatar';
import VoiceMessage from './VoiceMessage';
import { support, supportRadius } from './supportTheme';

/**
 * One turn of the conversation, with a face and a name on it.
 *
 * The Discord-style identity layout from PRD section 6.3 is doing something
 * WhatsApp-style balloons cannot: in a support chat the user needs to know at a
 * glance which sentences came from a machine, because the whole feature rests on
 * them trusting the difference. A name and an avatar on every AI turn is a
 * stronger signal than bubble colour alone, especially for a user reading Urdu
 * script where the alignment cue is weaker.
 *
 * Which is also why the assistant is left-aligned and the user right-aligned
 * *and* both keep their avatar — section 6.3 asks for exactly that, rather than
 * the usual trick of dropping the user's identity because "they know who they
 * are". They do; the point is the contrast.
 */

export type UserIdentity = {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  photoURL?: string | null;
  preset: AvatarPreset | null;
};

type Props = {
  message: SupportMessage;
  user: UserIdentity;
  /** First name only, so a two-word name does not wrap the header row. */
  displayName: string;
};

function ChatMessage({ message, user, displayName }: Props) {
  const reduced = useReducedMotion();
  const isUser = message.role === 'user';

  // Entry is a fade with a small rise. The *send* transition — the message
  // lifting out of the composer — belongs to the composer, not here; this is
  // what a message looks like when it simply arrives (an AI turn, or a replayed
  // history entry).
  const entering = reduced ? undefined : FadeIn.duration(220);

  return (
    <Animated.View
      entering={entering}
      layout={reduced ? undefined : LinearTransition.duration(220)}
      style={[s.row, isUser && s.rowUser]}
    >
      {!isUser ? (
        <View style={s.avatar}>
          <HashmiAvatar size={30} state="idle" />
        </View>
      ) : null}

      <View style={[s.column, isUser && s.columnUser]}>
        <Text style={[s.who, isUser && s.whoUser]} numberOfLines={1}>
          {isUser ? displayName : 'Hashmi AI'}
        </Text>

        {message.audioUri ? (
          <VoiceMessage message={message} />
        ) : (
          <View
            style={[
              s.bubble,
              isUser ? s.bubbleUser : s.bubbleAi,
              message.status === 'error' && s.bubbleError,
            ]}
          >
            {/*
              Urdu and Punjabi read right to left. `writingDirection: 'auto'`
              lets the platform decide per message, which is what keeps a mixed
              conversation legible without this app trying to detect a script
              itself — and it has to be per message, because one thread will
              hold both.
            */}
            <Text style={[s.text, isUser ? s.textUser : null, s.autoDirection]}>
              {message.content}
            </Text>
          </View>
        )}
      </View>

      {isUser ? (
        <View style={s.avatar}>
          <ProfileAvatar
            preset={user.preset}
            avatarUrl={user.avatarUrl}
            photoURL={user.photoURL}
            name={user.name}
            email={user.email}
            size={30}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowUser: { justifyContent: 'flex-end' },
  avatar: { paddingTop: 18 },
  column: { flexShrink: 1, maxWidth: '82%', gap: 3 },
  columnUser: { alignItems: 'flex-end' },
  who: { fontSize: 11, fontWeight: '700', color: support.muted, marginLeft: 2 },
  whoUser: { marginLeft: 0, marginRight: 2 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: supportRadius.bubble,
  },
  bubbleAi: {
    backgroundColor: support.aiSurface,
    borderWidth: 1,
    borderColor: support.aiBorder,
    borderTopLeftRadius: 6,
  },
  bubbleUser: {
    backgroundColor: support.userSurface,
    borderTopRightRadius: 6,
  },
  bubbleError: {
    backgroundColor: support.errorWash,
    borderColor: '#F2CFC6',
  },
  text: { fontSize: 14.5, lineHeight: 21, color: support.ink },
  textUser: { color: support.userInk },
  autoDirection: { writingDirection: 'auto' as const },
});

export default memo(ChatMessage);
