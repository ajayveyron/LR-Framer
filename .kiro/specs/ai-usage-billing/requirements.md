# Requirements Document

## Introduction

Token-based AI usage billing and metering system for FramerLink, integrated with Dodo Payments as the Merchant of Record. The system tracks token consumption across all AI features (chat, image generation, tool calls), enforces monthly allowances tied to two subscription plans — Free ($0/month) and Pro ($8/month) — and presents usage to users as a friendly percentage meter rather than raw token counts. Plan definitions and token allowances are managed through a single centralized configuration constant in code. Dodo Payments handles subscriptions, metered billing, global tax compliance, and payment processing across 150+ countries with first-class India domestic support.

## Glossary

- **Billing_Service**: The server-side module that manages subscription state, usage tracking, and Dodo Payments API integration
- **Usage_Meter**: The client-side UI component that displays the user's current AI usage as a percentage of their monthly allowance
- **Token_Tracker**: The server-side middleware that intercepts AI API responses, extracts token counts from Vercel AI SDK usage data, and records consumption
- **Dodo_Payments**: The external payment provider acting as Merchant of Record — handles subscriptions, metered billing, tax compliance, chargebacks, and fraud
- **Usage_Record**: A single record of token consumption tied to an organization, user, AI feature type, and timestamp
- **Monthly_Allowance**: The total token budget allocated to an organization per billing cycle, determined by their subscription plan
- **Token_Equivalent**: A normalized token cost assigned to non-token-based AI operations (e.g., image generation) so all usage is measured in a single unit
- **Webhook_Handler**: The API route that receives and processes Dodo Payments webhook events for subscription lifecycle changes
- **AI_Chat_Route**: The existing `/api/ai/chat` endpoint that handles AI chat requests via Gemini 3.1 Pro on Vertex AI
- **AI_Image_Route**: The existing `/api/ai/image` endpoint that handles standalone AI image generation via Gemini 3.1 Flash Image
- **Organization**: A Clerk organization that owns a FramerLink site — billing and usage are scoped to the organization level
- **Plan_Config**: The single centralized configuration constant in server-side code that defines all subscription plans, their IDs, prices, and token allowances — the sole source of truth for plan definitions
- **Free_Plan**: The default subscription plan at $0/month with a limited monthly token allowance, available to all organizations without payment
- **Pro_Plan**: The paid subscription plan at $8/month with a higher monthly token allowance, unlocked via Dodo Payments checkout

## Requirements

### Requirement 1: Token Usage Recording

**User Story:** As a platform operator, I want every AI interaction to record its token consumption, so that I have accurate usage data for billing.

#### Acceptance Criteria

1. WHEN the AI_Chat_Route returns a response with `usage.promptTokens` and `usage.completionTokens`, THE Token_Tracker SHALL record a Usage_Record containing the organization ID, user ID, feature type "chat", prompt token count, completion token count, total token count, and timestamp
2. WHEN the AI_Image_Route completes an image generation, THE Token_Tracker SHALL record a Usage_Record with feature type "image" and a Token_Equivalent cost derived from the model's reported usage or a configured fallback cost
3. WHEN the `generate_and_upload_image` chat tool completes within a chat session, THE Token_Tracker SHALL record a separate Usage_Record with feature type "image_tool" for the image generation tokens, distinct from the parent chat session's token usage
4. WHEN a chat session includes tool calls (Framer tools, Google Search grounding), THE Token_Tracker SHALL include all tool-call-related tokens (input and output across all steps) in the chat session's Usage_Record total
5. THE Token_Tracker SHALL store each Usage_Record in a Convex table with fields: organizationId, userId, featureType, promptTokens, completionTokens, totalTokens, model, conversationId (optional), and createdAt
6. IF the Token_Tracker fails to record a Usage_Record, THEN THE Token_Tracker SHALL log the failure as a wide event error and allow the AI response to proceed without blocking the user

### Requirement 2: Usage Aggregation and Querying

**User Story:** As a user, I want to see how much of my AI allowance I've used this billing cycle, so that I can manage my usage.

#### Acceptance Criteria

1. WHEN a user requests their current usage, THE Billing_Service SHALL return the total tokens consumed by the user's organization in the current billing cycle
2. THE Billing_Service SHALL calculate the current billing cycle start and end dates based on the organization's subscription anchor date from Dodo Payments
3. WHEN a user requests their usage, THE Billing_Service SHALL return the usage as a percentage of the organization's Monthly_Allowance (e.g., "34% used")
4. THE Billing_Service SHALL provide a breakdown of usage by feature type (chat, image, image_tool) for the current billing cycle when requested
5. WHEN the organization has no active subscription, THE Billing_Service SHALL return the Free_Plan's Monthly_Allowance from Plan_Config and the organization's actual usage against that allowance

### Requirement 3: Usage Enforcement (Quota Gating)

**User Story:** As a platform operator, I want to prevent AI usage when an organization exceeds its monthly allowance, so that costs remain predictable.

#### Acceptance Criteria

1. WHEN an AI request is received, THE Billing_Service SHALL check the organization's current usage against its Monthly_Allowance before allowing the request to proceed
2. IF the organization's current usage meets or exceeds its Monthly_Allowance, THEN THE Billing_Service SHALL reject the AI request with a 429 status code and a message indicating the allowance has been exhausted
3. WHEN the organization has no active paid subscription, THE Billing_Service SHALL enforce the Free_Plan's Monthly_Allowance from Plan_Config as the usage limit
4. WHEN the Billing_Service rejects an AI request due to quota exhaustion, THE Billing_Service SHALL log a wide event with the organization ID, current usage, and allowance limit
5. THE Billing_Service SHALL perform the quota check with a tolerance margin — allowing a request to start even if the remaining allowance is less than the expected cost, but recording the full actual usage afterward (soft cap, not hard mid-stream cutoff)

### Requirement 4: Dodo Payments Subscription Integration

**User Story:** As a user, I want to subscribe to a plan that gives me a monthly AI token allowance, so that I can use AI features.

#### Acceptance Criteria

1. THE Billing_Service SHALL integrate with the Dodo Payments API to create subscription checkout sessions for new subscribers
2. WHEN a user initiates a subscription, THE Billing_Service SHALL redirect the user to a Dodo Payments hosted checkout page with the selected plan's product ID
3. WHEN Dodo Payments sends a `subscription.active` webhook event, THE Webhook_Handler SHALL activate the organization's subscription and set the Monthly_Allowance based on the plan
4. WHEN Dodo Payments sends a `subscription.cancelled` or `subscription.expired` webhook event, THE Webhook_Handler SHALL deactivate the organization's subscription and set the Monthly_Allowance to zero
5. WHEN Dodo Payments sends a `subscription.updated` webhook event (plan change), THE Webhook_Handler SHALL update the organization's Monthly_Allowance to reflect the new plan
6. THE Webhook_Handler SHALL verify the webhook signature on every incoming Dodo Payments webhook to prevent spoofed events
7. THE Webhook_Handler SHALL be idempotent — processing the same webhook event multiple times SHALL produce the same result
8. THE Billing_Service SHALL store subscription state in a Convex table with fields: organizationId, dodoSubscriptionId, dodoCustomerId, planId, status, monthlyTokenAllowance, currentPeriodStart, currentPeriodEnd, and updatedAt

### Requirement 5: Dodo Payments Metered Usage Reporting

**User Story:** As a platform operator, I want token usage reported to Dodo Payments so that metered billing is accurate on invoices.

#### Acceptance Criteria

1. THE Billing_Service SHALL report aggregated token usage to the Dodo Payments metered billing API at the end of each billing cycle or on a periodic schedule
2. WHEN reporting usage to Dodo Payments, THE Billing_Service SHALL send the total tokens consumed by the organization during the billing period as the metered quantity
3. IF the usage report to Dodo Payments fails, THEN THE Billing_Service SHALL retry with exponential backoff and log each failure as a wide event error
4. THE Billing_Service SHALL log a wide event for every successful usage report sent to Dodo Payments, including the organization ID, period, and token count reported

### Requirement 6: Usage Meter UI

**User Story:** As a user, I want to see a visual indicator of my AI usage in the dashboard, so that I know how much of my allowance remains.

#### Acceptance Criteria

1. THE Usage_Meter SHALL display the organization's current AI usage as a percentage bar (e.g., "You've used 34% of your monthly AI allowance")
2. WHEN the organization's usage exceeds 80% of the Monthly_Allowance, THE Usage_Meter SHALL display a warning state with a distinct visual indicator
3. WHEN the organization's usage reaches 100% of the Monthly_Allowance, THE Usage_Meter SHALL display an exhausted state indicating no AI usage remains
4. THE Usage_Meter SHALL be accessible from the dashboard settings page
5. WHEN the organization has no active subscription, THE Usage_Meter SHALL display a prompt to subscribe with a link to the checkout flow
6. THE Usage_Meter SHALL refresh usage data when the user navigates to the settings page without requiring a full page reload

### Requirement 7: Subscription Management UI

**User Story:** As an admin, I want to manage my organization's subscription from the dashboard, so that I can upgrade, downgrade, or cancel my plan.

#### Acceptance Criteria

1. WHEN an admin user navigates to the subscription settings, THE Billing_Service SHALL display the current plan name, status, renewal date, and Monthly_Allowance
2. WHEN an admin user clicks "Manage Subscription", THE Billing_Service SHALL redirect the admin to the Dodo Payments customer portal where they can update payment methods, change plans, or cancel
3. WHEN an admin user with no active subscription clicks "Subscribe", THE Billing_Service SHALL initiate a Dodo Payments checkout session and redirect to the hosted checkout page
4. THE subscription management UI SHALL only be accessible to users with the "admin" role in the Clerk organization
5. WHEN a non-admin user views the settings page, THE Usage_Meter SHALL display usage information but hide subscription management actions

### Requirement 8: Webhook Security and Processing

**User Story:** As a platform operator, I want webhook processing to be secure and reliable, so that subscription state stays in sync with Dodo Payments.

#### Acceptance Criteria

1. THE Webhook_Handler SHALL validate the webhook signature using the Dodo Payments webhook secret before processing any event
2. IF the webhook signature validation fails, THEN THE Webhook_Handler SHALL reject the request with a 401 status code and log a wide event warning
3. THE Webhook_Handler SHALL respond with a 200 status code within 5 seconds to acknowledge receipt, performing heavy processing asynchronously if needed
4. THE Webhook_Handler SHALL log a wide event for every received webhook, including the event type, subscription ID, and processing result
5. IF the Webhook_Handler receives an event for an unknown organization, THEN THE Webhook_Handler SHALL log a wide event warning and respond with 200 to prevent Dodo Payments from retrying

### Requirement 9: Image Generation Token Normalization

**User Story:** As a platform operator, I want image generation costs normalized to token equivalents, so that all AI usage is measured in a single unit.

#### Acceptance Criteria

1. THE Token_Tracker SHALL assign a Token_Equivalent cost to each image generation based on the model's reported usage (promptTokens + completionTokens from the Vertex AI response)
2. WHEN the image generation model reports token usage in its response, THE Token_Tracker SHALL use the reported values directly as the Token_Equivalent
3. WHEN the image generation model does not report token usage, THE Token_Tracker SHALL apply a configured fallback Token_Equivalent cost for the image model
4. THE Billing_Service SHALL store the fallback Token_Equivalent cost as a server-side configuration constant, not as a user-facing setting

### Requirement 10: Wide Event Logging for Billing

**User Story:** As a platform operator, I want comprehensive logging of all billing events, so that I can audit and debug billing issues.

#### Acceptance Criteria

1. THE Billing_Service SHALL log a wide event for every usage record created, including organization ID, user ID, feature type, token count, and model
2. THE Billing_Service SHALL log a wide event for every quota check, including organization ID, current usage, allowance, and whether the request was allowed or rejected
3. THE Webhook_Handler SHALL log a wide event for every webhook received, including event type, subscription ID, and processing outcome
4. THE Billing_Service SHALL log a wide event for every subscription state change, including organization ID, old status, new status, and plan details
5. THE Token_Tracker SHALL log a wide event when a usage recording failure occurs, including the error details and the AI request metadata that triggered the recording attempt

### Requirement 11: Centralized Plan Configuration

**User Story:** As a platform operator, I want all plan definitions and token allowances defined in a single place in code, so that plan changes are consistent and easy to manage.

#### Acceptance Criteria

1. THE Billing_Service SHALL read all plan definitions (plan ID, name, price, and monthly token allowance) from a single Plan_Config constant exported from a server-side configuration module
2. THE Plan_Config SHALL define exactly two plans: Free_Plan ($0/month) and Pro_Plan ($8/month), each with an explicit monthly token allowance
3. WHEN any part of the system needs to resolve a plan's Monthly_Allowance, THE Billing_Service SHALL look up the allowance from Plan_Config using the plan ID — no hardcoded allowance values outside Plan_Config
4. WHEN the Webhook_Handler processes a subscription event and sets the Monthly_Allowance, THE Webhook_Handler SHALL resolve the allowance from Plan_Config based on the plan ID received from Dodo Payments
5. IF the Webhook_Handler receives a plan ID that does not exist in Plan_Config, THEN THE Webhook_Handler SHALL log a wide event error with the unknown plan ID and reject the subscription update
6. THE Plan_Config SHALL include the Dodo Payments product ID for each plan so that checkout session creation can reference the correct product
