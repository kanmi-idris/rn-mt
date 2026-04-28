import appJson from './app.json';

export default () => ({
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    existingEnvironment:
      process.env.EXPO_PUBLIC_API_BASE_URL ?? appJson.expo.extra.existingEnvironment,
  },
});
