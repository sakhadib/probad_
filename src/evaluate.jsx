import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  Timestamp
} from "firebase/firestore";
import { useAuth } from './contexts/AuthContext';
import {
  Lock,
  Clock,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  X,
  Quote,
  Lightbulb,
  Hash,
  Heart,
  Globe,
  Brain
} from 'lucide-react';
import { db } from "./firebase/config";
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

const Evaluate = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lockingInProgress, setLockingInProgress] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [evaluations, setEvaluations] = useState({});

  // Helper function to sanitize email for Firebase document field
  const sanitizeEmail = (email) => {
    return email.replace(/\./g, '_DOT_');
  };

  // Helper function to check if document is locked and should be skipped
  const shouldSkipDocument = (docData, currentUserEmail) => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    // If no lock, it's available
    if (!docData.lock) {
      return false;
    }

    // If locked by current user, it's available for them
    if (docData.locked_by === sanitizeEmail(currentUserEmail)) {
      return false;
    }

    // If locked but no locked_at timestamp, skip it (shouldn't happen but safety check)
    if (!docData.locked_at) {
      return true;
    }

    // Convert Firestore timestamp to Date
    const lockedAt = docData.locked_at.toDate ? docData.locked_at.toDate() : new Date(docData.locked_at);

    // If locked more than 24 hours ago, it's available
    if (lockedAt < twentyFourHoursAgo) {
      return false;
    }

    // Otherwise, it's locked and should be skipped
    return true;
  };

  // Function to lock a document
  const lockDocument = async (docId, userEmail) => {
    try {
      const docRef = doc(db, "eval", docId);
      await updateDoc(docRef, {
        lock: true,
        locked_by: sanitizeEmail(userEmail),
        locked_at: Timestamp.now()
      });
      return true;
    } catch (error) {
      console.error("Error locking document:", error);
      return false;
    }
  };

  // Function to submit evaluations
  const submitEvaluations = async () => {
    setProcessingAction(true);
    try {
      const updatedPredictions = document.predictions.map(pred => {
        const evalData = evaluations[pred.model];
        if (evalData && evalData.semantic && evalData.cultural) {
          return {
            ...pred,
            semantic_score: evalData.semantic,
            cultural_score: evalData.cultural,
            evaluated_by: sanitizeEmail(user.email),
            evaluated_at: Timestamp.now()
          };
        }
        return pred;
      });
      await updateDoc(doc(db, "eval", document.id), {
        predictions: updatedPredictions,
        status: "completed",
        lock: false,
        locked_by: null,
        locked_at: null
      });
      navigate('/evaluation-dashboard');
    } catch (error) {
      console.error("Error submitting evaluations:", error);
      setError("Failed to submit evaluations. Please try again.");
    } finally {
      setProcessingAction(false);
    }
  };

  // Function to find and lock the next available document
  const findAndLockDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError("No authenticated user found");
        return;
      }

      const userEmail = user.email;

      // Query for pending documents in eval collection ordered by status (using the index)
      const q = query(
        collection(db, "eval"),
        where("status", "==", "pending"),
        orderBy("status", "asc"),
        limit(50) // Get multiple documents to find an available one
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("No pending evaluation documents found");
        return;
      }

      let availableDoc = null;
      let availableDocData = null;

      // Iterate through documents to find an available one
      for (const docSnapshot of querySnapshot.docs) {
        const docData = docSnapshot.data();

        if (!shouldSkipDocument(docData, userEmail)) {
          availableDoc = docSnapshot;
          availableDocData = docData;
          break;
        }
      }

      if (!availableDoc) {
        setError("No available evaluation documents found. All pending documents are currently locked by other users.");
        return;
      }

      // Lock the document
      setLockingInProgress(true);
      const lockSuccess = await lockDocument(availableDoc.id, userEmail);

      if (!lockSuccess) {
        setError("Failed to lock the document. Please try again.");
        return;
      }

      // Update the document data with lock information
      const updatedDocData = {
        ...availableDocData,
        id: availableDoc.id,
        lock: true,
        locked_by: sanitizeEmail(userEmail),
        locked_at: Timestamp.now()
      };

      setDocument(updatedDocData);

    } catch (error) {
      console.error("Error finding document:", error);
      setError(`Error loading document: ${error.message}`);
    } finally {
      setLoading(false);
      setLockingInProgress(false);
    }
  };

  useEffect(() => {
    // Only try to load document if user is authenticated and auth is not loading
    if (!authLoading) {
      if (isAuthenticated) {
        findAndLockDocument();
      } else {
        setError("Please log in to access the evaluation page");
        setLoading(false);
      }
    }
  }, [authLoading, isAuthenticated]);

  // Handle auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto mb-4"></div>
          <p className="text-sm tracking-wide uppercase text-slate-400">Preparing workspace</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto mb-4"></div>
          <p className="text-sm tracking-wide uppercase text-slate-400">
            {lockingInProgress ? "Locking document" : "Finding available document"}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-red-100 bg-white p-6 shadow">
          <div className="flex items-center gap-3 mb-4 text-red-600">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-semibold">Something went wrong</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{error}</p>
          <button
            onClick={findAndLockDocument}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <FileText className="h-16 w-16 text-indigo-400 mx-auto mb-4" />
          <p className="text-slate-500">No document available for evaluation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen font-hind-siliguri bg-gray-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-100" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex flex-col gap-3">
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs uppercase tracking-[0.25em] text-indigo-600">
            <Lock className="h-4 w-4" /> Evaluation Mode
          </span>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">Evaluate AI predictions</h1>
          <p className="text-sm md:text-base text-slate-600">Review and score AI model predictions for semantic and cultural accuracy.</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 mb-8 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-slate-600">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Lock className="h-3.5 w-3.5" />
                </span>
                Document locked for you
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                <span className="font-mono text-xs text-slate-500">{document.locked_by?.replace(/_DOT_/g, '.')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-500">
                  {document.locked_at?.toDate ? document.locked_at.toDate().toLocaleString() : 'Just now'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="hidden sm:inline">Doc ID</span>
              <span className="rounded-md border border-gray-200 bg-slate-100 px-3 py-1 font-mono">{document.id}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:rounded-3xl sm:border sm:border-gray-200 sm:p-8 mb-8 sm:shadow-lg">
          <div className="text-left sm:text-center space-y-4 sm:space-y-6">
            <div className="flex items-center justify-start sm:justify-center gap-3">
              <span className="flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-transparent sm:bg-indigo-50 text-indigo-500">
                <Quote className="h-4 w-4 sm:h-6 sm:w-6" />
              </span>
              <h2 className="text-lg sm:text-2xl font-semibold text-slate-900">Bengali proverb under evaluation</h2>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="border border-indigo-100 bg-white sm:bg-indigo-50 p-4 sm:p-6 sm:rounded-2xl text-left">
                <p className="text-xl sm:text-4xl font-bold text-slate-900 mb-2 sm:mb-4 leading-tight">
                  {document.proverb?.text}
                </p>
              </div>
              <div className="border border-emerald-100 bg-white sm:bg-emerald-50 p-4 sm:p-6 sm:rounded-2xl text-left">
                <h3 className="text-base sm:text-lg font-semibold text-slate-800 sm:text-emerald-800 mb-2 sm:mb-3">Figurative Meaning</h3>
                <p className="text-base sm:text-lg font-medium text-slate-700 sm:text-emerald-700 leading-relaxed">
                  {document.proverb?.figurative_meaning}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-lg">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                <Brain className="h-6 w-6" />
              </span>
              <h2 className="text-2xl font-semibold text-slate-900">AI Model Evaluations</h2>
              {/* <p className="text-sm text-slate-600">Rate each AI model's semantic and cultural understanding of the proverb</p> */}
            </div>

            <Swiper
              grabCursor={true}
              slidesPerView={1}
              spaceBetween={20}
              className="mySwiper"
            >
              {document.predictions?.map((prediction, index) => (
                <SwiperSlide key={index}>
                  <div className="rounded-2xl border border-gray-200 bg-slate-50 p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">{prediction.model}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        prediction.evaluated_by ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {prediction.evaluated_by ? 'Evaluated' : 'Pending'}
                      </span>
                    </div>

                    {prediction.prediction && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">AI Prediction:</h4>
                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <p className="text-slate-800">{prediction.prediction}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Semantic Accuracy (1-5)
                        </label>
                        <select
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          value={evaluations[prediction.model]?.semantic || prediction.semantic_score || ""}
                          onChange={(e) => setEvaluations(prev => ({ ...prev, [prediction.model]: { ...prev[prediction.model], semantic: e.target.value } }))}
                          disabled={prediction.evaluated_by !== null}
                        >
                          <option value="">Select score</option>
                          <option value="1">1 - Poor</option>
                          <option value="2">2 - Below Average</option>
                          <option value="3">3 - Average</option>
                          <option value="4">4 - Good</option>
                          <option value="5">5 - Excellent</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Cultural Accuracy (1-5)
                        </label>
                        <select
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          value={evaluations[prediction.model]?.cultural || prediction.cultural_score || ""}
                          onChange={(e) => setEvaluations(prev => ({ ...prev, [prediction.model]: { ...prev[prediction.model], cultural: e.target.value } }))}
                          disabled={prediction.evaluated_by !== null}
                        >
                          <option value="">Select score</option>
                          <option value="1">1 - Poor</option>
                          <option value="2">2 - Below Average</option>
                          <option value="3">3 - Average</option>
                          <option value="4">4 - Good</option>
                          <option value="5">5 - Excellent</option>
                        </select>
                      </div>
                    </div>

                    {prediction.evaluated_by && (
                      <div className="mt-4 text-xs text-slate-500">
                        Evaluated by {prediction.evaluated_by.replace(/_DOT_/g, '.')} on {prediction.evaluated_at?.toDate ? prediction.evaluated_at.toDate().toLocaleString() : 'Unknown'}
                      </div>
                    )}
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm mt-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-center">
            <button
              onClick={() => navigate('/evaluation-dashboard')}
              className="flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition-shadow bg-slate-600 text-white shadow hover:shadow-lg"
            >
              <X size={18} />
              <span>Cancel Evaluation</span>
            </button>
            <button
              onClick={submitEvaluations}
              disabled={processingAction}
              className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition-shadow ${
                processingAction
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-blue-600 text-white shadow hover:shadow-lg'
              }`}
            >
              {processingAction ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Submitting</span>
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  <span>Submit Evaluations</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Evaluate;