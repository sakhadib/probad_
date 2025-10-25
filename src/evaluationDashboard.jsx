import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { db } from './firebase/config';
import {
  BarChart3,
  CheckCircle,
  Clock,
  AlertTriangle,
  Play,
  Brain,
  Users,
  Target,
  Trophy
} from 'lucide-react';

const EvaluationDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [evalStats, setEvalStats] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleStartEvaluation = () => {
    navigate('/evaluate');
  };

  useEffect(() => {
    const fetchEvalStats = async () => {
      try {
        setLoading(true);

        // Query eval collection for basic stats
        const evalQuery = query(collection(db, 'eval'));
        const evalSnapshot = await getDocs(evalQuery);

        const totalEval = evalSnapshot.size;
        let completedEval = 0;
        let inProgressEval = 0;

        evalSnapshot.forEach(doc => {
          const data = doc.data();
          const predictions = data.predictions || [];

          // Count completed predictions (those with semantic_score filled)
          const completedPredictions = predictions.filter(p => p.semantic_score !== null).length;

          if (completedPredictions === predictions.length && predictions.length > 0) {
            completedEval++;
          } else if (completedPredictions > 0) {
            inProgressEval++;
          }
        });

        const pendingEval = totalEval - (completedEval + inProgressEval);

        setEvalStats({
          total: totalEval,
          completed: completedEval,
          inProgress: inProgressEval,
          pending: pendingEval
        });

        // Fetch analytics data
        try {
          const analyticsRef = doc(db, 'analytics', 'eval_analytics');
          const analyticsSnap = await getDocs(query(collection(db, 'analytics'), where('__name__', '==', 'eval_analytics')));
          
          if (!analyticsSnap.empty) {
            const analytics = analyticsSnap.docs[0].data();
            setAnalyticsData(analytics);
          }
        } catch (analyticsError) {
          console.error('Error fetching analytics:', analyticsError);
          // Continue without analytics data
        }

      } catch (err) {
        setError('Failed to load evaluation statistics');
        console.error('Error fetching eval stats:', err);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch stats if user is authenticated and auth is not loading
    if (!authLoading) {
      if (isAuthenticated) {
        fetchEvalStats();
      } else {
        setError('Please log in to access the evaluation dashboard');
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

  if (error || !evalStats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-600">{error || 'No evaluation data available'}</p>
        </div>
      </div>
    );
  }

  const { total = 0, completed = 0, inProgress = 0, pending = 0 } = evalStats;

  // Calculate script-level statistics
  const totalScripts = total * 15;
  const completedScripts = analyticsData?.script_done || 0;
  const scriptProgressPercentage = totalScripts > 0 ? (completedScripts / totalScripts) * 100 : 0;

  // Sort contributions by script_count descending
  const sortedContributions = analyticsData?.contribution 
    ? [...analyticsData.contribution].sort((a, b) => b.script_count - a.script_count)
    : [];

  const stats = [
    {
      title: 'Total Proverbs',
      value: total,
      icon: BarChart3,
      iconBg: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'Completed Proverbs',
      value: completed,
      icon: CheckCircle,
      iconBg: 'bg-emerald-100 text-emerald-600'
    },
    {
      title: 'Total Scripts',
      value: totalScripts.toLocaleString(),
      icon: Target,
      iconBg: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'Scripts Done',
      value: completedScripts.toLocaleString(),
      icon: Trophy,
      iconBg: 'bg-amber-100 text-amber-600'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100/70 font-hind-siliguri">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="mb-8 rounded-3xl border border-blue-100 bg-white/80 backdrop-blur shadow-xl shadow-blue-100/40">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-6 md:p-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                <Brain className="h-4 w-4" />
                AI Evaluation Hub
              </span>
              <h1 className="mt-4 text-2xl md:text-3xl font-semibold text-gray-900">probad_ evaluation center</h1>
              <p className="mt-2 max-w-2xl text-sm md:text-base text-gray-600">
                Evaluate AI model predictions for Bengali proverbs. Compare semantic and cultural accuracy across multiple language models.
              </p>
            </div>
            <button
              onClick={handleStartEvaluation}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
            >
              <Play className="h-4 w-4" />
              Continue evaluation
            </button>
          </div>
          <div className="border-t border-blue-50 bg-blue-50/40 px-6 py-4 md:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="rounded-full bg-white px-2 py-1 font-semibold text-blue-600">{Math.round(scriptProgressPercentage)}%</span>
                <span>
                  {completedScripts.toLocaleString()} of {totalScripts.toLocaleString()} scripts evaluated
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white shadow-inner md:max-w-sm">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 transition-all"
                  style={{ width: `${scriptProgressPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <span className={`${stat.iconBg} rounded-2xl p-3 shadow-inner`}>
                    <IconComponent className="h-5 w-5" />
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2 mt-8">
          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg shadow-blue-50/40">
            <h3 className="text-lg font-semibold text-gray-900">Evaluation progress</h3>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Completed Proverbs</span>
                <span className="font-semibold text-green-600">{total > 0 ? ((completed / total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">In Progress Proverbs</span>
                <span className="font-semibold text-blue-600">{total > 0 ? ((inProgress / total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Pending Proverbs</span>
                <span className="font-semibold text-yellow-600">{total > 0 ? ((pending / total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Scripts Completed</span>
                <span className="font-semibold text-purple-600">{totalScripts > 0 ? ((completedScripts / totalScripts) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-lg shadow-purple-50/40">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top Contributors</h3>
            </div>
            <div className="space-y-3">
              {sortedContributions.length > 0 ? (
                sortedContributions.slice(0, 5).map((contributor, index) => (
                  <div key={contributor.email} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-100 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{contributor.email.replace(/_DOT_/g, '.')}</p>
                        <p className="text-xs text-gray-500">{contributor.script_count} scripts</p>
                      </div>
                    </div>
                    {index < 3 && (
                      <Trophy className={`h-4 w-4 ${
                        index === 0 ? 'text-yellow-500' :
                        index === 1 ? 'text-gray-400' :
                        'text-orange-500'
                      }`} />
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No contributions yet</p>
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};

export default EvaluationDashboard;