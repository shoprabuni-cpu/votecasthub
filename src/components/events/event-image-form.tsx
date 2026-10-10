"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateEventImageAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

const maxFileBytes = 5 * 1024 * 1024;
const imageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function hasValidImageHeader(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  return type === "image/webp" && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export function EventImageForm({
  eventId,
  eventName,
  initialPath,
  initialUrl,
  backTo,
}: {
  eventId: string;
  eventName: string;
  initialPath: string | null;
  initialUrl: string | null;
  backTo: string;
}) {
  const [imagePath, setImagePath] = useState(initialPath);
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function saveImagePath(path: string | null, uploadedPath?: string) {
    startTransition(async () => {
      const data = new FormData();
      data.set("eventId", eventId);
      data.set("imagePath", path ?? "");
      data.set("backTo", backTo);
      const result = await updateEventImageAction(null, data);
      if (!result?.success) {
        if (uploadedPath) await createClient().storage.from("nominee-images").remove([uploadedPath]);
        setImageUrl(initialUrl);
        setMessage(result?.message ?? "We could not save that image.");
        return;
      }
      if (imagePath && imagePath !== path) await createClient().storage.from("nominee-images").remove([imagePath]);
      setImagePath(path);
      if (!path) setImageUrl(null);
      setMessage(result.message);
    });
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const file = (new FormData(event.currentTarget).get("image") as File | null) ?? null;
    if (!file || file.size === 0) {
      setMessage("Choose an event cover image to upload.");
      return;
    }
    if (file.size > maxFileBytes) {
      setMessage("Choose an image smaller than 5 MB.");
      return;
    }
    if (
      !(file.type in imageTypes) ||
      !hasValidImageHeader(file.type, new Uint8Array(await file.slice(0, 12).arrayBuffer()))
    ) {
      setMessage("Use a valid JPEG, PNG, or WebP image.");
      return;
    }

    const path = `${eventId}/${crypto.randomUUID()}.${imageTypes[file.type]}`;
    const supabase = createClient();
    const { error } = await supabase.storage
      .from("nominee-images")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) {
      setMessage("We could not upload that image. Check your connection and try again.");
      return;
    }
    const signed = await supabase.storage.from("nominee-images").createSignedUrl(path, 3600);
    if (signed.error || !signed.data?.signedUrl) {
      await supabase.storage.from("nominee-images").remove([path]);
      setMessage("The image uploaded, but we could not prepare its preview. Please try again.");
      return;
    }
    setImageUrl(signed.data.signedUrl);
    saveImagePath(path, path);
  }

  return (
    <div className="space-y-4">
      {/* Cover Banner Preview or Placeholder */}
      <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-xs aspect-21/9 min-h-[160px] sm:min-h-[220px]">
        {imageUrl ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 hover:scale-105"
              style={{ backgroundImage: `url("${imageUrl}")` }}
              role="img"
              aria-label={`${eventName} cover image`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end p-4 sm:p-6">
              <span className="text-white font-serif font-bold text-base sm:text-xl drop-shadow-sm truncate">
                {eventName}
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-stone-400">
            <Icon name="image" size={32} className="text-stone-300" />
            <span className="mt-2 text-xs font-medium text-stone-500">No cover image set</span>
            <span className="text-[10px] text-stone-400">Recommended size: 1200 × 512px (Landscape)</span>
          </div>
        )}
      </div>

      {/* Upload Controls */}
      <form onSubmit={handleUpload} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor={`event-image-${eventId}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white min-h-11 px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all cursor-pointer"
          >
            <Icon name="image" size={13} />
            <span>{imagePath ? "Select new cover" : "Choose image"}</span>
          </label>
          <input
            id={`event-image-${eventId}`}
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <span className="text-[11px] text-stone-400">JPEG, PNG, WebP · Max 5MB</span>
        </div>

        <div className="flex items-center gap-2">
          {imagePath && (
            <button
              type="button"
              disabled={pending}
              onClick={() => saveImagePath(null)}
              className="text-sm font-semibold text-red-700 hover:bg-stone-100 cursor-pointer border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove cover
            </button>
          )}
          {pending && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
              <span>Saving...</span>
            </span>
          )}
        </div>
      </form>

      {message && (
        <p className="rounded-xl bg-stone-50 p-2.5 text-xs text-stone-700 font-medium" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
