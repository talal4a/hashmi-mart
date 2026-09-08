import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useNavigation } from '@react-navigation/native';
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
import {
  VoicePlaybackProvider,
  useVoicePlayback,
} from '../components/support/VoicePlaybackContext';
import AudioBoundary from '../components/voice/AudioBoundary';
import useVoiceRecorder from '../hooks/useVoiceRecorder';
import { AVATARS } from '../components/profile/avatars/catalog';
import { tapRecordStart, tapSend } from '../components/voice/haptics';
import VoiceRecorder from '../components/voice/VoiceRecorder';
import SupportHeader from '../components/support/SupportHeader';
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

export default function SupportScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const { user, profile } = useProfileIdentity();
  const chat = useSupportChat();
  const focused = useIsFocused();
  const [recorderSession, setRecorderSession] = useState(0);
  const [startingRecorder, setStartingRecorder] = useState(false);
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', value =>
      setForeground(value === 'active'),
    );
    return () => sub.remove();
  }, []);
  const audioEnabled = focused && foreground;

  const scroller = useRef<ScrollView>(null);
  const [flight, setFlight] = useState<{
    label: string;
    from: ChipRect;
  } | null>(null);

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
    <VoicePlaybackProvider enabled={audioEnabled}>
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
              <Text style={s.greetingLine}>
                Assalam-o-Alaikum, {firstName} 👋
              </Text>
              <Text style={s.greetingAsk}>
                Aaj main aap ki kis cheez mein madad kar sakta hoon?
              </Text>
            </View>

            {!chat.started ? (
              <Animated.View
                exiting={reduced ? undefined : FadeOut.duration(160)}
              >
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
                      onRetryVoice={chat.retry}
                      onDeleteVoice={chat.deleteVoice}
                      busy={chat.pending}
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
                  onRetry={() => chat.retry()}
                  retrying={chat.retrying}
                  offerWhatsApp={chat.error !== 'Stopped.'}
                />
              ) : null}
            </View>
          </ScrollView>

          <View
            style={[s.dock, { paddingBottom: Math.max(insets.bottom, 10) }]}
          >
            {focused && (foreground || startingRecorder) ? (
              <AudioBoundary>
                <SupportVoiceRecorder
                  key={recorderSession}
                  onReset={() => setRecorderSession(value => value + 1)}
                  onStartingChange={setStartingRecorder}
                  onSend={send}
                  onSendVoice={chat.sendVoice}
                  onStop={chat.stop}
                  generating={generating}
                />
              </AudioBoundary>
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
    </VoicePlaybackProvider>
  );
}

// Focus owns the native recorder lifetime; meter ticks only rerender this dock.
function SupportVoiceRecorder({
  onStartingChange,
  onReset,
  onSend,
  onSendVoice,
  onStop,
  generating,
}: {
  onStartingChange: (starting: boolean) => void;
  onReset: () => void;
  onSend: (text: string) => void;
  onSendVoice: ReturnType<typeof useSupportChat>['sendVoice'];
  onStop: () => void;
  generating: boolean;
}) {
  const recorder = useVoiceRecorder();
  const playback = useVoicePlayback();
  useEffect(() => () => playback.setRecording(false), [playback.setRecording]);
  useEffect(() => {
    playback.setRecording(
      ['requesting', 'recording', 'stopping', 'ready'].includes(
        recorder.status,
      ),
    );
  }, [recorder.status, playback.setRecording]);
  const reduced = useReducedMotion();
  const startRecording = useCallback(async () => {
    playback.select(null);
    // Permission activities temporarily background Android. Keep this owner
    // alive until the request resolves so the first tap can finish.
    onStartingChange(true);
    try {
      const ok = await recorder.start();
      if (ok) tapRecordStart();
    } finally {
      onStartingChange(false);
    }
  }, [recorder, playback, onStartingChange]);

  const sendRecording = useCallback(async () => {
    const recording = await recorder.stop();
    if (!recording) return;
    tapSend();
    await onSendVoice(recording);
  }, [recorder, onSendVoice, playback]);

  return (
    <>
      {recorder.hasRecording ? (
        <VoiceRecorder
          compact
          levels={recorder.levels}
          durationMs={recorder.durationMs}
          onCancel={recorder.cancel}
          recording={recorder.recording}
          busy={recorder.status === 'stopping'}
          onSend={sendRecording}
        />
      ) : (
        <ChatComposer
          onSend={onSend}
          disabled={
            recorder.status === 'requesting' || recorder.status === 'error'
          }
          onStartRecording={startRecording}
          onStop={onStop}
          generating={generating}
        />
      )}

      {recorder.status === 'error' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset microphone"
          onPress={onReset}
          style={{ padding: 8 }}
        >
          <Text style={s.micDenied}>
            Recording couldn't finish. Tap here to reset the microphone.
          </Text>
        </Pressable>
      ) : null}
      {recorder.status === 'ready' ? (
        <Text style={s.micDenied}>
          Two-minute limit reached. Your note is ready to send.
        </Text>
      ) : null}
      {recorder.status === 'requesting' ? (
        <Text style={s.micDenied}>Preparing your microphone…</Text>
      ) : null}
      {recorder.status === 'denied' ? (
        <Animated.Text
          entering={reduced ? undefined : FadeIn.duration(200)}
          style={s.micDenied}
        >
          Microphone access is off. Enable it in Settings to send a voice note,
          or type your question instead.
        </Animated.Text>
      ) : null}
    </>
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
