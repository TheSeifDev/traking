import Image from "next/image";
import Link from "next/link";

const GithubIcon = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.5 5.74.5 12.04c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.16-.02-2.1-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.79 2.73 1.27 3.4.97.11-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.42.36.79 1.08.79 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.8.56 4.56-1.53 7.85-5.84 7.85-10.91C23.5 5.74 18.27.5 12 .5Z" /></svg>;
const LinkedinIcon = ({ size = 16 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.452 20.452h-3.553v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.934v5.672H9.358V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.268 2.37 4.268 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.064 2.063 2.063 0 1 1 2.063 2.064zM7.118 20.452H3.554V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>;

const footerColumns = [
  { title: "Product", links: [{ label: "Features", href: "/features" }, { label: "How It Works", href: "/how-it-works" }, { label: "Use Cases", href: "/use-cases" }, { label: "Get started", href: "/login" }] },
  { title: "Integrations", links: [{ label: "ClickUp", href: "/integrations" }, { label: "YouTube", href: "/integrations" }, { label: "Google Drive", href: "/integrations" }, { label: "Telegram", href: "/integrations" }] },
  { title: "Resources", links: [{ label: "FAQ", href: "/faq" }, { label: "Help Center", href: "/contact" }, { label: "Privacy", href: "/privacy" }] },
  { title: "Company", links: [{ label: "About TrackUp", href: "/" }, { label: "Terms of Service", href: "/terms" }, { label: "Contact", href: "/contact" }] },
];

const socialLinks = [{ label: "GitHub", href: "https://github.com/TheSeifDev/traking", icon: GithubIcon }, { label: "LinkedIn", href: "https://www.linkedin.com/in/theseifdev/", icon: LinkedinIcon }];
const currentYear = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#8065ff]/60 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-75 w-[80vw] max-w-175 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5a3cff]/10 blur-[130px]" />
      <div className="relative mx-auto w-full max-w-[90rem] px-6 py-14 sm:px-8 lg:px-12 lg:py-16">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-[1.35fr_repeat(4,minmax(0,1fr))]">
          <div className="col-span-2 flex flex-col gap-4 sm:col-span-3 lg:col-span-1"><Link href="/" className="flex w-fit items-center gap-2 transition-opacity duration-200 hover:opacity-85"><Image src="/logo.webp" alt="TrackUp" width={128} height={128} priority className="h-9 w-9 object-contain sm:h-10 sm:w-10" /><span className="text-lg font-semibold tracking-[-0.04em] text-white">TrackUp</span></Link><p className="max-w-70 text-sm leading-6 text-white/50">Track. Understand. Improve. Video intelligence for ClickUp-connected teams.</p><div className="mt-1 flex items-center gap-3">{socialLinks.map(({ label, href, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/3 text-white/60 transition duration-200 hover:border-white/20 hover:bg-white/7 hover:text-white"><Icon size={16} /></a>)}</div></div>
          {footerColumns.map((column) => <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3.5"><h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">{column.title}</h2>{column.links.map((link) => <Link key={`${column.title}-${link.label}`} href={link.href} className="w-fit text-sm text-white/60 transition-colors duration-200 hover:text-white">{link.label}</Link>)}</nav>)}
        </div>
        <div className="mt-12 flex flex-col items-center gap-4 border-t border-white/10 pt-6 sm:flex-row sm:justify-between lg:mt-14"><p className="text-xs text-white/40 sm:text-sm">© {currentYear} TrackUp. All rights reserved.</p><p className="text-xs text-white/35 sm:text-sm">Built with care by TheSeifDev</p></div>
      </div>
    </footer>
  );
}
