import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";

import {
  groupInvitationEmailText,
  type GroupInvitationEmailProps,
} from "./group-invitation-content";

export { groupInvitationEmailText };

export function GroupInvitationEmail({
  groupName,
  inviteUrl,
  expiresInMinutes = 5,
}: GroupInvitationEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Você recebeu um convite para participar de {groupName}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>✦ INDICA AÍ</Text>
          <Section style={styles.card}>
            <Heading style={styles.heading}>Você foi convidado para um grupo</Heading>
            <Text style={styles.text}>
              Você recebeu um convite para participar de <strong>{groupName}</strong>.
            </Text>
            <Text style={styles.text}>
              O convite expira em {expiresInMinutes} minutos e pode ser usado somente uma vez.
            </Text>
            <Button href={inviteUrl} style={styles.button}>
              Aceitar convite
            </Button>
            <Hr style={styles.divider} />
            <Text style={styles.footer}>
              Se você não esperava este convite, ignore este e-mail.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

GroupInvitationEmail.PreviewProps = {
  groupName: "CineClub",
  inviteUrl: "http://localhost:3000/invite/exemplo",
  expiresInMinutes: 5,
} satisfies GroupInvitationEmailProps;

const styles = {
  body: {
    backgroundColor: "#070a12",
    color: "#eef0ff",
    fontFamily: "Arial, Helvetica, sans-serif",
    margin: 0,
    padding: "32px 12px",
  },
  container: { margin: "0 auto", maxWidth: "560px" },
  brand: {
    color: "#a78bfa",
    fontSize: "14px",
    fontWeight: "700",
    letterSpacing: "2px",
    margin: "0 0 16px",
  },
  card: {
    backgroundColor: "#101421",
    border: "1px solid #282d40",
    borderRadius: "16px",
    padding: "32px",
  },
  heading: {
    color: "#ffffff",
    fontSize: "25px",
    lineHeight: "1.25",
    margin: "0 0 20px",
  },
  text: {
    color: "#c4c8d8",
    fontSize: "16px",
    lineHeight: "1.6",
    margin: "0 0 14px",
  },
  button: {
    backgroundColor: "#7c3aed",
    borderRadius: "10px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "700",
    margin: "16px 0 24px",
    padding: "13px 22px",
    textDecoration: "none",
  },
  divider: { borderColor: "#282d40", margin: "0 0 20px" },
  footer: {
    color: "#8f95a8",
    fontSize: "12px",
    lineHeight: "1.5",
    margin: 0,
  },
} as const;
