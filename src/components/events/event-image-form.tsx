"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateEventImageAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";

const maxFileBytes = 5 * 1024 * 1024;
const imageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function hasValidImageHeader(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  return type === "image/webp" && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export function EventImageForm({ eventId, eventName, initialPath, initialUrl, backTo }: {
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
    if (!file || file.size === 0) { setMessage("Choose an event cover image to upload."); return; }
    if (file.size > maxFileBytes) { setMessage("Choose an image smaller than 5 MB."); return; }
    if (!(file.type in imageTypes) || !hasValidImageHeader(file.type, new Uint8Array(await file.slice(0, 12).arrayBuffer()))) {
      setMessage("Use a valid JPEG, PNG, or WebP image.");
      return;
    }

    const path = `${eventId}/${crypto.randomUUID()}.${imageTypes[file.type]}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("nominee-images").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) { setMessage("We could not upload that image. Check your connection and try again."); return; }
    const signed = await supabase.storage.from("nominee-images").createSignedUrl(path, 3600);
    if (signed.error || !signed.data?.signedUrl) {
      await supabase.storage.from("nominee-images").remove([path]);
      setMessage("The image uploaded, but we could not prepare its preview. Please try again.");
      return;
    }
    setImageUrl(signed.data.signedUrl);
    saveImagePath(path, path);
  }

  return <section className="event-image-editor" aria-label={`Cover image for ${eventName}`}>
    <div className={`event-image-preview${imageUrl ? " has-image" : ""}`} style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined} role={imageUrl ? "img" : undefined} aria-label={imageUrl ? `${eventName} cover image` : undefined}>
      {!imageUrl && <span aria-hidden="true">V</span>}
      {imageUrl && <span className="event-image-preview-title">{eventName}</span>}
    </div>
    <form className="event-image-controls" onSubmit={handleUpload}>
      <div><strong>{imagePath ? "Update event cover" : "Add an event cover"}</strong><small>Give your event a visual identity on its public page and event card.</small></div>
      <label className="secondary-button" htmlFor={`event-image-${eventId}`}>{imagePath ? "Choose a new image" : "Choose image"}</label>
      <input id={`event-image-${eventId}`} name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
      <small>JPEG, PNG, or WebP · 5 MB maximum</small>
      <div className="event-image-actions"><button className="primary-link" type="submit" disabled={pending}>{pending ? "Saving…" : "Upload cover"}</button>{imagePath && <button className="image-remove-button" type="button" disabled={pending} onClick={() => saveImagePath(null)}>Remove cover</button>}</div>
    </form>
    {message && <p className="image-form-message" role="status">{message}</p>}
  </section>;
}
