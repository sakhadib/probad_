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
  deleteDoc,
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
  Brain,
  Trash2
} from 'lucide-react';
import { db } from "./firebase/config";
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import { askModel } from './utils/ask';

const Evaluate = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lockingInProgress, setLockingInProgress] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [evaluations, setEvaluations] = useState({});
  const [askLoading, setAskLoading] = useState({});

  // Helper function to sanitize email for Firebase document field
  const sanitizeEmail = (email) => {
    return email.replace(/\./g, '_DOT_');
  };

  // Helper function to check if any predictions have been fetched
  const hasAnyPredictionsFetched = (document) => {
    if (!document || !document.predictions) return false;
    return document.predictions.some(pred => 
      pred.prediction !== null || pred.fetch === true
    );
  };

  // Function to remove document from evaluation
  const handleRemoveFromEvaluation = async () => {
    if (!document || !user) {
      setError("Document or user not available");
      return;
    }

    // Check if any predictions have been fetched
    if (hasAnyPredictionsFetched(document)) {
      setError("Cannot remove: At least one model prediction has been fetched. You can only remove before fetching any predictions.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove this proverb from the evaluation set? This will delete the evaluation document and reset its status."
    );

    if (!confirmed) return;

    try {
      setProcessingAction(true);
      setError(null);

      // Step 1: Delete the document from eval collection
      await deleteDoc(doc(db, "eval", document.id));
      console.log(`Deleted eval document: ${document.id}`);

      // Step 2: Find the original probad document using probad_id or other identifier
      // The eval doc should have all the fields from the original probad doc
      // We need to find it in probad collection and set taken to false
      if (document.probad_id) {
        const probadRef = doc(db, "probad", document.probad_id);
        await updateDoc(probadRef, {
          taken: false
        });
        console.log(`Reset taken field for probad: ${document.probad_id}`);
      } else {
        // If no probad_id, we need to search by matching fields
        // This is a fallback - ideally probad_id should be stored
        const probadQuery = query(
          collection(db, "probad"),
          where("proverb.text", "==", document.proverb?.text),
          limit(1)
        );
        const probadSnapshot = await getDocs(probadQuery);
        if (!probadSnapshot.empty) {
          const probadDocRef = doc(db, "probad", probadSnapshot.docs[0].id);
          await updateDoc(probadDocRef, {
            taken: false
          });
          console.log(`Reset taken field for probad: ${probadSnapshot.docs[0].id}`);
        }
      }

      // Find and lock the next document
      await findAndLockDocument();

    } catch (error) {
      console.error("Error removing from evaluation:", error);
      setError(`Failed to remove from evaluation: ${error.message}`);
    } finally {
      setProcessingAction(false);
    }
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
        status: "done",
        completed_at: Timestamp.now(),
        completed_by: sanitizeEmail(user.email),
        lock: false,
        locked_by: null,
        locked_at: null
      });

      // Update analytics
      const analyticsRef = doc(db, "analytics", "eval_analytics");
      
      try {
        const analyticsSnap = await getDocs(query(collection(db, "analytics"), where("__name__", "==", "eval_analytics")));
        
        if (!analyticsSnap.empty) {
          const analyticsData = analyticsSnap.docs[0].data();
          const userEmail = user.email;
          let contribution = analyticsData.contribution || [];
          let userContribution = contribution.find(c => c.email === userEmail);
          
          if (!userContribution) {
            userContribution = { email: userEmail, proverb: 0 };
            contribution.push(userContribution);
          }
          
          userContribution.proverb += 1;
          
          await updateDoc(analyticsRef, {
            done: (analyticsData.done || 0) + 1,
            contribution: contribution
          });
        }
      } catch (analyticsError) {
        console.error("Error updating analytics:", analyticsError);
        // Don't fail the whole operation for analytics error
      }

      // Find and lock the next document
      await findAndLockDocument();
    } catch (error) {
      console.error("Error submitting evaluations:", error);
      setError("Failed to submit evaluations. Please try again.");
    } finally {
      setProcessingAction(false);
    }
  };

  // Function to save individual prediction evaluation
  const savePredictionEvaluation = async (modelId) => {
    const evalData = evaluations[modelId];
    if (!evalData || evalData.semantic === undefined || evalData.semantic === null || evalData.cultural === undefined || evalData.cultural === null) {
      setError("Please select both semantic and cultural scores before saving.");
      return;
    }

    try {
      const wasPreviouslyUnevaluated = !document.predictions.find(p => p.model === modelId)?.evaluated_by;

      // Update predictions array with the evaluation data
      const updatedPredictions = document.predictions.map(pred =>
        pred.model === modelId
          ? {
              ...pred,
              semantic_score: evalData.semantic,
              cultural_score: evalData.cultural,
              evaluated_by: sanitizeEmail(user.email),
              evaluated_at: Timestamp.now()
            }
          : pred
      );

      // Update Firebase
      await updateDoc(doc(db, "eval", document.id), {
        predictions: updatedPredictions
      });

      // Update local state
      setDocument(prev => ({
        ...prev,
        predictions: updatedPredictions
      }));

      // Update analytics if this was the first evaluation
      if (wasPreviouslyUnevaluated) {
        const analyticsRef = doc(db, "analytics", "eval_analytics");
        
        try {
          const analyticsSnap = await getDocs(query(collection(db, "analytics"), where("__name__", "==", "eval_analytics")));
          
          if (!analyticsSnap.empty) {
            const analyticsData = analyticsSnap.docs[0].data();
            const userEmail = user.email;
            let contribution = analyticsData.contribution || [];
            let userContribution = contribution.find(c => c.email === userEmail);
            
            if (!userContribution) {
              userContribution = { email: userEmail, script_count: 0 };
              contribution.push(userContribution);
            }
            
            userContribution.script_count += 1;
            
            await updateDoc(analyticsRef, {
              script_done: (analyticsData.script_done || 0) + 1,
              contribution: contribution
            });
          }
        } catch (analyticsError) {
          console.error("Error updating analytics:", analyticsError);
          // Don't fail the whole operation for analytics error
        }
      }

      // Clear evaluations for this model
      setEvaluations(prev => {
        const newEvals = { ...prev };
        delete newEvals[modelId];
        return newEvals;
      });

    } catch (error) {
      console.error("Error saving evaluation:", error);
      setError("Failed to save evaluation. Please try again.");
    }
  };

  // Function to undo individual prediction evaluation
  const undoPredictionEvaluation = async (modelId) => {
    try {
      // Update predictions array to clear evaluation data
      const updatedPredictions = document.predictions.map(pred =>
        pred.model === modelId
          ? {
              ...pred,
              semantic_score: null,
              cultural_score: null,
              evaluated_by: null,
              evaluated_at: null
            }
          : pred
      );

      // Update Firebase
      await updateDoc(doc(db, "eval", document.id), {
        predictions: updatedPredictions
      });

      // Update local state
      setDocument(prev => ({
        ...prev,
        predictions: updatedPredictions
      }));

      // Update analytics (decrement count)
      const analyticsRef = doc(db, "analytics", "eval_analytics");
      
      try {
        const analyticsSnap = await getDocs(query(collection(db, "analytics"), where("__name__", "==", "eval_analytics")));
        
        if (!analyticsSnap.empty) {
          const analyticsData = analyticsSnap.docs[0].data();
          const userEmail = user.email;
          let contribution = analyticsData.contribution || [];
          let userContribution = contribution.find(c => c.email === userEmail);
          
          if (userContribution && userContribution.script_count > 0) {
            userContribution.script_count -= 1;
            
            await updateDoc(analyticsRef, {
              script_done: Math.max(0, (analyticsData.script_done || 0) - 1),
              contribution: contribution
            });
          }
        }
      } catch (analyticsError) {
        console.error("Error updating analytics:", analyticsError);
        // Don't fail the whole operation for analytics error
      }

    } catch (error) {
      console.error("Error undoing evaluation:", error);
      setError("Failed to undo evaluation. Please try again.");
    }
  };

  // Function to ask AI model for prediction
  const handleAsk = async (modelId) => {
    console.log('Asking AI for model:', modelId);
    console.log('Proverb text:', document.proverb?.text);
    setAskLoading(prev => ({ ...prev, [modelId]: true }));
    try {
      const response = await askModel(modelId, document.proverb?.text);
      console.log('AI response:', response);

      // Update predictions array with the new prediction
      const updatedPredictions = document.predictions.map(pred =>
        pred.model === modelId
          ? { ...pred, prediction: response, fetch: true }
          : pred
      );

      // Update Firebase
      await updateDoc(doc(db, "eval", document.id), {
        predictions: updatedPredictions
      });

      // Update local state
      setDocument(prev => ({
        ...prev,
        predictions: updatedPredictions
      }));

    } catch (error) {
      console.error("Error getting AI prediction:", error);
      setError(`Failed to get AI prediction: ${error.message}`);
    } finally {
      setAskLoading(prev => ({ ...prev, [modelId]: false }));
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
      const sanitizedEmail = sanitizeEmail(userEmail);

      // First, check if there's already a document locked by this user with status not "done"
      const userLockedQuery = query(
        collection(db, "eval"),
        where("locked_by", "==", sanitizedEmail),
        where("status", "!=", "done")
      );

      const userLockedSnapshot = await getDocs(userLockedQuery);

      if (!userLockedSnapshot.empty) {
        // Found a document already locked by this user
        const docSnapshot = userLockedSnapshot.docs[0];
        const docData = docSnapshot.data();
        
        setDocument({
          ...docData,
          id: docSnapshot.id
        });
        return;
      }

      // If no user-locked document found, proceed with finding a pending document
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
        locked_by: sanitizedEmail,
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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-100 hidden sm:block" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex flex-col gap-3">
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs uppercase tracking-[0.25em] text-indigo-600">
            <Lock className="h-4 w-4" /> Evaluation Mode
          </span>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">Evaluate AI predictions</h1>
          <p className="text-sm md:text-base text-slate-600">Review and score AI model predictions for semantic and cultural accuracy.</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 mb-8 shadow-sm hidden md:block">
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

        <div className="p-4 sm:rounded-3xl sm:border sm:border-gray-200 sm:p-8 mb-8 sm:shadow-lg">
          <div className="text-left sm:text-center space-y-4 sm:space-y-6">
            <div className="flex items-center justify-start sm:justify-center gap-3">
              <span className="flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-transparent sm:bg-indigo-50 text-indigo-500">
                <Quote className="h-4 w-4 sm:h-6 sm:w-6" />
              </span>
              <h2 className="text-lg sm:text-2xl font-semibold text-slate-900">Bengali proverb under evaluation</h2>
            </div>

            <div className="space-y-0 sm:space-y-6">
              <div className="sm:bg-indigo-50 p-4 sm:p-6 sm:rounded-2xl text-left">
                <p className="text-xl sm:text-4xl font-bold text-slate-900 mb-2 sm:mb-4 leading-tight">
                  {document.proverb?.text}
                </p>
              </div>
              <div className="sm:bg-emerald-50 p-4 sm:p-6 sm:rounded-2xl text-left">
                <h3 className="text-base sm:text-lg font-semibold text-slate-800 sm:text-emerald-800 mb-2 sm:mb-3">Figurative Meaning</h3>
                <p className="text-base sm:text-lg font-medium text-slate-700 sm:text-emerald-700 leading-relaxed">
                  {document.proverb?.figurative_meaning}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="">
          <div className="text-left space-y-6">
            <div className="flex items-center justify-left gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                <Brain className="h-6 w-6" />
              </span>
              <div className="flex flex-col">
                <h2 className="text-2xl font-semibold text-slate-900">AI Model Evaluations</h2>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((document.predictions?.filter(prediction => prediction.evaluated_by).length || 0) / (document.predictions?.length || 15)) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      {document.predictions?.filter(prediction => prediction.evaluated_by).length || 0} of {document.predictions?.length || 15} completed
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Swiper
              grabCursor={true}
              slidesPerView={1}
              spaceBetween={20}
              className="mySwiper"
            >
              {document.predictions?.map((prediction, index) => (
                <SwiperSlide key={index}>
                  <div className="bg-slate-50 p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">{prediction.model}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        prediction.evaluated_by ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {prediction.evaluated_by ? 'Evaluated' : 'Pending'}
                      </span>
                    </div>

                    {!prediction.prediction ? (
                      <div className="mb-4">
                        <button
                          onClick={() => handleAsk(prediction.model)}
                          disabled={askLoading[prediction.model]}
                          className={`inline-flex items-center gap-3 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 ${
                            askLoading[prediction.model]
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                              : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
                          }`}
                        >
                          {askLoading[prediction.model] ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-400"></div>
                              <span>এ আই টি ভাবছে অপেক্ষা করুন ...</span>
                            </>
                          ) : (
                            <>
                              <Brain className="h-5 w-5" />
                              <span>এ আই কে জিজ্ঞেস করুন</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="mb-4">
                        {/* <h4 className="text-sm font-semibold text-slate-700 mb-2">AI Prediction:</h4> */}
                        <div className="">
                          <p className="text-slate-800 whitespace-pre-wrap">{prediction.prediction}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Semantic Accuracy (0-5)
                        </label>
                        <div className="flex gap-2">
                          {[0, 1, 2, 3, 4, 5].map((score) => (
                            <label key={score} className="flex-1">
                              <input
                                type="radio"
                                name={`semantic-${prediction.model}`}
                                value={score}
                                checked={(evaluations[prediction.model]?.semantic || prediction.semantic_score || "") === score.toString()}
                                onChange={(e) => setEvaluations(prev => ({ ...prev, [prediction.model]: { ...prev[prediction.model], semantic: e.target.value } }))}
                                disabled={prediction.evaluated_by !== null || !prediction.prediction}
                                className="sr-only"
                              />
                              <div className={`w-full aspect-square rounded-lg border-2 flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${
                                (evaluations[prediction.model]?.semantic || prediction.semantic_score || "") === score.toString()
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                              } ${(prediction.evaluated_by !== null || !prediction.prediction) ? 'cursor-not-allowed opacity-50' : ''}`}>
                                {score}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Cultural Accuracy (0-5)
                        </label>
                        <div className="flex gap-2">
                          {[0, 1, 2, 3, 4, 5].map((score) => (
                            <label key={score} className="flex-1">
                              <input
                                type="radio"
                                name={`cultural-${prediction.model}`}
                                value={score}
                                checked={(evaluations[prediction.model]?.cultural || prediction.cultural_score || "") === score.toString()}
                                onChange={(e) => setEvaluations(prev => ({ ...prev, [prediction.model]: { ...prev[prediction.model], cultural: e.target.value } }))}
                                disabled={prediction.evaluated_by !== null || !prediction.prediction}
                                className="sr-only"
                              />
                              <div className={`w-full aspect-square rounded-lg border-2 flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${
                                (evaluations[prediction.model]?.cultural || prediction.cultural_score || "") === score.toString()
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                              } ${(prediction.evaluated_by !== null || !prediction.prediction) ? 'cursor-not-allowed opacity-50' : ''}`}>
                                {score}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {!prediction.evaluated_by && (
                      <div className="mt-6 flex justify-center">
                        <button
                          onClick={() => savePredictionEvaluation(prediction.model)}
                          className={`inline-flex items-center gap-3 px-8 py-4 rounded-xl text-base font-semibold transition-all duration-200 transform hover:scale-105 ${
                            (evaluations[prediction.model]?.semantic === undefined || evaluations[prediction.model]?.semantic === null || evaluations[prediction.model]?.cultural === undefined || evaluations[prediction.model]?.cultural === null || !prediction.prediction)
                              ? 'bg-slate-100 text-slate-700 cursor-not-allowed'
                              : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl hover:scale-105'
                          }`}
                          disabled={evaluations[prediction.model]?.semantic === undefined || evaluations[prediction.model]?.semantic === null || evaluations[prediction.model]?.cultural === undefined || evaluations[prediction.model]?.cultural === null || !prediction.prediction}
                        >
                          <CheckCircle size={20} />
                          <span>Save Evaluation</span>
                        </button>
                      </div>
                    )}

                    {prediction.evaluated_by && (
                      <div className="mt-6 flex justify-center">
                        <button
                          onClick={() => undoPredictionEvaluation(prediction.model)}
                          className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-base font-semibold transition-all duration-200 transform hover:scale-105 bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700 shadow-lg hover:shadow-xl"
                        >
                          <X size={20} />
                          <span>Undo Evaluation</span>
                        </button>
                      </div>
                    )}

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

        {(() => {
          const allEvaluated = document.predictions?.every(prediction => prediction.evaluated_by);
          const totalPredictions = document.predictions?.length || 0;
          const evaluatedCount = document.predictions?.filter(prediction => prediction.evaluated_by).length || 0;

          return (
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm mt-10">
              {!allEvaluated && (
                <div className="text-center mb-4">
                  <p className="text-sm text-slate-600">
                    Progress: {evaluatedCount} of {totalPredictions} evaluations completed
                  </p>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(evaluatedCount / totalPredictions) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-center">
                <button
                  onClick={submitEvaluations}
                  disabled={processingAction || !allEvaluated}
                  className={`flex items-center gap-3 rounded-full px-10 py-4 text-lg font-bold transition-all duration-200 transform ${
                    allEvaluated && !processingAction
                      ? 'bg-gradient-to-r from-green-500 to-blue-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 animate-pulse'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {processingAction ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      <span>Submitting</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={24} />
                      <span>Submit All Evaluations</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleRemoveFromEvaluation}
                  disabled={processingAction || hasAnyPredictionsFetched(document)}
                  className={`flex items-center gap-3 rounded-full px-10 py-4 text-lg font-bold transition-all duration-200 transform ${
                    !hasAnyPredictionsFetched(document) && !processingAction
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg hover:shadow-xl hover:scale-105'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                  title={hasAnyPredictionsFetched(document) ? "Cannot remove: At least one prediction has been fetched" : "Remove this proverb from evaluation set"}
                >
                  <Trash2 size={24} />
                  <span>Remove from Evaluation</span>
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default Evaluate;