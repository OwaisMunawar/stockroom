import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { CountRecord } from '../../../../shared/contracts';
import type { InventoryController, InventoryState } from '../application/controller';
import { Badge, Button, Card, Empty, Section, styles } from '../../../ui/design';

function ConflictReview({
  count,
  state,
  controller,
}: {
  count: CountRecord;
  state: InventoryState;
  controller: InventoryController;
}) {
  const [note, setNote] = useState('');
  const product = state.snapshot.products.find((p) => p.id === count.command.productId);
  return (
    <Card>
      <Badge tone="warning">REVISION CONFLICT</Badge>
      <Text style={styles.heading}>{product?.name}</Text>
      <Text style={styles.text}>
        Your local count: {count.command.quantity} · based on revision {count.command.baseVersion}
      </Text>
      <Text style={styles.text}>
        Latest saved server view: {product?.onHand} · revision {product?.version}
      </Text>
      <Text style={styles.muted}>
        No stock was overwritten. Recount the shelf before replacing the server view, or keep the
        server count.
      </Text>
      <TextInput
        testID="conflict-note"
        accessibilityLabel="Conflict review note"
        autoCorrect={false}
        autoComplete="off"
        placeholder="What did you verify?"
        style={styles.input}
        value={note}
        onChangeText={setNote}
        multiline
      />
      <Button
        testID="requeue-count"
        label="Recount verified · queue replacement"
        disabled={state.busy}
        onPress={() => void controller.resolve(count, 'recount', note)}
      />
      <Button
        secondary
        testID="keep-server"
        label="Keep server count"
        disabled={state.busy}
        onPress={() => void controller.resolve(count, 'keep-server', note)}
      />
    </Card>
  );
}
export function OutboxScreen({
  controller,
  state,
}: {
  controller: InventoryController;
  state: InventoryState;
}) {
  const active = state.snapshot.counts.filter((c) =>
    ['queued', 'conflict', 'failed'].includes(c.state),
  );
  const product = state.snapshot.products.find((p) => p.id === 'brass-adapter');
  return (
    <View style={styles.page}>
      <Text style={styles.eyebrow}>DELIVERY / RECEIPTS / RECONCILIATION</Text>
      <Text style={styles.title}>Every count.{`\n`}Accounted for.</Text>
      <Text style={styles.muted}>
        A queued count stays on this device until a receipt is saved. Retries keep the original
        command ID.
      </Text>
      <Button
        label={state.busy ? 'Synchronizing…' : 'Sync now'}
        testID="sync-now"
        disabled={state.busy || !state.online}
        onPress={() => void controller.sync()}
      />
      <Section title="Local outbox" right={`${active.length} awaiting receipt`} />
      {active.length === 0 ? (
        <Empty
          title="Nothing waiting"
          message="Reviewed counts and their receipts remain in the ledger."
        />
      ) : null}
      {active.map((count) =>
        count.state === 'conflict' ? (
          <ConflictReview
            key={count.command.id}
            count={count}
            state={state}
            controller={controller}
          />
        ) : (
          <Card key={count.command.id}>
            <Badge>
              {count.state === 'failed' ? 'PAUSED AFTER FIVE ATTEMPTS' : 'QUEUED ON THIS DEVICE'}
            </Badge>
            <Text style={styles.heading}>
              {state.snapshot.products.find((p) => p.id === count.command.productId)?.name}
            </Text>
            <Text style={styles.text}>
              {count.command.quantity} observed · based on revision {count.command.baseVersion}
            </Text>
            <Text style={styles.muted}>{count.command.note}</Text>
            <Text style={styles.muted}>
              Delivery attempts: {count.attempts}
              {count.error ? ` · ${count.error}` : ''}
            </Text>
            {count.state === 'failed' ? (
              <Button
                secondary
                label="Resume delivery"
                onPress={() => void controller.retry(count.command.id)}
              />
            ) : null}
          </Card>
        ),
      )}
      {controller.mode === 'demo' && product ? (
        <>
          <Section title="Conflict lab" right="Local demo only" />
          <Card>
            <Badge>SIMULATED SECOND DEVICE</Badge>
            <Text style={styles.text}>
              Change the demo server’s brass-adapter count while your device is offline. The next
              sync must surface the newer revision.
            </Text>
            <Button
              secondary
              testID="simulate-competition"
              label="Run competing demo count"
              disabled={state.busy}
              onPress={() => void controller.simulateCompetingCount(product)}
            />
            <Text style={styles.muted}>
              This changes the persisted demo warehouse, not a real inventory server.
            </Text>
          </Card>
        </>
      ) : null}
    </View>
  );
}
