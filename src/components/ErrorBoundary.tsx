import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Renders the crash instead of a white screen.
 *
 * LogBox can be silenced (it was — `ignoreAllLogs()`), and a render exception
 * behind that setting is indistinguishable from a blank screen. This boundary
 * turns any uncaught render error into readable text so it can be reported.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('Render crash:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Screen error</Text>
        <ScrollView style={styles.scroll}>
          <Text style={styles.message}>{String(error.message || error)}</Text>
          <Text style={styles.stack}>{String(error.stack ?? '')}</Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff', paddingTop: 60, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#dc2626', marginBottom: 12 },
  scroll: { flex: 1 },
  message: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 12 },
  stack: { fontSize: 11, color: '#444' },
});
