"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";

export function BoxNameEditor({
  boxId,
  initialName,
  labels,
}: {
  boxId: string;
  initialName: string;
  labels: {
    edit: string;
    save: string;
    cancel: string;
    nameLabel: string;
    saved: string;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const startEdit = () => {
    setDraft(name);
    setEditing(true);
    setError(null);
    setSaved(false);
  };

  const cancel = () => {
    setDraft(name);
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (trimmed === name) {
      setEditing(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSaved(false);

    const res = await fetch(`/api/admin-athron/boxes/${boxId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Error al guardar");
      setLoading(false);
      return;
    }

    const nextName = typeof data.name === "string" ? data.name : trimmed;
    setName(nextName);
    setDraft(nextName);
    setEditing(false);
    setSaved(true);
    setLoading(false);
    router.refresh();
  };

  if (editing) {
    return (
      <div className="space-y-3 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="box-name">{labels.nameLabel}</Label>
          <Input
            id="box-name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={80}
            autoComplete="off"
            disabled={loading}
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void save()} disabled={loading}>
            {loading ? "..." : labels.save}
          </Button>
          <Button size="sm" variant="outline" onClick={cancel} disabled={loading}>
            {labels.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-3xl font-black brand-text">{name}</h1>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={startEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
          {labels.edit}
        </Button>
      </div>
      {saved && <p className="text-sm text-green-400">{labels.saved}</p>}
    </div>
  );
}
