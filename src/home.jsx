import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAnalyticsData } from "./utils/analytics";
import { Globe2, ShieldCheck, Sparkles, Users, BarChart3 } from "lucide-react";

const TOTAL_PROVERBS = 6518;

const Home = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await getAnalyticsData();
        setAnalytics(data || {});
      } catch (error) {
        console.error("Failed to load analytics data", error);
        setAnalytics({});
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const doneCount = analytics?.done || 0;
  const editedCount = analytics?.edited || 0;
  const problematicCount = analytics?.problematic || 0;
  const pendingCount = Math.max(TOTAL_PROVERBS - (doneCount + problematicCount), 0);

  const highlightStats = [
    {
      label: "Total Proverbs",
      value: TOTAL_PROVERBS.toLocaleString(),
      description: "Structured Bangla entries with cross-lingual metadata",
      icon: Globe2,
    },
    {
      label: "Verified",
      value: doneCount.toLocaleString(),
      description: "Completed by native linguists inside probad_",
      icon: ShieldCheck,
    },
    {
      label: "Pending Review",
      value: pendingCount.toLocaleString(),
      description: "Awaiting expert verification",
      icon: Sparkles,
    },
  ];

  const capabilityCards = [
    {
      title: "Rich Metadata",
      body: "Every proverb links Bangla text, transliteration, figurative meaning, semantic roles, and usage contexts.",
      accent: "indigo",
    },
    {
      title: "Cross-Lingual Bridges",
      body: "Instant access to English, Arabic, and Hindi equivalents for comparative research.",
      accent: "emerald",
    },
    {
      title: "Scholarly Workflow",
      body: "Lock, edit, and review with audit-ready provenance tailored for academic rigor.",
      accent: "rose",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-hind-siliguri text-slate-900">
      <main className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-100 via-white to-emerald-100" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <section className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 text-indigo-700 px-4 py-1 text-sm font-medium tracking-wide uppercase">
                <Sparkles className="h-4 w-4" />
                Largest Bangla Proverb Corpus
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
                Curate the cultural memory of Bangla proverbs
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed">
                probad_ empowers Bangla linguists to audit, edit, and verify a living corpus of 6,500+ proverbs. Preserve figurative meaning, cultural annotations, and multilingual mappings with a workflow built for scholarly collaboration.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-white text-sm font-semibold shadow hover:bg-indigo-500 transition"
                >
                  Join the Reviewer Cohort
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition"
                >
                  Access Review Workspace
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-indigo-200/50 via-white to-emerald-200/40 blur-3xl" />
              <div className="relative rounded-3xl border border-white shadow-xl bg-white/90 backdrop-blur p-8 space-y-8">
                <div className="flex items-center gap-3 text-indigo-600">
                  <BarChart3 className="h-6 w-6" />
                  <span className="text-sm font-semibold uppercase tracking-widest text-slate-500">Corpus Snapshot</span>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  {highlightStats.map(({ label, value, description, icon: Icon }) => (
                    <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-sm">
                      <div className="flex items-center gap-3 text-indigo-500">
                        <SpanIcon Icon={Icon} />
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-slate-900">{loading ? "—" : value}</p>
                      <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
                  <h3 className="text-lg font-semibold text-emerald-700">Editorial Impact</h3>
                  <p className="mt-2 text-sm text-emerald-800">
                    {loading
                      ? "Tracking real-time contributions..."
                      : `${editedCount.toLocaleString()} proverbs refined with expert edits, ${problematicCount.toLocaleString()} flagged for deeper cultural review.`}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-wider text-emerald-600">
                    Collaborators worldwide · Secure Firestore workflow
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-24 space-y-12">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-semibold text-slate-900">Designed for linguistic scholarship</h2>
              <p className="mt-4 text-lg text-slate-600">
                Built with academic reviewers, anthropologists, and digital humanists to keep Bangla proverb heritage authenticated and accessible.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {capabilityCards.map(({ title, body, accent }) => (
                <CapabilityCard key={title} title={title} body={body} accent={accent} />
              ))}
            </div>
          </section>

          <section className="mt-24 rounded-3xl border border-slate-200 bg-white shadow-sm p-10">
            <div className="grid gap-10 md:grid-cols-[1.2fr,1fr] md:items-center">
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-slate-900">Community of custodians</h3>
                <p className="text-slate-600">
                  Join a trusted circle of linguists and cultural historians safeguarding proverb knowledge. Collaborate asynchronously, leave audit trails, and deliver peer-reviewed updates to the national corpus.
                </p>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <Users className="h-5 w-5 text-indigo-500" />
                  <span>Dedicated reviewer analytics & contribution tracking</span>
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-8 text-center shadow">
                <p className="text-sm uppercase tracking-widest text-indigo-500">Get started</p>
                <h4 className="mt-3 text-xl font-semibold text-slate-900">Ready to review?</h4>
                <p className="mt-2 text-sm text-slate-600">Sign in with your reviewer credentials or request access.</p>
                <div className="mt-6 flex flex-col gap-3">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                  >
                    Enter workspace
                  </Link>
                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center rounded-full border border-indigo-200 px-5 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
                  >
                    Request reviewer access
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

const SpanIcon = ({ Icon }) => (
  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow">
    <Icon className="h-5 w-5" />
  </span>
);

const CapabilityCard = ({ title, body, accent }) => {
  const accentStyles = {
    indigo: {
      ring: "ring-1 ring-indigo-100",
      badge: "bg-indigo-100 text-indigo-600",
    },
    emerald: {
      ring: "ring-1 ring-emerald-100",
      badge: "bg-emerald-100 text-emerald-600",
    },
    rose: {
      ring: "ring-1 ring-rose-100",
      badge: "bg-rose-100 text-rose-600",
    },
  };

  const { ring, badge } = accentStyles[accent] || accentStyles.indigo;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-lg ${ring}`}>
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badge}`}>
        {title}
      </span>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
};

export default Home;
