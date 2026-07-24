import assert from "node:assert/strict";
import test from "node:test";

import {
  AVATAR_OUTPUT_SIZE,
  MAX_AVATAR_OUTPUT_SIZE,
  MAX_AVATAR_SOURCE_SIZE,
  avatarObjectPath,
  calculateAvatarCrop,
  calculateSquareCrop,
  clampAvatarOffset,
  deleteAvatar,
  persistAvatar,
  validateAvatarFile,
  validateOptimizedAvatar,
} from "./avatar.ts";

test("aceita os formatos de avatar permitidos dentro do limite", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(validateAvatarFile({ type, size: MAX_AVATAR_SOURCE_SIZE }), null);
  }
  assert.equal(AVATAR_OUTPUT_SIZE, 256);
});

test("rejeita formato, arquivo vazio e tamanho excessivo", () => {
  assert.match(
    validateAvatarFile({ type: "image/svg+xml", size: 100 }) ?? "",
    /JPG, PNG ou WebP/,
  );
  assert.match(
    validateAvatarFile({ type: "image/png", size: 0 }) ?? "",
    /vazia/,
  );
  assert.match(
    validateAvatarFile({ type: "image/jpeg", size: MAX_AVATAR_SOURCE_SIZE + 1 }) ?? "",
    /8 MB/,
  );
});

test("valida o WebP otimizado antes de enviar ao servidor", () => {
  assert.equal(
    validateOptimizedAvatar({ type: "image/webp", size: MAX_AVATAR_OUTPUT_SIZE }),
    null,
  );
  assert.match(
    validateOptimizedAvatar({ type: "image/png", size: 100 }) ?? "",
    /WebP/,
  );
  assert.match(
    validateOptimizedAvatar({ type: "image/webp", size: 0 }) ?? "",
    /vazia/,
  );
  assert.match(
    validateOptimizedAvatar({
      type: "image/webp",
      size: MAX_AVATAR_OUTPUT_SIZE + 1,
    }) ?? "",
    /1 MB/,
  );
});

test("calcula recorte central quadrado para imagens horizontais e verticais", () => {
  assert.deepEqual(calculateSquareCrop(1200, 800), {
    sourceX: 200,
    sourceY: 0,
    size: 800,
  });
  assert.deepEqual(calculateSquareCrop(600, 1000), {
    sourceX: 0,
    sourceY: 200,
    size: 600,
  });
  assert.deepEqual(calculateSquareCrop(512, 512), {
    sourceX: 0,
    sourceY: 0,
    size: 512,
  });
});

test("rejeita dimensões inválidas antes de usar o canvas", () => {
  for (const dimensions of [[0, 20], [20, -1], [Number.NaN, 10], [10, Infinity]]) {
    assert.throws(() => calculateSquareCrop(dimensions[0], dimensions[1]), /inválidas/);
  }
});

test("calcula recorte com zoom e deslocamento limitado à imagem", () => {
  assert.deepEqual(
    clampAvatarOffset({
      width: 1200,
      height: 800,
      zoom: 1,
      offsetX: 999,
      offsetY: 999,
      viewportSize: 256,
    }),
    { offsetX: 64, offsetY: 0, scale: 0.32 },
  );

  assert.deepEqual(
    calculateAvatarCrop({
      width: 1200,
      height: 800,
      zoom: 1,
      offsetX: 64,
      offsetY: 0,
      viewportSize: 256,
    }),
    { sourceX: 0, sourceY: 0, sourceSize: 800 },
  );
});

test("rejeita parâmetros inválidos no recorte interativo", () => {
  assert.throws(
    () => clampAvatarOffset({
      width: 0,
      height: 100,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      viewportSize: 256,
    }),
    /inválidos/,
  );
});

test("isola o avatar no diretório do usuário", () => {
  assert.equal(
    avatarObjectPath("91000000-0000-0000-0000-000000000001"),
    "91000000-0000-0000-0000-000000000001/avatar.webp",
  );
});

test("persiste avatar autenticado e versiona a URL pública", async () => {
  const calls: string[] = [];
  const image = new Blob(["webp"], { type: "image/webp" });
  const result = await persistAvatar({
    userId: "user-1",
    optimizedImage: image,
    dependencies: {
      authenticate: async () => "user-1",
      uploadObject: async (path, blob) => {
        calls.push(`upload:${path}:${blob.type}`);
      },
      getPublicUrl: (path) => `https://storage.test/${path}`,
      updateProfile: async (url) => {
        calls.push(`profile:${url}`);
      },
      removeObject: async (path) => {
        calls.push(`remove:${path}`);
      },
      now: () => 1234,
    },
  });

  assert.equal(result, "https://storage.test/user-1/avatar.webp?v=1234");
  assert.deepEqual(calls, [
    "upload:user-1/avatar.webp:image/webp",
    "profile:https://storage.test/user-1/avatar.webp?v=1234",
  ]);
});

test("bloqueia persistência quando a sessão não pertence ao usuário", async () => {
  await assert.rejects(
    persistAvatar({
      userId: "user-1",
      optimizedImage: new Blob(["webp"]),
      dependencies: {
        authenticate: async () => "user-2",
        uploadObject: async () => assert.fail("não deve enviar"),
        getPublicUrl: () => "",
        updateProfile: async () => assert.fail("não deve atualizar"),
        removeObject: async () => assert.fail("não deve remover"),
      },
    }),
    /sessão expirou/,
  );
});

test("remove objeto recém-enviado se a atualização do perfil falhar", async () => {
  const removed: string[] = [];
  await assert.rejects(
    persistAvatar({
      userId: "user-1",
      optimizedImage: new Blob(["webp"]),
      dependencies: {
        authenticate: async () => "user-1",
        uploadObject: async () => undefined,
        getPublicUrl: () => "https://storage.test/avatar.webp",
        updateProfile: async () => {
          throw new Error("profile failed");
        },
        removeObject: async (path) => {
          removed.push(path);
        },
      },
    }),
    /profile failed/,
  );
  assert.deepEqual(removed, ["user-1/avatar.webp"]);
});

test("preserva o erro original mesmo se a limpeza do upload falhar", async () => {
  await assert.rejects(
    persistAvatar({
      userId: "user-1",
      optimizedImage: new Blob(["webp"]),
      dependencies: {
        authenticate: async () => "user-1",
        uploadObject: async () => undefined,
        getPublicUrl: () => "https://storage.test/avatar.webp",
        updateProfile: async () => {
          throw new Error("profile failed");
        },
        removeObject: async () => {
          throw new Error("cleanup failed");
        },
      },
    }),
    /profile failed/,
  );
});

test("remove o arquivo antes de limpar a URL do perfil", async () => {
  const calls: string[] = [];
  await deleteAvatar({
    userId: "user-1",
    dependencies: {
      authenticate: async () => "user-1",
      removeObject: async (path) => {
        calls.push(`remove:${path}`);
      },
      updateProfile: async (url) => {
        calls.push(`profile:${url}`);
      },
    },
  });
  assert.deepEqual(calls, ["remove:user-1/avatar.webp", "profile:null"]);
});

test("bloqueia remoção com sessão divergente", async () => {
  await assert.rejects(
    deleteAvatar({
      userId: "user-1",
      dependencies: {
        authenticate: async () => null,
        removeObject: async () => assert.fail("não deve remover"),
        updateProfile: async () => assert.fail("não deve atualizar"),
      },
    }),
    /sessão expirou/,
  );
});
