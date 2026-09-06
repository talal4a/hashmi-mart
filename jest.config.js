module.exports = {
  preset: 'jest-expo',
  // Reanimated-driven components need worklets' non-native entry point.
  resolver: '<rootDir>/tests/support/resolver.js',
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  clearMocks: true,
  moduleNameMapper: {
    // Jest only transpiles .js/.ts; point lucide at its CommonJS build so the
    // icon set can be imported from component tests.
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
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
