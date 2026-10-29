import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import type { InventoryController, InventoryState } from '../application/controller';
import { Badge, Button, Card, Section, colors, styles } from '../../../ui/design';

export function CountScreen({
  controller,
  state,
  initialNote,
  onQueued,
}: {
  controller: InventoryController;
  state: InventoryState;
  initialNote: string;
  onQueued: () => void;
}) {
  const [note, setNote] = useState(initialNote || 'Counted 14 brass adapters in bin B2.');
  const [manual, setManual] = useState(false);
  const [productId, setProductId] = useState('brass-adapter');
  const [quantity, setQuantity] = useState('14');
  const draft = state.draft;
  return (
    <View style={styles.page}>
      <Text style={styles.eyebrow}>CAPTURE / REVIEW / QUEUE</Text>
      <Text style={styles.title}>A count.{`\n`}Not a guess.</Text>
      <Text style={styles.muted}>
        Drafts cannot change stock. Check the product and exact quantity, then queue a reviewed
        count.
      </Text>
      <View style={styles.row}>
        <Button
          secondary={!manual}
          label={manual ? 'Use note entry' : 'Switch to manual entry'}
          onPress={() => setManual(!manual)}
          disabled={state.busy}
        />
      </View>
      {manual ? (
        <Card>
          <Text style={styles.label}>Catalog product</Text>
          <View style={styles.row}>
            {state.snapshot.products.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setProductId(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: p.id === productId }}
                accessibilityLabel={p.name}
              >
                <Badge tone={p.id === productId ? 'lime' : 'soft'}>{p.name}</Badge>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            accessibilityLabel="Manual quantity"
            keyboardType="number-pad"
            value={quantity}
            onChangeText={setQuantity}
          />
          <Button
            label="Review manual count"
            testID="manual-review"
            disabled={state.busy}
            onPress={() => void controller.prepareManual(productId, quantity)}
          />
        </Card>
      ) : (
        <Card>
          <Text style={styles.label}>Count note</Text>
          <TextInput
            testID="count-note"
            accessibilityLabel="Count note"
            autoCorrect={false}
            autoComplete="off"
            value={note}
            onChangeText={setNote}
            multiline
            style={[styles.input, { minHeight: 108, textAlignVertical: 'top' }]}
          />
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>On-device model</Text>
              <Text style={styles.muted}>
                {controller.modelAvailable
                  ? 'Available on this device'
                  : 'Not active · rules parser is available'}
              </Text>
            </View>
            <Switch
              testID="model-switch"
              accessibilityLabel="Use on-device model"
              disabled={!controller.modelAvailable || state.busy}
              value={state.modelEnabled}
              onValueChange={(value) => controller.setModel(value)}
              trackColor={{ true: colors.blue }}
            />
          </View>
          <Text style={styles.muted}>
            Use one named catalog item and one exact whole quantity. Fractions, estimates and number
            words are not supported.
          </Text>
          <Button
            label={state.busy ? 'Preparing draft…' : 'Prepare count draft'}
            testID="parse-count"
            disabled={state.busy}
            onPress={() => void controller.prepareDraft(note)}
          />
        </Card>
      )}
      {draft ? (
        <>
          <Section title="Review before queuing" />
          <Card>
            <Badge tone="lime">
              {draft.origin === 'on-device'
                ? 'ON-DEVICE AI'
                : draft.origin === 'rules'
                  ? 'RULES PARSER · NO MODEL'
                  : 'MANUAL ENTRY'}
            </Badge>
            <Text style={styles.heading}>{draft.product.name}</Text>
            <Text style={styles.muted}>
              {draft.product.sku} · bin {draft.product.bin} · baseline revision{' '}
              {draft.product.version}
            </Text>
            <View style={[styles.row, { paddingVertical: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.muted}>Server view</Text>
                <Text style={{ fontSize: 32, color: colors.ink }}>{draft.product.onHand}</Text>
              </View>
              <Text style={{ fontSize: 25, color: colors.muted }}>→</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.muted}>Observed count</Text>
                <Text
                  testID="draft-quantity"
                  style={{ fontSize: 42, fontWeight: '700', color: colors.blue }}
                >
                  {draft.quantity}
                </Text>
              </View>
            </View>
            <Text style={styles.text}>
              Difference: {draft.quantity - draft.product.onHand > 0 ? '+' : ''}
              {draft.quantity - draft.product.onHand} {draft.product.unit}
            </Text>
            <View style={{ borderLeftWidth: 3, borderColor: colors.blue, paddingLeft: 12 }}>
              <Text style={styles.muted}>Source note</Text>
              <Text style={styles.text}>{draft.note}</Text>
            </View>
            <Text style={styles.muted}>
              The product and numeric quantity are checked against the note. This does not prove the
              shelf was counted correctly.
            </Text>
            <Button
              label="Confirm and queue count"
              testID="queue-count"
              disabled={state.busy}
              onPress={() =>
                void controller.queueDraft().then((ok) => {
                  if (ok) onQueued();
                })
              }
            />
          </Card>
        </>
      ) : null}
    </View>
  );
}
