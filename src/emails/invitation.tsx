import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface InvitationEmailProps {
  inviterName?: string;
  organizationName?: string;
  acceptUrl: string;
}

export function InvitationEmail({
  inviterName,
  organizationName,
  acceptUrl,
}: InvitationEmailProps) {
  const inviterLine = inviterName
    ? `${inviterName} has invited you`
    : "You have been invited";
  const orgLine = organizationName
    ? ` to join ${organizationName} on Framer Bot`
    : " to join a team on Framer Bot";

  return (
    <Html>
      <Head />
      <Preview>
        {inviterLine}
        {orgLine}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Img
              src="https://framerbot.com/logo.png"
              alt="Framer Bot"
              height="32"
              style={logoImg}
            />
          </Section>
          <Heading style={heading}>You are invited</Heading>
          <Text style={paragraph}>
            {inviterLine}
            {orgLine}. Accept the invitation below to get started.
          </Text>
          <Section style={ctaSection}>
            <Link href={acceptUrl} style={ctaButton}>
              Accept invitation
            </Link>
          </Section>
          <Text style={secondaryText}>
            If you were not expecting this invitation, you can safely ignore
            this email.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Framer Bot</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default InvitationEmail;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const body: React.CSSProperties = {
  backgroundColor: "#f8f9fa",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  margin: "40px auto",
  maxWidth: "480px",
  padding: "40px 32px",
};

const logoSection: React.CSSProperties = {
  marginBottom: "24px",
};

const logoImg: React.CSSProperties = {
  display: "block",
  height: "32px",
  width: "auto",
};

const heading: React.CSSProperties = {
  color: "#111111",
  fontSize: "22px",
  fontWeight: 600,
  lineHeight: "1.3",
  margin: "0 0 16px",
};

const paragraph: React.CSSProperties = {
  color: "#444444",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const ctaSection: React.CSSProperties = {
  margin: "24px 0",
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#111111",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none",
};

const secondaryText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 16px",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  borderTop: "1px solid #e5e7eb",
  margin: "32px 0 16px",
};

const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  margin: 0,
};
