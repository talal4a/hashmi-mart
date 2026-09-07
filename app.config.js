/**
 * The one Expo config for this app.
 *
 * There used to be two — `app.json` and this file — and that was a trap rather
 * than a convenience: when both exist, `app.config.js` replaces `app.json`
 * wholesale rather than merging with it. So `app.json` was already dead config,
 * and the moment a `plugins` array was added here, the Google Sign-In and
 * image-picker plugins it declared vanished from the build without any error.
 * Everything that file held is now here, and it is gone.
 *
 * Check what is actually in effect with `npx expo config --type public`.
 */
export default {
  expo: {
    name: 'HashmiMart',
    slug: 'hashmimart',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    newArchEnabled: true,

    // No `icon` or `splash.image` here on purpose. `app.json` pointed all three
    // image fields at `./assets/images/…`, a directory this project does not
    // have — the artwork lives under `src/assets/images/`. Those paths broke
    // `expo prebuild` the first time anyone ran it. The native projects in
    // `ios/` and `android/` already carry generated icons, so omitting these
    // keeps prebuild working and leaves that artwork untouched. To set real
    // icons later, add a 1024x1024 PNG and point `icon` at its true path.
    splash: {
      resizeMode: 'contain',
      backgroundColor: '#ecfeff',
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.hashmimart',
      infoPlist: {
        // Shown verbatim in the iOS permission sheet, so it says what the
        // recording is for rather than that the app would like the microphone.
        NSMicrophoneUsageDescription:
          'HashmiMart uses the microphone so you can send voice messages to Hashmi AI support and place voice orders.',
      },
    },

    android: {
      package: 'com.hashmimart',
      adaptiveIcon: {
        backgroundColor: '#ecfeff',
      },
      permissions: ['android.permission.RECORD_AUDIO', 'android.permission.VIBRATE'],
    },

    // The Google Sign-In config plugin is deliberately absent.
    //
    // It was declared in app.json, but app.json was never in effect (this file
    // replaced it), so the plugin has never run — and sign-in works anyway,
    // because `services/googleAuth.ts` configures it at runtime with
    // `GoogleSignin.configure({ webClientId })`. Adding it back breaks
    // `expo prebuild` outright: it demands an `iosUrlScheme`, and this project
    // has no iOS Google setup at all — no GoogleService-Info.plist, and a
    // Firebase appId that is Android-only. If iOS sign-in is ever needed,
    // create the iOS OAuth client first, then add the plugin with its reversed
    // client id.
    plugins: [
      [
        'expo-image-picker',
        {
          photosPermission:
            'HashmiMart uses your photos so you can set a profile picture.',
          cameraPermission:
            'HashmiMart uses your camera so you can take a profile picture.',
        },
      ],
      [
        'expo-audio',
        {
          microphonePermission:
            'HashmiMart uses the microphone so you can send voice messages to Hashmi AI support and place voice orders.',
        },
      ],
    ],
  },
};
