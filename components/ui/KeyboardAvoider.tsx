import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  StyleSheet,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

// Clavier : l'app s'affiche d'un bord à l'autre (Android 15, build de développement), la fenêtre ne
// rétrécit plus quand le clavier s'ouvre. Ce conteneur réduit sa hauteur de la partie cachée par le clavier
// (behavior « padding » sur Android comme sur iOS). Il mesure sa propre position à l'écran, ce qui le rend
// juste sous un en-tête, dans un onglet comme dans une fenêtre (Modal).
export function KeyboardAvoider({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<View>(null);
  const [top, setTop] = useState(0);

  return (
    <View
      ref={ref}
      style={[styles.fill, style]}
      onLayout={() => ref.current?.measureInWindow((_x, y) => setTop(y))}
    >
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={top} style={styles.fill}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

// Dans une zone qui défile : le champ actif remonte au-dessus du clavier à son ouverture
// (à brancher sur la ScrollView : ref et onScroll)
export function useKeyboardScroll(margin = 24) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetY = useRef(0);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', (event) => {
      const keyboardTop = event.endCoordinates.screenY;
      // Après la réduction de la zone par KeyboardAvoider
      setTimeout(() => {
        const input = TextInput.State.currentlyFocusedInput() as unknown as View | null;
        input?.measureInWindow((_x, y, _width, height) => {
          const hidden = y + height + margin - keyboardTop;
          if (hidden > 0) scrollRef.current?.scrollTo({ y: offsetY.current + hidden, animated: true });
        });
      }, 120);
    });
    return () => subscription.remove();
  }, [margin]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetY.current = event.nativeEvent.contentOffset.y;
  };

  return { scrollRef, onScroll, scrollEventThrottle: 32 };
}

// Clavier ouvert : pour masquer une barre du bas qui recouvrirait le champ en cours de saisie
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
