import { Tabs } from 'expo-router';
import { Camera, Heart, House, ListChecks, SlidersHorizontal } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { TabBar } from '@/components/ui/TabBar';
import { colors } from '@/constants/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      // Barre de l'app : pilule derrière l'onglet actif, au-dessus des boutons de navigation d'Android
      tabBar={(props) => <TabBar {...props} />}
      // Retour : onglet précédent (depuis la liste de courses, par exemple)
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ size, color }) => <House size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: t('tabs.scan'),
          tabBarIcon: ({ size, color }) => <Camera size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: t('tabs.pantry'),
          tabBarIcon: ({ size, color }) => <ListChecks size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: t('tabs.saved'),
          tabBarIcon: ({ size, color }) => <Heart size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ size, color }) => <SlidersHorizontal size={size} color={color} />,
        }}
      />
      {/* Liste de courses : ouverte depuis l'accueil et le garde-manger, barre d'onglets visible */}
      <Tabs.Screen name="shopping" options={{ href: null, title: t('shopping.title') }} />
    </Tabs>
  );
}
