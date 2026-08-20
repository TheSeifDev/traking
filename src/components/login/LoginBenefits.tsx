import { LOGIN_BENEFITS } from "./login-content";

const LoginBenefits = () => {
  return (
    <div className="mt-10 space-y-6">
      {LOGIN_BENEFITS.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.title} className="flex gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/8 text-violet-300 shadow-[0_0_20px_rgba(124,58,237,0.08)]">
              <Icon className="size-5" strokeWidth={1.8} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-white/60">
                {item.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LoginBenefits;