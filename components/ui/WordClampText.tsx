import { useState } from 'react';
import { StyleSheet, Text, View, type NativeSyntheticEvent, type StyleProp, type TextLayoutEventData, type TextStyle } from 'react-native';

interface Props {
  children: string;
  style?: StyleProp<TextStyle>;
  lines?: number;
}

// Texte limité à quelques lignes, coupé à la fin d'un mot avec « … » (« Tartines croustillantes à la farine
// de blé… »). Le texte entier est mesuré à l'écart (invisible) ; sans mesure (web), la limite de lignes du
// système s'applique.
export function WordClampText({ children, style, lines = 2 }: Props) {
  const [shown, setShown] = useState<string | null>(null);

  const onMeasure = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const measured = event.nativeEvent.lines;
    if (measured.length <= lines) {
      setShown(children);
      return;
    }
    // Lignes visibles, dernier mot retiré (place du « … »)
    const words = measured.slice(0, lines).map((line) => line.text).join('').trimEnd().split(/\s+/);
    const cut = (words.length > 1 ? words.slice(0, -1) : words).join(' ').replace(/[\s,;:.\-–—/]+$/, '');
    setShown(`${cut}…`);
  };

  return (
    <View>
      <Text style={style} numberOfLines={lines}>{shown ?? children}</Text>
      <View style={styles.measure} pointerEvents="none" importantForAccessibility="no-hide-descendants" aria-hidden>
        <Text style={style} onTextLayout={onMeasure}>{children}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
});
