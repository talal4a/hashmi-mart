module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  clearMocks: true,
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?/|expo(nent)?|@expo(nent)?/|@react-navigation/|react-native-svg|lucide-react-native)',
  ],
  collectCoverageFrom: [
    'src/services/{emailAuth,googleAuth,users,profileGate}.ts',
    'src/hooks/{useAuthUser,useAuthDestination,useAuthBack,useAfterAuth,useStoredProfile,useSplashGate}.ts',
    'src/screens/{LoginScreen,SignupScreen,ForgotPasswordScreen,CompleteProfileScreen}.tsx',
    'src/components/profile/{ProfileForm,RoleSelect}.tsx',
    'src/components/AuthBottomSheet.tsx',
    'src/validation/Schema.ts',
    'src/utils/{authErrors,firestoreErrors,phone}.ts',
  ],
  coverageReporters: ['text', 'html', 'lcov'],
};
