"use client";

import { useState, useTransition, type FormEvent } from "react";
import { requestEventCorrectionAction } from "@/lib/events/actions";
import { updateNomineeImageAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

const maxFileBytes = 5 * 1024 * 1024;
const imageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function hasValidImageHeader(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  return type === "image/webp" && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export function NomineeImageForm({
  eventId,
  nomineeId,
  nomineeName,
  initialPath,
  initialUrl,
  backTo,
  reviewRequired = false,
}: {
  reviewRequired?: boolean;
  eventId: string;
  nomineeId: string;
  nomineeName: string;
  initialPath: string | null;
  initialUrl: string | null;
  backTo: string;
}) {
  const [reason, setReason] = useState("");
  const [imagePath, setImagePath] = useState(initialPath);
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function saveImagePath(path: string | null, uploadedPath?: string) {
    startTransition(async () => {
      const data = new FormData();
      data.set("nomineeId", nomineeId);
      data.set("imagePath", path ?? "");
      data.set("backTo", backTo);
      data.set("eventId", eventId);
      data.set("kind", "photo");
      data.set("value", path ?? "");
      data.set("reason", reason);
      const result = reviewRequired
        ? await requestEventCorrectionAction(null, data)
        : await updateNomineeImageAction(null, data);
      if (!result?.success) {
        if (uploadedPath) await createClient().storage.from("nominee-images").remove([uploadedPath]);
        setImageUrl(initialUrl);
        setPendingPreviewUrl(null);
        setStage("idle");
        setMessage(result?.message ?? "We could not save that image.");
        return;
      }
      if (reviewRequired) {
        setImageUrl(initialUrl);
        setMessage(result.message);
        setStage("idle");
        return;
      }
      if (imagePath && imagePath !== path) await createClient().storage.from("nominee-images").remove([imagePath]);
      setImagePath(path);
      if (!path) setImageUrl(null);
      setMessage(result.message);
      setStage("idle");
    });
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const file = (new FormData(form).get("image") as File | null) ?? null;
    if (!file || file.size === 0) {
      setMessage("Choose a photo to upload.");
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

    const path = `${eventId}/${nomineeId}/${crypto.randomUUID()}.${imageTypes[file.type]}`;
    setStage("uploading");
    setPendingPreviewUrl(URL.createObjectURL(file));
    const supabase = createClient();
    const { error } = await supabase.storage
      .from("nominee-images")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) {
      const msg = error.message.toLowerCase();
      setStage("idle");
      setPendingPreviewUrl(null);
      setMessage(
        msg.includes("row-level security") || msg.includes("not authorized")
          ? "You do not have permission to upload a photo for this nominee. Refresh the page and try again."
          : msg.includes("bucket") || msg.includes("mime") || msg.includes("size")
          ? "That image was rejected by storage. Use a JPEG, PNG, or WebP image smaller than 5 MB."
          : "We could not upload that image. Check your connection and try again."
      );
      return;
    }
    const signed = await supabase.storage.from("nominee-images").createSignedUrl(path, 3600);
    if (signed.error || !signed.data?.signedUrl) {
      await supabase.storage.from("nominee-images").remove([path]);
      setStage("idle");
      setPendingPreviewUrl(null);
      setMessage("The photo uploaded but could not be previewed. Refresh the page and try again.");
      return;
    }
    setImageUrl(signed.data.signedUrl);
    setStage("saving");
    saveImagePath(path, path);
  }

  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-2.5 text-sm font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all select-none min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
        <Icon name="image" size={12} />
        <span>{imagePath ? "Photo" : "+ Photo"}</span>
      </summary>

      <div className="absolute right-0 top-12 z-30 w-72 sm:w-80 rounded-2xl border border-stone-200 bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
          <span className="text-xs font-semibold text-stone-900">
            {reviewRequired ? "Request Photo Correction" : imagePath ? "Change Photo" : "Upload Nominee Photo"}
          </span>
          <span className="text-[10px] text-stone-400 truncate max-w-[120px]">{nomineeName}</span>
        </div>

        {/* Mini Preview */}
        <div className="mb-3 flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
            {imageUrl ? (
              <img src={imageUrl} alt={nomineeName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-serif text-lg font-bold text-emerald-900 bg-emerald-50">
                {nomineeName.trim().slice(0, 1).toUpperCase()}
              </div>
            )}
            {reviewRequired && pendingPreviewUrl && (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url("${pendingPreviewUrl}")` }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-stone-800 truncate">{nomineeName}</p>
            <p className="text-[10px] text-stone-400">JPEG, PNG, WebP · max 5MB</p>
          </div>
        </div>

        <form onSubmit={handleUpload} className="space-y-3">
          <input
            id={`nominee-image-${nomineeId}`}
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="block w-full text-[11px] text-stone-600 file:mr-2 file:rounded-lg file:border-0 file:bg-stone-100 file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-stone-700 hover:file:bg-stone-200"
          />

          {reviewRequired && (
            <div>
              <label className="block text-[11px] font-semibold text-stone-800 mb-1">
                Reason for change (same nominee only)
              </label>
              <textarea
                required
                minLength={20}
                maxLength={1000}
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this replacement photo is needed..."
                className="w-full rounded-xl border border-stone-300 p-2 text-xs text-stone-900 focus:outline-none focus:border-emerald-600 resize-none"
              />
            </div>
          )}

          {stage !== "idle" && (
            <div className="flex items-center gap-2 text-xs text-emerald-800 font-medium">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
              <span>{stage === "uploading" ? "Uploading image..." : "Saving..."}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            {imagePath && !reviewRequired ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => saveImagePath(null)}
                className="text-sm font-semibold text-red-700 hover:bg-stone-100 cursor-pointer border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove photo
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              disabled={pending || stage !== "idle"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-3 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-800 disabled:opacity-60 transition-all active:scale-95 cursor-pointer ml-auto min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Saving..." : reviewRequired ? "Submit for Review" : "Save Photo"}
            </button>
          </div>
        </form>

        {message && (
          <p className="mt-2 text-[11px] text-stone-600 bg-stone-50 p-2 rounded-lg leading-tight" role="status">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
