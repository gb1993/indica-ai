export const MAX_AVATAR_SOURCE_SIZE = 8 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 512;
export const AVATAR_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type AvatarFileMetadata = {
  type: string;
  size: number;
};

export function validateAvatarFile(file: AvatarFileMetadata): string | null {
  if (!AVATAR_ALLOWED_TYPES.includes(file.type as (typeof AVATAR_ALLOWED_TYPES)[number])) {
    return "Escolha uma imagem JPG, PNG ou WebP.";
  }
  if (file.size <= 0) return "A imagem selecionada está vazia.";
  if (file.size > MAX_AVATAR_SOURCE_SIZE) {
    return "A imagem original deve ter no máximo 8 MB.";
  }
  return null;
}

export function calculateSquareCrop(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Dimensões de imagem inválidas.");
  }

  const size = Math.min(width, height);
  return {
    sourceX: (width - size) / 2,
    sourceY: (height - size) / 2,
    size,
  };
}

export function avatarObjectPath(userId: string) {
  return `${userId}/avatar.webp`;
}

type AvatarUploadDependencies = {
  authenticate: () => Promise<string | null>;
  uploadObject: (path: string, blob: Blob) => Promise<void>;
  getPublicUrl: (path: string) => string;
  updateProfile: (avatarUrl: string | null) => Promise<void>;
  removeObject: (path: string) => Promise<void>;
  now?: () => number;
};

export async function persistAvatar({
  userId,
  optimizedImage,
  dependencies,
}: {
  userId: string;
  optimizedImage: Blob;
  dependencies: AvatarUploadDependencies;
}) {
  const authenticatedUserId = await dependencies.authenticate();
  if (authenticatedUserId !== userId) {
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  const objectPath = avatarObjectPath(userId);
  await dependencies.uploadObject(objectPath, optimizedImage);
  const publicUrl = `${dependencies.getPublicUrl(objectPath)}?v=${(dependencies.now ?? Date.now)()}`;

  try {
    await dependencies.updateProfile(publicUrl);
  } catch (error) {
    try {
      await dependencies.removeObject(objectPath);
    } catch {
      // The profile still points to the previous avatar, so cleanup can be retried later.
    }
    throw error;
  }

  return publicUrl;
}

export async function deleteAvatar({
  userId,
  dependencies,
}: {
  userId: string;
  dependencies: Pick<
    AvatarUploadDependencies,
    "authenticate" | "removeObject" | "updateProfile"
  >;
}) {
  const authenticatedUserId = await dependencies.authenticate();
  if (authenticatedUserId !== userId) {
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  await dependencies.removeObject(avatarObjectPath(userId));
  await dependencies.updateProfile(null);
}
