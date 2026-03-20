'use client';
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from 'react';
import { useRouter } from 'next/navigation';

import { AIChatPanel } from '@/components/ai-chat-panel';
import { BlogTable } from '@/components/blog-table';
import { PostEditor } from '@/components/post-editor';
import {
	PlusIcon,
	MagnifyingGlassIcon,
	ChatCircleIcon,
} from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from '@/components/ui/sheet';
import type { BlogCollectionMetadata, BlogPostRecord } from '@/lib/cms-types';
import { ACTIVE_COLLECTION_COOKIE } from '@/lib/product-framer-shared';
import type { FramerCollectionOption, SiteRole } from '@/lib/product-types';
import { toggleRow, toggleAllRows, shiftClickRange } from '@/lib/selection';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const AI_CHAT_OPEN_STORAGE_KEY = 'lr:dashboard:ai-chat-open';

type DrawerState = { mode: 'create' } | { mode: 'edit'; postId: string };

function buildColumnOptions(metadata: BlogCollectionMetadata) {
	const titleFieldId = metadata.logicalFields.title;

	return [
		{ key: 'title', label: 'Title' },
		{ key: 'slug', label: 'Slug' },
		{ key: 'status', label: 'Status' },
		{ key: 'lastUpdated', label: 'Last updated' },
		...metadata.fields
			.filter((field) => field.id !== titleFieldId)
			.map((field) => ({
				key: `field:${field.id}`,
				label: field.name,
			})),
	];
}

function includesQuery(value: string | null | undefined, query: string) {
	if (!value) {
		return false;
	}

	return value.toLowerCase().includes(query);
}

function buildSearchText(
	post: BlogPostRecord,
	metadata: BlogCollectionMetadata,
) {
	const searchValues = [
		post.title,
		post.slug,
		post.lastUpdated,
		post.lastUpdatedBy,
	];

	for (const field of metadata.fields) {
		const value = post.fieldValues[field.id];

		if (
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			searchValues.push(String(value));
			continue;
		}

		if (Array.isArray(value)) {
			searchValues.push(
				value
					.map((entry) =>
						typeof entry === 'string' ? entry : (
							JSON.stringify(entry)
						),
					)
					.join(' '),
			);
		}
	}

	return searchValues
		.filter(
			(value): value is string =>
				typeof value === 'string' && value.length > 0,
		)
		.join('\n')
		.toLowerCase();
}

function buildSearchIndex(
	posts: BlogPostRecord[],
	metadata: BlogCollectionMetadata,
) {
	return posts.map((post) => ({
		post,
		searchText: buildSearchText(post, metadata),
	}));
}

function sortPostsByRecency(posts: BlogPostRecord[]) {
	return [...posts].sort((left, right) => {
		if (left.draft !== right.draft) {
			return left.draft ? -1 : 1;
		}

		const leftDate = Date.parse(left.date ?? left.lastUpdated ?? '') || 0;
		const rightDate =
			Date.parse(right.date ?? right.lastUpdated ?? '') || 0;
		return rightDate - leftDate;
	});
}

function upsertCachedPost(posts: BlogPostRecord[], nextPost: BlogPostRecord) {
	const remaining = posts.filter((post) => post.id !== nextPost.id);
	return sortPostsByRecency([...remaining, nextPost]);
}

function getDrawerPath(drawerState: DrawerState | null) {
	if (!drawerState) {
		return '/dashboard';
	}

	if (drawerState.mode === 'create') {
		return '/dashboard/posts/new';
	}

	return `/dashboard/posts/${drawerState.postId}`;
}

function parseDrawerState(pathname: string): DrawerState | null {
	if (pathname === '/dashboard/posts/new') {
		return { mode: 'create' };
	}

	if (pathname.startsWith('/dashboard/posts/')) {
		return {
			mode: 'edit',
			postId: pathname.slice('/dashboard/posts/'.length),
		};
	}

	return null;
}

function matchesSearch(searchText: string, rawQuery: string) {
	const query = rawQuery.trim().toLowerCase();
	if (!query) {
		return true;
	}

	return includesQuery(searchText, query);
}

function readStoredAIChatOpen() {
	if (typeof window === 'undefined') {
		return false;
	}

	return window.localStorage.getItem(AI_CHAT_OPEN_STORAGE_KEY) === 'true';
}

function CollectionTableSkeleton() {
	return (
		<div className='px-5 py-5'>
			<div className='mb-5 flex items-center gap-2 text-sm text-[color:var(--framer-fresco-panelDescription-color)]'>
				<Spinner className='size-4' />
				<span>Loading collection…</span>
			</div>
			<div className='overflow-hidden rounded-2xl border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)]'>
				<div className='grid grid-cols-[minmax(220px,2.2fr)_minmax(160px,1.2fr)_minmax(140px,0.9fr)_minmax(180px,1.1fr)] border-b border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-subtle-color)] px-6 py-4'>
					{Array.from({ length: 4 }).map((_, index) => (
						<div
							key={`header-${index}`}
							className='h-3.5 w-20 animate-pulse rounded-full bg-[var(--framer-fresco-panelDivider-color)]/70'
						/>
					))}
				</div>
				<div className='px-6 py-4'>
					{Array.from({ length: 8 }).map((_, rowIndex) => (
						<div
							key={`row-${rowIndex}`}
							className='grid grid-cols-[minmax(220px,2.2fr)_minmax(160px,1.2fr)_minmax(140px,0.9fr)_minmax(180px,1.1fr)] gap-6 border-b border-[var(--framer-fresco-panelDivider-color)]/70 py-4 last:border-b-0'
						>
							<div className='h-4 w-3/4 animate-pulse rounded-full bg-[var(--framer-app-surface-muted-color)]' />
							<div className='h-4 w-5/6 animate-pulse rounded-full bg-[var(--framer-app-surface-muted-color)]' />
							<div className='h-7 w-20 animate-pulse rounded-full bg-[var(--framer-app-surface-muted-color)]' />
							<div className='h-4 w-2/3 animate-pulse rounded-full bg-[var(--framer-app-surface-muted-color)]' />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export function DashboardTableView({
	activeCollectionId,
	bridgeStatus,
	collections,
	framerStatus,
	initialDrawerState = null,
	metadata,
	posts,
	role,
}: {
	activeCollectionId: string;
	bridgeStatus?: {
		configured: boolean;
		issues: Array<{ path: string; message: string }>;
		webhookPath: string;
		manualSyncPath: string;
		dataSourceId: string | null;
		statusPropertyName: string;
		approvedStatusValue: string;
		slugPropertyName: string;
		framerItemIdPropertyName: string;
		fieldMap: Record<string, string>;
	};
	collections: FramerCollectionOption[];
	framerStatus: {
		cachedAt: string | null;
		state: 'available' | 'stale';
	};
	initialDrawerState?: DrawerState | null;
	metadata: BlogCollectionMetadata;
	posts: BlogPostRecord[];
	role: SiteRole;
}) {
	const router = useRouter();
	const framerUnavailable = framerStatus.state !== 'available';
	const columnOptions = buildColumnOptions(metadata);
	const [cachedPosts, setCachedPosts] = useState(() =>
		sortPostsByRecency(posts),
	);
	const [drawerState, setDrawerState] = useState<DrawerState | null>(
		initialDrawerState,
	);
	const [loadingPosts, setLoadingPosts] = useState<Set<string>>(new Set());
	const [editorRevision, setEditorRevision] = useState(0);
	const [query, setQuery] = useState('');
	const [page, setPage] = useState(1);
	const [activeCollectionSelection, setActiveCollectionSelection] =
		useState(activeCollectionId);
	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
	const [chatOpen, setChatOpen] = useState(readStoredAIChatOpen);
	const lastClickedIndexRef = useRef<number | null>(null);
	const [searchIndex, setSearchIndex] = useState(() =>
		buildSearchIndex(posts, metadata),
	);
	const [pendingCollectionId, setPendingCollectionId] = useState<
		string | null
	>(null);
	const [isCollectionTransitionPending, startCollectionTransition] =
		useTransition();
	const deferredQuery = useDeferredValue(query);

	useEffect(() => {
		if (window.location.search) {
			window.history.replaceState(null, '', window.location.pathname);
		}
	}, []);

	useEffect(() => {
		setCachedPosts(sortPostsByRecency(posts));
	}, [posts]);

	useEffect(() => {
		setActiveCollectionSelection(activeCollectionId);
	}, [activeCollectionId]);

	useEffect(() => {
		if (pendingCollectionId === activeCollectionId) {
			setPendingCollectionId(null);
		}
	}, [activeCollectionId, pendingCollectionId]);

	useEffect(() => {
		setSearchIndex(buildSearchIndex(cachedPosts, metadata));
	}, [cachedPosts, metadata]);

	useEffect(() => {
		window.localStorage.setItem(
			AI_CHAT_OPEN_STORAGE_KEY,
			chatOpen ? 'true' : 'false',
		);
	}, [chatOpen]);

	useEffect(() => {
		const handlePopState = () => {
			setDrawerState(parseDrawerState(window.location.pathname));
		};

		window.addEventListener('popstate', handlePopState);
		return () => {
			window.removeEventListener('popstate', handlePopState);
		};
	}, []);

	useEffect(() => {
		function handleKeyboardShortcuts(event: KeyboardEvent) {
			if (!(event.metaKey || event.ctrlKey)) return;

			const key = event.key.toLowerCase();

			// Cmd+K → toggle AI chat panel
			if (key === 'k') {
				event.preventDefault();
				setChatOpen((prev) => !prev);
				return;
			}

			// Cmd+\ → focus search
			if (key === '\\') {
				const target = event.target as HTMLElement | null;
				if (
					target instanceof HTMLInputElement ||
					target instanceof HTMLTextAreaElement ||
					target?.isContentEditable
				) {
					return;
				}
				event.preventDefault();
				searchInputRef.current?.focus();
				searchInputRef.current?.select();
			}
		}

		window.addEventListener('keydown', handleKeyboardShortcuts);
		return () => {
			window.removeEventListener('keydown', handleKeyboardShortcuts);
		};
	}, []);

	// Emit wide event when selection changes
	useEffect(() => {
		console.log(
			JSON.stringify({
				ts: new Date().toISOString(),
				level: 'info',
				event: 'dashboard.rows.selected',
				count: selectedRows.size,
			}),
		);
	}, [selectedRows]);

	function commitDrawerState(
		nextDrawerState: DrawerState | null,
		historyMode: 'push' | 'replace' = 'push',
	) {
		setDrawerState(nextDrawerState);

		if (typeof window === 'undefined') {
			return;
		}

		const nextPath = getDrawerPath(nextDrawerState);
		if (window.location.pathname === nextPath) {
			return;
		}

		window.history[
			historyMode === 'replace' ? 'replaceState' : 'pushState'
		](null, '', nextPath);
	}

	function handleOpenCreate() {
		if (framerUnavailable) {
			return;
		}
		commitDrawerState({ mode: 'create' });
	}

	function handleCollectionChange(nextCollectionId: string) {
		if (framerUnavailable) {
			return;
		}
		if (nextCollectionId === activeCollectionSelection) {
			return;
		}
		setActiveCollectionSelection(nextCollectionId);
		setPendingCollectionId(nextCollectionId);
		setSelectedRows(new Set());
		lastClickedIndexRef.current = null;
		document.cookie = `${ACTIVE_COLLECTION_COOKIE}=${encodeURIComponent(nextCollectionId)}; path=/; max-age=31536000; samesite=lax`;
		startCollectionTransition(() => {
			router.push(
				`/dashboard?collectionId=${encodeURIComponent(nextCollectionId)}`,
			);
			router.refresh();
		});
	}

	function handleOpenPost(postId: string) {
		commitDrawerState({ mode: 'edit', postId });
	}

	function handleCloseDrawer() {
		commitDrawerState(null, 'replace');
	}

	function handlePostSaved(
		nextPost: BlogPostRecord,
		saveMode: 'create' | 'edit',
	) {
		setCachedPosts((current) => upsertCachedPost(current, nextPost));
		setEditorRevision((current) => current + 1);
		commitDrawerState(
			{ mode: 'edit', postId: nextPost.id },
			saveMode === 'create' ? 'replace' : 'replace',
		);
	}

	const filteredPosts =
		deferredQuery.trim() ?
			searchIndex
				.filter((entry) =>
					matchesSearch(entry.searchText, deferredQuery),
				)
				.map((entry) => entry.post)
		:	cachedPosts;
	const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
	const currentPage = Math.min(totalPages, Math.max(1, page));
	const startIndex = (currentPage - 1) * PAGE_SIZE;
	const visiblePosts = filteredPosts.slice(
		startIndex,
		startIndex + PAGE_SIZE,
	);
	const visiblePostIds = visiblePosts.map((post) => post.id);

	function handleToggleRow(rowId: string) {
		setSelectedRows((current) => toggleRow(current, rowId));
		const idx = visiblePostIds.indexOf(rowId);
		if (idx !== -1) {
			lastClickedIndexRef.current = idx;
		}
	}

	function handleToggleAll(visibleRowIds: string[]) {
		setSelectedRows((current) => toggleAllRows(current, visibleRowIds));
		lastClickedIndexRef.current = null;
	}

	function handleShiftClick(rowId: string) {
		const clickedIndex = visiblePostIds.indexOf(rowId);
		if (clickedIndex === -1) return;
		const lastIndex = lastClickedIndexRef.current ?? clickedIndex;
		setSelectedRows((current) =>
			shiftClickRange(current, visiblePostIds, lastIndex, clickedIndex),
		);
		lastClickedIndexRef.current = clickedIndex;
	}

	function handleClearSelection() {
		setSelectedRows(new Set());
		lastClickedIndexRef.current = null;
	}

	const selectedPosts = useMemo(
		() => cachedPosts.filter((p) => selectedRows.has(p.id)),
		[cachedPosts, selectedRows],
	);

	const handlePostsUpdated = useCallback((updatedPosts: BlogPostRecord[]) => {
		setCachedPosts((current) => {
			const updated = new Map(updatedPosts.map((p) => [p.id, p]));
			return current.map((p) => updated.get(p.id) ?? p);
		});
	}, []);

	const activeColumns = columnOptions;
	const isDrawerRoute = drawerState !== null;
	const activePostId =
		drawerState?.mode === 'edit' ? drawerState.postId : null;
	const activePost =
		activePostId ?
			(cachedPosts.find((post) => post.id === activePostId) ?? null)
		:	null;
	const isCreateRoute = drawerState?.mode === 'create';
	const pageOptions = Array.from(
		{ length: totalPages },
		(_, index) => index + 1,
	);
	const isCollectionLoading =
		pendingCollectionId !== null || isCollectionTransitionPending;

	return (
		<section className='relative min-w-0 overflow-x-clip'>
			<div className='min-h-full min-w-0 bg-[var(--framer-fresco-panelBackground-color)] shadow-[inset_0_1px_0_var(--framer-app-frame-overlay-color)] md:border md:border-[var(--framer-fresco-panelDivider-color)]'>
				<div
					className='sticky top-0 z-20 border-b border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)]'
				>
					<div className='flex flex-wrap items-start gap-2.5 border-b border-[var(--framer-fresco-panelDivider-color)] p-4 md:items-center'>
						<Button
							className='!h-11 gap-2.5 !rounded-full px-4 text-sm font-semibold'
							disabled={framerUnavailable}
							onClick={handleOpenCreate}
							size='default'
							variant='outline'
						>
							<span
								aria-hidden='true'
								className='inline-flex items-center justify-center'
							>
								<PlusIcon weight='bold' />
							</span>
							<span>New Item</span>
						</Button>
						{collections.length > 1 ?
							<Select
								disabled={framerUnavailable}
								onValueChange={handleCollectionChange}
								value={activeCollectionSelection}
							>
								<SelectTrigger
									aria-label='Select collection'
									className='!h-11 min-w-48 !rounded-full px-4 py-0 text-sm font-semibold'
									size='default'
								>
									<SelectValue placeholder='Select collection' />
								</SelectTrigger>
								<SelectContent>
									{collections.map((collection) => (
										<SelectItem
											key={collection.id}
											value={collection.id}
										>
											{collection.name}
											{/* <span className='text-sm text-[color:var(--framer-fresco-panelDescription-color)]'>
												{filteredPosts.length} result
												{filteredPosts.length === 1 ?
													''
												:	's'}
											</span> */}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						:	null}
						<label
							className='relative flex h-11 min-w-0 w-full items-center gap-2 rounded-full border border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-3 text-[color:var(--framer-fresco-panelSubtitle-color)] transition-colors focus-within:border-[var(--framer-fresco-tint-color)] md:w-auto md:flex-[0_1_36rem] md:max-w-xl'
							htmlFor='dashboard-search'
						>
							<MagnifyingGlassIcon className='size-4 shrink-0' />
							<input
								aria-label='Search items'
								className='h-full min-w-0 flex-1 bg-transparent px-1 py-0 text-sm text-[color:var(--framer-fresco-settingsText-color)] outline-none placeholder:text-[color:var(--framer-fresco-panelSubtitle-color)]'
								id='dashboard-search'
								onChange={(event) => {
									setQuery(event.target.value);
									setPage(1);
								}}
								placeholder='Search…'
								ref={searchInputRef}
								value={query}
							/>
							<KbdGroup className='hidden shrink-0 sm:inline-flex'>
								<Kbd className='text-[color:var(--framer-fresco-panelSubtitle-color)]'>
									{(
										typeof navigator !== 'undefined' &&
										/mac/i.test(navigator.platform)
									) ?
										'⌘'
									:	'Ctrl'}
								</Kbd>
								<Kbd className='text-[color:var(--framer-fresco-panelSubtitle-color)]'>
									\
								</Kbd>
							</KbdGroup>
						</label>
						<div className='flex flex-wrap items-center gap-2.5 md:ml-auto'>
							{bridgeStatus ?
								<Badge
									className='flex h-11 items-center gap-2.5 rounded-full border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-app-surface-muted-color)] px-4 text-[13px] font-semibold text-[color:var(--framer-fresco-panelDescription-color)]'
									variant='outline'
								>
									<span
										aria-hidden='true'
										className={cn(
											'inline-flex size-2 rounded-full',
											bridgeStatus.configured ?
												'framer-live-dot'
											:	'bg-[var(--framer-fresco-panelSubtitle-color)]',
										)}
									/>
									{bridgeStatus.configured ?
										'Bridge Ready'
									:	'Manual Mode'}
								</Badge>
							:	null}
							<Button
								aria-label='Open AI chat'
								className='h-11 gap-2.5 rounded-full px-4 text-sm font-semibold'
								disabled={framerUnavailable}
								onClick={() => setChatOpen(true)}
								size='sm'
								type='button'
								variant='default'
							>
								<ChatCircleIcon
									className='size-5'
									weight='duotone'
								/>
								<span>AI Assistant</span>
							</Button>
							{/* <DashboardAccountLink /> */}
						</div>
					</div>
				</div>

				<div className='min-w-0'>
					{isCollectionLoading ?
						<CollectionTableSkeleton />
					:	<BlogTable
							activePostId={activePostId}
							actionsDisabled={framerUnavailable}
							columns={activeColumns}
							metadata={metadata}
							onOpenPost={handleOpenPost}
						posts={visiblePosts}
						role={role}
						loadingPosts={loadingPosts}
						selectedRows={selectedRows}
						onToggleRow={handleToggleRow}
						onToggleAll={handleToggleAll}
							onShiftClick={handleShiftClick}
							onDraftToggle={async (post) => {
								if (framerUnavailable) {
									return;
								}
								setLoadingPosts((prev) =>
									new Set(prev).add(post.id),
								);
								try {
									const response = await fetch(
										`/api/posts/${post.id}`,
										{
											method: 'PUT',
											headers: {
												'Content-Type':
													'application/json',
											},
											body: JSON.stringify({
												slug: post.slug,
												draft: !post.draft,
												fieldValues: post.fieldValues,
											}),
										},
									);
									if (response.ok) {
										const { post: nextPost } =
											await response.json();
										setCachedPosts((current) =>
											upsertCachedPost(
												current,
												nextPost,
											),
										);
									}
								} catch (error) {
									console.error(
										'Failed to toggle draft status',
										error,
									);
								} finally {
									setLoadingPosts((prev) => {
										const next = new Set(prev);
										next.delete(post.id);
										return next;
									});
								}
							}}
							onDelete={async (postId) => {
								if (framerUnavailable) {
									return;
								}
								setLoadingPosts((prev) =>
									new Set(prev).add(postId),
								);
								try {
									const response = await fetch(
										`/api/posts/${postId}`,
										{ method: 'DELETE' },
									);
									if (response.ok) {
										setCachedPosts((current) =>
											current.filter(
												(post) =>
													post.id !== postId,
											),
										);
									}
								} catch (error) {
									console.error(
										'Failed to delete post',
										error,
									);
								} finally {
									setLoadingPosts((prev) => {
										const next = new Set(prev);
										next.delete(postId);
										return next;
									});
								}
							}}
						/>
					}
				</div>

				<div className='flex flex-col gap-4 border-t border-[var(--framer-fresco-panelDivider-color)] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between'>
					<div className='text-sm text-[color:var(--framer-fresco-panelDescription-color)]'>
						{isCollectionLoading ?
							'Loading collection…'
						: filteredPosts.length === 0 ?
							'Showing 0 of 0'
						:	`Showing ${startIndex + 1}-${startIndex + visiblePosts.length} of ${filteredPosts.length}`
						}
					</div>

					{!isCollectionLoading && totalPages > 1 ?
						<div className='flex flex-wrap items-center gap-2.5 sm:justify-end'>
							<Button
								disabled={currentPage === 1}
								onClick={() =>
									setPage((value) => Math.max(1, value - 1))
								}
								size='sm'
								type='button'
								variant='outline'
							>
								Previous
							</Button>
							<Select
								onValueChange={(value) => {
									setPage(Number(value));
								}}
								value={String(currentPage)}
							>
								<SelectTrigger
									aria-label='Select page'
									className='min-w-32 text-[color:var(--framer-fresco-settingsText-color)]'
									size='sm'
								>
									<SelectValue
										placeholder={`Page ${currentPage}`}
									/>
								</SelectTrigger>
								<SelectContent>
									{pageOptions.map((pageNumber) => (
										<SelectItem
											key={pageNumber}
											value={String(pageNumber)}
										>
											Page {pageNumber}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<span className='text-sm text-[color:var(--framer-fresco-panelDescription-color)]'>
								of {totalPages}
							</span>
							<Button
								disabled={currentPage === totalPages}
								onClick={() =>
									setPage((value) =>
										Math.min(totalPages, value + 1),
									)
								}
								size='sm'
								type='button'
								variant='outline'
							>
								Next
							</Button>
						</div>
					:	null}
				</div>
			</div>

			<Sheet
				onOpenChange={(open) => {
					if (!open) {
						handleCloseDrawer();
					}
				}}
				open={isDrawerRoute}
			>
				<SheetContent
					className='gap-0 overflow-hidden border-[var(--framer-fresco-panelDivider-color)] bg-[var(--framer-fresco-panelBackground-color)] p-0 text-[color:var(--framer-fresco-panelTitle-color)] shadow-[-40px_0_120px_rgba(0,0,0,0.55)] data-[side=right]:w-full data-[side=right]:sm:max-w-none md:data-[side=right]:top-2 md:data-[side=right]:right-2 md:data-[side=right]:bottom-2 md:data-[side=right]:w-[min(72vw,920px)] xl:data-[side=right]:w-[min(56vw,980px)]'
					showCloseButton={false}
					side='right'
				>
					<SheetTitle className='sr-only'>
						{isCreateRoute ?
							'Create post'
						: activePost ?
							`Edit ${activePost.title}`
						:	'Post editor'}
					</SheetTitle>
					<SheetDescription className='sr-only'>
						Review and edit the selected CMS entry in a side drawer.
					</SheetDescription>
					<div className='flex min-h-0 flex-1 [&>*]:min-w-0 [&>*]:flex-1'>
						{isCreateRoute ?
							<PostEditor
								framerUnavailable={framerUnavailable}
								key={`new:${editorRevision}`}
								metadata={metadata}
								mode='create'
								onClose={handleCloseDrawer}
								onPostSaved={handlePostSaved}
								post={null}
							/>
						: activePost ?
							<PostEditor
								framerUnavailable={framerUnavailable}
								key={`${activePost.id}:${editorRevision}`}
								metadata={metadata}
								mode='edit'
								onClose={handleCloseDrawer}
								onPostSaved={handlePostSaved}
								post={activePost}
							/>
						:	<div className='flex h-full flex-col gap-3.5 p-7'>
								<span className='framer-kicker w-fit'>
									Unavailable
								</span>
								<h2 className='font-heading text-3xl leading-tight text-[color:var(--framer-fresco-panelTitle-color)]'>
									This item is not in the preloaded set.
								</h2>
								<p className='text-sm leading-6 text-[color:var(--framer-fresco-panelDescription-color)]'>
									The drawer keeps item data in memory, but
									this entry is not available in the current
									client cache.
								</p>
								<Button
									onClick={handleCloseDrawer}
									size='sm'
									type='button'
									variant='outline'
								>
									Close
								</Button>
							</div>
						}
					</div>
				</SheetContent>
			</Sheet>

			<AIChatPanel
				metadata={metadata}
				onOpenChange={setChatOpen}
				onPostsUpdated={handlePostsUpdated}
				onClearSelection={handleClearSelection}
				open={chatOpen}
				selectedPosts={selectedPosts}
			/>
		</section>
	);
}
