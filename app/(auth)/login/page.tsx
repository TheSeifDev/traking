import { ResponsiveNav } from "@/src/components/navigation";
import LoginHero from "@/src/components/login/LoginHero";
import { getSafeAuthReturnPath } from "@/src/lib/auth/redirect";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const LoginPage = async ({ searchParams }: LoginPageProps) => {
  const params = await searchParams;
  const rawRedirect = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect;
  const returnPath = getSafeAuthReturnPath(rawRedirect);
  const authHref = returnPath === "/dashboard"
    ? "/api/auth/clickup"
    : `/api/auth/clickup?redirect=${encodeURIComponent(returnPath)}`;

  return (
    <>
      <ResponsiveNav />
      <LoginHero authHref={authHref} />
    </>
  );
};

export default LoginPage;
