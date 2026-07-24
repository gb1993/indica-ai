export type GroupInvitationEmailProps = {
  groupName: string;
  inviteUrl: string;
  expiresInMinutes?: number;
};

export function groupInvitationEmailText({
  groupName,
  inviteUrl,
  expiresInMinutes = 5,
}: GroupInvitationEmailProps) {
  return [
    "Você foi convidado para o Indica Aí",
    "",
    `Você recebeu um convite para participar do grupo ${groupName}.`,
    `O convite expira em ${expiresInMinutes} minutos e pode ser usado somente uma vez.`,
    "",
    `Aceitar convite: ${inviteUrl}`,
    "",
    "Se você não esperava este convite, ignore este e-mail.",
  ].join("\n");
}
