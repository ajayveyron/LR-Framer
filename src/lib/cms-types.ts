export type LogicalFieldKey = "title" | "body" | "author" | "date";

export type DashboardFieldType =
  | "string"
  | "formattedText"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "link"
  | "image"
  | "file"
  | "color"
  | "collectionReference"
  | "multiCollectionReference"
  | "array"
  | "divider"
  | "unsupported";

export type DashboardFieldValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | Array<Record<string, unknown>>
  | { url: string; alt: string | null };

export interface ReferenceOption {
  id: string;
  label: string;
  slug: string;
}

export interface DashboardFieldDefinition {
  id: string;
  name: string;
  type: DashboardFieldType;
  required: boolean;
  supported: boolean;
  logicalKey?: LogicalFieldKey;
  options?: Array<{ id?: string; label: string; value: string }>;
  referenceCollection?: {
    collectionId: string;
    collectionName: string;
    multiple: boolean;
    options: ReferenceOption[];
  };
  displayTime?: boolean;
  helpText?: string;
}

export interface BlogCollectionMetadata {
  collectionId: string;
  collectionName: string;
  logicalFields: Partial<Record<LogicalFieldKey, string>>;
  fields: DashboardFieldDefinition[];
}

export interface BlogPostSummary {
  id: string;
  slug: string;
  draft: boolean;
  title: string;
  date: string | null;
  createdAt: string | null;
  lastUpdated: string | null;
  lastUpdatedBy: string | null;
}

export interface BlogPostRecord extends BlogPostSummary {
  fieldValues: Record<string, DashboardFieldValue>;
}

export interface PublishResponse {
  deploymentId: string;
  hostnames: string[];
  createdAt: string;
}

export interface UpsertBlogPostInput {
  id?: string;
  slug: string;
  draft: boolean;
  publish?: boolean;
  fieldValues: Record<string, DashboardFieldValue>;
}

export interface BridgeSyncInput {
  externalId: string;
  framerItemId?: string | null;
  sourceVersion?: string | null;
  slug: string;
  draft: boolean;
  fieldValues: Record<string, DashboardFieldValue>;
}

export interface BridgeRemovalInput {
  externalId: string;
  framerItemId?: string | null;
  slug?: string | null;
}

export interface BridgeSyncResult {
  externalId: string;
  framerItemId: string;
  action: "created" | "updated" | "unchanged" | "deleted";
  matchedBy: "framerItemId" | "slug" | "none";
  post: BlogPostRecord;
}

export interface BridgeSyncResponse {
  results: BridgeSyncResult[];
  publish?: PublishResponse;
}
