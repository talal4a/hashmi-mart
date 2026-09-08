# Support voice notes: changes and verification

Status: voice upload and AI reply verified on the connected Android phone after the September 8 upload fix. Native playback start/pause is verified; the agent has not independently heard speaker output. iOS device checks remain pending.

## Voice upload fix — September 8

Expo 57 installs Expo fetch globally. Its multipart encoder rejects the legacy React Native `{ uri, name, type }` descriptor with `Unsupported FormDataPart implementation` before making a network request. The catch block then mapped that local encoding failure to “offline”. Text chat uses XHR and was unaffected.

`transcribeVoice` now explicitly uses `expo/fetch` and appends the validated `expo-file-system` File itself. Authentication, cancellation, the 45-second deadline, and response handling are preserved. The regression check uses the installed Expo FormData patch and real multipart serializer: the legacy descriptor rejects, while the new upload contains the file bytes, filename, and media type with an automatically generated boundary.

On the signed-in itel S685LN, tapped Retry on the previously failed six-second note. It produced the Urdu transcript “ہیلو کیسے ہو” and the AI response “ہیلو! میں ٹھیک ہوں، آپ کیسے ہیں؟”. This verifies upload → transcription → AI reply through the actual app. The older failed note remains available for Retry.

Targeted voice/support checks: 42 tests pass. TypeScript remains blocked only by the pre-existing swiper ref and navigation-test errors.

## Follow-up on the connected itel phone — September 8

- Reproduced the mic returning to idle after briefly showing “Preparing your microphone”. Android opened its permission activity despite RECORD_AUDIO already being granted; the foreground-only dock disposed the pending recorder.
- Check existing permission before requesting again, retain the recorder owner through a pending permission request, and avoid starting if the app remains backgrounded. Added a regression test for already-granted permission.
- Removed the duplicate avatar/“Hashmi AI ✦” greeting row. The Support header remains.
- Support now uses a compact recording tray with a blinking red microphone, live meter, timer, delete and send controls. Reduce Motion keeps the mic steady; the home recorder keeps its existing presentation.
- Manually verified the updated UI on the connected, signed-in itel S685LN: recording opens, timer/meter advance, another recording can start, and starting recording disposes playback. Tested voice-note pause/resume; Android AudioTrack changed between paused and started, with unmuted speaker routing. Actual audible output was not independently heard by the agent.
- The submitted recording showed the existing offline upload error. Successful transcription is still unverified; this follow-up does not claim to fix that separate upload failure.
- Current targeted checks: 42 tests pass across voice and support-service suites. TypeScript still reports the two existing errors listed below.

## Findings and changes

- **Sending:** transcription had no deadline or cancellation, failed uploads had no usable retry target, and the maximum-duration stop discarded its result. The hook also ran network work inside a React state updater and computed voice history inside another updater. Requests now start outside React updaters, use a synchronous in-flight guard, retain the same card and URI for Retry, preserve the transcript for answer-only retries, and support Stop during transcription. Uploads time out after 45 seconds. Missing/empty files, rejected audio, and silent recordings get specific friendly messages.
- **Playback:** the previous component ignored `AudioStatus.error`, so asynchronous native failures could appear to do nothing. It also played immediately after starting an asynchronous seek and created one player per card without exclusive playback or navigation ownership. Only the selected card now mounts a player; replay awaits seek, rapid taps use synchronous intent, progress comes from Expo status, errors offer recovery, and loading has a bounded deadline. Leaving Support, backgrounding the app, or starting a recording disposes that player. Returning to Support does not automatically resume audio. A 4.46-second recording inspected from the phone was a valid mono AAC/M4A file at 22,050 Hz, approximately 64 kbps; this rules out an empty/malformed container for that sample, not all recordings.
- **Released recorder:** earlier cleanup read/stopped an Expo-owned recorder, while the screen could remain mounted and status polling continued. The recorder now belongs to the focused, foreground dock. Expo handles disposal. One guarded poller runs only during recording, operations share a synchronous lock, and async continuations check lifetime before accessing native state. Native recording errors expose a reset that mounts a fresh owner. The two-minute limit retains a ready-to-send note and never requires a second native stop.
- **Audio session races:** session-mode changes are serialized using opaque owner tokens. Old cleanup cannot reset the mode for a newer owner. No recorder/player object is stored globally or in Zustand.
- **Home:** `searchWrap` reserved 100 pixels with 44 pixels of top padding for a temporary, absolutely positioned greeting. This explains the excessive gap. That reservation and temporary greeting are removed. Voice copy now reserves three lines from the first frame, rotates once using one cleaned-up interval, pauses off-screen/in background, and uses full-phrase fades under Reduce Motion. The reported physical movement after reload was not reproduced on the locked device; it is not claimed as an independently measured layout shift.

The Groq Worker, selected models, authentication, profile state, navigation routes, product/category/vendor data, and WhatsApp linking were preserved. No dependency or native configuration changes were introduced.

## Files

- `src/hooks/useVoiceRecorder.ts`: recorder lifecycle, polling, file validation, retained recording limit.
- `src/hooks/useSupportChat.ts`: one request lifecycle, pure state updates, retry/delete/cancel.
- `src/services/supportService.ts`: transcription timeout, cancellation and file/error checks.
- `src/services/voiceAudioSession.ts` (new): ordered audio-mode ownership.
- `src/types/support.ts`: per-card voice errors.
- `src/screens/SupportScreen.tsx`: focused/foreground audio ownership, recovery controls.
- `src/components/support/VoiceMessage.tsx`: actual selected-card playback and error/retry UI.
- `src/components/support/VoicePlaybackContext.tsx` (new): exclusive playback selection.
- `src/components/support/ChatMessage.tsx`: voice retry/delete wiring and message entry.
- `src/components/support/ChatComposer.tsx`: controlled entry/exit and mic press compression.
- `src/components/support/AIMessage.tsx`: preserve thinking collapse during answer reveal; memoized completed messages.
- `src/components/support/AIThinkingIndicator.tsx`: stop invisible motion; honor reduced travel.
- `src/components/voice/VoiceRecorder.tsx`: real recording/ready/finishing states and transitions.
- `src/components/voice/voiceMotion.ts` (new): restrained recorder rise, send compression/rise and cancel descent.
- `src/components/voice/AudioBoundary.tsx` (new): recover from native hook/render failures.
- `src/components/home/GroceryHome.tsx`: remove greeting gap; use reserved copy.
- `src/components/home/VoiceOrderCopy.tsx` (new): finite copy animation with lifecycle cleanup.
- `tests/voice/*.test.*`, `tests/ai-support/support.test.ts`: regression coverage.

The recorder-to-card transition uses coordinated compression/rise and card entry, not a fragile shared-element transition. Existing typography, colors, avatar components, compact header and WhatsApp controls remain.

## Automated and build checks

- Voice suite: 21 passing tests covering stop/cancel races, idle/unmount polling, permission denial, late permission/stop completion, the recording limit, replay seek ordering, native playback failures, exclusive playback, missing-load recovery, transcription retry/cancel/delete/history, and audio-session ownership.
- Support service/SSE/identity checks: 37 passing tests, including upload timeout/cancellation and existing text/WhatsApp behavior.
- Android and iOS production JavaScript/Hermes export succeeds. This is a bundle check, not an on-device audio or native binary test.
- TypeScript reports two existing blockers: `react-native-swiper-flatlist` nullable ref typing, and `tests/ai-support/navigation.test.tsx` calling `useStoredProfile` with an unsupported argument.
- That existing navigation test also fails because its test router does not register Support. It was not modified in this task.

## Android device verification (pending)

1. Unlock the connected phone, open the current development build and reload the Metro bundle. Native dependencies did not change.
2. Open Support. Record a 4–8 second spoken question, observe the live meter, and tap Send. Verify a voice card appears, then its transcript, then an AI answer. In `worker`, run `npm run tail` and confirm `/transcribe` succeeds followed by `/chat`. Logs must not print ID tokens, audio contents, or Groq credentials.
3. Tap the card and listen for actual sound from the speaker. Confirm elapsed position and waveform progress, tap Pause, resume, allow completion and replay. Rapidly tap play/pause. Send a second note and switch playback; only one may be audible.
4. Record and Cancel; start again. Record for two minutes: the tray must show a ready note which Send submits once or Cancel discards. Navigate away while recording, return, and record again. Navigate away during playback: audio must stop and remain stopped on return.
5. Deny microphone permission, then grant it in Settings. Confirm friendly text and recovery. Reset an errored microphone to create a fresh native recorder.
6. Disable networking before Send. Restore networking and use Retry on the same card; there must be no duplicate user note. Delete a failed card. Press Stop during transcription and retry.
7. Open Home from a fresh reload. Compare header/search/voice-card positions before and after each phrase. Enable system Reduce Motion and larger text; copy must stay inside reserved space. Observe motion on normal device hardware; no 60-fps claim has been measured yet.

## iOS device verification (pending)

Run the same flow on a configured iOS development build (`npm run ios` if one needs building). Test microphone denial in Settings, playback with the silent switch enabled, speaker routing after recording, app background/foreground, navigation disposal, completion/replay, network failure/retry, and Reduce Motion/larger text. No iOS device test was available in this session.
