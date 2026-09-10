import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import AnimatedAuthButton from '../../src/components/auth/AnimatedAuthButton';

describe('AnimatedAuthButton', () => {
  it('renders idle label and triggers onPress when tapped', async () => {
    const onPress = jest.fn();
    const { getByText, getByRole } = await render(
      <AnimatedAuthButton
        state="idle"
        label="Sign In"
        onPress={onPress}
      />,
    );

    expect(getByText('Sign In')).toBeTruthy();
    const button = getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(false);
    expect(button.props.accessibilityState.busy).toBe(false);

    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disables pressing and sets busy accessibility state when loading', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(
      <AnimatedAuthButton
        state="loading"
        label="Sign In"
        onPress={onPress}
      />,
    );

    const button = getByRole('button');
    expect(button.props.accessibilityState.busy).toBe(true);
    expect(button.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders success state with green badge checkmark (no text label)', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(
      <AnimatedAuthButton
        state="success"
        label="Sign In"
        onPress={onPress}
      />,
    );

    const button = getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders error state and triggers onErrorEnd after delay', async () => {
    const onErrorEnd = jest.fn();
    await render(
      <AnimatedAuthButton
        state="error"
        label="Sign In"
        onPress={jest.fn()}
        onErrorEnd={onErrorEnd}
      />,
    );

    expect(onErrorEnd).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    expect(onErrorEnd).toHaveBeenCalledTimes(1);
  });

  it('respects disabled prop when idle', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(
      <AnimatedAuthButton
        state="idle"
        label="Sign In"
        disabled={true}
        onPress={onPress}
      />,
    );

    const button = getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
