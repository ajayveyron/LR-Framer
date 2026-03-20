export type SiteRole = "admin" | "contributor";

export type SiteOnboardingStatus = "not_started" | "framer_validated" | "ready";

export type OnboardingStep = "organization" | "framer" | "complete";

export interface ProductSite {
  clerkOrganizationId: string;
  name: string;
  onboardingStatus: SiteOnboardingStatus;
  framerApiKeyCiphertext?: string | null;
  framerProjectId?: string | null;
  framerProjectUrl?: string | null;
  framerCollectionId?: string | null;
  framerCollectionName?: string | null;
  framerDashboardSnapshotJson?: string | null;
  framerDashboardSnapshotSyncedAt?: number | null;
  framerMetadataJson?: string | null;
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProductMembership {
  clerkOrganizationId: string;
  clerkUserId: string;
  role: SiteRole;
  createdAt: number;
  updatedAt: number;
}

export interface ProductOnboardingState {
  clerkOrganizationId: string;
  clerkUserId: string;
  step: OnboardingStep;
  projectUrl?: string | null;
  projectId?: string | null;
  collectionId?: string | null;
  collectionName?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface FramerCollectionOption {
  id: string;
  name: string;
}

export interface FramerValidationResult {
  projectId: string;
  projectUrl: string;
  collections: FramerCollectionOption[];
}
