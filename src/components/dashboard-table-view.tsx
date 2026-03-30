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
import { AIWorkspacePane } from '@/components/ai-workspace-pane';
import { BlogTable } from '@/components/blog-table';
import { PostEditor } from '@/components/post-editor';
import {
	PlusIcon,
	MagnifyingGlassIcon,
	ChatCircleIcon,
	ArrowsClockwiseIcon,
	TrashIcon,
	ArrowFatUpIcon,
	ArrowFatDownIcon,
	XIcon,
	CaretDownIcon,
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from '@/components/ui/sheet';
import type { BlogCollectionMetadata, BlogPostRecord } from '@/lib/cms-types';
import { analyzeAllPosts } from '@/lib/content-nudges';
import { SiteInsightsPill } from '@/components/site-insights-overlay';
import { ACTIVE_COLLECTION_COOKIE, getCollectionHeader } from '@/lib/product-framer-shared';
import { normalizeStagedDates } from '@/lib/normalize-staged-dates';
import type { FramerCollectionOption, SiteRole } from '@/lib/product-types';
import { toggleRow, toggleAllRows, shiftClickRange } from '@/lib/selection';
import { useCmsMutations } from '@/lib/use-cms-mutations';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const AI_CHAT_OPEN_STORAGE_KEY = 'lr:dashboard:ai-chat-open';
const AI_CHAT_WIDTH_STORAGE_KEY = 'lr:dashboard:ai-chat-width';
const DEFAULT_AI_CHAT_WIDTH = 460;
const MIN_AI_CHAT_WIDTH = 380;
const MAX_AI_CHAT_WIDTH = 760;

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

function clampChatWidth(width: number) {
	return Math.min(Math.max(width, MIN_AI_CHAT_WIDTH), MAX_AI_CHAT_WIDTH);
}

function readStoredAIChatWidth() {
	if (typeof window === 'undefined') {
		return DEFAULT_AI_CHAT_WIDTH;
	}

	const raw = window.localStorage.getItem(AI_CHAT_WIDTH_STORAGE_KEY);
	const parsed = raw ? Number(raw) : NaN;
	return Number.isFinite(parsed) ?
			clampChatWidth(parsed)
		:	DEFAULT_AI_CHAT_WIDTH;
}

function CollectionTableSkeleton() {
	return (
		<div className='px-5 py-5'>
			<div className='mb-5 flex items-center gap-2 text-[12px] text-fresco-description'>
				<Spinner className='size-4' />
				<span>Loading collection…</span>
			</div>
			<div className='overflow-hidden border border-dash-content-border '>
				<div className='grid grid-cols-[minmax(220px,2.2fr)_minmax(160px,1.2fr)_minmax(140px,0.9fr)_minmax(180px,1.1fr)] border-b border-dash-content-border bg-dash-group-bg px-[22px] py-3'>
					{Array.from({ length: 4 }).map((_, index) => (
						<div
							key={`header-${index}`}
							className='h-3 w-20 animate-pulse rounded-full bg-fresco-divider/70'
						/>
					))}
				</div>
				<div className='px-[22px] py-2'>
					{Array.from({ length: 8 }).map((_, rowIndex) => (
						<div
							key={`row-${rowIndex}`}
							className='grid grid-cols-[minmax(220px,2.2fr)_minmax(160px,1.2fr)_minmax(140px,0.9fr)_minmax(180px,1.1fr)] gap-6 border-b border-dash-content-border py-3.5 last:border-b-0'
						>
							<div className='h-4 w-3/4 animate-pulse rounded-full bg-fresco-surface-muted' />
							<div className='h-4 w-5/6 animate-pulse rounded-full bg-fresco-surface-muted' />
							<div className='h-5 w-14 animate-pulse rounded-full bg-fresco-surface-muted' />
							<div className='h-4 w-2/3 animate-pulse rounded-full bg-fresco-surface-muted' />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function BulkActionBar({
	selectedCount,
	selectedPosts,
	role,
	framerUnavailable,
	activeCollectionId,
	metadata,
	loadingPosts,
	setLoadingPosts,
	setCachedPosts,
	onClearSelection,
}: {
	selectedCount: number;
	selectedPosts: BlogPostRecord[];
	role: SiteRole;
	framerUnavailable: boolean;
	activeCollectionId: string;
	metadata: BlogCollectionMetadata;
	loadingPosts: Set<string>;
	setLoadingPosts: React.Dispatch<React.SetStateAction<Set<string>>>;
	setCachedPosts: React.Dispatch<React.SetStateAction<BlogPostRecord[]>>;
	onClearSelection: () => void;
}) {
	const hasStaged = selectedPosts.some((p) => p.staged);
	const allDraft = selectedPosts.every((p) => p.draft);
	const allLive = selectedPosts.every((p) => !p.draft && !p.staged);
	const isLoading = selectedPosts.some((p) => loadingPosts.has(p.id));

	async function handleBulkStatusChange(toDraft: boolean) {
		if (framerUnavailable || isLoading) return;
		const targets = selectedPosts.filter((p) => !p.staged && p.draft !== toDraft);
		if (targets.length === 0) return;
		setLoadingPosts((prev) => {
			const next = new Set(prev);
			for (const p of targets) next.add(p.id);
			return next;
		});
		const results: BlogPostRecord[] = [];
		for (const post of targets) {
			try {
				const res = await fetch(`/api/posts/${post.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json', ...getCollectionHeader(activeCollectionId) },
					body: JSON.stringify({ slug: post.slug, draft: toDraft, fieldValues: post.fieldValues }),
				});
				if (res.ok) {
					const { post: updated } = await res.json();
					results.push(updated);
				}
			} catch { /* skip failed */ }
		}
		if (results.length > 0) {
			setCachedPosts((current) => {
				let next = current;
				for (const p of results) next = upsertCachedPost(next, p);
				return next;
			});
		}
		setLoadingPosts((prev) => {
			const next = new Set(prev);
			for (const p of targets) next.delete(p.id);
			return next;
		});
	}

	async function handleBulkDelete() {
		if (framerUnavailable || isLoading) return;
		const msg = `Delete ${selectedCount} item${selectedCount === 1 ? '' : 's'}? This cannot be undone.`;
		if (!window.confirm(msg)) return;
		setLoadingPosts((prev) => {
			const next = new Set(prev);
			for (const p of selectedPosts) next.add(p.id);
			return next;
		});
		const deleted: string[] = [];
		for (const post of selectedPosts) {
			try {
				if (post.staged && post.stagedId) {
					await fetch(`/api/staged-items/${post.stagedId}`, { method: 'DELETE' });
				} else {
					await fetch(`/api/posts/${post.id}`, { method: 'DELETE', headers: getCollectionHeader(activeCollectionId) });
				}
				deleted.push(post.id);
			} catch { /* skip failed */ }
		}
		if (deleted.length > 0) {
			const deletedSet = new Set(deleted);
			setCachedPosts((current) => current.filter((p) => !deletedSet.has(p.id)));
		}
		setLoadingPosts((prev) => {
			const next = new Set(prev);
			for (const p of selectedPosts) next.delete(p.id);
			return next;
		});
		onClearSelection();
	}

	return (
		<div className='flex shrink-0 items-center gap-2 border-b border-dash-content-border bg-fresco-surface-muted/60 px-4 py-2'>
			<span className='text-[12px] font-medium text-fresco-title'>
				{selectedCount} selected
			</span>
			<div className='ml-auto flex items-center gap-1.5'>
				{!hasStaged && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								className='h-7 gap-1.5 rounded-lg px-2.5 text-[11px]'
								disabled={framerUnavailable || isLoading}
								size='sm'
								type='button'
								variant='outline'
							>
								Set Status
								<CaretDownIcon className='size-3' weight='bold' />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end' className='min-w-36'>
							<DropdownMenuItem
								disabled={allLive}
								onSelect={() => handleBulkStatusChange(false)}
							>
								<ArrowFatUpIcon className='size-3.5' weight='bold' />
								Publish
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={allDraft}
								onSelect={() => handleBulkStatusChange(true)}
							>
								<ArrowFatDownIcon className='size-3.5' weight='bold' />
								Move to Drafts
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
				{role === 'admin' && (
					<Button
						className='h-7 gap-1.5 rounded-lg px-2.5 text-[11px]'
						disabled={framerUnavailable || isLoading}
						onClick={handleBulkDelete}
						size='sm'
						type='button'
						variant='destructive'
					>
						<TrashIcon className='size-3.5' weight='bold' />
						Delete
					</Button>
				)}
				<Button
					aria-label='Clear selection'
					className='size-7 rounded-lg'
					onClick={onClearSelection}
					size='icon-sm'
					type='button'
					variant='ghost'
				>
					<XIcon className='size-3.5' weight='bold' />
				</Button>
			</div>
		</div>
	);
}

export function DashboardTableView({
	activeCollectionId,
	collections,
	framerStatus,
	initialDrawerState = null,
	metadata,
	posts,
	role,
}: {
	activeCollectionId: string;
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
	const cms = useCmsMutations({ activeCollectionId, setCachedPosts });
	const loadingPosts = cms.loadingPosts;
	const [editorRevision, setEditorRevision] = useState(0);
	const [query, setQuery] = useState('');
	const [page, setPage] = useState(1);
	const [activeCollectionSelection, setActiveCollectionSelection] =
		useState(activeCollectionId);
	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
	const [chatOpen, setChatOpen] = useState(readStoredAIChatOpen);
	const [chatWidth, setChatWidth] = useState(readStoredAIChatWidth);
	const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
	const lastClickedIndexRef = useRef<number | null>(null);
	const [searchIndex, setSearchIndex] = useState(() =>
		buildSearchIndex(posts, metadata),
	);
	const [pendingCollectionId, setPendingCollectionId] = useState<
		string | null
	>(null);
	const [publishConfirm, setPublishConfirm] = useState<BlogPostRecord | null>(null);
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
		window.localStorage.setItem(
			AI_CHAT_WIDTH_STORAGE_KEY,
			String(clampChatWidth(chatWidth)),
		);
	}, [chatWidth]);

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
		if (isCollectionLoading) {
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

	const handleNudgeClick = useCallback(
		(postId: string, prompt: string) => {
			// Select the post so the agent has context
			setSelectedRows(new Set([postId]));
			lastClickedIndexRef.current = null;
			// Open chat and queue the prompt
			setChatOpen(true);
			setPendingPrompt(prompt);
		},
		[],
	);

	const handleInsightFix = useCallback(
		(prompt: string) => {
			setChatOpen(true);
			setPendingPrompt(prompt);
		},
		[],
	);

	const handlePendingPromptConsumed = useCallback(() => {
		setPendingPrompt(null);
	}, []);

	const selectedPosts = useMemo(
		() => cachedPosts.filter((p) => selectedRows.has(p.id)),
		[cachedPosts, selectedRows],
	);

	const nudges = useMemo(
		() => analyzeAllPosts(cachedPosts, metadata),
		[cachedPosts, metadata],
	);

	const handlePostsUpdated = useCallback((updatedPosts: BlogPostRecord[]) => {
		setCachedPosts((current) => {
			let nextPosts = current;
			for (const updatedPost of updatedPosts) {
				nextPosts = upsertCachedPost(nextPosts, updatedPost);
			}
			return nextPosts;
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
		<section className='relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden'>
			<div
				className={cn(
					'bg-dash-topbar backdrop-blur-[14px]',
					'sticky top-0 z-20 shrink-0',
				)}
			>
				<div className='flex flex-wrap items-start gap-2.5 border-b border-dash-content-border px-4 py-3 md:items-center'>
						{collections.length > 1 ?
							<Select
								disabled={isCollectionLoading}
								onValueChange={handleCollectionChange}
								value={activeCollectionSelection}
							>
								<SelectTrigger
									aria-label='Select collection'
									className={cn(
										'border border-dash-control-border bg-dash-control-bg text-dash-nav-text shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:not-disabled:bg-dash-control-hover hover:not-disabled:text-fresco-title focus-visible:not-disabled:bg-dash-control-hover focus-visible:not-disabled:text-fresco-title',
										'!h-10 min-w-44 rounded-xl px-3 py-0 text-[12px] font-medium tracking-[-0.01em] text-fresco-title',
									)}
									size='default'
								>
									<SelectValue placeholder='Select collection' />
								</SelectTrigger>
								<SelectContent className='border border-dash-control-border bg-[#141415] text-fresco-text shadow-2xl'>
									{collections.map((collection) => (
										<SelectItem
											key={collection.id}
											value={collection.id}
										>
											{collection.name}
											{/* <span className='text-sm text-fresco-description'>
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
						<Button
							aria-label='Refresh collection'
							className={cn(
								'border border-dash-control-border bg-dash-control-bg text-dash-nav-text shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:not-disabled:bg-dash-control-hover hover:not-disabled:text-fresco-title focus-visible:not-disabled:bg-dash-control-hover focus-visible:not-disabled:text-fresco-title',
								'!size-10 rounded-xl',
							)}
							disabled={isCollectionLoading || framerUnavailable}
							onClick={() => {
								startCollectionTransition(() => {
									router.refresh();
								});
							}}
							size='icon'
							title='Refresh collection items'
							type='button'
							variant='outline'
						>
							<ArrowsClockwiseIcon
								className={cn('size-4', isCollectionLoading && 'animate-spin')}
								weight='bold'
							/>
						</Button>
						<Button
							className={cn(
								'border border-dash-control-border bg-dash-control-bg text-dash-nav-text shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:not-disabled:bg-dash-control-hover hover:not-disabled:text-fresco-title focus-visible:not-disabled:bg-dash-control-hover focus-visible:not-disabled:text-fresco-title',
								'!h-10 gap-2 rounded-xl px-3 text-[12px] font-medium tracking-[-0.01em] text-fresco-title',
							)}
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

						<div className='flex flex-row items-center gap-2.5 ml-auto'>
							<label
								className={cn(
									'border border-dash-control-border bg-dash-control-bg text-dash-nav-text shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:not-disabled:bg-dash-control-hover hover:not-disabled:text-fresco-title focus-visible:not-disabled:bg-dash-control-hover focus-visible:not-disabled:text-fresco-title',
									'relative flex h-10 min-w-0 w-full items-center gap-2 rounded-xl px-3 text-fresco-subtitle transition-colors focus-within:border-fresco-tint md:w-auto md:flex-[0_1_32rem] md:max-w-[32rem]',
								)}
								htmlFor='dashboard-search'
							>
								<MagnifyingGlassIcon className='size-4 shrink-0' />
								<input
									aria-label='Search items'
									className='h-full min-w-0 flex-1 bg-transparent px-1 py-0 text-[12px] font-normal text-fresco-text outline-none placeholder:text-fresco-subtitle'
									id='dashboard-search'
									onChange={(event) => {
										setQuery(event.target.value);
										setPage(1);
									}}
									placeholder='Search…'
									ref={searchInputRef}
									value={query}
								/>
								<KbdGroup className='hidden shrink-0 gap-1 sm:inline-flex'>
									<Kbd className='h-5 min-w-5 rounded-md border border-dash-control-border bg-black/20 px-1.5 text-[11px] text-fresco-subtitle'>
										{(
											typeof navigator !== 'undefined' &&
											/mac/i.test(navigator.platform)
										) ?
											'⌘'
										:	'Ctrl'}
									</Kbd>
									<Kbd className='h-5 min-w-5 rounded-md border border-dash-control-border bg-black/20 px-1.5 text-[11px] text-fresco-subtitle'>
										\
									</Kbd>
								</KbdGroup>
							</label>
							<Button
								aria-label={chatOpen ? 'Close AI chat' : 'Open AI chat'}
								aria-keyshortcuts="Meta+K"
								className='h-10 rounded-xl'
								onClick={() => setChatOpen((prev) => !prev)}
								size='default'
								type='button'
								variant='default'
							>
								<ChatCircleIcon
									className='size-[15px]'
									weight='duotone'
								/>
								<span>{selectedRows.size > 0 ? `Chat with ${selectedRows.size} row${selectedRows.size === 1 ? '' : 's'}` : 'AI Assistant'}</span>
								<KbdGroup className='ml-1 hidden md:flex'>
									<Kbd className='h-5 min-w-5 rounded-md border border-white/10 bg-black/20 px-1.5 text-[11px] text-white/50'>&thinsp;&#8984;&thinsp;</Kbd>
									<Kbd className='h-5 min-w-5 rounded-md border border-white/10 bg-black/20 px-1.5 text-[11px] text-white/50'>K</Kbd>
								</KbdGroup>
							</Button>
						</div>
				</div>
			</div>

			<div className='flex min-h-0 min-w-0 flex-1 overflow-hidden'>
				<div className='min-w-0 flex-1 overflow-hidden'>
					<div className='flex h-full min-h-0 min-w-0 flex-col shadow-[inset_0_1px_0_var(--color-fresco-frame-overlay)] md:border md:border-dash-content-border'>
						{selectedRows.size > 0 && !isCollectionLoading && (
							<BulkActionBar
								selectedCount={selectedRows.size}
								selectedPosts={selectedPosts}
								role={role}
								framerUnavailable={framerUnavailable}
								activeCollectionId={activeCollectionId}
								metadata={metadata}
								loadingPosts={loadingPosts}
								setLoadingPosts={setLoadingPosts}
								setCachedPosts={setCachedPosts}
								onClearSelection={handleClearSelection}
							/>
						)}
						<div className='min-h-0 min-w-0 flex-1 overflow-auto'>
							{isCollectionLoading ?
								<CollectionTableSkeleton />
							: filteredPosts.length === 0 ?
								<div className='flex h-full flex-col items-center justify-center gap-3 p-12 text-center'>
									<div className='text-[13px] font-medium text-fresco-title'>
										{searchQuery ? 'No items match your search' : 'No items yet'}
									</div>
									<p className='max-w-xs text-[12px] text-fresco-description'>
										{searchQuery
											? 'Try a different query or clear your search.'
											: 'Create your first item to get started, or use AI to generate content.'}
									</p>
								</div>
							:	<BlogTable
							activePostId={activePostId}
							actionsDisabled={framerUnavailable}
							columns={activeColumns}
							metadata={metadata}
							nudges={nudges}
							onNudgeClick={handleNudgeClick}
							onOpenPost={handleOpenPost}
							posts={visiblePosts}
							role={role}
							loadingPosts={loadingPosts}
							selectedRows={selectedRows}
							onToggleRow={handleToggleRow}
							onToggleAll={handleToggleAll}
							onShiftClick={handleShiftClick}
							onDraftToggle={async (post) => {
								if (post.staged && post.stagedId) {
									if (framerUnavailable) return;
									await cms.pushStagedItem(post);
									return;
								}
								if (framerUnavailable) return;
								// Publishing (draft → live) needs confirmation
								if (post.draft) {
									setPublishConfirm(post);
									return;
								}
								await cms.toggleDraft(post);
							}}
							onDelete={async (postId) => {
								const post = cachedPosts.find((p) => p.id === postId);
								if (post?.staged && post.stagedId) {
									await cms.discardStagedItem(postId, post.stagedId);
									return;
								}
								if (framerUnavailable) return;
								await cms.deletePost(postId);
							}}
							onChatWithItem={(postId) => {
								setSelectedRows(new Set([postId]));
								setChatOpen(true);
							}}
						/>
							}
						</div>

						<div className='shrink-0 border-t border-dash-content-border px-5 py-3'>
							<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
								<div className='text-[12px] text-fresco-description'>
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
											className={cn(
												'border border-dash-control-border bg-dash-control-bg text-dash-nav-text shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:not-disabled:bg-dash-control-hover hover:not-disabled:text-fresco-title focus-visible:not-disabled:bg-dash-control-hover focus-visible:not-disabled:text-fresco-title',
												'rounded-xl px-3 text-[12px] font-medium text-fresco-title',
											)}
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
									className={cn(
										'border border-dash-control-border bg-dash-control-bg text-dash-nav-text shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:not-disabled:bg-dash-control-hover hover:not-disabled:text-fresco-title focus-visible:not-disabled:bg-dash-control-hover focus-visible:not-disabled:text-fresco-title',
										'min-w-28 rounded-xl text-[12px] font-medium text-fresco-text',
									)}
												size='sm'
											>
												<SelectValue
													placeholder={`Page ${currentPage}`}
												/>
											</SelectTrigger>
											<SelectContent className='border border-dash-control-border bg-[#141415] text-fresco-text shadow-2xl'>
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
										<span className='text-[12px] text-fresco-description'>
											of {totalPages}
										</span>
										<Button
											className={cn(
												'border border-dash-control-border bg-dash-control-bg text-dash-nav-text shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:not-disabled:bg-dash-control-hover hover:not-disabled:text-fresco-title focus-visible:not-disabled:bg-dash-control-hover focus-visible:not-disabled:text-fresco-title',
												'rounded-xl px-3 text-[12px] font-medium text-fresco-title',
											)}
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
					</div>
				</div>

				<AIWorkspacePane
					onWidthChange={setChatWidth}
					open={chatOpen}
					width={chatWidth}
				>
					<AIChatPanel
						className='h-full border-0 shadow-none'
						metadata={metadata}
						onOpenChange={setChatOpen}
						onPostsUpdated={handlePostsUpdated}
						onClearSelection={handleClearSelection}
						open={chatOpen}
						pendingPrompt={pendingPrompt}
						onPendingPromptConsumed={handlePendingPromptConsumed}
						selectedPosts={selectedPosts}
						variant='embedded'
					/>
				</AIWorkspacePane>
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
					className='gap-0 overflow-hidden border-fresco-divider p-0 text-fresco-title shadow-[-40px_0_120px_rgba(0,0,0,0.55)] data-[side=right]:w-full data-[side=right]:sm:max-w-none md:data-[side=right]:top-2 md:data-[side=right]:right-2 md:data-[side=right]:bottom-2 md:data-[side=right]:w-[min(72vw,920px)] xl:data-[side=right]:w-[min(56vw,980px)]'
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
								activeCollectionId={activeCollectionId}
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
								activeCollectionId={activeCollectionId}
								framerUnavailable={framerUnavailable}
								key={`${activePost.id}:${editorRevision}`}
								metadata={metadata}
								mode='edit'
								onClose={handleCloseDrawer}
								onPostSaved={handlePostSaved}
								post={activePost}
								onChatWithItem={() => {
									setSelectedRows(new Set([activePost.id]));
									setChatOpen(true);
								}}
							/>
						:	<div className='flex h-full flex-col gap-3.5 p-7'>
								<span
									className={cn(
										'inline-flex items-center rounded-none border border-fresco-divider bg-fresco-surface-muted px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fresco-subtitle',
										'w-fit',
									)}
								>
									Unavailable
								</span>
								<h2 className='font-heading text-3xl leading-tight text-fresco-title'>
									This item is not in the preloaded set.
								</h2>
								<p className='text-sm leading-6 text-fresco-description'>
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

			<SiteInsightsPill
				metadata={metadata}
				onFixInsight={handleInsightFix}
				posts={cachedPosts}
			/>

			{/* Publish confirmation dialog */}
			<Dialog open={!!publishConfirm} onOpenChange={() => setPublishConfirm(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Publish item?</DialogTitle>
						<DialogDescription>
							This will make &ldquo;{publishConfirm?.title || publishConfirm?.slug}&rdquo; live on your site. Changes are published immediately.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setPublishConfirm(null)}>Cancel</Button>
						<Button
							onClick={async () => {
								const post = publishConfirm;
								if (!post) return;
								setPublishConfirm(null);
								await cms.publishPost(post);
							}}
						>
							Publish
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Undo toast */}
			{cms.undoPending && (
				<div className='fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4'>
					<div className='flex items-center gap-3 rounded-xl border border-dash-content-border bg-fresco-panel px-4 py-3 shadow-lg'>
						<span className='text-[13px] text-fresco-text'>{cms.undoPending.label}</span>
						<Button
							className='h-7 rounded-lg px-3 text-[12px]'
							onClick={cms.undoPending.undo}
							size='sm'
							type='button'
							variant='outline'
						>
							Undo
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}
