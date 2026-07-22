"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getPublicEnv } from "@/lib/env";
import { createResendClient } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";

const uuidSchema = z.uuid();
const groupSchema = z.object({
  name: z.string().trim().min(2, "O nome deve ter pelo menos 2 caracteres.").max(80),
  description: z.string().trim().max(500, "A descrição deve ter no máximo 500 caracteres."),
});
const invitationSchema = z.object({
  groupId: uuidSchema,
  email: z.email("Informe um e-mail válido.").max(254).transform((value) => value.toLowerCase()),
});

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function withMessage(path: string, type: "error" | "success", message: string) {
  const params = new URLSearchParams({ [type]: message });
  return `${path}?${params.toString()}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function invitationHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createAndSendInvitation(groupId: string, email: string) {
  const supabase = await createClient();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = invitationHash(token);

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();

  if (groupError || !group) return { error: "Grupo não encontrado ou acesso negado." };

  const { data: invitationId, error: invitationError } = await supabase.rpc(
    "create_group_invitation",
    { p_group_id: groupId, p_email: email, p_token_hash: tokenHash },
  );

  if (invitationError || !invitationId) {
    return { error: "Não foi possível criar o convite. O e-mail pode já pertencer ao grupo." };
  }

  try {
    const env = getPublicEnv();
    const { client, from } = createResendClient();
    const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
    const safeGroupName = escapeHtml(group.name);
    const { error: emailError } = await client.emails.send({
      from,
      to: email,
      subject: `Convite para o grupo ${group.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17201b">
          <h1 style="font-size:24px">Você foi convidado para o Indica Aí</h1>
          <p>Você recebeu um convite para participar do grupo <strong>${safeGroupName}</strong>.</p>
          <p>Este convite expira em 5 minutos e pode ser usado somente uma vez.</p>
          <p style="margin:28px 0">
            <a href="${inviteUrl}" style="background:#3ddc84;color:#07150c;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">
              Aceitar convite
            </a>
          </p>
          <p style="font-size:12px;color:#66736a">Se você não esperava este convite, ignore este e-mail.</p>
        </div>
      `,
    });

    if (emailError) throw new Error(emailError.message);
    return { invitationId: invitationId as string };
  } catch (error) {
    await supabase.rpc("cancel_group_invitation", {
      p_invitation_id: invitationId,
    });
    console.error("Invitation email failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return { error: "O convite não pôde ser enviado. Verifique a configuração do Resend." };
  }
}

export async function createGroup(formData: FormData) {
  const parsed = groupSchema.safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
  });

  if (!parsed.success) {
    redirect(withMessage("/app/groups/new", "error", parsed.error.issues[0].message));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
  });

  if (error || !data) {
    redirect(withMessage("/app/groups/new", "error", "Não foi possível criar o grupo."));
  }

  revalidatePath("/dashboard");
  redirect(`/app/groups/${data}`);
}

export async function updateGroup(formData: FormData) {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  const values = groupSchema.safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
  });
  const fallback = groupId.success ? `/app/groups/${groupId.data}/settings` : "/dashboard";

  if (!groupId.success || !values.success) {
    redirect(withMessage(fallback, "error", "Revise os dados do grupo."));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({ name: values.data.name, description: values.data.description || null })
    .eq("id", groupId.data);

  if (error) redirect(withMessage(fallback, "error", "Você não pode alterar este grupo."));

  revalidatePath("/dashboard");
  revalidatePath(`/app/groups/${groupId.data}`);
  redirect(withMessage(fallback, "success", "Grupo atualizado."));
}

export async function deleteGroup(formData: FormData) {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  if (!groupId.success) redirect("/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.from("groups").delete().eq("id", groupId.data);
  if (error) {
    redirect(withMessage(`/app/groups/${groupId.data}/settings`, "error", "Não foi possível excluir o grupo."));
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function sendInvitation(formData: FormData) {
  const parsed = invitationSchema.safeParse({
    groupId: formString(formData, "groupId"),
    email: formString(formData, "email"),
  });
  if (!parsed.success) redirect("/dashboard");

  const destination = `/app/groups/${parsed.data.groupId}/members`;
  const result = await createAndSendInvitation(parsed.data.groupId, parsed.data.email);
  if (result.error) redirect(withMessage(destination, "error", result.error));

  revalidatePath(destination);
  redirect(withMessage(destination, "success", "Convite enviado e válido por 5 minutos."));
}

export async function resendInvitation(formData: FormData) {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  const invitationId = uuidSchema.safeParse(formString(formData, "invitationId"));
  if (!groupId.success || !invitationId.success) redirect("/dashboard");

  const destination = `/app/groups/${groupId.data}/members`;
  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("group_invitations")
    .select("email")
    .eq("id", invitationId.data)
    .eq("group_id", groupId.data)
    .single();

  if (!invitation) redirect(withMessage(destination, "error", "Convite não encontrado."));

  const result = await createAndSendInvitation(groupId.data, invitation.email);
  if (result.error) redirect(withMessage(destination, "error", result.error));

  revalidatePath(destination);
  redirect(withMessage(destination, "success", "Um novo convite foi enviado."));
}

export async function cancelInvitation(formData: FormData) {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  const invitationId = uuidSchema.safeParse(formString(formData, "invitationId"));
  if (!groupId.success || !invitationId.success) redirect("/dashboard");

  const destination = `/app/groups/${groupId.data}/members`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_group_invitation", {
    p_invitation_id: invitationId.data,
  });
  if (error) redirect(withMessage(destination, "error", "Não foi possível cancelar o convite."));

  revalidatePath(destination);
  redirect(withMessage(destination, "success", "Convite cancelado."));
}

export async function removeMember(formData: FormData) {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  const membershipId = uuidSchema.safeParse(formString(formData, "membershipId"));
  if (!groupId.success || !membershipId.success) redirect("/dashboard");

  const destination = `/app/groups/${groupId.data}/members`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_group_member", {
    p_membership_id: membershipId.data,
  });
  if (error) redirect(withMessage(destination, "error", "Não foi possível remover o membro."));

  revalidatePath(destination);
  redirect(withMessage(destination, "success", "Membro removido."));
}

export async function acceptInvitation(formData: FormData) {
  const token = z.string().min(32).max(256).safeParse(formString(formData, "token"));
  if (!token.success) redirect("/?error=invalid-invitation");

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("accept_group_invitation", {
    p_token_hash: invitationHash(token.data),
  });

  if (error || !groupId) {
    redirect(withMessage(`/invite/${encodeURIComponent(token.data)}`, "error", "Convite inválido, expirado ou destinado a outro e-mail."));
  }

  revalidatePath("/dashboard");
  redirect(`/app/groups/${groupId}`);
}
