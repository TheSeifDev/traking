# TrackUp / Trakup — Phase 4 Boundary Final Report

**التاريخ:** 22 أغسطس 2026

**الفرع:** `fix/restore-workspace-contract`

**PR:** [#2 — fix: restore workspace contract after merge](https://github.com/TheSeifDev/traking/pull/2)

**آخر commit:** `9525403`

## Executive summary

تمت متابعة الخطة من Phase 4 boundary بشكل تنفيذي، مع الحفاظ على الـ OAuth architecture الحالية وعدم إضافة workspace membership model جزئي. الحالة الحالية clean وbuildable، وPR #2 ما زال مفتوحاً ولم يتم merge إلى `main`. تم إصلاح route wiring المتبقي في settings، وتحويل read routes إلى permission-based authorization، وإغلاق race في watch-link lifecycle، وتصحيح حفظ seek origins واحتساب watch time، ومنع عرض completion/watch-time كأرقام دقيقة لمصادر iframe التي لا توفر telemetry حالياً. لم تتم إضافة heatmap زائفة، ولم تتم إضافة rate limiter غير production-safe، ولم تعتبر `/api/admin/users` مكتملة؛ ما زالت تعيد 501 بشفافية.

## 1. Gate status والأدلة التنفيذية

| Gate | الحالة | الدليل |
| --- | --- | --- |
| Git/merge recovery | ناجح | branch مستقل، working tree clean، PR #2 مفتوح ولم يُدمج، و`git diff --check` ناجح مقابل `origin/main` |
| Buildability | ناجح | أحدث فحص محلي شغّل `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` بنجاح |
| OAuth → Dashboard source flow | source-verified | authorization، state، token exchange، workspace discovery، identity، provisioning، signed cookie، ثم redirect إلى `/dashboard` موجودة؛ live browser E2E ما زال محجوباً بحماية Vercel |
| Workspace/RBAC audit | ناجح ضمن MVP الحالي | operations الخاصة بالفيديو scoped بالـ primary workspace، والـ API routes protected بالـ centralized permissions؛ لا يوجد membership model صريح |
| Viewer-link security | ناجح ضمن lifecycle الحالي | expiry/revocation وsession capability والتحقق غير الكاشف مطبقة ومختبرة |
| Provider-aware analytics | ناجح من ناحية honesty | `direct_url` فقط ينتج playback metrics؛ iframe providers يعيدون `null` للمؤشرات غير المثبتة، ولا توجد heatmap معلنة |
| CI | ناجح | Quality run `32587746065` / job `97066606140` على commit `9525403`: install، type check، lint، tests، production build كلها `success` |

آخر suite محلي بعد analytics changes أعاد **route authorization 60/60** و**security hardening 58/58**، مع نجاح typecheck وlint وbuild. بقي تحذير Next.js المعروف حول deprecation لـ `middleware` إلى `proxy`، وهو ليس فشل build.

## 2. Workspace / organization isolation audit

### المشكلة المؤكدة

النموذج الحالي يخزن `role` و`is_active` على `profiles` بشكل global. جدول `clickup_connections` يربط profile بالـ workspace، لكن التطبيق الحالي يختار primary workspace واحداً من اتصال ClickUp، ولا توجد memberships أو role assignments على مستوى workspace.

### السبب الجذري

هذا هو تصميم MVP الحالي: OAuth provisions profile واحداً، يحفظ أول ClickUp team كاتصال أساسي، وdashboard/video services تستخدم `getPrimaryWorkspace*`. لا يوجد في migrations أو auth helpers مفهوم user-to-workspace membership مستقل.

### الأثر والقرار

هذا لا يمنع current scope ما دام كل مستخدم يعمل على primary workspace واحداً ولا يوجد workspace switching أو roles مختلفة لنفس المستخدم عبر منظمات متعددة. لكنه يصبح requirement أمنياً ووظيفياً مؤكداً عند دعم multi-organization switching، أو اختلاف role للمستخدم حسب workspace، أو owner/admin management داخل workspace واحد مع إخفاء بقية المنظمات.

لم تتم إضافة membership model تلقائياً. الإضافة الصحيحة مستقبلاً يجب أن تشمل migration كاملة، مفاتيح uniqueness، membership role، OAuth provisioning، workspace selection/session context، إعادة scoping لكل protected query وmanagement operation، backup/rollback، واختبارات cross-workspace. Partial membership implementation الآن ستكون أخطر من limitation واضحة.

### إصلاح موضعي منفذ

تم إصلاح reconnect CTA في `app/(dashboard)/settings/page.tsx` من `/auth/clickup` غير الموجود إلى `/api/auth/clickup`، مع regression داخل `scripts/verify-routes.ts`.

## 3. RBAC audit

### المشكلة المؤكدة

بعض read routes كانت تستخدم `withAuth` رغم أن العقود والـ permission map تعرفها كـ `videos.read`. كما أن ClickUp task search كان متاحاً لكل authenticated role رغم أنه جزء من workflow إدارة وربط المهام بالفيديو.

### الإصلاح

تم تحويل:

- `app/api/videos/route.ts` GET إلى `withPermission(PERMISSIONS.VIDEOS_READ)`.
- `app/api/videos/[id]/route.ts` GET إلى `withPermission(PERMISSIONS.VIDEOS_READ)`.
- `app/api/clickup/tasks/route.ts` GET إلى `withPermission(PERMISSIONS.VIDEOS_UPDATE)`.

هذا لا يسحب صلاحية حالية مقصودة من viewer في video reads، لكنه يمنع bypass مستقبلي للـ permission map ويجعل task search management-only. جميع mutation routes بقيت خلف permissions المناسبة. `/api/admin/users` ما زال يعيد `501 not_implemented`، ولم يتم تحويله إلى fake success.

### Evidence

`verify-routes.ts` يثبت wrappers الجديدة، وQuality/local gates نجحت بعد التغيير: **60/60 route authorization**.

## 4. Viewer-link security audit

### ما تم إثباته

صفحة `app/watch/[token]/page.tsx` تحل الرابط server-side ولا تعرض الفيديو عند token invalid/expired/revoked. management routes فقط تنشئ أو تلغي روابط المشاهدة. `resolveWatchLink` يرفض expiry عند لحظته (`<= now`) و`revoked_at`. `createWatchSession` يعيد فحص lifecycle قبل insert لإغلاق resolve-then-insert race. كل event/end write يحتاج `session_token` عشوائياً ومستقلاً عن `session_id`، وفشل capability يعيد 404 عاماً دون التمييز بين unknown id وwrong token.

### الحد المقصود

Revocation يمنع الجلسات العامة الجديدة، لكنه لا يلغي session capabilities التي أُصدرت سابقاً؛ هذا يحافظ على analytics الجلسات الموجودة. إذا كان المطلوب إنهاء المشاهدة فوراً بعد revoke، فذلك يحتاج state وسياسة إضافية في `watch_sessions` ولم يُخترع الآن.

## 5. Provider capability audit

| Provider | Current position | Current duration | Current events | Watched ranges | Heatmap | ما يُسمح بعرضه الآن |
| --- | --- | --- | --- | --- | --- | --- |
| `direct_url` | نعم، native HTML5 | نعم | play/pause/seeked/timeupdate/ended مع heartbeat؛ buffer غير ملتقط | ليس بعد؛ seek origin أصبح محفوظاً لدعمها مستقبلاً | لا | session count وnative watch-time/completion مع scope واضح |
| `youtube` | لا في الكود الحالي؛ ممكن بعد YouTube IFrame API | لا في الكود الحالي | لا في الكود الحالي؛ API الرسمي يتيح state/current time بعد integration | لا | لا | session start/end فقط |
| `vimeo` | لا في الكود الحالي؛ ممكن بعد Vimeo Player SDK | لا في الكود الحالي | لا في الكود الحالي؛ SDK الرسمي يتيح play/pause/seek/buffer/end/timeupdate بعد integration | لا | لا | session start/end فقط |
| `google_drive` | لا؛ plain iframe وDrive REST API | لا | لا | لا | لا | session start/end فقط |
| `telegram` | لا؛ plain iframe وBot API | لا | لا | لا | لا | session start/end فقط |

تم فحص [YouTube IFrame Player API][1] و[Vimeo Player SDK][2] و[Google Drive API][3] و[Telegram Bot API][4]. المصفوفة التفصيلية محفوظة في `trakup-provider-capability-matrix.md`.

## 6. Tracking correctness audit

### Seek origin

**المشكلة:** payload كان يسمى `from_position`، لكن service كان يكتبه في العمود التاريخي `duration`، ولم يكن هناك field مخصص في schema.

**الإصلاح:** أضيفت migration additive `supabase/migrations/20260822000006_add_watch_event_from_position.sql`، وتحدثت `src/types/database.ts` و`src/types/video.ts`، وأصبح service يكتب `from_position` صراحة. لم يتم تعديل migrations التاريخية.

**Regression:** `verify-security-hardening.ts` يثبت migration وكتابة `from_position`، ونجحت security suite **58/58**.

### Watch-time accumulation

**المشكلة:** heartbeat كان يجمع الزمن منذ بداية play segment في كل interval، ما يسبب overcount تراكمي؛ كما كان timer يبدأ عند session creation قبل بدء playback.

**الإصلاح:** `WatchPlayer` أصبح يflush elapsed play segments عند heartbeat/pause/end/cleanup، ويستأنف segment من timestamp جديد بعد heartbeat، ولا يبدأ timer إلا عند play.

**Regression:** assertions تغطي explicit accumulation، عدم بدء الزمن قبل playback، heartbeat resume، وpause flush. typecheck/lint/tests/build كلها نجحت.

## 7. Analytics / Heatmap

### المشكلة المؤكدة

`getVideoAnalytics` و`getWorkspaceAnalytics` كانا يعرضان completion/watch-time من sessions لكل source type رغم أن iframe providers لا يرسلون playback telemetry. واجهات dashboard وanalytics وvideo detail عرضت أرقاماً عادية، وأحياناً `0%` أو `0m`، ما قد يوحي بقياس غير موجود.

### الإصلاح

أضيف `playback_metrics_scope` إلى analytics contract. مؤشرات playback تحسب فقط لـ `direct_url`، ومؤشرات iframe providers تعود `null`. بقيت session/view counts متاحة، لكن الواجهة تسميها sessions وتعرض `Unavailable` أو `Not measured` عند غياب telemetry. لم تتم إضافة watched-range reconstruction أو heatmap لأن البيانات الحالية لا تثبتها.

هذا إصلاح honesty وليس ادعاء اكتمال feature. بناء heatmap حقيقية يتطلب event normalization، deduplication، range reconstruction، provider adapters، ومصدر position موثوق لكل provider.

## 8. Security hardening / rate limiting / deployment

تم الحفاظ على ClickUp access token server-side داخل `clickup_connections`، وتحسين session capability، وإضافة revocation وfrom-position migrations بشكل additive. لم تتم إضافة distributed أو in-memory rate limiter. البنية الحالية لا توفر shared counter/TTL primitive؛ الحل المطلوب مستقبلاً يجب أن يحدد primitive مشتركة، keys وquotas وTTL وresponse policy وobservability. In-memory limiter على serverless غير production-safe.

المigrations التالية ما زالت **غير مطبقة** في Supabase:

1. `20260822000004_harden_watch_session_capabilities.sql`
2. `20260822000005_add_watch_link_revocation.sql`
3. `20260822000006_add_watch_event_from_position.sql`

قبل تطبيقها يجب أخذ backup/checkpoint، مراجعة ترتيب migration، تنفيذ smoke tests، ووضع rollback procedure في البيئة الفعلية. لا يوجد ادعاء بأن database runtime أصبح متوافقاً قبل هذه الخطوة.

## 9. E2E / Regression status

المتاح تنفيذه executable داخل repository وCI نجح. أما live browser E2E، فقد تمت محاولة فتح preview الفعلي:

`https://traking-git-fix-restore-workspace-contract-s3fpls-projects.vercel.app`

لكن Vercel أعاد التحويل إلى صفحة تسجيل دخول Vercel قبل تحميل TrackUp. لذلك لم يتم ادعاء نجاح ClickUp OAuth browser flow. يلزم preview أو deployment accessible بدون Vercel protection، مع environment variables فعلية: `CLICKUP_CLIENT_ID`, `CLICKUP_CLIENT_SECRET`, `CLICKUP_REDIRECT_URI`, `TRACKUP_SESSION_SECRET` بطول مناسب، `TRACKUP_OWNER_EMAIL`, `NEXT_PUBLIC_APP_URL`, وSupabase service-role configuration.

## 10. الملفات المتغيرة

| File | Reason |
| --- | --- |
| `app/(dashboard)/settings/page.tsx` | إصلاح reconnect OAuth CTA |
| `app/api/clickup/tasks/route.ts` | explicit RBAC على task search |
| `app/api/videos/route.ts` | explicit `videos.read` على GET |
| `app/api/videos/[id]/route.ts` | explicit `videos.read` على GET |
| `src/lib/tracking/service.ts` | capability lifecycle، revocation/expiry re-check، from_position |
| `src/components/watch/WatchPlayer.tsx` | session capability propagation وaccurate elapsed play segments |
| `src/lib/videos/service.ts` | watch-link lifecycle وprovider-aware analytics |
| `src/types/database.ts` | session_token، revoked_at، from_position contracts |
| `src/types/tracking.ts` | session capability payload contracts |
| `src/types/video.ts` | revoke/analytics/provider-aware domain types |
| `app/(dashboard)/analytics/page.tsx` | عدم عرض unsupported completion |
| `app/(dashboard)/dashboard/page.tsx` | توضيح direct URL scope وsession counts |
| `app/(dashboard)/videos/[id]/page.tsx` | provider limitation messaging وnullable metrics |
| `app/api/videos/[id]/watch-link/route.ts` | DELETE revoke حقيقي |
| `app/api/owner/admins/route.ts` | mutation حقيقي بدلاً من success stub |
| `supabase/migrations/20260822000004_harden_watch_session_capabilities.sql` | session capability column/backfill/index |
| `supabase/migrations/20260822000005_add_watch_link_revocation.sql` | revocation state additive |
| `supabase/migrations/20260822000006_add_watch_event_from_position.sql` | seek origin field additive |
| `scripts/verify-routes.ts` | OAuth/settings/RBAC regressions |
| `scripts/verify-security-hardening.ts` | capability، lifecycle، analytics honesty regressions |
| `.github/workflows/quality.yml` | CI quality gate |
| `trakup-provider-capability-matrix.md` | provider capability contract |
| `trakup-git-findings.md` | audit trail والأدلة |

## 11. الخطوة التالية بالضبط

الخطوة التالية ليست merge ولا heatmap مباشرة. أولاً يجب توفير deployment accessible وSupabase environment فعلي، ثم تطبيق migrations بعد backup وتشغيل smoke test حقيقي: ClickUp authorization → callback → provisioning → signed session → `/dashboard`، ثم إنشاء watch link، فتحه، إنشاء session، إرسال event/end capability، revoke الرابط، والتأكد من رفض session جديدة بعد revoke.

بعد نجاح ذلك، إذا ظل scope هو single-primary-workspace، يمكن إبقاء membership model limitation. أما إذا أصبح المنتج multi-organization أو يحتاج roles مختلفة للمستخدم نفسه حسب workspace، فيجب التوقف وتصميم membership model كاملاً قبل أي schema implementation. بعد ذلك فقط يُتخذ قرار تنفيذ YouTube/Vimeo adapters؛ Drive/Telegram يحتاجان delivery method قابل للتحكم أو يبقيان session-only.

## References

[1]: https://developers.google.com/youtube/iframe_api_reference "YouTube IFrame Player API Reference"
[2]: https://developer.vimeo.com/player/sdk/reference "Vimeo Player SDK Reference"
[3]: https://developers.google.com/workspace/drive/api/reference/rest/v3 "Google Drive API REST Reference"
[4]: https://core.telegram.org/bots/api "Telegram Bot API"
