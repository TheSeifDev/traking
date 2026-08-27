/**
 * TrackUp creation-flow contract checks.
 *
 * These checks intentionally inspect the real route/component contracts rather
 * than fabricate database records. Live mutation verification is performed
 * separately with controlled production data and is never mocked here.
 */
import { readFileSync } from "node:fs";
import { isValidSourceUrl } from "../src/lib/playback/providers";

let passed = 0;
let failed = 0;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed += 1;
  } else {
    console.error(`  [FAIL] ${label}`);
    failed += 1;
  }
}

const videoRoute = read("app/api/videos/route.ts");
const watchLinkRoute = read("app/api/videos/[id]/watch-link/route.ts");
const access = read("src/lib/spaces/access.ts");
const providers = read("src/lib/playback/providers.ts");
const createDialog = read("src/components/dashboard/CreateVideoDialog.tsx");
const videoList = read("src/components/dashboard/VideoList.tsx");
const videosPage = read("app/(dashboard)/videos/page.tsx");
const watchLinksPage = read("app/(dashboard)/watch-links/page.tsx");
const watchLinksManager = read("src/components/dashboard/WatchLinksManager.tsx");
const watchLinkPanel = read("src/components/dashboard/WatchLinkPanel.tsx");
const videoService = read("src/lib/videos/service.ts");

console.log("\n── TrackUp creation-flow contracts");
assert(videoRoute.includes("resolveMutationScopeForUser"), "video creation uses server-side mutation scope resolution");
assert(videoRoute.includes("isValidSourceUrl(source_type, source_url)"), "video creation validates provider URL server-side");
assert(videoRoute.includes("space_id: scope.spaceId"), "video creation returns the server-authorized persisted scope");
assert(watchLinkRoute.includes("resolveMutationScopeForUser"), "watch-link mutations use the same server-side scope resolver");
assert(access.includes("spaceId: null"), "virtual All Spaces returns null persistence scope rather than a Space ID");
assert(access.includes("access.space.organization_id !== organizationId"), "combined Organization/Space requests are checked for scope mismatch");
assert(access.includes("if (organizationId && isOwner(user.role))"), "Organization-wide mutation scope is Owner-only");
assert(providers.includes("export function isValidSourceUrl"), "provider registry owns source URL validation");
assert(providers.includes("getYouTubeId(sourceUrl) !== null"), "YouTube URLs require a parseable video ID");
assert(providers.includes("getVimeoId(sourceUrl) !== null"), "Vimeo URLs require a parseable video ID");
assert(providers.includes("getGoogleDriveId(sourceUrl) !== null"), "Google Drive URLs require a parseable file ID");
assert(isValidSourceUrl("youtube", "https://www.youtube.com/watch?v=abc123"), "valid YouTube URL is accepted");
assert(!isValidSourceUrl("youtube", "https://example.com/video"), "non-YouTube URL is rejected for YouTube provider");
assert(isValidSourceUrl("vimeo", "https://vimeo.com/123456"), "valid Vimeo URL is accepted");
assert(isValidSourceUrl("google_drive", "https://drive.google.com/file/d/abc123/view"), "valid Google Drive URL is accepted");
assert(!isValidSourceUrl("direct_url", "javascript:alert(1)"), "non-http source URL is rejected");
assert(createDialog.includes("Tracking scope *"), "creation UI requires an explicit tracking scope");
assert(createDialog.includes("All Spaces · Organization-wide"), "creation UI exposes virtual All Spaces");
assert(createDialog.includes("value={`space:${space.id}`}"), "creation UI exposes real Space options");
assert(createDialog.includes("/api/videos/${createdVideo.id}/watch-link"), "successful video creation offers canonical watch-link creation");
assert(createDialog.includes("Share it to collect real viewer activity"), "post-create UX explains the tracking handoff");
assert(videoList.includes("allowAllSpaces"), "VideoList receives explicit All Spaces creation permission");
assert(videoList.includes("createAction={canManage ? renderCreateDialog()"), "empty VideoList state opens the real Add Video dialog");
assert(videosPage.includes("spaceCanManage={user.role === \"owner\"}"), "Owner All Spaces receives a real Add Video entry point");
assert(watchLinksPage.includes("spaceCanManage={user.role === \"owner\"}"), "Owner All Spaces receives real Watch Link management");
assert(watchLinksManager.includes("Create watch link"), "Watch Links has a discoverable creation CTA");
assert(watchLinksManager.includes("Video → Watch Link → Viewer → Tracking → Analytics"), "Watch Links explains the canonical product relationship");
assert(watchLinkPanel.includes("organizationId"), "canonical Watch Link panel carries Organization scope");
assert(watchLinkPanel.includes("organization_id=${encodeURIComponent(organizationId)}"), "All Spaces Watch Link requests preserve organization_id");
assert(videoService.includes("space_id: spaceId ?? null"), "video service persists null for All Spaces and real IDs for Space scope");
assert(!createDialog.includes("00000000-0000-0000-0000-000000000000"), "creation flow contains no fabricated UUID");

console.log(`\nTrackUp creation-flow contracts: ${passed}/${passed + failed} checks passed`);
if (failed > 0) process.exit(1);
