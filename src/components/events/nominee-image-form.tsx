"use client";

import { useState, useTransition, type FormEvent } from "react";
import { requestEventCorrectionAction } from "@/lib/events/actions";
import { updateNomineeImageAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";

const maxFileBytes = 5 * 1024 * 1024;
const imageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function hasValidImageHeader(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  return type === "image/webp" && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export function NomineeImageForm({ eventId, nomineeId, nomineeName, initialPath, initialUrl, backTo, reviewRequired = false }: {
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
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function saveImagePath(path: string | null, uploadedPath?: string) {
    startTransition(async () => {
      const data = new FormData();
      data.set("nomineeId", nomineeId);
      data.set("imagePath", path ?? "");
      data.set("backTo", backTo);
      data.set("eventId", eventId); data.set("kind", "photo"); data.set("value", path ?? ""); data.set("reason", reason);
      const result = reviewRequired ? await requestEventCorrectionAction(null, data) : await updateNomineeImageAction(null, data);
      if (!result?.success) {
        if (uploadedPath) await createClient().storage.from("nominee-images").remove([uploadedPath]);
        setImageUrl(initialUrl);
        setMessage(result?.message ?? "We could not save that image.");
        return;
      }
      if (reviewRequired) { setImageUrl(initialUrl); setMessage(result.message); return; }
      if (imagePath && imagePath !== path) await createClient().storage.from("nominee-images").remove([imagePath]);
      setImagePath(path);
      if (!path) setImageUrl(null);
      setMessage(result.message);
    });
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const file = (new FormData(form).get("image") as File | null) ?? null;
    if (!file || file.size === 0) { setMessage("Choose a photo to upload."); return; }
    if (file.size > maxFileBytes) { setMessage("Choose an image smaller than 5 MB."); return; }
    if (!(file.type in imageTypes) || !hasValidImageHeader(file.type, new Uint8Array(await file.slice(0, 12).arrayBuffer()))) {
      setMessage("Use a valid JPEG, PNG, or WebP image.");
      return;
    }

    const path = `${eventId}/${nomineeId}/${crypto.randomUUID()}.${imageTypes[file.type]}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("nominee-images").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) { setMessage("We could not upload that image. Check your connection and try again."); return; }
    const signed = await supabase.storage.from("nominee-images").createSignedUrl(path, 3600);
    setImageUrl(signed.data?.signedUrl ?? null);
    saveImagePath(path, path);
  }

  return <section className="nominee-image-editor" aria-label={`Image for ${nomineeName}`}>
    {imageUrl ? <div className="nominee-photo-preview" style={{ backgroundImage: `url("${imageUrl}")` }} role="img" aria-label={`${nomineeName} photo`} /> : <span className="nominee-avatar nominee-photo-placeholder" aria-hidden="true">{nomineeName.trim().slice(0, 1).toUpperCase()}</span>}
    <form className="nominee-image-controls" onSubmit={handleUpload}>
      <label htmlFor={`nominee-image-${nomineeId}`}>{reviewRequired ? "Request a photo correction" : imagePath ? "Replace photo" : "Add a photo"}</label>
      <input id={`nominee-image-${nomineeId}`} name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
      <small>JPEG, PNG, or WebP · 5 MB maximum</small>
      {reviewRequired && <label>Explain the correction (same nominee only)<textarea required minLength={20} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} /><small>The current photo stays public until platform review confirms this is the same person.</small></label>}
      <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Saving…" : reviewRequired ? "Submit photo for review" : "Upload photo"}</button>
      {imagePath && !reviewRequired && <button className="image-remove-button" type="button" disabled={pending} onClick={() => saveImagePath(null)}>Remove photo</button>}
    </form>
    {message && <p className="image-form-message" role="status">{message}</p>}
  </section>;
}
