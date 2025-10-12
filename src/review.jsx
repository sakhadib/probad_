import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getFirestore, 
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
import { markDocumentAsDone, problematic_inc, edited_inc } from './utils/analytics';
import { 
  Lock, 
  Clock, 
  User, 
  FileText, 
  BookOpen, 
  Globe, 
  MessageSquare, 
  Hash, 
  Languages,
  Heart,
  Lightbulb,
  Quote,
  AlertTriangle,
  CheckCircle,
  Edit3
} from 'lucide-react';

// Initialize Firestore
const db = getFirestore();

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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {lockingInProgress ? "Locking document..." : "Finding available document..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center mb-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <h3 className="text-lg font-semibold text-red-800">Error</h3>
          </div>
          <p className="text-red-600">{error}</p>
          <button
            onClick={findAndLockDocument}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No document available for review</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-hind-siliguri">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        {/* <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Proverb Review</h1>
          <p className="text-gray-600 text-base md:text-lg">Academic review and validation of Bengali proverbs</p>
        </div> */}

        {/* Document Lock Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">Document Locked</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-4 w-4" />
                <span className="text-sm break-all">{document.locked_by?.replace(/_DOT_/g, '.')}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span className="text-sm">
                  {document.locked_at?.toDate ? 
                    document.locked_at.toDate().toLocaleString() : 
                    'Just now'
                  }
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Document ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">{document.id}</span>
            </div>
          </div>
        </div>

        {/* Proverb Main Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Quote className="h-8 w-8 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-800">Bengali Proverb</h2>
            </div>
            
            {/* Bengali Text */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-4 rounded-r-lg">
              <p className="text-3xl font-bold text-gray-800 mb-2 font-hind-siliguri">
                {document.proverb?.text}
              </p>
              <p className="text-lg text-gray-600 italic">
                {document.proverb?.transliteration}
              </p>
            </div>

            {/* English Translation */}
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
              <p className="text-lg font-semibold text-gray-800">
                "{document.proverb?.literal_translation}"
              </p>
            </div>
          </div>
        </div>

        {/* Academic Analysis Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          {/* Semantic Analysis */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-6 w-6 text-yellow-600" />
              <h3 className="text-xl font-semibold text-gray-800">Semantic Analysis</h3>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Figurative Meaning</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {document.proverb?.figurative_meaning}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Themes</h4>
                <div className="flex flex-wrap gap-2">
                  {document.proverb?.semantic_theme?.map((theme, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Context</h4>
                <div className="flex flex-wrap gap-2">
                  {document.proverb?.context_tags?.map((tag, index) => (
                    <span key={index} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Linguistic Features */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="h-6 w-6 text-purple-600" />
              <h3 className="text-xl font-semibold text-gray-800">Linguistic Features</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Rhyme Pattern:</span>
                <span className="text-gray-600">{document.linguistic_features?.rhyme_pattern}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Meter Type:</span>
                <span className="text-gray-600">{document.linguistic_features?.meter_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Structure:</span>
                <span className="text-gray-600">{document.linguistic_features?.syntactic_structure}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Metaphor Type:</span>
                <span className="text-gray-600">{document.linguistic_features?.metaphor_type}</span>
              </div>
              
              {document.linguistic_features?.semantic_roles && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-semibold text-gray-700 mb-2">Semantic Roles</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-gray-600 font-medium">Agent:</span>
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs break-all">{document.linguistic_features.semantic_roles.agent}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-gray-600 font-medium">Action:</span>
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs break-all">{document.linguistic_features.semantic_roles.action}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-gray-600 font-medium">Cause:</span>
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs break-all">{document.linguistic_features.semantic_roles.cause}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Annotations */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="h-6 w-6 text-red-600" />
            <h3 className="text-xl font-semibold text-gray-800">Cultural Annotations</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Moral Lesson</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {document.annotations?.moral_lesson}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Emotion</h4>
                  <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm">
                    {document.annotations?.emotion}
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Register</h4>
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                    {document.annotations?.register}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Usage Frequency</h4>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {document.annotations?.usage_frequency}
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">Popularity Index</h4>
                  <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                    {document.annotations?.popularity_index}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Example Sentences */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Usage Examples</h4>
              <div className="space-y-4">
                {document.annotations?.example_sentences?.map((example, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-800 font-hind-siliguri">
                        {example.bangla}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 italic">
                        {example.english}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cross-Cultural Equivalents */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-6 w-6 text-green-600" />
            <h3 className="text-xl font-semibold text-gray-800">Cross-Cultural Analysis</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Similar Proverbs</h4>
              <div className="space-y-2">
                {document.cross_cultural?.similar_proverbs?.map((proverb, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded text-sm">
                    {proverb}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Language Equivalents</h4>
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">English:</span>
                  <p className="text-gray-600 text-sm">{document.cross_cultural?.english_equivalent}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Hindi:</span>
                  <p className="text-gray-600 text-sm">{document.cross_cultural?.hindi_equivalent}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Arabic:</span>
                  <p className="text-gray-600 text-sm">{document.cross_cultural?.arabic_equivalent}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
            <button 
              onClick={handleMarkAsDone}
              disabled={processingAction}
              className={`flex items-center gap-2 font-semibold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ${
                processingAction 
                  ? 'bg-gray-400 cursor-not-allowed text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {processingAction ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  <span>Mark as Done</span>
                </>
              )}
            </button>
            <button 
              onClick={handleMarkAsProblematic}
              disabled={processingAction}
              className={`flex items-center gap-2 font-semibold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ${
                processingAction 
                  ? 'bg-gray-400 cursor-not-allowed text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {processingAction ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={20} />
                  <span>Mark as Problematic</span>
                </>
              )}
            </button>
            <button 
              onClick={() => navigate(`/edit/${document.id}`)}
              disabled={processingAction}
              className={`flex items-center gap-2 font-semibold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ${
                processingAction 
                  ? 'bg-gray-400 cursor-not-allowed text-white' 
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              }`}
            >
              <Edit3 size={20} />
              <span>Edit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Review;
