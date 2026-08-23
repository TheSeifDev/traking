export default function DashboardLoading() {
  return (
    <div className="min-h-full bg-[#08081f] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1440px] animate-pulse space-y-8" aria-label="Loading dashboard">
        <div className="flex flex-col gap-4 border-b border-white/8 pb-7 lg:flex-row lg:items-end lg:justify-between"><div className="space-y-3"><div className="h-3 w-32 rounded bg-white/10" /><div className="h-10 w-80 rounded bg-white/10" /><div className="h-4 w-[28rem] max-w-full rounded bg-white/6" /></div><div className="h-11 w-36 rounded-xl bg-white/8" /></div>
        <div className="grid grid-cols-2 gap-4 border-b border-white/8 pb-7 sm:grid-cols-4 xl:grid-cols-7">{Array.from({ length: 7 }, (_, index) => <div key={index} className="space-y-3"><div className="h-9 w-9 rounded-xl bg-white/8" /><div className="h-8 w-20 rounded bg-white/10" /><div className="h-3 w-24 rounded bg-white/6" /><div className="h-2 w-28 rounded bg-white/5" /></div>)}</div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.45fr)]"><div className="h-[390px] rounded-3xl border border-white/8 bg-white/[0.03]" /><div className="h-[390px] rounded-3xl border border-white/8 bg-white/[0.03]" /></div>
        <div className="grid gap-5 xl:grid-cols-2"><div className="h-[320px] rounded-3xl border border-white/8 bg-white/[0.03]" /><div className="h-[320px] rounded-3xl border border-white/8 bg-white/[0.03]" /></div>
      </div>
    </div>
  );
}
