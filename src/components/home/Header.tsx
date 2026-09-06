import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { c, radius, shadow, type } from '../../theme/design';
import Icon from '../ui/Icon';
import PressableScale from '../ui/PressableScale';

type Props = {
  name: string;
  avatar?: ImageSourcePropType;
  onNotifications?: () => void;
};

export default function Header({ name, avatar, onNotifications }: Props) {
  const initial = name.trim().charAt(0).toUpperCase() || 'H';

  return (
    <View style={s.row}>
      <View style={s.identity}>
        {avatar ? (
          <Image source={avatar} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.initial}>{initial}</Text>
          </View>
        )}
        <View style={s.greeting}>
          <Text style={s.hi}>Hi, Welcome back</Text>
          <Text style={s.name} numberOfLines={1}>
            {name}
          </Text>
        </View>
      </View>

      <PressableScale style={s.bell} scaleTo={0.9} onPress={onNotifications}>
        <Icon name="bell" size={20} color={c.label} />
        <View style={s.dot} />
      </PressableScale>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  identity: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 7,
    paddingLeft: 7,
    paddingRight: 14,
    borderRadius: radius.pill,
    backgroundColor: c.white,
    ...shadow.pill,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: c.cyanTint,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.cyan,
  },
  initial: { ...type.title, fontSize: 16, color: c.white },
  greeting: { flexShrink: 1 },
  hi: { ...type.caption, fontSize: 11.5, color: c.secondary },
  name: { ...type.title, fontSize: 14.5, marginTop: 0.5 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: c.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.pill,
  },
  dot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: c.cyan,
    borderWidth: 1.5,
    borderColor: c.white,
  },
});
