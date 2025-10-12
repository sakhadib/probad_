import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase/config";

// Document reference
const ANALYTICS_DOC_ID = "PONZhk2b6LlmgoMeRIS7";
const analyticsDocRef = doc(db, "analytics", ANALYTICS_DOC_ID);

/**
 * Increments the "done" field by 1. Creates the field with value 0 then increments if it doesn't exist.
 */
export const done_inc = async () => {
  try {
    const docSnap = await getDoc(analyticsDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.done !== undefined) {
        // Field exists, increment it
        await updateDoc(analyticsDocRef, {
          done: increment(1)
        });
      } else {
        // Field doesn't exist, create it with value 1 (0 + 1)
        await updateDoc(analyticsDocRef, {
          done: 1
        });
      }
    } else {
      // Document doesn't exist, create it with done field set to 1
      await setDoc(analyticsDocRef, {
        done: 1
      });
    }
    
    console.log("Successfully incremented done field");
  } catch (error) {
    console.error("Error incrementing done field:", error);
    throw error;
  }
};

/**
 * Decrements the "done" field by 1. Creates the field with value 0 if it doesn't exist.
 * If the current value is 0, no decrement happens.
 */
export const done_dec = async () => {
  try {
    const docSnap = await getDoc(analyticsDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.done !== undefined) {
        // Field exists, check if it's greater than 0 before decrementing
        if (data.done > 0) {
          await updateDoc(analyticsDocRef, {
            done: increment(-1)
          });
        }
        // If done is 0, do nothing (no decrement)
      } else {
        // Field doesn't exist, create it with value 0
        await updateDoc(analyticsDocRef, {
          done: 0
        });
      }
    } else {
      // Document doesn't exist, create it with done field set to 0
      await setDoc(analyticsDocRef, {
        done: 0
      });
    }
    
    console.log("Successfully processed done field decrement");
  } catch (error) {
    console.error("Error decrementing done field:", error);
    throw error;
  }
};

/**
 * Increments the "problematic" field by 1. Creates the field with value 0 then increments if it doesn't exist.
 */
export const problematic_inc = async () => {
  try {
    const docSnap = await getDoc(analyticsDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.problematic !== undefined) {
        // Field exists, increment it
        await updateDoc(analyticsDocRef, {
          problematic: increment(1)
        });
      } else {
        // Field doesn't exist, create it with value 1 (0 + 1)
        await updateDoc(analyticsDocRef, {
          problematic: 1
        });
      }
    } else {
      // Document doesn't exist, create it with problematic field set to 1
      await setDoc(analyticsDocRef, {
        problematic: 1
      });
    }
    
    console.log("Successfully incremented problematic field");
  } catch (error) {
    console.error("Error incrementing problematic field:", error);
    throw error;
  }
};

/**
 * Decrements the "problematic" field by 1. Creates the field with value 0 if it doesn't exist.
 * If the current value is 0, no decrement happens.
 */
export const problematic_dec = async () => {
  try {
    const docSnap = await getDoc(analyticsDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.problematic !== undefined) {
        // Field exists, check if it's greater than 0 before decrementing
        if (data.problematic > 0) {
          await updateDoc(analyticsDocRef, {
            problematic: increment(-1)
          });
        }
        // If problematic is 0, do nothing (no decrement)
      } else {
        // Field doesn't exist, create it with value 0
        await updateDoc(analyticsDocRef, {
          problematic: 0
        });
      }
    } else {
      // Document doesn't exist, create it with problematic field set to 0
      await setDoc(analyticsDocRef, {
        problematic: 0
      });
    }
    
    console.log("Successfully processed problematic field decrement");
  } catch (error) {
    console.error("Error decrementing problematic field:", error);
    throw error;
  }
};

/**
 * Increments the "edited" field by 1. Creates the field with value 0 then increments if it doesn't exist.
 */
export const edited_inc = async () => {
  try {
    const docSnap = await getDoc(analyticsDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.edited !== undefined) {
        // Field exists, increment it
        await updateDoc(analyticsDocRef, {
          edited: increment(1)
        });
      } else {
        // Field doesn't exist, create it with value 1 (0 + 1)
        await updateDoc(analyticsDocRef, {
          edited: 1
        });
      }
    } else {
      // Document doesn't exist, create it with edited field set to 1
      await setDoc(analyticsDocRef, {
        edited: 1
      });
    }
    
    console.log("Successfully incremented edited field");
  } catch (error) {
    console.error("Error incrementing edited field:", error);
    throw error;
  }
};

/**
 * Decrements the "edited" field by 1. Creates the field with value 0 if it doesn't exist.
 * If the current value is 0, no decrement happens.
 */
export const edited_dec = async () => {
  try {
    const docSnap = await getDoc(analyticsDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.edited !== undefined) {
        // Field exists, check if it's greater than 0 before decrementing
        if (data.edited > 0) {
          await updateDoc(analyticsDocRef, {
            edited: increment(-1)
          });
        }
        // If edited is 0, do nothing (no decrement)
      } else {
        // Field doesn't exist, create it with value 0
        await updateDoc(analyticsDocRef, {
          edited: 0
        });
      }
    } else {
      // Document doesn't exist, create it with edited field set to 0
      await setDoc(analyticsDocRef, {
        edited: 0
      });
    }
    
    console.log("Successfully processed edited field decrement");
  } catch (error) {
    console.error("Error decrementing edited field:", error);
    throw error;
  }
};

/**
 * Returns the analytics document data.
 * If the document doesn't exist, returns null.
 */
export const getAnalyticsData = async () => {
  try {
    const docSnap = await getDoc(analyticsDocRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("Analytics document does not exist");
      return null;
    }
  } catch (error) {
    console.error("Error getting analytics document:", error);
    throw error;
  }
};

/**
 * Helper function to sanitize email for Firebase field names
 * Replaces dots with '_dot_' to avoid Firebase field name issues
 */
const sanitizeEmail = (email) => {
  return email.replace(/\./g, '_dot_');
};

/**
 * Marks a document as done by incrementing the done count and tracking user contribution.
 * Only increments if the document wasn't previously marked as done.
 * @param {string} userEmail - The email of the user marking the document as done
 * @param {boolean} wasPreviouslyDone - Whether the document was previously marked as done
 */
export const markDocumentAsDone = async (userEmail, wasPreviouslyDone = false) => {
  try {
    if (!userEmail) {
      throw new Error("User email is required");
    }

    const sanitizedEmail = sanitizeEmail(userEmail);
    const docSnap = await getDoc(analyticsDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const updates = {};

      // Only increment done count if document wasn't previously marked as done
      if (!wasPreviouslyDone) {
        if (data.done !== undefined) {
          updates.done = increment(1);
        } else {
          updates.done = 1;
        }
      }

      // Handle user contribution tracking
      const contribution = data.contribution || {};
      const currentUserContribution = contribution[sanitizedEmail] || 0;
      
      updates[`contribution.${sanitizedEmail}`] = currentUserContribution + 1;

      await updateDoc(analyticsDocRef, updates);
    } else {
      // Document doesn't exist, create it
      const newDoc = {
        done: wasPreviouslyDone ? 0 : 1,
        contribution: {
          [sanitizedEmail]: 1
        }
      };
      
      await setDoc(analyticsDocRef, newDoc);
    }
    
    console.log(`Successfully marked document as done for user: ${userEmail}`);
  } catch (error) {
    console.error("Error marking document as done:", error);
    throw error;
  }
};



