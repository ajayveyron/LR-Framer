/**
 * Types for the AI CMS action confirmation flow.
 *
 * Instead of the AI directly executing write operations, it proposes actions
 * via the `propose_cms_action` tool. The client renders a confirmation card
 * and only executes the action when the user approves.
 */

// ---------------------------------------------------------------------------
// Action definitions — one per write operation
// ---------------------------------------------------------------------------

export interface CmsActionAddItems {
  action: "add_items";
  collectionId: string;
  items: Array<{
    id?: string;
    slug: string;
    draft?: boolean;
    fieldData?: Record<string, { type: string; value: unknown }>;
  }>;
}

export interface CmsActionRemoveItems {
  action: "remove_items";
  collectionId: string;
  itemIds: string[];
}

export interface CmsActionRemoveItem {
  action: "remove_item";
  collectionId: string;
  itemId: string;
}

export interface CmsActionSetItemAttributes {
  action: "set_item_attributes";
  collectionId: string;
  itemId: string;
  slug?: string;
  draft?: boolean;
  fieldData?: Record<string, { type: string; value: unknown }>;
}

export interface CmsActionAddEnumCase {
  action: "add_enum_case";
  collectionId: string;
  fieldId: string;
  name: string;
}

export interface CmsActionUpdateEnumCase {
  action: "update_enum_case";
  collectionId: string;
  fieldId: string;
  caseId: string;
  newName: string;
}

export interface CmsActionRemoveEnumCase {
  action: "remove_enum_case";
  collectionId: string;
  fieldId: string;
  caseId: string;
}

export interface CmsActionSetEnumCaseOrder {
  action: "set_enum_case_order";
  collectionId: string;
  fieldId: string;
  caseIds: string[];
}

export interface CmsActionPublish {
  action: "publish";
}

export type CmsAction =
  | CmsActionAddItems
  | CmsActionRemoveItems
  | CmsActionRemoveItem
  | CmsActionSetItemAttributes
  | CmsActionAddEnumCase
  | CmsActionUpdateEnumCase
  | CmsActionRemoveEnumCase
  | CmsActionSetEnumCaseOrder
  | CmsActionPublish;

// ---------------------------------------------------------------------------
// The shape the AI tool returns (and the client receives)
// ---------------------------------------------------------------------------

export interface CmsActionProposal {
  /** Human-readable summary of what the action does */
  description: string;
  /** The action payload to execute if approved */
  payload: CmsAction;
}

// ---------------------------------------------------------------------------
// Severity classification for UI styling
// ---------------------------------------------------------------------------

export type ActionSeverity = "safe" | "warning" | "destructive";

export function getActionSeverity(action: CmsAction): ActionSeverity {
  switch (action.action) {
    case "remove_item":
    case "remove_items":
    case "remove_enum_case":
      return "destructive";
    case "publish":
      return "warning";
    default:
      return "safe";
  }
}

/** Human-readable label for the action type */
export function getActionLabel(action: CmsAction): string {
  switch (action.action) {
    case "add_items":
      return `Add ${action.items.length} item${action.items.length === 1 ? "" : "s"}`;
    case "remove_items":
      return `Remove ${action.itemIds.length} item${action.itemIds.length === 1 ? "" : "s"}`;
    case "remove_item":
      return "Remove item";
    case "set_item_attributes":
      return "Update item";
    case "add_enum_case":
      return `Add enum case "${action.name}"`;
    case "update_enum_case":
      return `Rename enum case to "${action.newName}"`;
    case "remove_enum_case":
      return "Remove enum case";
    case "set_enum_case_order":
      return "Reorder enum cases";
    case "publish":
      return "Publish site";
  }
}
