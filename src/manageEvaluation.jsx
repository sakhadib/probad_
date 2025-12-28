import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query,
  where,
  limit,
  getDocs, 
  doc, 
  updateDoc,
  deleteDoc,
  Timestamp
} from "firebase/firestore";
import { useAuth } from './contexts/AuthContext';
import { 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  List,
  Quote,
  X,
  EyeOff
} from 'lucide-react';
import { db } from "./firebase/config";

const ManageEvaluation = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());

  // Helper function to check if any predictions have been fetched
  const hasAnyPredictionsFetched = (document) => {
    if (!document || !document.predictions) return false;
    return document.predictions.some(pred => 
      pred.prediction !== null || pred.fetch === true
    );
  };

  // Function to fetch all evaluation documents
  const fetchEvaluationDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const evalQuery = query(collection(db, "eval"));
      const querySnapshot = await getDocs(evalQuery);

      const docs = [];
      const seenFirestoreIds = new Set();
      
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const firestoreDocId = docSnapshot.id; // This is the REAL Firestore document ID
        
        // Skip duplicates
        if (seenFirestoreIds.has(firestoreDocId)) {
          console.warn(`Duplicate Firestore document ID found: ${firestoreDocId}`);
          return;
        }
        
        // Only include documents where:
        // 1. NO predictions have been fetched
        // 2. NOT already marked as kept/reviewed
        if (!hasAnyPredictionsFetched(data) && !data.kept) {
          seenFirestoreIds.add(firestoreDocId);
          docs.push({
            ...data,
            _firestoreId: firestoreDocId, // Store the REAL Firestore ID separately
            displayId: data.id || firestoreDocId // Use internal id field for display
          });
        }
      });

      setDocuments(docs);
    } catch (err) {
      console.error("Error fetching evaluation documents:", err);
      setError(`Failed to load evaluation documents: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchEvaluationDocuments();
    } else if (!authLoading && !isAuthenticated) {
      setError("Please log in to access this page");
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  // Function to remove a document from evaluation (instant action)
  const handleRemove = async (docToRemove) => {
    const firestoreId = docToRemove._firestoreId;
    console.log('=== REMOVE CLICKED ===');
    console.log('Display ID:', docToRemove.displayId);
    console.log('Firestore ID:', firestoreId);
    
    // Mark as processing
    setProcessingIds(prev => new Set(prev).add(firestoreId));
    
    // Remove from UI immediately
    setDocuments(prev => prev.filter(d => d._firestoreId !== firestoreId));

    // Delete from Firebase
    try {
      // Delete the eval document
      await deleteDoc(doc(db, "eval", firestoreId));
      console.log('✓ Deleted eval document');
      
      // Reset probad taken field (fire and forget)
      if (docToRemove.probad_id) {
        updateDoc(doc(db, "probad", docToRemove.probad_id), { taken: false })
          .catch(err => console.error("Error resetting probad:", err));
      } else if (docToRemove.proverb?.text) {
        getDocs(query(collection(db, "probad"), where("proverb.text", "==", docToRemove.proverb.text), limit(1)))
          .then(snap => {
            if (!snap.empty) {
              updateDoc(doc(db, "probad", snap.docs[0].id), { taken: false })
                .catch(err => console.error("Error resetting probad:", err));
            }
          })
          .catch(err => console.error("Error finding probad:", err));
      }
    } catch (error) {
      console.error('✗ ERROR removing:', error);
      
      setError(`Failed to remove: ${error.message}`);
      setDocuments(prev => {
        if (prev.some(d => d._firestoreId === firestoreId)) return prev;
        return [docToRemove, ...prev];
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(firestoreId);
        return newSet;
      });
    }
  };

  // Function to keep a document (mark in Firebase so it won't show again)
  const handleKeep = async (docToKeep) => {
    const firestoreId = docToKeep._firestoreId;
    console.log('=== KEEP CLICKED ===');
    console.log('Display ID:', docToKeep.displayId);
    console.log('Firestore ID:', firestoreId);
    
    // Mark as processing
    setProcessingIds(prev => new Set(prev).add(firestoreId));
    
    // Remove from UI immediately
    setDocuments(prev => prev.filter(d => d._firestoreId !== firestoreId));

    // Mark as kept in Firebase
    try {
      const evalDocRef = doc(db, "eval", firestoreId);
      console.log('Updating Firestore document:', firestoreId);
      
      const updateData = { 
        kept: true,
        kept_at: Timestamp.now(),
        kept_by: user?.email || 'unknown'
      };
      
      console.log('Update data:', updateData);
      
      await updateDoc(evalDocRef, updateData);
      
      console.log('✓ Successfully marked as kept');
    } catch (error) {
      console.error('✗ ERROR marking as kept:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Always show error and re-add
      setError(`Failed to mark as kept: ${error.message}`);
      setDocuments(prev => {
        if (prev.some(d => d._firestoreId === firestoreId)) return prev;
        return [docToKeep, ...prev];
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(firestoreId);
        return newSet;
      });
    }
  };

  // Handle auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto mb-4"></div>
          <p className="text-sm tracking-wide uppercase text-slate-400">Loading</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto mb-4"></div>
          <p className="text-sm tracking-wide uppercase text-slate-400">Loading evaluation documents</p>
        </div>
      </div>
    );
  }

  if (error && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-red-100 bg-white p-6 shadow">
          <div className="flex items-center gap-3 mb-4 text-red-600">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-semibold">Authentication Required</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-hind-siliguri">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Filter Evaluation Queue
          </h1>
          <p className="text-slate-600">
            Review each proverb and decide: <span className="font-semibold text-emerald-600">Keep</span> it or <span className="font-semibold text-red-600">Remove</span> it
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mb-4 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-full px-4 py-2">
            <span className="font-bold text-slate-900">{documents.length}</span> remaining
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  All Done!
                </h3>
                <p className="text-slate-600">
                  No more proverbs to review.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
              >
                <div clas_firestoreIName="text-center mb-6">
                  <p className="text-2xl font-bold text-slate-900 mb-3 leading-relaxed">
                    {doc.proverb?.text}
                  </p>
                  {doc.proverb?.figurative_meaning && (
                    <p className="text-base text-slate-600 leading-relaxed">
                      {doc.proverb.figurative_meaning}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleKeep(doc)}
                    disabled={processingIds.has(doc._firestoreId)}
                    className="flex-1 py-4 rounded-xl text-lg font-bold bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  >
                    ✓ Keep
                  </button>
                  <button
                    onClick={() => handleRemove(doc)}
                    disabled={processingIds.has(doc._firestoreId)}
                    className="flex-1 py-4 rounded-xl text-lg font-bold bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  >
                    ✕ Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageEvaluation;
