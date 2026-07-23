"use client";

import { useState } from "react";

import { setContentRating } from "@/app/app/groups/[groupId]/contents/actions";

import { ActionForm } from "./action-form";

const ratingLabels: Record<number, string> = {
  1: "Péssimo",
  2: "Ruim",
  3: "Regular",
  4: "Bom",
  5: "Excelente",
};

export function ContentRatingForm({
  groupId,
  contentId,
  currentRating,
  currentComment,
}: {
  groupId: string;
  contentId: string;
  currentRating: number | null;
  currentComment: string | null;
}) {
  const [rating, setRating] = useState(currentRating ?? 0);

  return (
    <ActionForm
      action={setContentRating}
      submitLabel={currentRating ? "Atualizar avaliação" : "Enviar avaliação"}
      pendingLabel="Salvando…"
      className="space-y-4"
      buttonClassName="rounded-xl bg-(--accent) px-5 py-3 font-bold text-[#07150c] disabled:opacity-60"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="contentId" value={contentId} />
      <fieldset>
        <legend className="text-sm font-medium">Sua avaliação</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border px-3 py-2 text-2xl transition hover:bg-(--surface-muted) ${
                rating === value ? "border-(--accent) bg-(--surface-muted)" : ""
              }`}
            >
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
                required
              />
              <span aria-hidden>{value <= rating ? "★" : "☆"}</span>
              <span className="sr-only">{value} de 5 — {ratingLabels[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p aria-live="polite" className="text-sm text-(--muted)">
        {rating ? `${rating} de 5 — ${ratingLabels[rating]}` : "Nenhuma nota selecionada"}
      </p>
      <div>
        <label htmlFor="rating-comment" className="text-sm font-medium">
          Comentário <span className="font-normal text-(--muted)">(opcional)</span>
        </label>
        <textarea
          id="rating-comment"
          name="comment"
          maxLength={500}
          rows={3}
          defaultValue={currentComment ?? ""}
          placeholder="Conte brevemente o que achou…"
          className="mt-2 w-full resize-y rounded-xl border bg-(--surface-muted) px-4 py-3"
        />
        <p className="mt-1 text-xs text-(--muted)">Até 500 caracteres.</p>
      </div>
    </ActionForm>
  );
}
