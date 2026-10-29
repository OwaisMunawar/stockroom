import { Pressable, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import type { InventoryState } from '../application/controller';
import type { Product } from '../../../../shared/contracts';
import { Badge, Card, Metric, Section, colors, styles } from '../../../ui/design';

export function InventoryScreen({
  state,
  count,
}: {
  state: InventoryState;
  count: (product: Product) => void;
}) {
  const [query, setQuery] = useState('');
  const products = state.snapshot.products.filter((p) =>
    `${p.name} ${p.sku} ${p.bin}`.toLowerCase().includes(query.toLowerCase()),
  );
  const active = state.snapshot.counts.filter((c) =>
    ['queued', 'conflict', 'failed'].includes(c.state),
  );
  return (
    <View style={styles.page}>
      <Text style={styles.eyebrow}>NORTH DEPOT / CYCLE COUNTS</Text>
      <Text style={styles.title}>Count what’s here.{`\n`}Trust what syncs.</Text>
      <Text style={styles.muted}>
        Capture a count without a connection. Review differences before server stock changes.
      </Text>
      <Card dark>
        <Badge tone="lime">LOCAL-FIRST INVENTORY</Badge>
        <View style={[styles.row, { marginTop: 4 }]}>
          <Metric value={String(state.snapshot.products.length)} label="Catalog items" light />
          <Metric value={String(active.length)} label="Awaiting receipt" light />
          <Metric
            value={String(state.snapshot.products.filter((p) => p.onHand < p.threshold).length)}
            label="Low stock"
            light
          />
        </View>
        <View style={{ height: 1, backgroundColor: '#3E4C61', marginTop: 8 }} />
        <Text style={{ fontSize: 12, color: '#C5CEDA' }}>
          Saved locally. Applied only with a server receipt.
        </Text>
      </Card>
      <Section title="Stock on the shelf" right="Server-confirmed quantities" />
      <TextInput
        testID="catalog-search"
        accessibilityLabel="Search catalog"
        placeholder="Search name, SKU or bin"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        style={styles.input}
      />
      {products.length === 0 ? (
        <Text style={styles.muted}>No catalog items match this search.</Text>
      ) : null}
      {products.map((product) => {
        const pending = active.find((c) => c.command.productId === product.id);
        return (
          <Pressable
            key={product.id}
            testID={`product-${product.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Count ${product.name}`}
            onPress={() => count(product)}
          >
            <Card style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <View
                  style={{
                    width: 50,
                    height: 56,
                    borderRadius: 10,
                    backgroundColor: colors.paper,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.blue }}>
                    {product.bin}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>
                    {product.name}
                  </Text>
                  <Text style={styles.muted}>
                    {product.sku} · revision {product.version}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    testID={`quantity-${product.id}`}
                    style={{
                      fontSize: 27,
                      fontWeight: '600',
                      color: product.onHand < product.threshold ? colors.orange : colors.ink,
                    }}
                  >
                    {product.onHand}
                  </Text>
                  <Text style={styles.muted}>{product.unit}</Text>
                </View>
              </View>
              {pending ? (
                <Badge tone={pending.state === 'conflict' ? 'warning' : 'soft'}>
                  {pending.state === 'conflict'
                    ? 'CONFLICT NEEDS REVIEW'
                    : `LOCAL COUNT ${pending.command.quantity} · ${pending.state.toUpperCase()}`}
                </Badge>
              ) : null}
            </Card>
          </Pressable>
        );
      })}
      <Text style={styles.muted}>
        Sample warehouse data. Quantities shown here come from the latest saved server view.
      </Text>
    </View>
  );
}
