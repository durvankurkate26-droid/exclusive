"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadMemoryMedia, type FormState } from "@/lib/actions/vault";

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending || count === 0}>
      {pending
        ? "Uploading…"
        : count === 0
          ? "Choose photos"
          : `Add ${count} ${count === 1 ? "photo" : "photos"} ↗`}
    </button>
  );
}

/**
 * The real upload.
 *
 * Everything shown here is backed by an actual file: the thumbnails are
 * `createObjectURL` on the chosen `File` objects, the count is `files.length`, and
 * the submit button posts the same `FormData` the server action reads. There is no
 * simulated progress bar, because the action uploads sequentially and cannot report
 * partial state back mid-flight — a bar that animates on a timer would be a lie, and
 * "Uploading…" that stops when it is actually done is not.
 *
 * Object URLs are revoked when the selection changes; without that, picking twelve
 * photos three times leaks thirty-six decoded images into the tab.
 */
export function MediaUploader({
  capsuleId,
  groupId,
  slug,
}: {
  capsuleId: string;
  groupId: string;
  slug: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(uploadMemoryMedia, {});
  const [previews, setPreviews] = useState<Array<{ name: string; url: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    return () => {
      for (const preview of previews) URL.revokeObjectURL(preview.url);
    };
  }, [previews]);

  // A successful upload clears the tray — those files are on the wall now, and
  // leaving them queued invites a duplicate submission.
  useEffect(() => {
    if (state.message) {
      setPreviews([]);
      formRef.current?.reset();
    }
  }, [state.message]);

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    for (const preview of previews) URL.revokeObjectURL(preview.url);
    const files = [...(event.target.files ?? [])];
    setPreviews(
      files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    );
  };

  return (
    <form className="uploader" action={action} ref={formRef}>
      <input type="hidden" name="capsule_id" value={capsuleId} />
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="slug" value={slug} />

      <label className="uploader-drop">
        <input
          ref={inputRef}
          type="file"
          name="media"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          onChange={onPick}
          aria-label="Add photos to this memory"
        />
        <span className="uploader-drop-line">Add photographs</span>
        <span className="uploader-drop-hint">JPG, PNG, WEBP, GIF or AVIF · 25MB each</span>
      </label>

      {previews.length > 0 && (
        <>
          <ul className="uploader-tray">
            {previews.map((preview) => (
              <li key={preview.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.url} alt={preview.name} />
              </li>
            ))}
          </ul>
          <div className="inline-form-actions">
            <Submit count={previews.length} />
            <button
              className="btn"
              type="button"
              onClick={() => {
                for (const preview of previews) URL.revokeObjectURL(preview.url);
                setPreviews([]);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Clear
            </button>
          </div>
        </>
      )}

      {state.error && (
        <p className="inline-form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.message && <p className="uploader-done">{state.message}</p>}
    </form>
  );
}
