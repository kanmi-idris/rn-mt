import { StyleSheet, Text, View } from 'react-native';

import { brandConfig } from '@config/brand';
import { tokens } from '@theme/tokens';
import { WelcomeCard } from '@app/components/WelcomeCard';

export function HomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Existing brownfield home screen</Text>
      <WelcomeCard
        title={brandConfig.displayName}
        body={brandConfig.headline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    gap: tokens.spacing.md,
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  label: {
    color: tokens.colors.accent,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
