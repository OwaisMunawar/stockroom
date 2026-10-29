import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { openInventory } from './src/bootstrap';
import type { InventoryController } from './src/features/counts/application/controller';
import { InventoryApp } from './src/ui/InventoryApp';
import { Button, colors, styles } from './src/ui/design';

export default function App() {
  const [controller, setController] = useState<InventoryController | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void openInventory().then(
      (value) => {
        if (active) setController(value);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {controller ? (
        <InventoryApp controller={controller} />
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.paper,
            justifyContent: 'center',
            padding: 30,
            gap: 16,
          }}
        >
          <Text style={styles.title}>Stockroom</Text>
          {failed ? (
            <>
              <Text style={styles.text}>
                Could not open the local warehouse. Saved data has not been reset.
              </Text>
              <Button
                label="Retry opening"
                onPress={() => {
                  setFailed(false);
                  setAttempt(attempt + 1);
                }}
              />
            </>
          ) : (
            <ActivityIndicator accessibilityLabel="Opening warehouse" />
          )}
        </View>
      )}
    </SafeAreaProvider>
  );
}
