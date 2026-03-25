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

interface ProUpgradeEmailProps {
  firstName?: string;
  planName: string;
  dashboardUrl: string;
}

export function ProUpgradeEmail({
  firstName,
  planName,
  dashboardUrl,
}: ProUpgradeEmailProps) {
  const greeting = firstName ? `${firstName}, you` : "You";

  return (
    <Html>
      <Head />
      <Preview>
        You are now on the {planName} plan — congrats
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
          <Heading style={heading}>
            {greeting} just upgraded to {planName}
          </Heading>
          <Text style={paragraph}>
            Your upgrade is live. You now have access to 10M tokens per month
            and all the features that come with the {planName} plan.
          </Text>
          <Section style={highlightBox}>
            <Text style={highlightText}>
              Your new monthly token allowance: 10,000,000 tokens
            </Text>
          </Section>
          <Section style={ctaSection}>
            <Link href={dashboardUrl} style={ctaButton}>
              Go to dashboard
            </Link>
          </Section>
          <Text style={paragraph}>
            Thanks for upgrading. If you need anything, just reply to this
            email.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Framer Bot</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ProUpgradeEmail;

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

const highlightBox: React.CSSProperties = {
  backgroundColor: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: "6px",
  margin: "16px 0",
  padding: "16px",
};

const highlightText: React.CSSProperties = {
  color: "#166534",
  fontSize: "14px",
  fontWeight: 600,
  margin: 0,
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
