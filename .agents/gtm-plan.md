# Framer Bot GTM, Website, and Pricing Plan

*Last updated: 2026-03-21*

## Summary

Reposition Framer Bot around one clear wedge: **internal Framer CMS ops for teams, with AI accelerating edit, review, and batch workflows**.

Launch only **Free** and **Standard ($19)** in the live product and on the site.

Treat **Agency ($49)** as roadmap-only marketing copy for now, not a live checkout or billing option.

The first GTM motion targets **in-house Framer teams** and runs **mostly self-serve**, supported by a lightweight setup and demo loop.

Organic content runs on **both X demo videos and YouTube Shorts**, reusing the same demo assets across both.

## Product Positioning

### Core message

- Primary message: **Run Framer CMS with your team, without giving everyone full Framer editor access.**
- Secondary message: **Use AI to rewrite, review, and batch-improve content faster inside that workflow.**
- Do not lead with "AI-native", "backend syncs", or Notion.

### Ideal buyer now

- In-house startup marketing teams using Framer
- Founders who are the bottleneck for Framer content updates
- Small internal teams managing one Framer site
- Freelancers managing one active internal content workflow for a client

### Wrong buyer for now

- Large agencies needing multi-workspace or multi-project support
- Teams buying primarily for Notion sync
- Buyers expecting advanced approvals, compliance, or granular enterprise controls

## Pricing and Packaging

### Free

**Benefit:** prove the product works on a real Framer project before paying.

**Includes:**

- 1 workspace
- 1 Framer project
- connect Framer
- basic CMS view and edit
- very small AI allowance
- invite 1 teammate max beyond the owner

**Best for:**

- trying the workflow on a live site

**Job:**

- activation

### Standard ($19)

**Benefit:** run one Framer site with a small team and get a meaningful AI workflow boost.

**Includes:**

- 1 workspace
- 1 Framer project
- unlimited members
- shared CMS editing
- one owner or admin
- rewrite, review, and batch-assist basics
- moderate AI allowance

**Best for:**

- founders
- marketers
- freelancers
- small internal teams managing one site

**Job:**

- monetize the core product

### Agency ($49) later

**Benefit:** manage multiple Framer workspaces or projects from one operating layer.

**Includes later:**

- multiple workspaces or Framer projects
- bigger AI allowance
- stronger admin controls
- agency-friendly client management

**Best for later:**

- agencies
- larger teams

**Job later:**

- expansion revenue

### Pricing rules

- AI should be included up to an allowance, not unlimited.
- Standard is the only live paid plan in v1.
- Agency should not exist in checkout, billing logic, or upgrade flows until the product actually supports multi-workspace and multi-project workflows.
- Standard should be the highlighted plan everywhere.

## Website Plan

### Homepage rewrite

Update the landing page to shift from a broad "AI-native Framer ops" story to a tighter workflow-first promise.

### New hero direction

- Headline: team Framer CMS workflow outside the Framer editor
- Supporting line: AI speeds up rewrite, review, and batch edits inside that workflow
- Primary CTA: `Start free`
- Secondary CTA: `See setup flow` or `Watch demo`

### Replace current value props with these three

- `Connect one Framer site fast`
- `Invite your internal team`
- `Use AI to edit and review faster`

### Add sections

- Pricing section with `Free`, `Standard ($19)`, and `Agency` as coming later
- Who it is for section
- How it works section with exact activation path
- FAQ covering why this exists if they already use Framer, what unlimited members means, how AI allowance works, and whether Agency is live yet

### Remove from public story

- Notion positioning
- generic "AI-native ops" framing
- language that makes the product sound like a generic AI writing tool

## Product Changes Needed

### Billing and plan model

Update the current runtime packaging from `Free/Pro $8` to `Free/Standard $19`.

This includes:

- plan definitions
- upgrade labels
- checkout route
- usage meter text
- webhook plan resolution
- billing UI naming

### Constraints to enforce

#### Free

- allow exactly 1 invited teammate beyond the owner
- block further invites
- show upgrade messaging instead of allowing another invite

#### Standard

- allow unlimited members
- keep 1 workspace and 1 Framer project as the strong cap

### AI allowance behavior

- keep the current hard allowance model
- chat, rewrite, and image routes should continue blocking once exhausted
- upgrade messaging should sell workflow value, not just more tokens

### Notion handling

- keep backend Notion code untouched for now if needed
- remove or hide all user-facing Notion copy and UI from active product surfaces

### Tracking and funnel instrumentation

Use existing server-side logging patterns first instead of adding a new analytics vendor in this pass.

Track:

- landing CTA click
- signup started
- Framer connected
- teammate invited
- AI action completed
- first publish completed
- upgrade initiated
- checkout completed

## GTM Plan

### Launch motion

The first 30 to 60 days should be mostly self-serve, not sales-led.

Support self-serve with:

- clear landing page
- simple pricing
- setup flow
- short demo assets
- optional light-touch help for high-intent users

### First ICP

Optimize first for **in-house Framer teams**.

Secondary audience:

- freelancers managing one Framer workflow for a client

### Outreach

Build a list of prospects already using Framer and showing these pain signals:

- one person is the Framer bottleneck
- marketers should not need full Framer editor access
- frequent CMS updates
- content workflows happening in Slack or docs instead of in one shared workspace

### Outreach message structure

- identify the Framer workflow bottleneck
- explain that Framer Bot lets the internal team manage CMS outside the Framer editor
- show the AI angle as acceleration, not the entire product
- CTA should be `Try it free` or `I can help you connect your first project`

### Follow-up sequence

- Day 1: short intro plus pain statement
- Day 3: 30 to 45 second product demo clip
- Day 6: one concrete use case, such as inviting a marketer and running an AI rewrite
- Day 10: low-friction final nudge with free setup offer

## Organic Content Plan

### Channels

- X demo videos
- YouTube Shorts

Run both equally, but reuse the same demo footage and script for both.

### Publishing cadence

- 2 short demos per week for the first 6 weeks

### Video themes

Each video should show one workflow only:

- connect a Framer project
- invite a teammate
- rewrite a post with AI
- batch-improve titles or descriptions
- show how marketers work outside the Framer editor

### Video structure

- 2 to 3 second hook naming the pain
- 15 to 25 seconds of product action
- 5 second payoff showing the bottleneck removed
- CTA to try it free

### Repeating message angles

- marketers should not need the Framer editor
- one person bottleneck
- AI inside the content workflow, not beside it
- run one Framer site with your team

## Funnel and Activation

Optimize the product around this exact first-run path:

1. Sign up
2. Connect Framer
3. Choose collection
4. Invite first teammate
5. Complete one AI-assisted action
6. Complete one real content publish
7. See upgrade prompt

### Upgrade triggers

- Free user attempts a second invite
- Free AI allowance runs low or is exhausted
- Free workspace completes first successful publish and comes back for another session

## 30-Day Execution Plan

### Week 1

- rewrite homepage messaging
- add pricing section for Free and Standard
- remove public Notion story
- update all live billing labels from Pro to Standard

### Week 2

- enforce Free invite limit
- update upgrade prompts and billing UI
- add funnel event logging
- create first 2 demo videos

### Week 3

- start outreach to in-house Framer teams
- start posting demos to X and YouTube Shorts
- offer optional setup help to high-intent users
- interview any user who connects Framer but does not invite a teammate

### Week 4

- collect first proof points
- refine landing page copy from actual user language
- identify the highest-performing demo theme
- decide whether the upgrade prompts are landing

## Success Metrics

Track these first:

- visitor to signup
- signup to Framer connected
- Framer connected to teammate invited
- Framer connected to first AI action
- first AI action to first publish
- Free to Standard conversion
- 30-day retained paid workspaces
- AI cost per Standard workspace

### Most important early metric

**What percentage of connected workspaces invite a teammate and complete one AI-assisted publish?**

If this is low, the workflow value is not landing yet.

## Risks to Watch

- Standard with unlimited members may become too generous if AI usage is high
- if the product sounds like just another AI writer, conversion will be weak
- if onboarding is too hard, users will never reach the activation moment
- if Agency is marketed too aggressively before the product supports it, expectations will break

## Implementation Notes

### Current product-side areas affected

- landing page content
- billing plan config
- checkout route
- webhook plan mapping
- usage meter text
- upgrade button labels
- team invite gating
- visible Notion-related UI and copy

### Defaults chosen

- first ICP is in-house Framer teams
- launch is mostly self-serve
- organic content runs on both X and YouTube Shorts
- Standard is the only live paid plan
- Agency remains roadmap-only
- AI limit model is a hard allowance

