import { useState, useEffect, useRef } from 'react';
import { Languages } from 'lucide-react';
import { translateGoogleFree } from '../utils/translator';

const TextTranslator = () => {
  const [selectedText, setSelectedText] = useState('');
  const [showButton, setShowButton] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });
  const [showModal, setShowModal] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text && text.length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setSelectedText(text);
        setButtonPosition({
          top: rect.top + window.scrollY - 40,
          left: rect.left + window.scrollX + rect.width / 2 - 50
        });
        setShowButton(true);
      } else {
        setShowButton(false);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const handleTranslate = async () => {
    setLoading(true);
    setShowModal(true);
    setShowButton(false);

    try {
      const translation = await translateGoogleFree(selectedText);
      setTranslatedText(translation);
    } catch (error) {
      console.error('Translation failed:', error);
      setTranslatedText('Translation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setTranslatedText('');
  };

  return (
    <>
      {showButton && (
        <button
          ref={buttonRef}
          onClick={handleTranslate}
          className="fixed z-50 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg hover:bg-indigo-500 transition flex items-center gap-1"
          style={{ top: buttonPosition.top, left: buttonPosition.left }}
        >
          <Languages size={12} />
          Translate to Bangla
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Translation</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Original (English):</p>
                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{selectedText}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Translated (Bangla):</p>
                {loading ? (
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded animate-pulse">Translating...</div>
                ) : (
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded font-hind-siliguri">{translatedText}</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={closeModal}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-500 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TextTranslator;