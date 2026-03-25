import { Resend } from "resend";

import { getResendEnv } from "@/lib/env";
import { logError, logEvent } from "@/lib/logger";

let cachedResend: Resend | null = null;

function getResendClient(): Resend | undefined {
  if (cachedResend) return cachedResend;

  const env = getResendEnv();
  if (!env) return undefined;

  cachedResend = new Resend(env.RESEND_API_KEY);
  return cachedResend;
}

interface SendEmailParams {
  to: string;
  subject: string;
  react: React.ReactElement;
  /** Wide-event name for logging, e.g. "email.welcome_sent" */
  eventName: string;
  metadata?: Record<string, unknown>;
}

export async function sendEmail({
  to,
  subject,
  react,
  eventName,
  metadata = {},
}: SendEmailParams): Promise<boolean> {
  const resend = getResendClient();
  const env = getResendEnv();

  if (!resend || !env) {
    logEvent("warn", "email.not_configured", { eventName, to });
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject,
      react,
    });

    if (error) {
      logError("email.send_failed", new Error(error.message), {
        eventName,
        to,
        ...metadata,
      });
      return false;
    }

    logEvent("info", eventName, { to, subject, ...metadata });
    return true;
  } catch (err) {
    logError("email.send_failed", err, { eventName, to, ...metadata });
    return false;
  }
}
