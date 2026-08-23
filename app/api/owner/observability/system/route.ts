import { NextResponse } from "next/server";
import { withRole } from "@/src/lib/auth/api-handler";
import { USER_ROLES } from "@/src/types/auth";
import { getOwnerSystemState } from "@/src/lib/observability/service";

export const GET = withRole(USER_ROLES.OWNER, async () => {
  try {
    return NextResponse.json({ system: await getOwnerSystemState() });
  } catch {
    return NextResponse.json({ error: "system_state_unavailable" }, { status: 503 });
  }
});
