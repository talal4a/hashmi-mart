import { Component, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

/** Native hook creation can fail before an event handler gets a chance to catch it. */
export default class AudioBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View
        style={{
          padding: 12,
          gap: 8,
          backgroundColor: '#EDF8FE',
          borderRadius: 16,
        }}
      >
        <Text style={{ color: '#263E4C' }}>
          Audio is unavailable right now.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry audio"
          onPress={() => this.setState({ failed: false })}
          style={{ paddingVertical: 8 }}
        >
          <Text style={{ color: '#087F9C', fontWeight: '600' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}
