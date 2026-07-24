export const MAX_AVATAR_SOURCE_SIZE = 8 * 1024 * 1024;
export const MAX_AVATAR_OUTPUT_SIZE = 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 256;
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

export function clampAvatarOffset({
  width,
  height,
  zoom,
  offsetX,
  offsetY,
  viewportSize,
}: {
  width: number;
  height: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  viewportSize: number;
}) {
  if (
    !Number.isFinite(width)
    || !Number.isFinite(height)
    || !Number.isFinite(zoom)
    || !Number.isFinite(viewportSize)
    || width <= 0
    || height <= 0
    || zoom < 1
    || viewportSize <= 0
  ) {
    throw new Error("Parâmetros de recorte inválidos.");
  }

  const baseScale = Math.max(viewportSize / width, viewportSize / height);
  const scale = baseScale * zoom;
  const maxX = Math.max(0, (width * scale - viewportSize) / 2);
  const maxY = Math.max(0, (height * scale - viewportSize) / 2);

  return {
    offsetX: Math.max(-maxX, Math.min(maxX, offsetX)),
    offsetY: Math.max(-maxY, Math.min(maxY, offsetY)),
    scale,
  };
}

export function calculateAvatarCrop({
  width,
  height,
  zoom,
  offsetX,
  offsetY,
  viewportSize,
}: {
  width: number;
  height: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  viewportSize: number;
}) {
  const clamped = clampAvatarOffset({
    width,
    height,
    zoom,
    offsetX,
    offsetY,
    viewportSize,
  });
  const sourceSize = viewportSize / clamped.scale;

  return {
    sourceX: (width - sourceSize) / 2 - clamped.offsetX / clamped.scale,
    sourceY: (height - sourceSize) / 2 - clamped.offsetY / clamped.scale,
    sourceSize,
  };
}

export function validateOptimizedAvatar(file: AvatarFileMetadata): string | null {
  if (file.type !== "image/webp") return "A imagem processada deve estar no formato WebP.";
  if (file.size <= 0) return "A imagem processada está vazia.";
  if (file.size > MAX_AVATAR_OUTPUT_SIZE) {
    return "A imagem processada deve ter no máximo 1 MB.";
  }
  return null;
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
