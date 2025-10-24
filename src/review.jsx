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
import { markDocumentAsDone, problematic_inc } from './utils/analytics';
import { createEvalDocument } from './utils/evaluator';
import { 
  Lock, 
  Clock, 
  User, 
  FileText, 
  Globe, 
  Hash, 
  Heart,
  Lightbulb,
  Quote,
  AlertTriangle,
  CheckCircle,
  Edit3,
  Send
} from 'lucide-react';
import { db } from "./firebase/config";

const Review = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lockingInProgress, setLockingInProgress] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);


  // Helper function to sanitize email for Firebase document field
  const sanitizeEmail = (email) => {
    return email.replace(/\./g, '_DOT_');
  };

  // Helper function to check if document is locked and should be skipped
  const shouldSkipDocument = (docData, currentUserEmail) => {
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - (6 * 60 * 60 * 1000));

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
    
    // If locked more than 6 hours ago, it's available
    if (lockedAt < sixHoursAgo) {
      return false;
    }

    // Otherwise, it's locked and should be skipped
    return true;
  };

  // Function to lock a document
  const lockDocument = async (docId, userEmail) => {
    try {
      const docRef = doc(db, "probad", docId);
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

  // Function to mark document as done (atomic operation)
  const handleMarkAsDone = async () => {
    if (!document || !user) {
      setError("Document or user not available");
      return;
    }

    try {
      setProcessingAction(true);
      setError(null);

      const userEmail = user.email;
      const documentId = document.id;
      const wasPreviouslyDone = document.status === 'done';

      // Step 1: Update document status to "done" in Firestore
      const docRef = doc(db, "probad", documentId);
      await updateDoc(docRef, {
        status: "done",
        completed_by: sanitizeEmail(userEmail),
        completed_at: Timestamp.now(),
        lock: false, // Release the lock
        locked_by: null,
        locked_at: null
      });

      // Step 2: Update analytics (this calls markDocumentAsDone from analytics.js)
      await markDocumentAsDone(userEmail, wasPreviouslyDone);

      console.log(`Document ${documentId} marked as done by ${userEmail}`);
      
      // Load next document automatically
      await findAndLockDocument();

    } catch (error) {
      console.error("Error marking document as done:", error);
      setError(`Failed to mark document as done: ${error.message}`);
      
      // If there was an error, try to revert the document status
      try {
        const docRef = doc(db, "probad", document.id);
        await updateDoc(docRef, {
          status: "pending",
          completed_by: null,
          completed_at: null,
          lock: true,
          locked_by: sanitizeEmail(user.email),
          locked_at: Timestamp.now()
        });
        console.log("Reverted document status due to error");
      } catch (revertError) {
        console.error("Failed to revert document status:", revertError);
      }
    } finally {
      setProcessingAction(false);
    }
  };

  // Function to mark document as problematic (atomic operation)
  const handleMarkAsProblematic = async () => {
    if (!document || !user) {
      setError("Document or user not available");
      return;
    }

    try {
      setProcessingAction(true);
      setError(null);

      const userEmail = user.email;
      const documentId = document.id;

      // Step 1: Update document status to "problematic" in Firestore
      const docRef = doc(db, "probad", documentId);
      await updateDoc(docRef, {
        status: "problematic",
        marked_problematic_by: sanitizeEmail(userEmail),
        marked_problematic_at: Timestamp.now(),
        lock: false, // Release the lock
        locked_by: null,
        locked_at: null
      });

      // Step 2: Update analytics (increment problematic count)
      await problematic_inc();

      console.log(`Document ${documentId} marked as problematic by ${userEmail}`);
      
      // Load next document automatically
      await findAndLockDocument();

    } catch (error) {
      console.error("Error marking document as problematic:", error);
      setError(`Failed to mark document as problematic: ${error.message}`);
      
      // If there was an error, try to revert the document status
      try {
        const docRef = doc(db, "probad", document.id);
        await updateDoc(docRef, {
          status: "pending",
          marked_problematic_by: null,
          marked_problematic_at: null,
          lock: true,
          locked_by: sanitizeEmail(user.email),
          locked_at: Timestamp.now()
        });
        console.log("Reverted document status due to error");
      } catch (revertError) {
        console.error("Failed to revert document status:", revertError);
      }
    } finally {
      setProcessingAction(false);
    }
  };



  // Function to send document to evaluation
  const handleSendToEvaluation = async () => {
    if (!document || !user) {
      setError("Document or user not available");
      return;
    }

    try {
      setProcessingAction(true);
      setError(null);

      // Step 1: Create eval document
      await createEvalDocument(document);

      // Step 2: Update document's taken field to true
      const docRef = doc(db, "probad", document.id);
      await updateDoc(docRef, {
        taken: true
      });

      // Update local state
      setDocument(prev => ({ ...prev, taken: true }));

      console.log(`Document ${document.id} sent to evaluation`);

    } catch (error) {
      console.error("Error sending to evaluation:", error);
      setError(`Failed to send to evaluation: ${error.message}`);
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

      // Query for pending documents ordered by status (using the index)
      const q = query(
        collection(db, "probad"),
        where("status", "==", "pending"),
        orderBy("status", "asc"),
        limit(50) // Get multiple documents to find an available one
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("No pending documents found for review");
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
        setError("No available documents found. All pending documents are currently locked by other users.");
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
        setError("Please log in to access the review page");
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
          <p className="text-slate-500">No document available for review</p>
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
            <Lock className="h-4 w-4" /> Review Mode
          </span>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">Curate today&rsquo;s proverb insight</h1>
          <p className="text-sm md:text-base text-slate-600">Lock a proverb, refine the meaning, and help us ship a precise cultural record.</p>
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

        <div className="rounded-3xl border border-gray-200 bg-white p-8 mb-8 shadow-lg">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                <Quote className="h-6 w-6" />
              </span>
              <h2 className="text-2xl font-semibold text-slate-900">Bengali proverb under review</h2>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 text-left">
                <p className="text-3xl font-bold text-slate-900 mb-3 leading-tight">
                  {document.proverb?.text}
                </p>
                <p className="text-lg text-indigo-700 italic">
                  {document.proverb?.transliteration}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left">
                <p className="text-lg font-medium text-emerald-700">
                  &ldquo;{document.proverb?.literal_translation}&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5 text-indigo-600">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
                <Lightbulb className="h-5 w-5" />
              </span>
              <h3 className="text-xl font-semibold text-slate-900">Semantic analysis</h3>
            </div>
            <div className="space-y-5 text-sm text-slate-600">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">Figurative meaning</h4>
                <p className="leading-relaxed text-slate-700">{document.proverb?.figurative_meaning}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">Themes</h4>
                <div className="flex flex-wrap gap-2">
                  {document.proverb?.semantic_theme?.map((theme, index) => (
                    <span key={index} className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs text-indigo-600">
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">Context cues</h4>
                <div className="flex flex-wrap gap-2">
                  {document.proverb?.context_tags?.map((tag, index) => (
                    <span key={index} className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5 text-purple-600">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50">
                <Hash className="h-5 w-5" />
              </span>
              <h3 className="text-xl font-semibold text-slate-900">Linguistic features</h3>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Rhyme pattern</span>
                <span className="text-right text-slate-700">{document.linguistic_features?.rhyme_pattern}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Meter type</span>
                <span className="text-right text-slate-700">{document.linguistic_features?.meter_type}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Structure</span>
                <span className="text-right text-slate-700">{document.linguistic_features?.syntactic_structure}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Metaphor type</span>
                <span className="text-right text-slate-700">{document.linguistic_features?.metaphor_type}</span>
              </div>

              {document.linguistic_features?.semantic_roles && (
                <div className="mt-5 rounded-xl border border-gray-200 bg-slate-50 p-4">
                  <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-3">Semantic roles</h4>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="text-slate-500">Agent</span>
                      <span className="font-mono rounded-lg bg-white px-2 py-1 text-slate-700 border border-slate-200">{document.linguistic_features.semantic_roles.agent}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="text-slate-500">Action</span>
                      <span className="font-mono rounded-lg bg-white px-2 py-1 text-slate-700 border border-slate-200">{document.linguistic_features.semantic_roles.action}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span className="text-slate-500">Cause</span>
                      <span className="font-mono rounded-lg bg-white px-2 py-1 text-slate-700 border border-slate-200">{document.linguistic_features.semantic_roles.cause}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 mb-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6 text-rose-500">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50">
              <Heart className="h-5 w-5" />
            </span>
            <h3 className="text-xl font-semibold text-slate-900">Cultural annotations</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600">
            <div className="space-y-5">
              <div>
                <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2">Moral lesson</h4>
                <p className="leading-relaxed text-slate-700">{document.annotations?.moral_lesson}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-center">
                  <h4 className="text-[11px] uppercase tracking-wider text-amber-700 mb-1">Emotion</h4>
                  <span className="text-sm font-medium text-amber-700">{document.annotations?.emotion}</span>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                  <h4 className="text-[11px] uppercase tracking-wider text-emerald-700 mb-1">Register</h4>
                  <span className="text-sm font-medium text-emerald-700">{document.annotations?.register}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-center">
                  <h4 className="text-[11px] uppercase tracking-wider text-sky-700 mb-1">Usage frequency</h4>
                  <span className="text-sm font-medium text-sky-700">{document.annotations?.usage_frequency}</span>
                </div>
                <div className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-center">
                  <h4 className="text-[11px] uppercase tracking-wider text-purple-700 mb-1">Popularity index</h4>
                  <span className="text-sm font-medium text-purple-700">{document.annotations?.popularity_index}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-3">Usage examples</h4>
              <div className="space-y-4">
                {document.annotations?.example_sentences?.map((example, index) => (
                  <div key={index} className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-900 mb-2 leading-relaxed">
                      {example.bangla}
                    </p>
                    <p className="text-xs text-slate-500 italic">
                      {example.english}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 mb-10 shadow-sm">
          <div className="flex items-center gap-3 mb-6 text-green-600">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
              <Globe className="h-5 w-5" />
            </span>
            <h3 className="text-xl font-semibold text-slate-900">Cross-cultural parallels</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-3">Similar proverbs</h4>
              <div className="space-y-3">
                {document.cross_cultural?.similar_proverbs?.map((proverb, index) => (
                  <div key={index} className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                    {proverb}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500">English</span>
                <p className="mt-1 text-slate-700">{document.cross_cultural?.english_equivalent}</p>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500">Hindi</span>
                <p className="mt-1 text-slate-700">{document.cross_cultural?.hindi_equivalent}</p>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-500">Arabic</span>
                <p className="mt-1 text-slate-700">{document.cross_cultural?.arabic_equivalent}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-center">
            <button
              onClick={handleMarkAsDone}
              disabled={processingAction}
              className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition-shadow ${
                processingAction
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-emerald-600 text-white shadow hover:shadow-lg'
              }`}
            >
              {processingAction ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing</span>
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  <span>Mark as done</span>
                </>
              )}
            </button>
            <button
              onClick={handleMarkAsProblematic}
              disabled={processingAction}
              className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition-shadow ${
                processingAction
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-rose-600 text-white shadow hover:shadow-lg'
              }`}
            >
              {processingAction ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={18} />
                  <span>Flag as problematic</span>
                </>
              )}
            </button>
            <button
              onClick={() => navigate(`/edit/${document.id}`)}
              disabled={processingAction}
              className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition-shadow ${
                processingAction
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-amber-400 text-slate-900 shadow hover:shadow-lg'
              }`}
            >
              <Edit3 size={18} />
              <span>Edit entry</span>
            </button>
            <button
              onClick={handleSendToEvaluation}
              disabled={processingAction || document.taken}
              className={`flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold transition-shadow ${
                processingAction || document.taken
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-blue-600 text-white shadow hover:shadow-lg'
              }`}
            >
              {processingAction ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing</span>
                </>
              ) : document.taken ? (
                <>
                  <span>Already in evaluation</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>Send to evaluation</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Review;
