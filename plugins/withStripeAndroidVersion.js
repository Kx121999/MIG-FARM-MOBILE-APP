const {
  createRunOncePlugin,
  withProjectBuildGradle,
} = require('expo/config-plugins');

const STRIPE_ANDROID_VERSION = '23.4.0';
const START_MARKER = '// @generated begin mig-farm-stripe-android-version';
const END_MARKER = '// @generated end mig-farm-stripe-android-version';
const MANAGED_BLOCK = `${START_MARKER}
ext {
  stripeVersion = "${STRIPE_ANDROID_VERSION}"
}
${END_MARKER}`;

function pinStripeAndroidVersion(contents) {
  const managedBlockPattern = new RegExp(
    `${escapeRegExp(START_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}`,
    'm',
  );

  if (managedBlockPattern.test(contents)) {
    return contents.replace(managedBlockPattern, MANAGED_BLOCK);
  }

  const existingAssignment = /(^[ \t]*)stripeVersion\s*=\s*["'][^"']+["'][^\r\n]*$/m;
  if (existingAssignment.test(contents)) {
    return contents.replace(
      existingAssignment,
      `$1stripeVersion = "${STRIPE_ANDROID_VERSION}"`,
    );
  }

  const allProjectsAnchor = /^allprojects\s*\{/m;
  if (!allProjectsAnchor.test(contents)) {
    throw new Error(
      'Unable to pin Stripe Android SDK: allprojects block was not found in android/build.gradle.',
    );
  }

  return contents.replace(allProjectsAnchor, `${MANAGED_BLOCK}\n\n$&`);
}

function withStripeAndroidVersion(config) {
  return withProjectBuildGradle(config, (androidConfig) => {
    if (androidConfig.modResults.language !== 'groovy') {
      throw new Error('Stripe Android SDK pin requires a Groovy project build.gradle.');
    }

    androidConfig.modResults.contents = pinStripeAndroidVersion(
      androidConfig.modResults.contents,
    );
    return androidConfig;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = createRunOncePlugin(
  withStripeAndroidVersion,
  'with-stripe-android-version',
  '1.0.0',
);

module.exports.pinStripeAndroidVersion = pinStripeAndroidVersion;
