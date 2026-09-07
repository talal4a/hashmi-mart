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

### The Groq key is server-side. Always.

The Groq API key must never reach the Expo bundle — not in `app.config.js`, not
in an `EXPO_PUBLIC_*` variable, not in a constant. Anything shipped in the app
is extractable from the APK in minutes, and a leaked key is somebody else's
inference bill charged to this account.

The key lives in `functions/` and only there. The app talks to two callables,
`supportChat` and `supportTranscribe`, which are the only code that ever sees it.

**Production** — store it in Secret Manager, once:

```sh
firebase functions:secrets:set GROQ_API_KEY   # paste the key when prompted
firebase deploy --only functions
```

**Local emulator** — copy the example file and paste a key into the copy.
`functions/.env.local` is gitignored; `functions/.env.example` is the committed
placeholder.

```sh
cp functions/.env.example functions/.env.local
firebase emulators:start --only functions,auth
```

To point the app at the emulator, add `connectFunctionsEmulator(functions,
'127.0.0.1', 5001)` beside the `functions` export in `src/config/firebase.ts` —
and take it out again before shipping.

If a key is ever pasted into a chat, a commit, a screenshot or an issue, treat
it as public and rotate it at <https://console.groq.com/keys>. Revoking is free;
finding out later is not.

### What the backend guarantees

- Callers must be signed in — an open endpoint is free inference for anyone.
- History is re-validated server-side: turn count, length, and role are all
  capped there, because a modified client will not cap them.
- Groq errors never reach the app. Every upstream fault becomes one of six
  friendly messages in `supportService.ts`; the real cause is logged.
- The system prompt lives in `functions/src/prompt.ts`, so it can be corrected
  without shipping a new build. It forbids inventing order, payment, refund,
  delivery or rider facts — the assistant says it cannot verify and offers
  WhatsApp instead.
- Order context is supplied by the server or not at all
  (`src/services/supportContext.ts` is the seam, and returns `null` today).

### Client layout

```
src/screens/SupportScreen.tsx        the screen
src/hooks/useSupportChat.ts          conversation state, streaming, retry
src/hooks/useVoiceRecorder.ts        shared mic + level metering
src/services/supportService.ts       the two callables, and error mapping
src/components/support/              header, messages, chips, composer, cards
src/components/voice/                AnimatedMic, VoiceWaveform, VoiceRecorder
src/config/support.ts                WhatsApp number, quick actions
```

`src/components/voice/` is the shared voice engine. Voice Order must reuse it
rather than growing a second recording stack.

Voice notes need `expo-audio` and haptics need `expo-haptics`, both native
modules — rebuild the dev client (`npx expo run:android` / `run:ios`) after
pulling; a Metro reload alone will not pick them up.

Run `npx jest tests/ai-support` for the support service, WhatsApp deep link, and
error-mapping checks.

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
