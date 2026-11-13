"use client";

import { useState, useTransition, useEffect, type FormEvent } from "react";
import { requestEventCorrectionAction } from "@/lib/events/actions";
import { updateNomineeImageAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { EventDialog } from "./event-dialog";
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
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [imagePath, setImagePath] = useState(initialPath);
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        setOpen(false);
        setIsSuccess(false);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

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
        setIsSuccess(true);
        return;
      }
      if (imagePath && imagePath !== path) await createClient().storage.from("nominee-images").remove([imagePath]);
      setImagePath(path);
      if (!path) setImageUrl(null);
      setMessage(result.message);
      setStage("idle");
      setIsSuccess(true);
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all select-none min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="image" size={13} />
        <span>{imagePath ? "Photo" : "+ Photo"}</span>
      </button>

      {open && (
        <EventDialog
          open={open}
          title={reviewRequired ? "Request Photo Correction" : imagePath ? "Change Nominee Photo" : "Upload Nominee Photo"}
          onClose={() => setOpen(false)}
          busy={pending || stage !== "idle"}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-white">
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
                <p className="text-sm font-semibold text-stone-800 truncate">{nomineeName}</p>
                <p className="text-xs text-stone-500">Formats: JPEG, PNG, WebP · max 5MB</p>
              </div>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label
                  htmlFor={`nominee-image-${nomineeId}`}
                  className="block text-xs font-semibold text-stone-800 mb-1"
                >
                  Select Photo File
                </label>
                <input
                  id={`nominee-image-${nomineeId}`}
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-xl file:border file:border-stone-200 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-stone-700 hover:file:bg-stone-50"
                />
              </div>

              {reviewRequired && (
                <div>
                  <label className="block text-xs font-semibold text-stone-800 mb-1">
                    Reason for change (same nominee only)
                  </label>
                  <textarea
                    required
                    minLength={20}
                    maxLength={1000}
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why this replacement photo is needed..."
                    className="w-full rounded-xl border border-stone-300 p-2.5 text-xs text-stone-900 focus:outline-none focus:border-emerald-600 resize-none"
                  />
                </div>
              )}

              {stage !== "idle" && (
                <div className="flex items-center gap-2 text-xs text-emerald-800 font-medium">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
                  <span>{stage === "uploading" ? "Uploading image..." : "Saving..."}</span>
                </div>
              )}

              {message && (
                <div
                  className={`rounded-xl p-2.5 text-xs font-semibold flex items-center gap-1.5 ${
                    isSuccess
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                  role={isSuccess ? "status" : "alert"}
                >
                  <Icon name={isSuccess ? "check" : "alert"} size={14} />
                  <span>{message}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                {imagePath && !reviewRequired ? (
                  <button
                    type="button"
                    disabled={pending || stage !== "idle"}
                    onClick={() => saveImagePath(null)}
                    className="text-xs font-semibold text-red-700 hover:bg-red-50 rounded-xl px-3 py-2 cursor-pointer border border-red-200"
                  >
                    Remove photo
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pending || stage !== "idle"}
                    onClick={() => setOpen(false)}
                    className="min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending || stage !== "idle"}
                    className="min-h-11 inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-800 disabled:opacity-60 transition-all active:scale-95 cursor-pointer"
                  >
                    {pending ? "Saving..." : reviewRequired ? "Submit for Review" : "Save Photo"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </EventDialog>
      )}
    </>
  );
}
