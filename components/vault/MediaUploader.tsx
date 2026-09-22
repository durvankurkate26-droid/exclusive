"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { recordUploads } from "@/lib/actions/vault";
import { Upload } from "@/components/app/Icons";
import { toast } from "@/components/app/Toast";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

type Item = {
  key: string;
  name: string;
  preview: string;
  progress: number; // 0..1
  state: "queued" | "uploading" | "done" | "failed";
  error?: string;
};

function safeName(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(-48) || "image.jpg";
}

function dimensions(file: File): Promise<{ width: number; height: number } | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(undefined);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Adding photographs, with progress that means something.
 *
 * Each file is PUT straight to Storage over XHR — the only browser API that reports
 * upload progress — using the member's own session token, so the bucket's path policy
 * (`<group_id>/…` must be a group you belong to) is what authorises it. Files go one
 * at a time: a phone on hotel wifi does better with twelve ordered requests than
 * twelve competing ones, and each print fills in as it lands. When the batch is done,
 * one Server Action records the rows (re-checking the folder) and revalidates.
 */
export function MediaUploader({
  capsuleId,
  groupId,
  slug,
  compact = false,
}: {
  capsuleId: string;
  groupId: string;
  slug: string;
  compact?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = (key: string, next: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...next } : item)));

  const put = (path: string, file: File, token: string, onProgress: (p: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/vault-media/${path}`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          let message = `Upload failed (${xhr.status}).`;
          try {
            message = JSON.parse(xhr.responseText).message ?? message;
          } catch {}
          reject(new Error(message));
        }
      };
      xhr.onerror = () => reject(new Error("Connection dropped."));
      xhr.send(file);
    });

  const start = async (files: File[]) => {
    if (files.length === 0 || busy) return;

    const queued: Array<Item & { file: File }> = files.map((file, i) => ({
      key: `${Date.now()}-${i}`,
      name: file.name,
      preview: URL.createObjectURL(file),
      progress: 0,
      state: "queued",
      file,
      error:
        file.size > MAX_BYTES
          ? "Over 25MB."
          : !ACCEPT.includes(file.type)
            ? "Not an image we can take."
            : undefined,
    }));
    setItems(queued.map(({ file: _file, ...item }) => ({ ...item, state: item.error ? "failed" : "queued" })));
    setBusy(true);

    const {
      data: { session },
    } = await createClient().auth.getSession();
    if (!session) {
      toast("You've been signed out. Sign in and try again.", "error");
      setBusy(false);
      return;
    }

    const landed: Array<{ path: string; width?: number; height?: number }> = [];
    for (const item of queued) {
      if (item.error) continue;
      patch(item.key, { state: "uploading" });
      const path = `${groupId}/${capsuleId}/${Date.now()}-${landed.length}-${safeName(item.file.name)}`;
      try {
        const [size] = await Promise.all([
          dimensions(item.file),
          put(path, item.file, session.access_token, (p) => patch(item.key, { progress: p })),
        ]);
        landed.push({ path, ...size });
        patch(item.key, { state: "done", progress: 1 });
      } catch (cause) {
        patch(item.key, { state: "failed", error: cause instanceof Error ? cause.message : "Failed." });
      }
    }

    if (landed.length > 0) {
      const result = await recordUploads(capsuleId, slug, landed);
      if (result.error) toast(result.error, "error");
      else toast(landed.length === 1 ? "Saved for later-you." : `${landed.length} photos, saved for later-you.`);
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    // Clear the tray once everything that worked is on the wall; keep failures visible.
    window.setTimeout(() => {
      setItems((current) => {
        for (const item of current) if (item.state === "done") URL.revokeObjectURL(item.preview);
        return current.filter((item) => item.state === "failed");
      });
    }, 1200);
  };

  const total = items.filter((i) => i.state !== "failed").length;
  const done = items.filter((i) => i.state === "done").length;

  return (
    <div className="uploader" data-compact={compact}>
      <label
        className="uploader-drop"
        data-dragging={dragging}
        data-busy={busy}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void start([...event.dataTransfer.files]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          multiple
          disabled={busy}
          onChange={(event) => void start([...(event.target.files ?? [])])}
          aria-label="Add photos to this memory"
        />
        <Upload className="uploader-icon" />
        <span className="uploader-line">
          {busy ? `Developing ${done} of ${total}…` : "Add the photos"}
        </span>
        <span className="uploader-hint">Drop them here or tap to choose · JPG, PNG, WEBP · 25MB each</span>
      </label>

      {items.length > 0 && (
        <ul className="uploader-tray" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} data-state={item.state} style={{ ["--p" as string]: item.progress }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.preview} alt="" />
              <span className="uploader-bar" aria-hidden="true" />
              <span className="sr-only">
                {item.name}: {item.state === "failed" ? item.error : item.state === "done" ? "uploaded" : `${Math.round(item.progress * 100)}%`}
              </span>
              {item.state === "failed" && <span className="uploader-fail">{item.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
