export default {
  expo: {
    name: "HashmiMart",
    slug: "hashmimart",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      resizeMode: "contain",
      backgroundColor: "#ecfeff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.hashmimart",
      infoPlist: {
        // Shown verbatim in the iOS permission sheet, so it says what the
        // recording is for rather than that the app would like the microphone.
        NSMicrophoneUsageDescription:
          "HashmiMart uses the microphone so you can send voice messages to Hashmi AI support and place voice orders."
      }
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#ecfeff"
      },
      package: "com.hashmimart",
      permissions: ["android.permission.RECORD_AUDIO", "android.permission.VIBRATE"]
    },
    plugins: [
      [
        "expo-audio",
        {
          microphonePermission:
            "HashmiMart uses the microphone so you can send voice messages to Hashmi AI support and place voice orders."
        }
      ]
    ]
  }
};
