"use client";

import { useState } from "react";
import { useOrganization, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CaretDown,
  DotsThree,
  Spinner,
  UserPlus,
  Shield,
  User,
} from "@phosphor-icons/react";
import { TeamManagerContentSkeleton } from "@/components/dashboard-page-skeletons";
import { UpgradeButton } from "@/components/upgrade-button";
import { useBillingUsage } from "@/lib/use-billing-usage";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Free plan: owner + 1 invited teammate max.
 * Standard+: unlimited members.
 */
const FREE_INVITE_LIMIT = 1;

export function TeamManager() {
  const { user } = useUser();
  const { organization, memberships, invitations, isLoaded } = useOrganization({
    memberships: { pageSize: 50, keepPreviousData: true },
    invitations: { pageSize: 50, keepPreviousData: true },
  });
  const { data: billingData } = useBillingUsage();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"org:admin" | "org:member">("org:member");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removeMember, setRemoveMember] = useState<any | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  if (!isLoaded || !organization) {
    return <TeamManagerContentSkeleton />;
  }

  const isAdmin =
    memberships?.data?.find((m) => m.publicUserData?.userId === user?.id)?.role === "org:admin";

  // Free plan invite gating: count non-owner members + pending invitations
  const isFreePlan = !billingData || billingData.planName === "Free";
  const nonOwnerMemberCount = (memberships?.count ?? 1) - 1;
  const pendingInviteCount = invitations?.count ?? 0;
  const totalInvited = nonOwnerMemberCount + pendingInviteCount;
  const inviteLimitReached = isFreePlan && totalInvited >= FREE_INVITE_LIMIT;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    try {
      setIsInviting(true);
      await organization?.inviteMember({ emailAddress: inviteEmail, role: inviteRole });
      setInviteEmail("");
      setIsInviteOpen(false);
      invitations?.revalidate?.();
    } catch (err: any) {
      setErrorMessage(err.errors?.[0]?.message || "Failed to invite user");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevoke = async (invitation: any) => {
    try {
      await invitation.revoke();
      invitations?.revalidate?.();
    } catch {
      setErrorMessage("Failed to revoke invitation");
    }
  };

  const handleUpdateRole = async (membership: any, newRole: "org:admin" | "org:member") => {
    try {
      await membership.update({ role: newRole });
      memberships?.revalidate?.();
    } catch {
      setErrorMessage("Failed to update role");
    }
  };

  const confirmRemoveMember = async () => {
    if (!removeMember) return;
    try {
      setIsRemoving(true);
      await removeMember.destroy();
      memberships?.revalidate?.();
    } catch {
      setErrorMessage("Failed to remove member");
    } finally {
      setIsRemoving(false);
      setRemoveMember(null);
    }
  };

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);

  // Build unified rows: members first, then pending invitations
  type UnifiedRow =
    | { kind: "member"; id: string; data: any }
    | { kind: "invitation"; id: string; data: any };

  const rows: UnifiedRow[] = [
    ...(memberships?.data?.map((m) => ({ kind: "member" as const, id: m.id, data: m })) ?? []),
    ...(invitations?.data?.map((i) => ({ kind: "invitation" as const, id: i.id, data: i })) ?? []),
  ];

  const totalCount = (memberships?.count ?? 0) + (invitations?.count ?? 0);

  return (
    <div className="grid gap-6">
      {/* Org card */}
      <div className="flex items-center gap-3">
        {organization.hasImage && organization.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={organization.imageUrl} alt={organization.name} className="h-10 w-10 rounded-lg object-cover" />
        ) : (
          <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-[#2B2B2B] text-fresco-tint font-semibold uppercase text-lg">
            {organization.name.charAt(0)}
          </div>
        )}
        <div>
          <h3 className={cn("font-sans text-[12px] font-medium leading-[1.6] text-fresco-title")}>{organization.name}</h3>
          <p className="text-[11px] text-fresco-description">Organization</p>
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className={cn("font-sans text-[12px] font-medium leading-[1.6] text-fresco-description")}>
          {totalCount} {totalCount === 1 ? "person" : "people"} in this workspace.
        </p>
        {isAdmin && (
          inviteLimitReached ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-fresco-description">
                Free plan allows 1 invited teammate.
              </span>
              <UpgradeButton label="Upgrade for unlimited members" size="sm" />
            </div>
          ) : (
            <Button onClick={() => setIsInviteOpen(true)} size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite
            </Button>
          )
        )}
      </div>

      {/* Unified table */}
      <div className="overflow-x-auto -mx-6">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.06)]">
              <th className="py-3 px-6 font-sans text-[12px] font-medium leading-[1.6] uppercase tracking-wider text-fresco-subtitle">User</th>
              <th className="py-3 px-6 font-sans text-[12px] font-medium leading-[1.6] uppercase tracking-wider text-fresco-subtitle">Status</th>
              <th className="py-3 px-6 font-sans text-[12px] font-medium leading-[1.6] uppercase tracking-wider text-fresco-subtitle">Date</th>
              <th className="py-3 px-6 font-sans text-[12px] font-medium leading-[1.6] uppercase tracking-wider text-fresco-subtitle">Role</th>
              <th className="py-3 px-6 font-sans text-[12px] font-medium leading-[1.6] uppercase tracking-wider text-fresco-subtitle text-right">Actions</th>
            </tr>
          </thead>
          <motion.tbody
            className="divide-y divide-[rgba(255,255,255,0.06)]"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          >
            <AnimatePresence mode="popLayout">
              {rows.map((row) => {
                if (row.kind === "member") {
                  const membership = row.data;
                  const isSelf = membership.publicUserData?.userId === user?.id;
                  return (
                    <motion.tr
                      key={`member-${row.id}`}
                      className="hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                      variants={{
                        hidden: { opacity: 0, filter: "blur(4px)", y: 10 },
                        visible: { opacity: 1, filter: "blur(0px)", y: 0 },
                      }}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, filter: "blur(4px)" }}
                    >
                      <td className="py-4 px-6 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={membership.publicUserData?.imageUrl || ""} alt="Avatar" className="h-8 w-8 rounded-full bg-[#2B2B2B] object-cover" />
                        <div className="flex flex-col">
                          <span className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title flex items-center gap-2">
                            {membership.publicUserData?.firstName} {membership.publicUserData?.lastName}
                            {isSelf && <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-normal">You</Badge>}
                          </span>
                          <span className="text-[11px] text-fresco-description">{membership.publicUserData?.identifier}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Badge variant="secondary" className="text-[10px] h-5 px-2 font-normal bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          Active
                        </Badge>
                      </td>
                      <td className="py-4 px-6 font-sans text-[12px] font-medium leading-[1.6] text-fresco-description">{formatDate(membership.createdAt)}</td>
                      <td className="py-4 px-6">
                        {isAdmin && !isSelf ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 text-xs gap-1 px-3">
                                {membership.role === "org:admin" ? "Admin" : "Member"}
                                <CaretDown className="h-3 w-3 opacity-50" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => handleUpdateRole(membership, "org:admin")}>Admin</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleUpdateRole(membership, "org:member")}>Member</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-description">{membership.role === "org:admin" ? "Admin" : "Member"}</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {isAdmin && !isSelf && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm"><DotsThree className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRemoveMember(membership)}>Remove User</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </motion.tr>
                  );
                }

                // Invitation row
                const invitation = row.data;
                return (
                  <motion.tr
                    key={`invite-${row.id}`}
                    className="hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                    variants={{
                      hidden: { opacity: 0, filter: "blur(4px)" },
                      visible: { opacity: 1, filter: "blur(0px)" },
                    }}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, filter: "blur(4px)" }}
                  >
                    <td className="py-4 px-6 flex items-center gap-3">
                      <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-[#2B2B2B] text-fresco-subtitle text-xs font-medium uppercase">
                        {invitation.emailAddress.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title">{invitation.emailAddress}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge variant="secondary" className="text-[10px] h-5 px-2 font-normal bg-amber-500/10 text-amber-400 border-amber-500/20">
                        Invited
                      </Badge>
                    </td>
                    <td className="py-4 px-6 font-sans text-[12px] font-medium leading-[1.6] text-fresco-description">{formatDate(invitation.createdAt)}</td>
                    <td className="py-4 px-6">
                      <span className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-description">{invitation.role === "org:admin" ? "Admin" : "Member"}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm"><DotsThree className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleRevoke(invitation)}>Revoke Invitation</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center font-sans text-[12px] font-medium leading-[1.6] text-fresco-description">No members found.</td></tr>
            )}
          </motion.tbody>
        </table>
      </div>

      {/* Error dialog */}
      <Dialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>{errorMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setErrorMessage(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm remove dialog */}
      <Dialog open={!!removeMember} onOpenChange={() => setRemoveMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {removeMember?.publicUserData?.identifier}? They will lose access to this workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveMember(null)} disabled={isRemoving}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemoveMember} disabled={isRemoving}>
              {isRemoving && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>Send an invitation email for someone to join {organization?.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label htmlFor="email" className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title">Email address</label>
                <Input id="email" type="email" required placeholder="name@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="!border-transparent !bg-[#2B2B2B] !text-fresco-text !shadow-none !rounded-lg placeholder:!text-[rgba(255,255,255,0.3)] focus-visible:!border-fresco-tint focus-visible:!shadow-none focus-visible:!outline-none" />
              </div>
              <div className="space-y-2">
                <label className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title">Role</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    aria-pressed={inviteRole === "org:admin"}
                    onClick={() => setInviteRole("org:admin")}
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-auto flex-col items-start gap-2.5 rounded-xl p-4 text-left transition-all",
                      inviteRole === "org:admin"
                        ? "border-fresco-tint bg-fresco-tint-dimmed ring-1 ring-fresco-tint"
                        : "border-[rgba(255,255,255,0.06)] bg-transparent hover:border-fresco-subtitle",
                    )}
                  >
                    <Shield weight={inviteRole === "org:admin" ? "fill" : "regular"} className={cn("h-5 w-5", inviteRole === "org:admin" ? "text-fresco-tint" : "text-fresco-subtitle")} />
                    <div className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title">Admin</div>
                  </Button>
                  <Button
                    aria-pressed={inviteRole === "org:member"}
                    onClick={() => setInviteRole("org:member")}
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-auto flex-col items-start gap-2.5 rounded-xl p-4 text-left transition-all",
                      inviteRole === "org:member"
                        ? "border-fresco-tint bg-fresco-tint-dimmed ring-1 ring-fresco-tint"
                        : "border-[rgba(255,255,255,0.06)] bg-transparent hover:border-fresco-subtitle",
                    )}
                  >
                    <User weight={inviteRole === "org:member" ? "fill" : "regular"} className={cn("h-5 w-5", inviteRole === "org:member" ? "text-fresco-tint" : "text-fresco-subtitle")} />
                    <div className="font-sans text-[12px] font-medium leading-[1.6] text-fresco-title">Member</div>
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isInviting}>
                {isInviting && <Spinner className="mr-2 h-4 w-4 animate-spin" />}
                Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
