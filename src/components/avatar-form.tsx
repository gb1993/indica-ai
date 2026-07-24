"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  removeProfileAvatar,
  saveProfileAvatar,
} from "@/app/app/profile/actions";
import {
  AVATAR_OUTPUT_SIZE,
  calculateAvatarCrop,
  validateAvatarFile,
} from "@/lib/avatar";

import {
  AvatarCropDialog,
  type AvatarCropSelection,
} from "./avatar-crop-dialog";
import { Toast } from "./toast";

const AVATAR_QUALITY = 0.8;

async function optimizeAvatar(file: File, selection: AvatarCropSelection) {
  const bitmap = await createImageBitmap(file);
  const crop = calculateAvatarCrop({
    width: bitmap.width,
    height: bitmap.height,
    ...selection,
  });
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível processar a imagem.");

  context.drawImage(
    bitmap,
    crop.sourceX,
    crop.sourceY,
    crop.sourceSize,
    crop.sourceSize,
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
  name,
  initialAvatarUrl,
}: {
  name: string;
  initialAvatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<{
    file: File;
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [croppedAvatar, setCroppedAvatar] = useState<Blob | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  const previewUrl = useMemo(
    () => (croppedAvatar ? URL.createObjectURL(croppedAvatar) : null),
    [croppedAvatar],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source.url);
    };
  }, [source]);

  async function selectFile(selectedFile: File | undefined) {
    setNotice(null);
    if (!selectedFile) return;
    const validationError = validateAvatarFile(selectedFile);
    if (validationError) {
      setNotice({ status: "error", message: validationError });
      return;
    }

    try {
      const bitmap = await createImageBitmap(selectedFile);
      const nextSource = {
        file: selectedFile,
        url: URL.createObjectURL(selectedFile),
        width: bitmap.width,
        height: bitmap.height,
      };
      bitmap.close();
      setSource(nextSource);
    } catch {
      setNotice({
        status: "error",
        message: "Não foi possível abrir a imagem selecionada.",
      });
    }
  }

  async function uploadAvatar() {
    if (!croppedAvatar || pending) return;
    setPending(true);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.set("avatar", croppedAvatar, "avatar.webp");
      const result = await saveProfileAvatar(formData);
      if (result.status === "error" || !result.avatarUrl) {
        throw new Error(result.message);
      }

      setAvatarUrl(result.avatarUrl);
      setCroppedAvatar(null);
      if (inputRef.current) inputRef.current.value = "";
      setNotice({ status: "success", message: result.message });
      router.refresh();
    } catch (error) {
      setNotice({
        status: "error",
        message: error instanceof Error
          ? error.message
          : "Não foi possível atualizar a foto.",
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
      const result = await removeProfileAvatar();
      if (result.status === "error") throw new Error(result.message);

      setAvatarUrl(null);
      setCroppedAvatar(null);
      if (inputRef.current) inputRef.current.value = "";
      setNotice({ status: "success", message: result.message });
      router.refresh();
    } catch (error) {
      setNotice({
        status: "error",
        message: error instanceof Error
          ? error.message
          : "Não foi possível remover a foto.",
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
            Ajuste o enquadramento como no Discord. A imagem será recortada e
            otimizada para WebP em 256 × 256 pixels antes do envio.
          </p>
          <input
            ref={inputRef}
            id="avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void selectFile(event.target.files?.[0])}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <label htmlFor="avatar-file" className="app-button-secondary cursor-pointer">
              Escolher imagem
            </label>
            {croppedAvatar ? (
              <button
                type="button"
                onClick={uploadAvatar}
                disabled={pending}
                className="app-button-primary disabled:opacity-60"
              >
                {pending ? "Enviando…" : "Salvar foto"}
              </button>
            ) : null}
            {avatarUrl && !croppedAvatar ? (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={pending}
                className="app-button-secondary text-red-400 disabled:opacity-60"
              >
                {pending ? "Removendo…" : "Remover foto"}
              </button>
            ) : null}
          </div>
          {croppedAvatar ? (
            <p className="mt-3 text-xs text-(--muted)">Recorte pronto para salvar.</p>
          ) : null}
        </div>
      </div>

      {source ? (
        <AvatarCropDialog
          open
          sourceUrl={source.url}
          width={source.width}
          height={source.height}
          onCancel={() => {
            setSource(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          onApply={(selection) => {
            void optimizeAvatar(source.file, selection)
              .then((blob) => {
                setCroppedAvatar(blob);
                setSource(null);
              })
              .catch(() => {
                setNotice({
                  status: "error",
                  message: "Não foi possível recortar a imagem.",
                });
              });
          }}
        />
      ) : null}

      {notice ? (
        <Toast
          status={notice.status}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      ) : null}
    </>
  );
}
