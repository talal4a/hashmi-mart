import { StyleSheet, Text, View } from 'react-native';
import { c, space, type } from '../../theme/design';
import PressableScale from '../ui/PressableScale';

type Props = {
  tabs: readonly string[];
  active: string;
  onChange?: (tab: string) => void;
};

/** Text tabs with an underline on the active one — no chrome, no boxes. */
export default function TabSwitcher({ tabs, active, onChange }: Props) {
  return (
    <View style={s.row}>
      {tabs.map(tab => {
        const isActive = tab === active;
        return (
          <PressableScale
            key={tab}
            style={s.tab}
            scaleTo={0.96}
            onPress={() => onChange?.(tab)}
          >
            <Text style={[s.label, isActive && s.labelActive]}>{tab}</Text>
            <View style={[s.rule, isActive && s.ruleActive]} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 22, paddingHorizontal: space.gutter },
  tab: { alignItems: 'flex-start', gap: 5 },
  label: { ...type.body, fontSize: 14.5, color: c.secondary },
  labelActive: { color: c.label, fontWeight: '600' },
  rule: {
    height: 2,
    borderRadius: 2,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  ruleActive: { backgroundColor: c.cyan },
});
