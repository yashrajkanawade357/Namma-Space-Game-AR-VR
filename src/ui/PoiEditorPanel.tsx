import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store";
import { selectPoi } from "../nav/runtime";
import { venueIdFromUrl } from "../venue/loadVenue";
import { loadPois } from "../poi/loadPois";
import { clearDraft, deletePoi, exportJson, setPois, updatePoi, useEditor } from "../poi/editorStore";
import { CATEGORIES, type PoiCategory } from "../poi/types";

/**
 * Tagging tool (?edit=1). Built for the finale's on-site round: tag a freshly scanned venue in
 * minutes, then download pois.json into public/venues/<id>/.
 */
export function PoiEditorPanel() {
  const editMode = useApp((s) => s.editMode);
  const pois = useApp((s) => s.pois);
  const view = useApp((s) => s.view);
  const { mode, editingId, draftZone, set } = useEditor();
  const venueId = useMemo(() => venueIdFromUrl(), []);
  const [copied, setCopied] = useState(false);
  const editing = pois.find((p) => p.id === editingId) ?? null;

  // Enter finishes the zone being drawn; Esc cancels whatever click is pending.
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      const ed = useEditor.getState();
      if (e.key === "Enter" && ed.mode === "zone") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (ed.editingId && ed.draftZone.length >= 3) updatePoi(venueId, ed.editingId, { zone: ed.draftZone });
        ed.set({ mode: "idle", draftZone: [] });
      } else if (e.key === "Escape" && ed.mode !== "idle") ed.set({ mode: "idle", draftZone: [] });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editMode, venueId]);

  if (!editMode) return null;

  const arm = (m: "place" | "move" | "zone") => {
    if (useApp.getState().view !== "overview") useApp.setState({ view: "overview" });
    set({ mode: m, draftZone: [] });
  };
  const finishZone = () => {
    if (editing && draftZone.length >= 3) updatePoi(venueId, editing.id, { zone: draftZone });
    set({ mode: "idle", draftZone: [] });
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJson(pois)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "pois.json" });
    a.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson(pois));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      download();
    }
  };
  const hint: Record<string, string> = {
    place: "Click the spot on the scan where the label should go.",
    move: "Click the new spot for this place.",
    zone: `Click the corners of the room or area on the floor (${draftZone.length} so far), then Finish (Enter).`,
  };

  return (
    <aside className="panel pointer-events-auto flex max-h-[calc(100vh-230px)] w-72 flex-col overflow-hidden p-0" aria-label="Place editor">
      <div className="border-b border-[var(--line)] p-3">
        <p className="eyebrow">Editor</p>
        <h2 className="display text-[16px]">Tag places</h2>
        {view !== "overview" && <p className="mt-1 text-[12px] text-[var(--warn)]">Press V for the overview to click on the scan.</p>}
        {mode !== "idle" && <p className="mt-2 rounded bg-[var(--warn-soft)] p-2 text-[12px]">{hint[mode]}</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn-primary flex-1 !py-1.5 text-[13px]" onClick={() => arm("place")}>
            + Add place
          </button>
          {mode !== "idle" && (
            <button type="button" className="chip" onClick={() => (mode === "zone" ? finishZone() : set({ mode: "idle", draftZone: [] }))}>
              {mode === "zone" ? (draftZone.length >= 3 ? "Finish" : "Cancel") : "Cancel"}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="space-y-2 border-b border-[var(--line)] p-3 text-[13px]">
          <label className="block">
            <span className="text-[11px] text-[var(--muted)]">Name</span>
            <input className="field" value={editing.name} onChange={(e) => updatePoi(venueId, editing.id, { name: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[11px] text-[var(--muted)]">Category</span>
            <select className="field" value={editing.category} onChange={(e) => updatePoi(venueId, editing.id, { category: e.target.value as PoiCategory })}>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-[var(--muted)]">Other names, comma-separated</span>
            <input
              className="field"
              value={(editing.aliases ?? []).join(", ")}
              onChange={(e) => updatePoi(venueId, editing.id, { aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-[var(--muted)]">Description</span>
            <input className="field" value={editing.description ?? ""} onChange={(e) => updatePoi(venueId, editing.id, { description: e.target.value || undefined })} />
          </label>
          <p className="mono text-[11px] text-[var(--muted)]">
            id {editing.id} · at {editing.position.map((v) => v.toFixed(2)).join(", ")}
            {editing.zone ? ` · zone ${editing.zone.length} corners` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="chip" onClick={() => arm("move")}>
              Move
            </button>
            <button type="button" className="chip" onClick={() => arm("zone")}>
              {editing.zone ? "Redraw zone" : "Draw zone"}
            </button>
            {editing.zone && (
              <button type="button" className="chip" onClick={() => updatePoi(venueId, editing.id, { zone: undefined })}>
                Remove zone
              </button>
            )}
            <button type="button" className="chip chip-warn" onClick={() => deletePoi(venueId, editing.id)}>
              Delete
            </button>
          </div>
        </div>
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {pois.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[var(--sunk)] ${p.id === editingId ? "bg-[var(--sunk)] font-semibold" : ""}`}
              onClick={() => {
                set({ editingId: p.id, mode: "idle", draftZone: [] });
                selectPoi(p.id);
              }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORIES[p.category].color }} />
              <span className="truncate">{p.name}</span>
              {p.zone && <span className="ml-auto text-[10px] text-[var(--muted)]">zone</span>}
            </button>
          </li>
        ))}
        {!pois.length && <li className="px-3 py-4 text-[12px] text-[var(--muted)]">No places yet. Add the first one.</li>}
      </ul>

      <div className="grid grid-cols-2 gap-2 border-t border-[var(--line)] p-3">
        <button type="button" className="btn-secondary !py-1.5 text-[12px]" onClick={download}>
          Download pois.json
        </button>
        <button type="button" className="btn-secondary !py-1.5 text-[12px]" onClick={copy}>
          {copied ? "Copied" : "Copy JSON"}
        </button>
        <button
          type="button"
          className="col-span-2 text-[11px] text-[var(--muted)] hover:text-[var(--fg)]"
          onClick={async () => {
            clearDraft(venueId);
            setPois(venueId, await loadPois(venueId));
            clearDraft(venueId);
            set({ editingId: null, mode: "idle", draftZone: [] });
          }}
        >
          Discard browser draft and reload pois.json
        </button>
      </div>
    </aside>
  );
}
