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
import { cn } from "@/lib/utils";

export function TeamManager() {
  const { user } = useUser();
  const { organization, memberships, invitations, isLoaded } = useOrganization({
    memberships: {
      pageSize: 50,
      keepPreviousData: true,
    },
    invitations: {
      pageSize: 50,
      keepPreviousData: true,
    },
  });

  const [activeTab, setActiveTab] = useState<"members" | "invitations">(
    "members",
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"org:admin" | "org:member">(
    "org:member",
  );
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // Loading state
  if (!isLoaded || !organization) {
    return (
      <div className="flex justify-center p-12">
        <Spinner className="h-8 w-8 animate-spin text-[color:var(--framer-fresco-panelSubtitle-color)]" />
      </div>
    );
  }

  // Admin check for currently active user
  const isAdmin =
    memberships?.data?.find((m) => m.publicUserData?.userId === user?.id)
      ?.role === "org:admin";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      setIsInviting(true);
      await organization.inviteMember({
        emailAddress: inviteEmail,
        role: inviteRole,
      });
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

  const handleUpdateRole = async (
    membership: any,
    newRole: "org:admin" | "org:member",
  ) => {
    try {
      await membership.update({ role: newRole });
      memberships?.revalidate?.();
    } catch (err: any) {
      alert("Failed to update role");
    }
  };

  const handleRemove = async (membership: any) => {
    if (
      !confirm(
        `Are you sure you want to remove ${membership.publicUserData.identifier}?`,
      )
    )
      return;
    try {
      await membership.destroy();
      memberships?.revalidate?.();
    } catch (err: any) {
      alert("Failed to remove member");
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
    }).format(date);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar / Organization Details block mimicking Clerk's layout */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="flex flex-col gap-4 p-4 border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] rounded-xl">
          <div className="flex items-center gap-3">
            {organization.hasImage && organization.imageUrl ? (
              <img
                src={organization.imageUrl}
                alt={organization.name}
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-[color:var(--framer-fresco-tintDimmed-color)] border border-[var(--framer-fresco-panelDivider-color)] text-[color:var(--framer-fresco-tint-color)] font-semibold uppercase text-lg">
                {organization.name.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="font-semibold text-[color:var(--framer-fresco-panelTitle-color)]">
                {organization.name}
              </h3>
              <p className="text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
                Organization
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] rounded-xl overflow-hidden shadow-sm">
        {/* Header & Tabs */}
        <div className="border-b border-[var(--framer-fresco-panelDivider-color)]">
          <div className="flex items-center justify-between p-4 md:p-6 pb-0">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--framer-fresco-panelTitle-color)]">
                Members
              </h2>
              <p className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
                Manage your organization members and their roles.
              </p>
            </div>
            {isAdmin && (
              <Button
                onClick={() => setIsInviteOpen(true)}
                size="sm"
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Invite
              </Button>
            )}
          </div>

          <div className="flex items-center gap-6 px-4 md:px-6 pt-6">
            <button
              onClick={() => setActiveTab("members")}
              className={cn(
                "pb-3 text-sm font-medium transition-colors border-b-2",
                activeTab === "members"
                  ? "border-[color:var(--framer-fresco-tint-color)] text-[color:var(--framer-fresco-panelTitle-color)]"
                  : "border-transparent text-[color:var(--framer-fresco-panelSubtitle-color)] hover:text-[color:var(--framer-fresco-panelTitle-color)]",
              )}
            >
              Members
              <Badge
                variant="secondary"
                className="ml-2 text-[10px] h-4 min-w-4 px-1 rounded-full"
              >
                {memberships?.count ?? 0}
              </Badge>
            </button>
            <button
              onClick={() => setActiveTab("invitations")}
              className={cn(
                "pb-3 text-sm font-medium transition-colors border-b-2",
                activeTab === "invitations"
                  ? "border-[color:var(--framer-fresco-tint-color)] text-[color:var(--framer-fresco-panelTitle-color)]"
                  : "border-transparent text-[color:var(--framer-fresco-panelSubtitle-color)] hover:text-[color:var(--framer-fresco-panelTitle-color)]",
              )}
            >
              Invitations
              <Badge
                variant="secondary"
                className="ml-2 text-[10px] h-4 min-w-4 px-1 rounded-full"
              >
                {invitations?.count ?? 0}
              </Badge>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full min-w-[500px] text-left">
            <thead>
              <tr className="border-b border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-subtle-color)]">
                <th className="py-3 px-6 text-xs font-semibold text-[color:var(--framer-fresco-panelSubtitle-color)] uppercase tracking-wider">
                  User
                </th>
                <th className="py-3 px-6 text-xs font-semibold text-[color:var(--framer-fresco-panelSubtitle-color)] uppercase tracking-wider">
                  {activeTab === "members" ? "Joined" : "Invited"}
                </th>
                <th className="py-3 px-6 text-xs font-semibold text-[color:var(--framer-fresco-panelSubtitle-color)] uppercase tracking-wider">
                  Role
                </th>
                <th className="py-3 px-6 text-xs font-semibold text-[color:var(--framer-fresco-panelSubtitle-color)] uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--framer-fresco-panelDivider-color)]">
              {activeTab === "members" &&
                memberships?.data?.map((membership) => {
                  const isSelf = membership.publicUserData?.userId === user?.id;

                  return (
                    <tr
                      key={membership.id}
                      className="hover:bg-[var(--framer-app-surface-subtle-color)] transition-colors"
                    >
                      <td className="py-4 px-6 flex items-center gap-3">
                        <img
                          src={membership.publicUserData?.imageUrl || ""}
                          alt="Avatar"
                          className="h-8 w-8 rounded-full bg-[var(--framer-fresco-panelDivider-color)] object-cover"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[color:var(--framer-fresco-panelTitle-color)] flex items-center gap-2">
                            {membership.publicUserData?.firstName}{" "}
                            {membership.publicUserData?.lastName}
                            {isSelf && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-4.5 px-1.5 font-normal"
                              >
                                You
                              </Badge>
                            )}
                          </span>
                          <span className="text-xs text-[color:var(--framer-fresco-panelDescription-color)]">
                            {membership.publicUserData?.identifier}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
                        {formatDate(membership.createdAt)}
                      </td>
                      <td className="py-4 px-6">
                        {isAdmin && !isSelf ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1 px-3"
                              >
                                {membership.role === "org:admin"
                                  ? "Admin"
                                  : "Member"}
                                <CaretDown className="h-3 w-3 opacity-50" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleUpdateRole(membership, "org:admin")
                                }
                              >
                                Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleUpdateRole(membership, "org:member")
                                }
                              >
                                Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
                            {membership.role === "org:admin"
                              ? "Admin"
                              : "Member"}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {isAdmin && !isSelf && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <DotsThree className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleRemove(membership)}
                              >
                                Remove User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  );
                })}

              {activeTab === "members" && memberships?.data?.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-sm text-[color:var(--framer-fresco-panelDescription-color)]"
                  >
                    No members found.
                  </td>
                </tr>
              )}

              {activeTab === "invitations" &&
                invitations?.data?.map((invitation) => (
                  <tr
                    key={invitation.id}
                    className="hover:bg-[var(--framer-app-surface-subtle-color)] transition-colors"
                  >
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-[color:var(--framer-fresco-panelTitle-color)]">
                        {invitation.emailAddress}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
                      {formatDate(invitation.createdAt)}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-[color:var(--framer-fresco-panelDescription-color)]">
                        {invitation.role === "org:admin" ? "Admin" : "Member"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <DotsThree className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleRevoke(invitation)}
                            >
                              Revoke Invitation
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}

              {activeTab === "invitations" &&
                invitations?.data?.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-sm text-[color:var(--framer-fresco-panelDescription-color)]"
                    >
                      No pending invitations.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send an invitation email for someone to join {organization.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-[color:var(--framer-fresco-panelTitle-color)]"
                >
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-transparent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[color:var(--framer-fresco-panelTitle-color)]">
                  Role
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInviteRole("org:admin")}
                    className={cn(
                      "flex flex-col items-start gap-2.5 p-4 rounded-xl border text-left transition-all",
                      inviteRole === "org:admin"
                        ? "border-[color:var(--framer-fresco-tint-color)] bg-[color:var(--framer-fresco-tintDimmed-color)] ring-1 ring-[color:var(--framer-fresco-tint-color)]"
                        : "border-[var(--framer-fresco-panelDivider-color)] bg-transparent hover:border-[color:var(--framer-fresco-panelSubtitle-color)]",
                    )}
                  >
                    <Shield
                      weight={inviteRole === "org:admin" ? "fill" : "regular"}
                      className={cn(
                        "h-5 w-5",
                        inviteRole === "org:admin"
                          ? "text-[color:var(--framer-fresco-tint-color)]"
                          : "text-[color:var(--framer-fresco-panelSubtitle-color)]",
                      )}
                    />
                    <div>
                      <div className="text-sm font-semibold text-[color:var(--framer-fresco-panelTitle-color)]">
                        Admin
                      </div>
                      {/* <div className="text-xs text-[color:var(--framer-fresco-panelDescription-color)] mt-0.5 leading-relaxed">
                        Full access to settings and team.
                      </div> */}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteRole("org:member")}
                    className={cn(
                      "flex flex-col items-start gap-2.5 p-4 rounded-xl border text-left transition-all",
                      inviteRole === "org:member"
                        ? "border-[color:var(--framer-fresco-tint-color)] bg-[color:var(--framer-fresco-tintDimmed-color)] ring-1 ring-[color:var(--framer-fresco-tint-color)]"
                        : "border-[var(--framer-fresco-panelDivider-color)] bg-transparent hover:border-[color:var(--framer-fresco-panelSubtitle-color)]",
                    )}
                  >
                    <User
                      weight={inviteRole === "org:member" ? "fill" : "regular"}
                      className={cn(
                        "h-5 w-5",
                        inviteRole === "org:member"
                          ? "text-[color:var(--framer-fresco-tint-color)]"
                          : "text-[color:var(--framer-fresco-panelSubtitle-color)]",
                      )}
                    />
                    <div>
                      <div className="text-sm font-semibold text-[color:var(--framer-fresco-panelTitle-color)]">
                        Member
                      </div>
                      {/* <div className="text-xs text-[color:var(--framer-fresco-panelDescription-color)] mt-0.5 leading-relaxed">
                        Can create and publish posts.
                      </div> */}
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isInviting}>
                {isInviting && (
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
