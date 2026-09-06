import { StyleSheet, Text } from 'react-native';
import { c, radius, shadow, type } from '../../theme/design';
import Icon from '../ui/Icon';
import { IconName } from '../ui/icons';
import PressableScale from '../ui/PressableScale';

type Props = {
  label: string;
  icon: IconName;
  active?: boolean;
  onPress?: () => void;
};

export default function CategoryPill({ label, icon, active, onPress }: Props) {
  return (
    <PressableScale
      style={[s.pill, active ? s.pillActive : s.pillIdle]}
      scaleTo={0.94}
      onPress={onPress}
    >
      <Icon name={icon} size={17} color={active ? c.white : c.label} />
      <Text style={[s.label, active && s.labelActive]}>{label}</Text>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 50,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
  },
  pillIdle: { backgroundColor: c.white, ...shadow.pill },
  pillActive: { backgroundColor: c.ink, ...shadow.floating },
  label: { ...type.title, fontSize: 15 },
  labelActive: { color: c.white },
});
