import { NextResponse } from "next/server";

import { Webhook } from "svix";

import { sendEmail } from "@/lib/email";
import { getResendEnv } from "@/lib/env";
import { logError, logEvent } from "@/lib/logger";
import { WelcomeEmail } from "@/emails/welcome";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Clerk webhook event shapes (only the fields we use)
// ---------------------------------------------------------------------------

interface ClerkUserCreatedEvent {
  type: "user.created";
  data: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email_addresses: Array<{
      email_address: string;
      id: string;
    }>;
    primary_email_address_id?: string | null;
  };
}

// NOTE: organizationInvitation.created handling is disabled because Clerk's
// free plan doesn't allow disabling their built-in invitation email, which
// would cause double emails. Re-enable when upgrading to Clerk Pro.

type ClerkWebhookEvent = ClerkUserCreatedEvent | { type: string; data: unknown };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
  : "https://framerbot.com/dashboard";

function getPrimaryEmail(
  addresses: ClerkUserCreatedEvent["data"]["email_addresses"],
  primaryId?: string | null,
): string | undefined {
  if (primaryId) {
    const primary = addresses.find((a) => a.id === primaryId);
    if (primary) return primary.email_address;
  }
  return addresses[0]?.email_address;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  if (!getResendEnv()) {
    return NextResponse.json(
      { error: "Email service is not configured" },
      { status: 503 },
    );
  }

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logEvent("warn", "clerk.webhook.secret_missing");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 503 },
    );
  }

  // Verify the webhook signature using svix (Clerk uses svix under the hood)
  const svixId = request.headers.get("svix-id") ?? "";
  const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
  const svixSignature = request.headers.get("svix-signature") ?? "";

  const rawBody = await request.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    logError("clerk.webhook.verification_failed", err, {
      svixId,
      signaturePresent: Boolean(svixSignature),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  logEvent("info", "clerk.webhook.received", {
    eventType: event.type,
    svixId,
  });

  try {
    switch (event.type) {
      case "user.created": {
        const { data } = event as ClerkUserCreatedEvent;
        const email = getPrimaryEmail(
          data.email_addresses,
          data.primary_email_address_id,
        );

        if (!email) {
          logEvent("warn", "clerk.webhook.no_email", {
            userId: data.id,
          });
          break;
        }

        await sendEmail({
          to: email,
          subject: "Welcome to Framer Bot",
          react: WelcomeEmail({
            firstName: data.first_name ?? undefined,
            dashboardUrl: DASHBOARD_URL,
          }),
          eventName: "email.welcome_sent",
          metadata: { userId: data.id },
        });
        break;
      }

      default:
        logEvent("info", "clerk.webhook.unhandled_event", {
          eventType: event.type,
        });
    }
  } catch (error) {
    logError("clerk.webhook.processing_failed", error, {
      eventType: event.type,
    });
  }

  return NextResponse.json({ received: true });
}
