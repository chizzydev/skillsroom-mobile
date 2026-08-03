const baseConfig = require("./app.json");

const variant = process.env.APP_VARIANT || process.env.SKILLSROOM_APP_VARIANT || "production";
const isDevelopment = variant === "development" || variant === "dev" || variant === "local";

module.exports = () => {
  const expo = {
    ...baseConfig.expo,
    android: {
      ...baseConfig.expo.android
    },
    ios: {
      ...baseConfig.expo.ios
    },
    extra: {
      ...(baseConfig.expo.extra || {}),
      appVariant: isDevelopment ? "development" : "production"
    }
  };

  if (isDevelopment) {
    expo.name = "Skillsroom Dev";
    expo.scheme = "skillsroom-dev";
    expo.android.package = "com.skillsroom.mobile.dev";
    expo.ios.bundleIdentifier = "com.skillsroom.mobile.dev";
  }

  return { expo };
};
