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

interface WelcomeEmailProps {
  firstName?: string;
  dashboardUrl: string;
}

export function WelcomeEmail({
  firstName,
  dashboardUrl,
}: WelcomeEmailProps) {
  const greeting = firstName ? `Hey ${firstName}` : "Hey there";

  return (
    <Html>
      <Head />
      <Preview>Welcome to Framer Bot — your CMS dashboard is ready</Preview>
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
          <Heading style={heading}>{greeting}, welcome aboard</Heading>
          <Text style={paragraph}>
            Your account is set up and ready to go. Framer Bot gives you a
            clean dashboard to manage your Framer CMS content — create posts,
            edit drafts, and publish with ease.
          </Text>
          <Section style={ctaSection}>
            <Link href={dashboardUrl} style={ctaButton}>
              Open your dashboard
            </Link>
          </Section>
          <Text style={paragraph}>
            If you have any questions, just reply to this email. We are happy
            to help.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Framer Bot</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;

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
