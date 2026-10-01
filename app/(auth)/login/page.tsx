import { ResponsiveNav } from "@/src/components/navigation";
import LoginHero from "@/src/components/login/LoginHero";
import { getSafeAuthReturnPath } from "@/src/lib/auth/redirect";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const LoginPage = async ({ searchParams }: LoginPageProps) => {
  const params = await searchParams;
  const rawRedirect = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect;
  const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
  const returnPath = getSafeAuthReturnPath(rawRedirect);

  return (
    <>
      <ResponsiveNav />
      <LoginHero returnPath={returnPath} initialError={rawError ?? null} />
    </>
  );
};

export default LoginPage;
