"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createElement } from "react";

import {
  GroupInvitationEmail,
  groupInvitationEmailText,
} from "@/emails/group-invitation";
import { getPublicEnv } from "@/lib/env";
import type { ActionState } from "@/lib/action-state";
import { createResendClient } from "@/lib/resend";
import { createClient } from "@/lib/supabase/server";
import {
  actionError,
  formString,
  groupSchema,
  invitationHash,
  invitationSchema,
  invitationTokenSchema,
  uuidSchema,
} from "@/lib/validation";

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
    const { data: sentEmail, error: emailError } = await client.emails.send(
      {
        from,
        to: email,
        subject: `Convite para o grupo ${group.name}`,
        react: createElement(GroupInvitationEmail, {
          groupName: group.name,
          inviteUrl,
        }),
        text: groupInvitationEmailText({ groupName: group.name, inviteUrl }),
        tags: [
          { name: "category", value: "group_invitation" },
          { name: "invitation_id", value: invitationId as string },
        ],
      },
      { idempotencyKey: `group-invitation/${invitationId}` },
    );

    if (emailError || !sentEmail?.id) {
      await supabase.rpc("record_group_invitation_email_result", {
        p_invitation_id: invitationId,
        p_status: "failed",
        p_resend_email_id: null,
      });
      await supabase.rpc("cancel_group_invitation", {
        p_invitation_id: invitationId,
      });
      console.error("Invitation email rejected by provider");
      return { error: "O convite não pôde ser enviado. Verifique a configuração do Resend." };
    }

    const { error: trackingError } = await supabase.rpc(
      "record_group_invitation_email_result",
      {
        p_invitation_id: invitationId,
        p_status: "sent",
        p_resend_email_id: sentEmail.id,
      },
    );
    if (trackingError) console.error("Invitation email tracking failed");

    return { invitationId: invitationId as string };
  } catch {
    console.error("Invitation email delivery could not be confirmed");
    return {
      error:
        "Não foi possível confirmar o envio. Aguarde um instante antes de tentar novamente.",
    };
  }
}

export async function createGroup(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = groupSchema.safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
  });

  if (!parsed.success) {
    return actionError("Revise os dados do grupo.", parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
  });

  if (error || !data) {
    return actionError("Não foi possível criar o grupo.");
  }

  revalidatePath("/dashboard");
  redirect(`/app/groups/${data}`);
}

export async function updateGroup(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  const values = groupSchema.safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
  });
  if (!groupId.success || !values.success) {
    return actionError(
      "Revise os dados do grupo.",
      values.success ? undefined : values.error,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({ name: values.data.name, description: values.data.description || null })
    .eq("id", groupId.data);

  if (error) return actionError("Você não pode alterar este grupo.");

  revalidatePath("/dashboard");
  revalidatePath(`/app/groups/${groupId.data}`);
  return { status: "success", message: "Grupo atualizado." };
}

export async function deleteGroup(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  if (!groupId.success) return actionError("Grupo inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("groups").delete().eq("id", groupId.data);
  if (error) {
    return actionError("Não foi possível excluir o grupo.");
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function sendInvitation(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = invitationSchema.safeParse({
    groupId: formString(formData, "groupId"),
    email: formString(formData, "email"),
  });
  if (!parsed.success) return actionError("Revise o e-mail informado.", parsed.error);

  const destination = `/app/groups/${parsed.data.groupId}/members`;
  const result = await createAndSendInvitation(parsed.data.groupId, parsed.data.email);
  if (result.error) return actionError(result.error);

  revalidatePath(destination);
  return { status: "success", message: "Convite enviado e válido por 5 minutos." };
}

export async function resendInvitation(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  const invitationId = uuidSchema.safeParse(formString(formData, "invitationId"));
  if (!groupId.success || !invitationId.success) return actionError("Convite inválido.");

  const destination = `/app/groups/${groupId.data}/members`;
  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("group_invitations")
    .select("email")
    .eq("id", invitationId.data)
    .eq("group_id", groupId.data)
    .single();

  if (!invitation) return actionError("Convite não encontrado.");

  const result = await createAndSendInvitation(groupId.data, invitation.email);
  if (result.error) return actionError(result.error);

  revalidatePath(destination);
  return { status: "success", message: "Um novo convite foi enviado." };
}

export async function cancelInvitation(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  const invitationId = uuidSchema.safeParse(formString(formData, "invitationId"));
  if (!groupId.success || !invitationId.success) return actionError("Convite inválido.");

  const destination = `/app/groups/${groupId.data}/members`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_group_invitation", {
    p_invitation_id: invitationId.data,
  });
  if (error) return actionError("Não foi possível cancelar o convite.");

  revalidatePath(destination);
  return { status: "success", message: "Convite cancelado." };
}

export async function removeMember(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const groupId = uuidSchema.safeParse(formString(formData, "groupId"));
  const membershipId = uuidSchema.safeParse(formString(formData, "membershipId"));
  if (!groupId.success || !membershipId.success) return actionError("Membro inválido.");

  const destination = `/app/groups/${groupId.data}/members`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_group_member", {
    p_membership_id: membershipId.data,
  });
  if (error) return actionError("Não foi possível remover o membro.");

  revalidatePath(destination);
  return { status: "success", message: "Membro removido." };
}

export async function acceptInvitation(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = invitationTokenSchema.safeParse(formString(formData, "token"));
  if (!token.success) return actionError("Convite inválido.");

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("accept_group_invitation", {
    p_token_hash: invitationHash(token.data),
  });

  if (error || !groupId) {
    return actionError("Convite inválido, expirado ou destinado a outro e-mail.");
  }

  revalidatePath("/dashboard");
  redirect(`/app/groups/${groupId}`);
}
