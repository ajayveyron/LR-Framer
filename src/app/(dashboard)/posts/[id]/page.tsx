import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard?action=edit&id=${encodeURIComponent(id)}`);
}
