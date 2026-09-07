import { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated';

import type { RootStackParamList } from '../navigation/RootNavigator';
import useProfileIdentity from '../hooks/useProfileIdentity';
import useSupportChat from '../hooks/useSupportChat';
import useVoiceRecorder from '../hooks/useVoiceRecorder';
import { AVATARS } from '../components/profile/avatars/catalog';
import { tapRecordStart, tapSend } from '../components/voice/haptics';
import VoiceRecorder from '../components/voice/VoiceRecorder';
import SupportHeader from '../components/support/SupportHeader';
import HashmiAvatar from '../components/support/HashmiAvatar';
import ChatMessage, {
  type UserIdentity,
} from '../components/support/ChatMessage';
import AIMessage from '../components/support/AIMessage';
import HandoffCard from '../components/support/HandoffCard';
import ErrorRetry from '../components/support/ErrorRetry';
import ChatComposer from '../components/support/ChatComposer';
import QuickActions, {
  ChipFlight,
  type ChipRect,
} from '../components/support/QuickActionChip';
import { support } from '../components/support/supportTheme';
import type { QuickAction } from '../types/support';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Hashmi AI Support.
 *
 * The screen owns three things and delegates the rest: who the user is, where a
 * tapped chip flies to, and how the keyboard behaves. Conversation state lives
 * in `useSupportChat`, the microphone in `useVoiceRecorder`, and every piece of
 * motion in the component that owns the thing being animated — which is what
 * keeps this file readable at the length the feature actually is.
 *
 * Identity comes from the existing profile document (PRD section 6.3): no
 * placeholder name, no invented avatar. A user who has not finished their
 * profile still gets their initials and their real first name from Firebase
 * Auth, which is better than "Alex" and better than a blank disc.
 */
export default function SupportScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const { user, profile } = useProfileIdentity();
  const chat = useSupportChat();
  const recorder = useVoiceRecorder();

  const scroller = useRef<ScrollView>(null);
  const [flight, setFlight] = useState<{ label: string; from: ChipRect } | null>(
    null,
  );

  const identity: UserIdentity = useMemo(
    () => ({
      name: profile?.name || user?.displayName || '',
      email: profile?.email || user?.email,
      avatarUrl: profile?.avatarUrl,
      photoURL: profile?.photoURL ?? user?.photoURL,
      preset: AVATARS.find(a => a.id === profile?.avatarId) ?? null,
    }),
    [profile, user],
  );

  /** First name only — the greeting and every message header use it. */
  const firstName = useMemo(() => {
    const full = (identity.name || '').trim();
    return full ? full.split(/\s+/)[0] : 'there';
  }, [identity.name]);

  // Pinned to the bottom on every change. `animated` is off under Reduce Motion
  // because a scroll is motion too, and a long answer streaming in would
  // otherwise scroll continuously for its whole length.
  const scrollToEnd = useCallback(() => {
    scroller.current?.scrollToEnd({ animated: !reduced });
  }, [reduced]);

  const send = useCallback(
    (text: string) => {
      tapSend();
      chat.send(text);
    },
    [chat],
  );

  /**
   * A quick action becomes a message.
   *
   * The message and the request both start now, while the chip is still in the
   * air — PRD section 8.1 asks for the request to begin once the *visual* send
   * has begun, which is the difference between a 400ms animation that costs
   * nothing and one that adds 400ms to every answer.
   */
  const selectAction = useCallback(
    (action: QuickAction, from: ChipRect | null) => {
      if (from && !reduced) setFlight({ label: action.label, from });
      send(action.prompt);
    },
    [send, reduced],
  );

  const startRecording = useCallback(async () => {
    const ok = await recorder.start();
    if (ok) tapRecordStart();
  }, [recorder]);

  const sendRecording = useCallback(async () => {
    const recording = await recorder.stop();
    if (!recording) return;
    tapSend();
    await chat.sendVoice(recording);
  }, [recorder, chat]);

  const generating = chat.pending || chat.live !== null;
  const avatarState = chat.live?.content
    ? 'speaking'
    : generating
      ? 'thinking'
      : 'idle';

  // Where a flying chip lands: the bottom-right of the conversation, just above
  // the composer, which is where the user's message settles.
  const flightTarget = useMemo(
    () => ({ x: width - 150, y: height - insets.bottom - 190 }),
    [width, height, insets.bottom],
  );

  return (
    <View style={s.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDF8FE" />
      <LinearGradient
        colors={[support.washTop, support.canvas]}
        style={s.wash}
        pointerEvents="none"
      />

      <SupportHeader
        onBack={() => navigation.goBack()}
        avatarState={avatarState}
      />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // iOS lifts the whole view by the keyboard height, which would hide the
        // header behind the notch without this offset. Android's adjustResize
        // handles it at the window level, so the behaviour is left unset there.
        keyboardVerticalOffset={insets.top + 62}
      >
        <ScrollView
          ref={scroller}
          style={s.flex}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
        >
          {/* The greeting is always present: it is the assistant introducing
              itself, not an empty state that disappears once used. */}
          <View style={s.greeting}>
            <View style={s.greetingHead}>
              <HashmiAvatar size={44} state={avatarState} />
              <Text style={s.greetingName}>Hashmi AI ✦</Text>
            </View>
            <Text style={s.greetingLine}>
              Assalam-o-Alaikum, {firstName} 👋
            </Text>
            <Text style={s.greetingAsk}>
              Aaj main aap ki kis cheez mein madad kar sakta hoon?
            </Text>
          </View>

          {!chat.started ? (
            <Animated.View exiting={reduced ? undefined : FadeOut.duration(160)}>
              <QuickActions onSelect={selectAction} disabled={generating} />
            </Animated.View>
          ) : null}

          <View style={s.thread}>
            {chat.messages.map(message => (
              <View key={message.id} style={s.turn}>
                {message.role === 'assistant' ? (
                  <>
                    <AIMessage content={message.content} phase="complete" />
                    {message.handoff ? (
                      <HandoffCard message={handoffMessage(firstName)} />
                    ) : null}
                  </>
                ) : (
                  <ChatMessage
                    message={message}
                    user={identity}
                    displayName={firstName}
                  />
                )}
              </View>
            ))}

            {chat.live ? (
              <AIMessage
                content={chat.live.content}
                phase={chat.live.content ? 'streaming' : 'thinking'}
              />
            ) : null}

            {chat.error ? (
              <ErrorRetry
                message={chat.error}
                onRetry={chat.retry}
                retrying={chat.retrying}
                offerWhatsApp={chat.error !== 'Stopped.'}
              />
            ) : null}
          </View>
        </ScrollView>

        <View style={[s.dock, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {recorder.recording ? (
            <VoiceRecorder
              levels={recorder.levels}
              durationMs={recorder.durationMs}
              onCancel={recorder.cancel}
              onSend={sendRecording}
            />
          ) : (
            <ChatComposer
              onSend={send}
              onStartRecording={startRecording}
              onStop={chat.stop}
              generating={generating}
            />
          )}

          {recorder.status === 'denied' ? (
            <Animated.Text
              entering={reduced ? undefined : FadeIn.duration(200)}
              style={s.micDenied}
            >
              Microphone access is off. Enable it in Settings to send a voice
              note, or type your question instead.
            </Animated.Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      {flight ? (
        <ChipFlight
          label={flight.label}
          from={flight.from}
          to={flightTarget}
          onDone={() => setFlight(null)}
        />
      ) : null}
    </View>
  );
}

/** What a handoff prefills WhatsApp with, so the agent has a starting point. */
function handoffMessage(firstName: string): string {
  return `Assalam-o-Alaikum, I need help with HashmiMart. (${firstName}, from the app)`;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: support.canvas },
  flex: { flex: 1 },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  content: { padding: 16, paddingBottom: 24, gap: 16 },
  greeting: { gap: 4, paddingTop: 6 },
  greetingHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greetingName: {
    fontSize: 15,
    fontWeight: '700',
    color: support.accentDeep,
    letterSpacing: -0.2,
  },
  greetingLine: {
    fontSize: 20,
    fontWeight: '700',
    color: support.ink,
    letterSpacing: -0.5,
    marginTop: 6,
  },
  greetingAsk: {
    fontSize: 13.5,
    lineHeight: 19,
    color: support.muted,
    writingDirection: 'auto',
  },
  thread: { gap: 14 },
  turn: { gap: 10 },
  dock: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D9EDF7',
    backgroundColor: '#F4FBFEEE',
  },
  micDenied: {
    fontSize: 11,
    lineHeight: 16,
    color: support.muted,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
