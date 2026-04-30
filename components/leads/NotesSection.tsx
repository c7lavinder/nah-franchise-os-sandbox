"use client";

import { FileText } from "lucide-react";
import { useShowNote } from "@/components/contact/ActionButtons";

interface Note {
  id: string;
  body: string;
  dateAdded: string;
}

interface NotesSectionProps {
  contactId: string;
  contactName: string;
  notes: Note[];
  onNoteAdded: () => void;
}

export default function NotesSection({ contactId, contactName, notes, onNoteAdded }: NotesSectionProps) {
  const showNote = useShowNote();

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-overline text-text-tertiary tracking-wider">NOTES ({notes.length})</h3>
        <button
          onClick={() => showNote({ contactId, contactName }, undefined, onNoteAdded)}
          className="flex items-center gap-1 text-caption text-nah-orange hover:text-nah-orange-hover"
        >
          + Add Note
        </button>
      </div>

      {/* Notes list */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {notes.length === 0 && <p className="text-caption text-text-tertiary py-2">No notes yet</p>}
        {notes.map((note) => (
          <div key={note.id} className="bg-bg-secondary border border-border-default rounded-md px-3 py-2">
            <p className="text-body-sm text-text-primary whitespace-pre-wrap break-words">{note.body}</p>
            <p className="text-caption text-text-tertiary mt-1">
              {new Date(note.dateAdded).toLocaleDateString()}{" "}
              {new Date(note.dateAdded).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
