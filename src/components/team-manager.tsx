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

import { cn } from "@/lib/utils";

export function TeamManager() {
  const { user } = useUser();
  const { organization, memberships, invitations, isLoaded } = useOrganization({
    memberships: { pageSize: 50, keepPreviousData: true },
    invitations: { pageSize: 50, keepPreviousData: true },
  });

  const [activeTab, setActiveTab] = useState<"members" | "invitations">("members");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"org:admin" | "org:member">("org:member");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  if (!isLoaded || !organization) {
    return <TeamManagerContentSkeleton />;
  }

  const isAdmin =
    memberships?.data?.find((m) => m.publicUserData?.userId === user?.id)?.role === "org:admin";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    try {
      setIsInviting(true);
      await organization.inviteMember({ emailAddress: inviteEmail, role: inviteRole });
      setInviteEmail("");
      setIsInviteOpen(false);
      invitations?.revalidate?.();
      setActiveTab("invitations");
    } catch (err: any) {
      alert(err.errors?.[0]?.message || "Failed to invite user");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevoke = async (invitation: any) => {
    try {
      await invitation.revoke();
      invitations?.revalidate?.();
    } catch (err: any) {
      alert("Failed to revoke invitation");
    }
  };

  const handleUpdateRole = async (membership: any, newRole: "org:admin" | "org:member") => {
    try {
      await membership.update({ role: newRole });
      memberships?.revalidate?.();
    } catch (err: any) {
      alert("Failed to update role");
    }
  };

  const handleRemove = async (membership: any) => {
    if (!confirm(`Are you sure you want to remove ${membership.publicUserData.identifier}?`)) return;
    try {
      await membership.destroy();
      memberships?.revalidate?.();
    } catch (err: any) {
      alert("Failed to remove member");
    }
  };

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);

  return (
    <div className="grid gap-6">
      {/* Org card */}
      <div className="flex items-center gap-3">
        {organization.hasImage && organization.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={organization.imageUrl} alt={organization.name} className="h-10 w-10 rounded-lg object-cover" />
        ) : (
          <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-[#2B2B2B] text-[color:var(--framer-fresco-tint-color)] font-semibold uppercase text-lg">
            {organization.name.charAt(0)}
          </div>
        )}
        <div>
          <h3 className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "text-[color:var(--framer-fresco-panelTitle-color)]")}>{organization.name}</h3>
          <p className="text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">Organization</p>
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "text-[color:var(--framer-fresco-panelDescription-color)]")}>
          Manage members and their roles.
        </p>
        {isAdmin && (
          <Button onClick={() => setIsInviteOpen(true)} size="sm" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Invite
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div
        aria-label="Team sections"
        className="flex items-center gap-8 border-b border-[rgba(255,255,255,0.06)]"
        role="tablist"
      >
        <Button
          aria-selected={activeTab === "members"}
          onClick={() => setActiveTab("members")}
          role="tab"
          size="sm"
          tabIndex={activeTab === "members" ? 0 : -1}
          type="button"
          variant="ghost"
          className={cn(
            "h-auto rounded-none border-x-0 border-t-0 border-b-2 bg-transparent px-0 pb-3 pt-0 font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)] shadow-none transition-colors hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 active:translate-y-0",
            activeTab === "members"
              ? "border-[color:var(--framer-fresco-tint-color)] text-[color:var(--framer-fresco-panelTitle-color)] focus-visible:border-[color:var(--framer-fresco-tint-color)]"
              : "border-transparent text-[color:var(--framer-fresco-panelSubtitle-color)] hover:text-[color:var(--framer-fresco-panelTitle-color)] focus-visible:border-transparent",
          )}
        >
          Members
          <Badge variant="secondary" className="ml-2 text-[10px] h-4 min-w-4 px-1 rounded-full">
            {memberships?.count ?? 0}
          </Badge>
        </Button>
        <Button
          aria-selected={activeTab === "invitations"}
          onClick={() => setActiveTab("invitations")}
          role="tab"
          size="sm"
          tabIndex={activeTab === "invitations" ? 0 : -1}
          type="button"
          variant="ghost"
          className={cn(
            "h-auto rounded-none border-x-0 border-t-0 border-b-2 bg-transparent px-0 pb-3 pt-0 font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)] shadow-none transition-colors hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 active:translate-y-0",
            activeTab === "invitations"
              ? "border-[color:var(--framer-fresco-tint-color)] text-[color:var(--framer-fresco-panelTitle-color)] focus-visible:border-[color:var(--framer-fresco-tint-color)]"
              : "border-transparent text-[color:var(--framer-fresco-panelSubtitle-color)] hover:text-[color:var(--framer-fresco-panelTitle-color)] focus-visible:border-transparent",
          )}
        >
          Invitations
          <Badge variant="secondary" className="ml-2 text-[10px] h-4 min-w-4 px-1 rounded-full">
            {invitations?.count ?? 0}
          </Badge>
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-6">
        <table className="w-full min-w-[500px] text-left">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.06)]">
              <th className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "py-3 px-6 uppercase tracking-wider text-[color:var(--framer-fresco-panelSubtitle-color)]")}>User</th>
              <th className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "py-3 px-6 uppercase tracking-wider text-[color:var(--framer-fresco-panelSubtitle-color)]")}>{activeTab === "members" ? "Joined" : "Invited"}</th>
              <th className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "py-3 px-6 uppercase tracking-wider text-[color:var(--framer-fresco-panelSubtitle-color)]")}>Role</th>
              <th className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "py-3 px-6 uppercase tracking-wider text-[color:var(--framer-fresco-panelSubtitle-color)] text-right")}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(255,255,255,0.06)]">
            {activeTab === "members" && memberships?.data?.map((membership) => {
              const isSelf = membership.publicUserData?.userId === user?.id;
              return (
                <tr key={membership.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="py-4 px-6 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={membership.publicUserData?.imageUrl || ""} alt="Avatar" className="h-8 w-8 rounded-full bg-[#2B2B2B] object-cover" />
                    <div className="flex flex-col">
                      <span className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "text-[color:var(--framer-fresco-panelTitle-color)] flex items-center gap-2")}>
                        {membership.publicUserData?.firstName} {membership.publicUserData?.lastName}
                        {isSelf && <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-normal">You</Badge>}
                      </span>
                      <span className="text-[11px] text-[color:var(--framer-fresco-panelDescription-color)]">{membership.publicUserData?.identifier}</span>
                    </div>
                  </td>
                  <td className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "py-4 px-6 text-[color:var(--framer-fresco-panelDescription-color)]")}>{formatDate(membership.createdAt)}</td>
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
                      <span className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "text-[color:var(--framer-fresco-panelDescription-color)]")}>{membership.role === "org:admin" ? "Admin" : "Member"}</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    {isAdmin && !isSelf && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm"><DotsThree className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleRemove(membership)}>Remove User</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
            {activeTab === "members" && memberships?.data?.length === 0 && (
              <tr><td colSpan={4} className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "py-8 text-center text-[color:var(--framer-fresco-panelDescription-color)]")}>No members found.</td></tr>
            )}
            {activeTab === "invitations" && invitations?.data?.map((invitation) => (
              <tr key={invitation.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                <td className="py-4 px-6"><span className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "text-[color:var(--framer-fresco-panelTitle-color)]")}>{invitation.emailAddress}</span></td>
                <td className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "py-4 px-6 text-[color:var(--framer-fresco-panelDescription-color)]")}>{formatDate(invitation.createdAt)}</td>
                <td className="py-4 px-6"><span className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "text-[color:var(--framer-fresco-panelDescription-color)]")}>{invitation.role === "org:admin" ? "Admin" : "Member"}</span></td>
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
              </tr>
            ))}
            {activeTab === "invitations" && invitations?.data?.length === 0 && (
              <tr><td colSpan={4} className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "py-8 text-center text-[color:var(--framer-fresco-panelDescription-color)]")}>No pending invitations.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invite dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>Send an invitation email for someone to join {organization.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label htmlFor="email" className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "text-[color:var(--framer-fresco-panelTitle-color)]")}>Email address</label>
                <Input id="email" type="email" required placeholder="name@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="!border-transparent !bg-[#2B2B2B] !text-[color:var(--framer-fresco-settingsText-color)] !shadow-none !rounded-lg placeholder:!text-[rgba(255,255,255,0.3)] focus-visible:!border-[var(--framer-fresco-tint-color)] focus-visible:!shadow-none focus-visible:!outline-none" />
              </div>
              <div className="space-y-2">
                <label className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "text-[color:var(--framer-fresco-panelTitle-color)]")}>Role</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    aria-pressed={inviteRole === "org:admin"}
                    onClick={() => setInviteRole("org:admin")}
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-auto flex-col items-start gap-2.5 rounded-xl p-4 text-left transition-all",
                      inviteRole === "org:admin"
                        ? "border-[color:var(--framer-fresco-tint-color)] bg-[color:var(--framer-fresco-tintDimmed-color)] ring-1 ring-[color:var(--framer-fresco-tint-color)]"
                        : "border-[rgba(255,255,255,0.06)] bg-transparent hover:border-[color:var(--framer-fresco-panelSubtitle-color)]",
                    )}
                  >
                    <Shield weight={inviteRole === "org:admin" ? "fill" : "regular"} className={cn("h-5 w-5", inviteRole === "org:admin" ? "text-[color:var(--framer-fresco-tint-color)]" : "text-[color:var(--framer-fresco-panelSubtitle-color)]")} />
                    <div className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "text-[color:var(--framer-fresco-panelTitle-color)]")}>Admin</div>
                  </Button>
                  <Button
                    aria-pressed={inviteRole === "org:member"}
                    onClick={() => setInviteRole("org:member")}
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-auto flex-col items-start gap-2.5 rounded-xl p-4 text-left transition-all",
                      inviteRole === "org:member"
                        ? "border-[color:var(--framer-fresco-tint-color)] bg-[color:var(--framer-fresco-tintDimmed-color)] ring-1 ring-[color:var(--framer-fresco-tint-color)]"
                        : "border-[rgba(255,255,255,0.06)] bg-transparent hover:border-[color:var(--framer-fresco-panelSubtitle-color)]",
                    )}
                  >
                    <User weight={inviteRole === "org:member" ? "fill" : "regular"} className={cn("h-5 w-5", inviteRole === "org:member" ? "text-[color:var(--framer-fresco-tint-color)]" : "text-[color:var(--framer-fresco-panelSubtitle-color)]")} />
                    <div className={cn("font-[Inter,system-ui,-apple-system,'system-ui','Segoe_UI',Roboto,Helvetica,Arial,sans-serif] text-[12px] font-medium leading-[1.6] text-[color:var(--framer-fresco-panelTitle-color)]", "text-[color:var(--framer-fresco-panelTitle-color)]")}>Member</div>
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
