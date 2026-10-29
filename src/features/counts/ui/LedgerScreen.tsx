import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { csvReport } from '../../../../shared/counts';
import type { InventoryState } from '../application/controller';
import { Badge, Button, Card, Empty, Section, styles } from '../../../ui/design';

export function LedgerScreen({ state }: { state: InventoryState }) {
  const [preview, setPreview] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const confirmed = state.snapshot.counts.filter((c) => c.state === 'synced').length;
  return (
    <View style={styles.page}>
      <Text style={styles.eyebrow}>REVIEWED COUNTS / DURABLE RECEIPTS</Text>
      <Text style={styles.title}>A trace you{`\n`}can follow.</Text>
      <Text style={styles.muted}>
        The ledger keeps the original observation, delivery outcome and conflict decision together.
      </Text>
      <Card>
        <Badge tone="lime">
          {confirmed} SERVER-CONFIRMED {confirmed === 1 ? 'COUNT' : 'COUNTS'}
        </Badge>
        <Text style={styles.heading}>Warehouse handover</Text>
        <Text style={styles.muted}>
          CSV includes the latest saved server quantities and revisions. Pending local counts are
          excluded.
        </Text>
        <Button
          testID="preview-report"
          label={preview ? 'Hide CSV preview' : 'Preview CSV report'}
          secondary
          onPress={() => setPreview(!preview)}
        />
        {preview ? (
          <Text
            testID="report-data"
            selectable
            style={[styles.muted, { fontFamily: 'Courier', fontSize: 11 }]}
          >
            {csvReport(state.snapshot.products)}
          </Text>
        ) : null}
        <Button
          label="Share stock report"
          onPress={() =>
            void Share.share({
              title: 'Stockroom server-confirmed stock',
              message: csvReport(state.snapshot.products),
            }).catch(() => setShareError('Could not open the share sheet. Try the CSV preview.'))
          }
        />
        {shareError ? <Text accessibilityLiveRegion="polite">{shareError}</Text> : null}
      </Card>
      <Section title="Count history" right={`${state.snapshot.events.length} events`} />
      {state.snapshot.events.length === 0 ? (
        <Empty
          title="Start with one reviewed count"
          message="Queuing, receipts and conflict decisions will appear here."
        />
      ) : null}
      {state.snapshot.events.map((event) => {
        const count = state.snapshot.counts.find((c) => c.command.id === event.commandId);
        const product = state.snapshot.products.find((p) => p.id === count?.command.productId);
        return (
          <Card key={event.id}>
            <View style={styles.row}>
              <Badge tone={event.kind === 'conflict' ? 'warning' : 'soft'}>
                {event.kind.toUpperCase()}
              </Badge>
              <Text style={styles.muted}>
                {new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={styles.label}>
              {product?.name} · {count?.command.quantity} observed
            </Text>
            <Text style={styles.text}>{event.note}</Text>
            <Text style={styles.muted}>
              Draft origin: {count?.command.origin} · baseline revision {count?.command.baseVersion}
            </Text>
          </Card>
        );
      })}
    </View>
  );
}
