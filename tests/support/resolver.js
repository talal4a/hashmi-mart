const reactNativeResolver = require('@react-native/jest-preset/jest/resolver');

/**
 * The Expo preset's resolver, with the react-native-worklets tweak layered on
 * top: worklets' `.native` entry points reach for TurboModules that do not
 * exist under Jest, so those extensions are dropped for that package only.
 * Everything else keeps React Native's own resolution (which is what maps
 * packages like lucide-react-native to their CommonJS build).
 */
module.exports = (request, options) => {
  const worklets =
    request.includes('react-native-worklets') ||
    options.basedir.includes('react-native-worklets');

  if (worklets) {
    return reactNativeResolver(request, {
      ...options,
      extensions: options.extensions?.filter(ext => !ext.includes('native')),
    });
  }
  return reactNativeResolver(request, options);
};
