This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

## Required profile role

Complete Profile requires an explicit choice of Customer, Vendor, or Rider.
Firestore stores it as `users/{uid}.role` (`customer`, `vendor`, or `rider`) in
the same write as the profile details and `profileComplete: true`. New accounts
start with `role: null`; repeat sign-ins preserve the selected role.

The shared profile gate requires a valid role, name, and phone. Existing accounts
without a role return to Complete Profile with their saved details prefilled,
even if their old completion flag is true. The role describes the account type;
it is not a Firebase Auth custom claim or a grant of backend permissions.

Run `npm run test:profile` for schema, persistence, cache, and routing regression
checks. These use an isolated Firestore double and do not write to live accounts.

## AI Support Chat (Hashmi AI)

Support lives at the `Support` route and opens from the AI button in the home
search bar. The floating green button on Home opens WhatsApp directly.

```
Expo app  ->  Cloudflare Worker  ->  Groq API
```

### The Groq key is server-side. Always.

The Groq API key must never reach the Expo bundle — not in `app.config.js`, not
in an `EXPO_PUBLIC_*` variable, not in a constant. Anything shipped in the app
is extractable from the APK in minutes, and a leaked key is somebody else's
inference bill charged to this account.

The key lives in `worker/` and only there.

**Production** — store it as a Worker secret, once:

```sh
cd worker
npx wrangler secret put GROQ_API_KEY   # paste the key when prompted
npx wrangler deploy
```

Then point the app at the deployed Worker. The URL is public, not a secret:

```sh
# .env, or your build environment
EXPO_PUBLIC_SUPPORT_API_URL=https://hashmimart-support.<your-subdomain>.workers.dev
```

**Local dev** — copy the example file and paste a key into the copy.
`worker/.dev.vars` is gitignored; `worker/.dev.vars.example` is the committed
placeholder.

```sh
cd worker
cp .dev.vars.example .dev.vars
npx wrangler dev            # serves on http://127.0.0.1:8787
```

Then run the app with `EXPO_PUBLIC_SUPPORT_API_URL=http://127.0.0.1:8787`. On a
physical Android device use your machine's LAN IP, not localhost.

`curl https://<worker>/health` returns `{"ok":true}` without touching Groq or
your token — it distinguishes "the Worker is deployed" from "the key is wrong".

If a key is ever pasted into a chat, a commit, a screenshot or an issue, treat
it as public and rotate it at <https://console.groq.com/keys>. Revoking is free;
finding out later is not.

### Authentication

Firebase callables used to verify the caller's ID token before any handler code
ran. A Worker gets none of that, so `worker/src/auth.ts` does it by hand: the
app sends its Firebase ID token as a bearer token, and the Worker verifies the
RS256 signature against Google's published JWKS, then checks `aud`, `iss` and
`exp`.

Without that check this endpoint would be a public Groq proxy. `npm test` in
`worker/` runs it against real forged tokens — rewritten uid, wrong signing key,
`alg:none`, expired, and a valid Google-signed token minted in *someone else's*
Firebase project, which is the case that is easiest to miss and cheapest to
exploit.

### What the backend guarantees

- Callers must be signed in, verified cryptographically on every request.
- History is re-validated server-side: turn count, length, and role are all
  capped there, because a modified client will not cap them.
- Groq errors never reach the app. Every upstream fault becomes an HTTP status
  that `supportService.ts` maps to one of six friendly messages; the real cause
  goes to `wrangler tail`.
- The system prompt lives in `worker/src/prompt.ts`, so it can be corrected
  without shipping a new build. It forbids inventing order, payment, refund,
  delivery or rider facts — the assistant says it cannot verify and offers
  WhatsApp instead.
- Order context is supplied by the server or not at all
  (`src/services/supportContext.ts` is the seam, and returns `null` today).

### Streaming

The Worker forwards Groq's own SSE stream rather than buffering it. On the
client, React Native's `fetch` cannot read a streaming body, so
`src/services/sse.ts` reads growing `responseText` off an `XMLHttpRequest`. If a
platform or proxy buffers the whole response anyway, every frame is still parsed
at the end — streaming degrades to non-streaming, never to nothing.

### Layout

```
worker/src/index.ts                  POST /chat (SSE), POST /transcribe
worker/src/auth.ts                   Firebase ID token verification
worker/src/groq.ts                   the only file that sees the key
worker/src/prompt.ts                 the assistant's rules

src/screens/SupportScreen.tsx        the screen
src/hooks/useSupportChat.ts          conversation state, streaming, retry
src/hooks/useVoiceRecorder.ts        shared mic + level metering
src/services/supportService.ts       backend calls and error mapping
src/services/sse.ts                  SSE over XHR, because RN fetch can't
src/components/support/              header, messages, chips, composer, cards
src/components/voice/                AnimatedMic, VoiceWaveform, VoiceRecorder
src/config/backend.ts                the Worker URL (public)
src/config/support.ts                WhatsApp number, quick actions
```

`src/components/voice/` is the shared voice engine. Voice Order must reuse it
rather than growing a second recording stack.

Voice notes need `expo-audio` and haptics need `expo-haptics`, both native
modules — rebuild the dev client (`npx expo run:android` / `run:ios`) after
pulling; a Metro reload alone will not pick them up.

### Tests

```sh
npx jest tests/ai-support   # SSE parsing, error mapping, WhatsApp deep link
npm --prefix worker test    # ID token verification against forged tokens
```

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
