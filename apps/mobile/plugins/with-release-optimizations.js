// Release build tuning, applied on every `expo prebuild`:
// - resource shrinking (R8 minification is already on): drops unused resources from the APK;
// - one APK per CPU architecture instead of a single "fat" APK: a phone downloads only its own native code.
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64'];

function setProperty(props, key, value) {
  const existing = props.find((p) => p.type === 'property' && p.key === key);
  if (existing) existing.value = value;
  else props.push({ type: 'property', key, value });
}

module.exports = function withReleaseOptimizations(config) {
  config = withGradleProperties(config, (c) => {
    setProperty(c.modResults, 'android.enableMinifyInReleaseBuilds', 'true');
    setProperty(c.modResults, 'android.enableShrinkResourcesInReleaseBuilds', 'true');
    return c;
  });
  return withAppBuildGradle(config, (c) => {
    if (c.modResults.contents.includes('// studium: abi splits')) return c;
    const splits = `
    // studium: abi splits
    splits {
        abi {
            enable true
            reset()
            include ${ABIS.map((a) => `"${a}"`).join(', ')}
            universalApk false
        }
    }
`;
    c.modResults.contents = c.modResults.contents.replace(/android\s*\{\n/, (m) => `${m}${splits}`);
    return c;
  });
};
