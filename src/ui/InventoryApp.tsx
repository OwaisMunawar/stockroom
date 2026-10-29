import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { InventoryController } from '../features/counts/application/controller';
import { CountScreen } from '../features/counts/ui/CountScreen';
import { InventoryScreen } from '../features/counts/ui/InventoryScreen';
import { LedgerScreen } from '../features/counts/ui/LedgerScreen';
import { OutboxScreen } from '../features/counts/ui/OutboxScreen';
import { colors, styles } from './design';

type Tab = 'inventory' | 'count' | 'outbox' | 'ledger';
const tabs: readonly { id: Tab; label: string; mark: string }[] = [
  { id: 'inventory', label: 'Stock', mark: '▦' },
  { id: 'count', label: 'Count', mark: '+' },
  { id: 'outbox', label: 'Outbox', mark: '⇅' },
  { id: 'ledger', label: 'Ledger', mark: '≡' },
];
export function InventoryApp({ controller }: { controller: InventoryController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [tab, setTab] = useState<Tab>('inventory');
  const [note, setNote] = useState('');
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.paper }}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View
        style={{
          paddingHorizontal: 22,
          paddingTop: 8,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 27,
            height: 27,
            borderWidth: 5,
            borderColor: colors.blue,
            borderRadius: 6,
            transform: [{ rotate: '-8deg' }],
          }}
        />
        <Text
          style={{ flex: 1, fontSize: 24, fontWeight: '700', letterSpacing: -1, color: colors.ink }}
        >
          Stockroom
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.muted }}>
            {state.online ? 'READY TO SYNC' : 'WORKING OFFLINE'}
          </Text>
          <Switch
            testID="online-switch"
            accessibilityLabel="Enable sync connection"
            value={state.online}
            disabled={state.busy}
            onValueChange={(value) => controller.setOnline(value)}
            trackColor={{ true: colors.blue }}
          />
        </View>
      </View>
      <View style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
        <Text testID="connection-mode" style={{ fontSize: 10, color: colors.muted }}>
          {controller.mode === 'demo'
            ? 'LOCAL DEMO WAREHOUSE · NO NETWORK REQUIRED'
            : 'HTTP REFERENCE SERVER · SINGLE WAREHOUSE'}
        </Text>
      </View>
      {state.error ? (
        <View
          style={{
            padding: 14,
            backgroundColor: '#FFE9DC',
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <Text accessibilityLiveRegion="polite" style={[styles.text, { flex: 1 }]}>
            {state.error}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss error"
            onPress={() => controller.clearError()}
            style={{ padding: 8 }}
          >
            <Text>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}
      {state.notice ? (
        <View style={{ padding: 12, backgroundColor: colors.lime }}>
          <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: colors.ink }}>
            {state.notice}
          </Text>
        </View>
      ) : null}
      {state.busy ? (
        <ActivityIndicator accessibilityLabel="Working on this device" color={colors.blue} />
      ) : null}
      <ScrollView
        key={tab}
        testID="page-scroll"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {tab === 'inventory' ? (
          <InventoryScreen
            state={state}
            count={(product) => {
              setNote(`${product.onHand} ${product.name} in bin ${product.bin}.`);
              setTab('count');
            }}
          />
        ) : tab === 'count' ? (
          <CountScreen
            controller={controller}
            state={state}
            initialNote={note}
            onQueued={() => setTab('outbox')}
          />
        ) : tab === 'outbox' ? (
          <OutboxScreen controller={controller} state={state} />
        ) : (
          <LedgerScreen state={state} />
        )}
      </ScrollView>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderColor: colors.line,
          paddingTop: 10,
          paddingBottom: 4,
        }}
      >
        {tabs.map((item) => (
          <Pressable
            key={item.id}
            testID={`tab-${item.id}`}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: tab === item.id }}
            onPress={() => setTab(item.id)}
            style={{ flex: 1, alignItems: 'center', padding: 8, gap: 3, minHeight: 54 }}
          >
            <Text
              style={{
                fontSize: 22,
                lineHeight: 25,
                color: tab === item.id ? colors.blue : colors.muted,
                fontWeight: '500',
              }}
            >
              {item.mark}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: tab === item.id ? '700' : '400',
                color: tab === item.id ? colors.ink : colors.muted,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
