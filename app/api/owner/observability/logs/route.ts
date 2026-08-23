import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { USER_ROLES } from "@/src/types/auth";
import { listOwnerLogs } from "@/src/lib/observability/service";
import { OBSERVABILITY_CATEGORIES, OBSERVABILITY_LEVELS } from "@/src/lib/observability/logger";

function optionalEnum<T extends readonly string[]>(value: string | null, options: T): T[number] | undefined {
  return value && (options as readonly string[]).includes(value) ? value as T[number] : undefined;
}

export const GET = withRole(USER_ROLES.OWNER, async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  try {
    const result = await listOwnerLogs({
      level: optionalEnum(params.get("level"), OBSERVABILITY_LEVELS),
      category: optionalEnum(params.get("category"), OBSERVABILITY_CATEGORIES),
      action: params.get("action") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      limit: Number(params.get("limit")),
      offset: Number(params.get("offset")),
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "logs_unavailable" }, { status: 503 });
  }
});
