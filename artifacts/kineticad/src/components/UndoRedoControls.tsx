import { useEffect } from 'react';
import { Redo2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useKinetiCADStore } from '@/state/store';

/** Model history shortcuts leave the browser's text-editing history alone. */
export function UndoRedoControls({ disabled = false }: { disabled?: boolean }) {
  const canUndo = useKinetiCADStore(s => s.canUndo);
  const canRedo = useKinetiCADStore(s => s.canRedo);
  const blockedReason = useKinetiCADStore(s => s.historyBlockedReason);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || !(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      const action = key === 'z' ? (event.shiftKey ? 'redo' : 'undo')
        : key === 'y' && event.ctrlKey && !event.shiftKey ? 'redo' : null;
      if (!action) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'))) return;
      // Dialogs own their keyboard interactions. Checking the live DOM also
      // covers a dialog that opened since the last component render.
      if (Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).some(el => el.getClientRects().length)) return;
      event.preventDefault();
      if (!disabled) void runHistory(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled]);

  const reason = disabled ? 'Finish the current edit or file operation first.' : blockedReason;
  return <div className="flex shrink-0 items-center gap-0.5" aria-label="Model history">
    {(['undo', 'redo'] as const).map(action => {
      const Icon = action === 'undo' ? Undo2 : Redo2;
      const label = action === 'undo' ? 'Undo' : 'Redo';
      const available = action === 'undo' ? canUndo : canRedo;
      const shortcut = action === 'undo' ? 'Ctrl / ⌘ Z' : 'Ctrl / ⌘ Shift Z';
      return <button key={action} type="button" aria-label={label}
        aria-keyshortcuts={action === 'undo' ? 'Control+z Meta+z' : 'Control+Shift+z Meta+Shift+z Control+y'}
        disabled={!!reason || !available}
        title={reason || (available ? `${label} the last model change (${shortcut})` : `Nothing to ${action}. History starts when you edit this project.`)}
        onClick={() => void runHistory(action)} data-testid={`history-${action}`}
        className="flex h-9 min-w-10 flex-col items-center justify-center gap-0.5 rounded px-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-35">
        <Icon size={14} /><span className="text-[9px] leading-none">{label}</span>
      </button>;
    })}
  </div>;
}

async function runHistory(action: 'undo' | 'redo') {
  const state = useKinetiCADStore.getState();
  if (state.historyBlockedReason || !(action === 'undo' ? state.canUndo : state.canRedo)) return;
  try {
    await state[action]();
  } catch (error) {
    toast.error(`Could not ${action} the model change`, { description: error instanceof Error ? error.message : String(error) });
  }
}
