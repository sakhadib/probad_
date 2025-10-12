import { Link, useLocation } from "react-router-dom";
import { Github, Mail, Twitter } from "lucide-react";

const Footer = () => {
  const location = useLocation();
  const hideOnAuthPages = location.pathname === "/signup" || location.pathname === "/login";

  if (hideOnAuthPages) {
    return null;
  }

  const footerLinks = [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Review Queue", to: "/review" },
    { label: "Profile", to: "/profile" }
  ];

  return (
    <footer className="bg-gray-950 text-gray-200 font-hind-siliguri border-t border-gray-800">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-slate-900 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid gap-10 lg:grid-cols-4">
            <div className="lg:col-span-2 space-y-4">
              <Link to="/dashboard" className="inline-flex items-center text-2xl font-semibold text-white tracking-tight">
                probad_
              </Link>
              <p className="text-gray-400 leading-relaxed">
                Community-led Sinhala proverb refinement. Lock a proverb, polish its meaning, and keep the shared knowledge base accurate for everyone.
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <div className="rounded-full bg-indigo-500/10 px-3 py-1">
                  Built for purposeful reviewers
                </div>
                <div className="rounded-full bg-purple-500/10 px-3 py-1">
                  Realtime Firestore powered
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Navigate</h3>
              <nav className="space-y-3 text-sm">
                {footerLinks.map(({ label, to }) => (
                  <Link
                    key={to}
                    to={to}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
                  >
                    <span className="h-1 w-1 rounded-full bg-gray-500" />
                    {label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Connect</h3>
              <p className="text-sm text-gray-400">
                Have an idea for a workflow tweak or a dataset to import? Reach out and help shape the next release.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/sakhadib/probad_"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition"
                  aria-label="GitHub repository"
                >
                  <Github className="h-5 w-5" />
                </a>
                <a
                  href="mailto:team@probad.app"
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition"
                  aria-label="Email the probad team"
                >
                  <Mail className="h-5 w-5" />
                </a>
                <a
                  href="https://twitter.com/sakhadib"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition"
                  aria-label="Follow on Twitter"
                >
                  <Twitter className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800 bg-black/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} probad_. Curated with collaborative care.</span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Last updated with community edits in real time.</span>
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-800 bg-white/5 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="uppercase tracking-wide text-[10px]">Live status</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
