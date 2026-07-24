"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AVATAR_OUTPUT_SIZE,
  calculateSquareCrop,
  deleteAvatar,
  persistAvatar,
  validateAvatarFile,
} from "@/lib/avatar";
import { createClient } from "@/lib/supabase/browser";

import { Toast } from "./toast";

const AVATAR_QUALITY = 0.82;

async function optimizeAvatar(file: File) {
  const bitmap = await createImageBitmap(file);
  const crop = calculateSquareCrop(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível processar a imagem.");

  context.drawImage(
    bitmap,
    crop.sourceX,
    crop.sourceY,
    crop.size,
    crop.size,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", AVATAR_QUALITY);
  });
  if (!blob) throw new Error("Não foi possível otimizar a imagem.");
  return blob;
}

export function AvatarForm({
  userId,
  name,
  initialAvatarUrl,
}: {
  userId: string;
  name: string;
  initialAvatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(selectedFile: File | undefined) {
    setNotice(null);
    if (!selectedFile) return;
    const validationError = validateAvatarFile(selectedFile);
    if (validationError) {
      setNotice({ status: "error", message: validationError });
      return;
    }
    setFile(selectedFile);
  }

  async function uploadAvatar() {
    if (!file || pending) return;
    setPending(true);
    setNotice(null);

    try {
      const optimized = await optimizeAvatar(file);
      const supabase = createClient();
      const publicUrl = await persistAvatar({
        userId,
        optimizedImage: optimized,
        dependencies: {
          authenticate: async () => {
            const { data } = await supabase.auth.getUser();
            return data.user?.id ?? null;
          },
          uploadObject: async (path, blob) => {
            const { error } = await supabase.storage.from("avatars").upload(path, blob, {
              cacheControl: "3600",
              contentType: "image/webp",
              upsert: true,
            });
            if (error) throw error;
          },
          getPublicUrl: (path) => supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl,
          updateProfile: async (url) => {
            const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
            if (error) throw error;
          },
          removeObject: async (path) => {
            const { error } = await supabase.storage.from("avatars").remove([path]);
            if (error) throw error;
          },
        },
      });

      setAvatarUrl(publicUrl);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setNotice({ status: "success", message: "Foto de perfil atualizada." });
      router.refresh();
    } catch (error) {
      setNotice({
        status: "error",
        message: error instanceof Error ? error.message : "Não foi possível atualizar a foto.",
      });
    } finally {
      setPending(false);
    }
  }

  async function removeAvatar() {
    if (pending) return;
    setPending(true);
    setNotice(null);

    try {
      const supabase = createClient();
      await deleteAvatar({
        userId,
        dependencies: {
          authenticate: async () => {
            const { data } = await supabase.auth.getUser();
            return data.user?.id ?? null;
          },
          removeObject: async (path) => {
            const { error } = await supabase.storage.from("avatars").remove([path]);
            if (error) throw error;
          },
          updateProfile: async (url) => {
            const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
            if (error) throw error;
          },
        },
      });

      setAvatarUrl(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setNotice({ status: "success", message: "Foto de perfil removida." });
      router.refresh();
    } catch (error) {
      setNotice({
        status: "error",
        message: error instanceof Error ? error.message : "Não foi possível remover a foto.",
      });
    } finally {
      setPending(false);
    }
  }

  const displayedAvatar = previewUrl ?? avatarUrl;

  return (
    <>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative size-28 shrink-0 overflow-hidden rounded-full border-2 border-(--accent)/50 bg-(--surface-muted) shadow-xl shadow-violet-950/20">
          {displayedAvatar ? (
            <Image
              src={displayedAvatar}
              alt={`Foto de perfil de ${name}`}
              fill
              sizes="112px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="grid size-full place-items-center bg-[linear-gradient(145deg,#6d28d9,#c084fc)] text-3xl font-black text-white">
              {initial}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-bold">Foto de perfil</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-(--muted)">
            A imagem será recortada em formato quadrado e otimizada para WebP em 512 × 512 pixels antes do envio.
          </p>
          <input
            ref={inputRef}
            id="avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <label htmlFor="avatar-file" className="app-button-secondary cursor-pointer">
              Escolher imagem
            </label>
            {file ? (
              <button type="button" onClick={uploadAvatar} disabled={pending} className="app-button-primary disabled:opacity-60">
                {pending ? "Enviando…" : "Salvar foto"}
              </button>
            ) : null}
            {avatarUrl && !file ? (
              <button type="button" onClick={removeAvatar} disabled={pending} className="app-button-secondary text-red-400 disabled:opacity-60">
                {pending ? "Removendo…" : "Remover foto"}
              </button>
            ) : null}
          </div>
          {file ? <p className="mt-3 truncate text-xs text-(--muted)">Selecionada: {file.name}</p> : null}
        </div>
      </div>

      {notice ? (
        <Toast status={notice.status} message={notice.message} onDismiss={() => setNotice(null)} />
      ) : null}
    </>
  );
}
