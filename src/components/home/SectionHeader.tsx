import { StyleSheet, Text, View } from 'react-native';
import { c, space, type } from '../../theme/design';
import Icon from '../ui/Icon';
import PressableScale from '../ui/PressableScale';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function SectionHeader({ title, actionLabel, onAction }: Props) {
  return (
    <View style={s.row}>
      <Text style={s.title}>{title}</Text>
      {actionLabel ? (
        <PressableScale style={s.action} scaleTo={0.94} onPress={onAction}>
          <Text style={s.actionText}>{actionLabel}</Text>
          <Icon name="chevron" size={13} color={c.cyanDeep} weight="bold" />
        </PressableScale>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
  },
  title: { ...type.section },
  action: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionText: {
    ...type.micro,
    fontSize: 13,
    color: c.cyanDeep,
    letterSpacing: -0.2,
  },
});
