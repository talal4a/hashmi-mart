import { StyleSheet, Text, TextInput, View } from 'react-native';
import { c, radius, shadow, type } from '../../theme/design';
import Icon from '../ui/Icon';
import PressableScale from '../ui/PressableScale';

type Props = {
  placeholder?: string;
  location?: string;
  onLocationPress?: () => void;
};

export default function SearchBar({
  placeholder = 'Search 20k+ products',
  location = 'Pocket 25.NH 254',
  onLocationPress,
}: Props) {
  return (
    <View style={s.field}>
      <Icon name="search" size={19} color={c.tertiary} weight="medium" />
      <TextInput
        style={s.input}
        placeholder={placeholder}
        placeholderTextColor={c.tertiary}
        editable={false}
      />
      <PressableScale
        style={s.location}
        scaleTo={0.94}
        onPress={onLocationPress}
      >
        <Icon name="pin" size={13} color={c.white} weight="bold" />
        <Text style={s.locationText} numberOfLines={1}>
          {location}
        </Text>
      </PressableScale>
    </View>
  );
}

const s = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 62,
    paddingLeft: 20,
    paddingRight: 7,
    borderRadius: radius.pill,
    backgroundColor: c.white,
    ...shadow.card,
  },
  input: { ...type.body, flex: 1, padding: 0, fontSize: 15.5 },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 158,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: c.cyan,
    ...shadow.accent,
  },
  locationText: {
    ...type.micro,
    fontSize: 12.5,
    color: c.white,
    letterSpacing: -0.2,
  },
});
