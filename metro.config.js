const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

/**
 * Native modules the app can run without.
 *
 * Metro resolves every `require` while it builds the graph, so a module that is not
 * installed fails the whole bundle — a try/catch at runtime is too late to help,
 * which is how an empty `@react-native-google-signin` directory once took this app
 * down completely. Resolving a listed module to an empty one instead means the
 * feature that needs it reports itself unavailable and everything else still runs.
 *
 * Once the package is installed this branch never fires: resolution succeeds and
 * the real module is used. So the list is a floor, not an override, and there is
 * nothing here to undo after `npx expo install`.
 *
 * Only add a module here if the code that reads it checks for the function it
 * needs before calling it — see src/services/photoPicker.ts.
 */
const OPTIONAL = ['expo-image-picker'];

const base = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = base ?? context.resolveRequest;
  if (OPTIONAL.includes(moduleName)) {
    try {
      return resolve(context, moduleName, platform);
    } catch {
      return { type: 'empty' };
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: './global.css',
});
