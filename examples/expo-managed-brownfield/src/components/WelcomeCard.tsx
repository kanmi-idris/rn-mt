import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@theme/tokens';

export function WelcomeCard(props: {
  title: string;
  body: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{props.title}</Text>
      <Text style={styles.body}>{props.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.card,
    borderRadius: tokens.radius.md,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  body: {
    color: tokens.colors.ink,
    fontSize: 16,
    lineHeight: 22,
  },
});
