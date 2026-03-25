"use client";

import { useState } from "react";
import { FileText, Plus, Loader2 } from "lucide-react";

interface Note {
  id: string;
  body: string;
  dateAdded: string;
}

interface NotesSectionProps {
  contactId: string;
  notes: Note[];
  onNoteAdded: () => void;
}

export default function NotesSection({ contactId, notes, onNoteAdded }: NotesSectionProps) {
  const [showInput, setShowInput] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!newNote.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/contacts/${contactId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newNote.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      setNewNote("");
      setShowInput(false);
      onNoteAdded();
    } catch {
      setError("Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-overline text-text-tertiary tracking-wider">
          NOTES ({notes.length})
        </h3>
        <button
          onClick={() => setShowInput(!showInput)}
          className="flex items-center gap-1 text-caption text-nah-orange hover:text-nah-orange-hover"
        >
          <Plus size={12} />
          Add Note
        </button>
      </div>

      {/* Add note input */}
      {showInput && (
        <div className="mb-3">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Type a note..."
            className="w-full bg-bg-secondary border border-border-default rounded-md px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-nah-orange focus:outline-none resize-none"
            rows={3}
            disabled={saving}
          />
          {error && <p className="text-caption text-danger mt-1">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => { setShowInput(false); setNewNote(""); }}
              className="btn-ghost px-3 py-1.5 text-caption"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary px-3 py-1.5 text-caption flex items-center gap-1"
              disabled={!newNote.trim() || saving}
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Save Note
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {notes.length === 0 && !showInput && (
          <p className="text-caption text-text-tertiary py-2">No notes yet</p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="bg-bg-secondary border border-border-default rounded-md px-3 py-2">
            <p className="text-body-sm text-text-primary whitespace-pre-wrap break-words">
              {note.body}
            </p>
            <p className="text-caption text-text-tertiary mt-1">
              {new Date(note.dateAdded).toLocaleDateString()} {new Date(note.dateAdded).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
