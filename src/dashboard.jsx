import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { getAnalyticsData } from './utils/analytics';
import {
  BarChart3,
  CheckCircle,
  Clock,
  AlertTriangle,
  Play
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleStartReview = () => {
    navigate('/review');
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const data = await getAnalyticsData();
        setAnalytics(data);
      } catch (err) {
        setError('Failed to load analytics data');
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch analytics if user is authenticated and auth is not loading
    if (!authLoading) {
      if (isAuthenticated) {
        fetchAnalytics();
      } else {
        setError('Please log in to access the dashboard');
        setLoading(false);
      }
    }
  }, [authLoading, isAuthenticated]);

  // Handle auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-600">{error || 'No analytics data available'}</p>
        </div>
      </div>
    );
  }

  const { total = 0, done = 0, problematic = 0, contribution = {} } = analytics;
  const pending = Math.max(total - (done + problematic), 0);

  // Helper function to sanitize email for Firebase field names (same as in analytics.js)
  const sanitizeEmail = (email) => {
    return email.replace(/\./g, '_dot_');
  };

  // Get current user's contribution count
  const userContribution = user?.email ? (contribution[sanitizeEmail(user.email)] || 0) : 0;

  const stats = [
    {
      title: 'Total Count',
      value: total,
      icon: BarChart3,
      iconBg: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'Done Count',
      value: done,
      icon: CheckCircle,
      iconBg: 'bg-emerald-100 text-emerald-600'
    },
    {
      title: 'Pending Count',
      value: pending,
      icon: Clock,
      iconBg: 'bg-amber-100 text-amber-600'
    },
    {
      title: 'Problematic',
      value: problematic,
      icon: AlertTriangle,
      iconBg: 'bg-rose-100 text-rose-600'
    },
  ];

  const progressPercentage = total > 0 ? ((done + problematic) / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-100/70 font-hind-siliguri">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="mb-8 rounded-3xl border border-blue-100 bg-white/80 backdrop-blur shadow-xl shadow-blue-100/40">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-6 md:p-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                Analytics Overview
              </span>
              <h1 className="mt-4 text-2xl md:text-3xl font-semibold text-gray-900">probad_ contribution pulse</h1>
              <p className="mt-2 max-w-2xl text-sm md:text-base text-gray-600">
                Stay aligned with the review flow. Track collective throughput, spot blocked queues, and jump back into the review lane quickly.
              </p>
            </div>
            <button
              onClick={handleStartReview}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
            >
              <Play className="h-4 w-4" />
              Continue reviewing
            </button>
          </div>
          <div className="border-t border-blue-50 bg-blue-50/40 px-6 py-4 md:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="rounded-full bg-white px-2 py-1 font-semibold text-blue-600">{Math.round(progressPercentage)}%</span>
                <span>
                  {done + problematic} of {total} documents processed
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white shadow-inner md:max-w-sm">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-green-500 to-emerald-500 transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const IconComponent = stat.icon;
            return (
              <article
                key={stat.title}
                className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-lg shadow-gray-100/40 transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.title}</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                  </div>
                  <span className={`${stat.iconBg} rounded-2xl p-3 shadow-inner`}> 
                    <IconComponent className="h-5 w-5" />
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg shadow-blue-50/40">
            <h3 className="text-lg font-semibold text-gray-900">Completion breakdown</h3>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Done</span>
                <span className="font-semibold text-green-600">{total > 0 ? ((done / total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Problematic</span>
                <span className="font-semibold text-red-600">{total > 0 ? ((problematic / total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Pending</span>
                <span className="font-semibold text-yellow-600">{total > 0 ? ((pending / total) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg shadow-emerald-50/40">
            <h3 className="text-lg font-semibold text-gray-900">Personal analytics</h3>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                <span className="text-gray-600">Documents touched</span>
                <span className="text-base font-semibold text-emerald-700">{userContribution.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                <span className="text-gray-600">Share of done</span>
                <span className="text-base font-semibold text-blue-700">
                  {done > 0 ? ((userContribution / done) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-purple-100 bg-purple-50/60 px-4 py-3">
                <span className="text-gray-600">Share of total</span>
                <span className="text-base font-semibold text-purple-700">
                  {total > 0 ? ((userContribution / total) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg shadow-rose-50/40">
            <h3 className="text-lg font-semibold text-gray-900">Contributor spotlight</h3>
            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
              <div className="grid grid-cols-[1fr_auto] bg-rose-50/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span>Reviewer</span>
                <span className="text-right">Contributions</span>
              </div>
              <div className="divide-y divide-gray-100 bg-white text-sm">
                {Object.entries(contribution)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([sanitizedEmail, value]) => {
                    const displayEmail = sanitizedEmail.replace(/_dot_/gi, '.');
                    return (
                      <div key={sanitizedEmail} className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2">
                        <span className="truncate text-gray-600" title={displayEmail}>{displayEmail}</span>
                        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                          {value.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                {Object.keys(contribution || {}).length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-gray-400">
                    No contributions recorded yet.
                  </div>
                )}
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
