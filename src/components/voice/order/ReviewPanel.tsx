import { StyleSheet, Text, View } from 'react-native';
import type { LayoutRectangle } from 'react-native';
import { Mic } from 'lucide-react-native';
import type { CatalogMatch } from '../../../services/voiceCatalog';
import type { VoiceOutcome } from './copy';
import HandoverBar from './HandoverBar';
import ItemRow from './ItemRow';
import OutcomeHeader from './OutcomeHeader';
import RepairActions from './RepairActions';
import StepRail from './StepRail';
import { C, text } from './theme';

/**
 * Everything the customer sees after the listening finishes.
 *
 * The panel does not decide anything. What happened is already settled by
 * `describeVoiceOutcome`, so this only chooses between the two endings: items
 * on their way to the cart, or a way to try again. Keeping the judgement out
 * of the view is what stops the headline and the buttons disagreeing.
 */

export default function ReviewPanel({
  outcome,
  transcript,
  matches,
  addable,
  hasRecording,
  paused,
  handoverMs,
  onPause,
  onConfirm,
  onRecord,
  onRetry,
  onKeepNote,
  onMeasureRow,
  onSetQuantity,
  onConfirmMatch,
}: {
  outcome: VoiceOutcome;
  transcript: string;
  matches: CatalogMatch[];
  addable: CatalogMatch[];
  hasRecording: boolean;
  paused: boolean;
  handoverMs: number;
  onPause: () => void;
  onConfirm: () => void;
  onRecord: () => void;
  onRetry: () => void;
  onKeepNote: () => void;
  onMeasureRow: (id: string, frame: LayoutRectangle) => void;
  onSetQuantity: (index: number, quantity: number) => void;
  onConfirmMatch: (index: number) => void;
}) {
  const handing = addable.length > 0;
  return (
    <View style={s.panel}>
      <StepRail current={handing ? 'cart' : 'listen'} />
      <OutcomeHeader outcome={outcome} />
      {transcript ? (
        <View style={s.transcript}>
          <View style={s.transcriptHeading}>
            <Mic size={13} color={C.muted} />
            <Text style={text.label}>YOU SAID</Text>
          </View>
          <Text style={s.transcriptText}>{transcript}</Text>
        </View>
      ) : null}
      {matches.length ? (
        <View style={s.items}>
          {matches.map((match, index) => (
            <ItemRow
              key={`${match.query}-${index}`}
              match={match}
              onMeasure={onMeasureRow}
              onSetQuantity={quantity => onSetQuantity(index, quantity)}
              onConfirm={() => onConfirmMatch(index)}
            />
          ))}
        </View>
      ) : null}
      {handing ? (
        <HandoverBar
          count={addable.length}
          durationMs={handoverMs}
          paused={paused}
          onPause={onPause}
          onConfirm={onConfirm}
        />
      ) : (
        <RepairActions
          action={outcome.action === 'add' ? 'record' : outcome.action}
          hasRecording={hasRecording}
          onRecord={onRecord}
          onRetry={onRetry}
          onKeepNote={onKeepNote}
        />
      )}
      <Text style={s.footnote}>
        {handing
          ? 'We send your voice to the shop with the order.'
          : 'Nothing is lost. Your recording stays here until you close this.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { gap: 14, paddingTop: 20 },
  transcript: {
    borderRadius: 18,
    backgroundColor: C.paper,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  transcriptHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  transcriptText: {
    color: C.ink,
    fontSize: 16,
    lineHeight: 25,
    writingDirection: 'auto',
  },
  items: { gap: 8 },
  footnote: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingBottom: 3,
  },
});
