import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import {
  ArrowLeft,
  Loader2,
  Save,
  RotateCcw,
  Plus,
  X,
  BookOpen,
  PenSquare,
  Languages,
  Quote,
  Hash
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { edited_inc } from './utils/analytics';

const db = getFirestore();

const AutoGrowTextarea = ({ value, onChange, className = '', minRows = 4, ...rest }) => {
  const textareaRef = useRef(null);

  const computeMinHeight = (element) => {
    if (!element) {
      return 0;
    }
    const styles = window.getComputedStyle(element);
    const parsedLineHeight = parseFloat(styles.lineHeight);

    if (Number.isFinite(parsedLineHeight) && parsedLineHeight > 0) {
      return parsedLineHeight * minRows;
    }

    const parsedFontSize = parseFloat(styles.fontSize) || 16;
    const fallbackLineHeight = parsedFontSize * 1.4;
    return fallbackLineHeight * minRows;
  };

  const resize = () => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }

    const minHeight = computeMinHeight(element);
    element.style.height = 'auto';
    const contentHeight = element.scrollHeight;
    const targetHeight = Math.max(contentHeight, minHeight);
    element.style.height = `${targetHeight}px`;
    element.style.minHeight = `${minHeight}px`;
  };

  useEffect(() => {
    resize();
  }, [value]);

  const handleChange = (event) => {
    if (onChange) {
      onChange(event);
    }
    requestAnimationFrame(resize);
  };

  return (
    <textarea
      {...rest}
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      rows={minRows}
      className={`resize-none ${className}`}
    />
  );
};

const cleanArray = (items = []) => {
  return items
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => Boolean(item) && item.length !== 0);
};

const sanitizeExampleSentences = (examples = []) => {
  return examples
    .map((example) => ({
      bangla: example.bangla?.trim() || '',
      english: example.english?.trim() || ''
    }))
    .filter((example) => example.bangla || example.english);
};

const ChipInput = ({
  label,
  values = [],
  placeholder,
  onAdd,
  onRemove,
  helper
}) => {
  const [draft, setDraft] = useState('');

  const handleKeyDown = (event) => {
    if ((event.key === 'Enter' || event.key === ',') && draft.trim()) {
      event.preventDefault();
      onAdd(draft.trim());
      setDraft('');
    }

    if (event.key === 'Backspace' && !draft && values.length) {
      const lastValue = values[values.length - 1];
      onRemove(lastValue);
    }
  };

  const handleBlur = () => {
    if (draft.trim()) {
      onAdd(draft.trim());
      setDraft('');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="group flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 transition hover:bg-blue-100"
            >
              {value}
              <button
                type="button"
                onClick={() => onRemove(value)}
                className="text-blue-500 transition hover:text-blue-700"
                aria-label={`Remove ${value}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="flex-1 min-w-[120px] border-none bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
            placeholder={placeholder}
          />
        </div>
      </div>
      {helper && (
        <p className="text-xs text-gray-500">{helper}</p>
      )}
    </div>
  );
};

const ExampleSentenceCard = ({ index, example, onChange, onRemove }) => {
  return (
    <div className="relative rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md">
      <div className="absolute right-4 top-4">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="rounded-full bg-white/80 p-1 text-gray-500 transition hover:text-red-500"
          aria-label="Remove example sentence"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Quote className="h-4 w-4 text-blue-500" />
          Bangla sentence
        </div>
        <AutoGrowTextarea
          value={example.bangla}
          onChange={(event) => onChange(index, 'bangla', event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 font-hind-siliguri"
          placeholder="Enter the Bangla example"
        />
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Languages className="h-4 w-4 text-green-500" />
          English translation
        </div>
        <AutoGrowTextarea
          value={example.english}
          onChange={(event) => onChange(index, 'english', event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          placeholder="Enter the English translation"
        />
      </div>
    </div>
  );
};

const Edit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState(null);
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const userEmail = user?.email;

  useEffect(() => {
    const fetchDocument = async () => {
      setLoading(true);
      setError(null);

      try {
        const docRef = doc(db, 'probad', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('Document not found.');
          setFormData(null);
          return;
        }

        const data = docSnap.data();

        const preparedData = {
          proverb: {
            text: data.proverb?.text || '',
            transliteration: data.proverb?.transliteration || '',
            literal_translation: data.proverb?.literal_translation || '',
            english_equivalent: data.proverb?.english_equivalent || '',
            figurative_meaning: data.proverb?.figurative_meaning || '',
            normalized_form: data.proverb?.normalized_form || '',
            tone: data.proverb?.tone || '',
            semantic_theme: cleanArray(data.proverb?.semantic_theme),
            context_tags: cleanArray(data.proverb?.context_tags)
          },
          annotations: {
            moral_lesson: data.annotations?.moral_lesson || '',
            emotion: data.annotations?.emotion || '',
            register: data.annotations?.register || '',
            usage_frequency: data.annotations?.usage_frequency || '',
            popularity_index: data.annotations?.popularity_index ?? '',
            example_sentences: sanitizeExampleSentences(data.annotations?.example_sentences)
          },
          linguistic_features: {
            rhyme_pattern: data.linguistic_features?.rhyme_pattern || '',
            meter_type: data.linguistic_features?.meter_type || '',
            syntactic_structure: data.linguistic_features?.syntactic_structure || '',
            metaphor_type: data.linguistic_features?.metaphor_type || '',
            semantic_roles: {
              agent: data.linguistic_features?.semantic_roles?.agent || '',
              action: data.linguistic_features?.semantic_roles?.action || '',
              cause: data.linguistic_features?.semantic_roles?.cause || ''
            }
          },
          cross_cultural: {
            similar_proverbs: cleanArray(data.cross_cultural?.similar_proverbs),
            english_equivalent: data.cross_cultural?.english_equivalent || '',
            hindi_equivalent: data.cross_cultural?.hindi_equivalent || '',
            arabic_equivalent: data.cross_cultural?.arabic_equivalent || ''
          },
          lock: data.lock ?? false,
          locked_by: data.locked_by || null,
          locked_at: data.locked_at || null
        };

        const editableSnapshot = JSON.parse(JSON.stringify(preparedData));
        const initialSnapshot = JSON.parse(JSON.stringify(preparedData));

        setFormData(editableSnapshot);
        setInitialData(initialSnapshot);
      } catch (fetchError) {
        console.error('Failed to load document for editing:', fetchError);
        setError(`Failed to load document: ${fetchError.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [id]);

  const isDirty = useMemo(() => {
    if (!formData || !initialData) {
      return false;
    }
    return JSON.stringify(formData) !== JSON.stringify(initialData);
  }, [formData, initialData]);

  const updateProverbField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      proverb: {
        ...prev.proverb,
        [field]: value
      }
    }));
  };

  const updateAnnotationField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        [field]: value
      }
    }));
  };

  const updateLinguisticField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      linguistic_features: {
        ...prev.linguistic_features,
        [field]: value
      }
    }));
  };

  const updateSemanticRole = (role, value) => {
    setFormData((prev) => ({
      ...prev,
      linguistic_features: {
        ...prev.linguistic_features,
        semantic_roles: {
          ...prev.linguistic_features.semantic_roles,
          [role]: value
        }
      }
    }));
  };

  const updateCrossCulturalField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      cross_cultural: {
        ...prev.cross_cultural,
        [field]: value
      }
    }));
  };

  const addChip = (section, field, value) => {
    if (!value) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: Array.from(new Set([...(prev[section][field] || []), value]))
      }
    }));
  };

  const removeChip = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: prev[section][field].filter((item) => item !== value)
      }
    }));
  };

  const handleExampleChange = (index, key, value) => {
    setFormData((prev) => {
      const nextExamples = prev.annotations.example_sentences.map((example, idx) => {
        if (idx === index) {
          return {
            ...example,
            [key]: value
          };
        }
        return example;
      });

      return {
        ...prev,
        annotations: {
          ...prev.annotations,
          example_sentences: nextExamples
        }
      };
    });
  };

  const addExample = () => {
    setFormData((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        example_sentences: [
          ...prev.annotations.example_sentences,
          { bangla: '', english: '' }
        ]
      }
    }));
  };

  const removeExample = (index) => {
    setFormData((prev) => ({
      ...prev,
      annotations: {
        ...prev.annotations,
        example_sentences: prev.annotations.example_sentences.filter((_, idx) => idx !== index)
      }
    }));
  };

  const handleReset = () => {
    if (initialData) {
      const resetSnapshot = JSON.parse(JSON.stringify(initialData));
      setFormData(resetSnapshot);
    }
  };

  const sanitizeForUpdate = () => {
    const popularityIndexRaw = formData.annotations.popularity_index;
    const popularityIndexValue = parseFloat(popularityIndexRaw);
    const updatedAnnotations = {
      ...formData.annotations,
      popularity_index: Number.isFinite(popularityIndexValue)
        ? popularityIndexValue
        : popularityIndexRaw
    };

    return {
      proverb: {
        ...formData.proverb,
        semantic_theme: cleanArray(formData.proverb.semantic_theme),
        context_tags: cleanArray(formData.proverb.context_tags)
      },
      annotations: {
        ...updatedAnnotations,
        example_sentences: sanitizeExampleSentences(formData.annotations.example_sentences)
      },
      linguistic_features: {
        ...formData.linguistic_features,
        semantic_roles: {
          agent: formData.linguistic_features.semantic_roles.agent?.trim() || '',
          action: formData.linguistic_features.semantic_roles.action?.trim() || '',
          cause: formData.linguistic_features.semantic_roles.cause?.trim() || ''
        }
      },
      cross_cultural: {
        ...formData.cross_cultural,
        similar_proverbs: cleanArray(formData.cross_cultural.similar_proverbs)
      },
      status: 'pending'
    };
  };

  const handleSave = async () => {
    if (!formData) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const docRef = doc(db, 'probad', id);
      const payload = sanitizeForUpdate();

      await updateDoc(docRef, payload);

      if (userEmail) {
        await edited_inc();
      }

      navigate('/review', { replace: true });
    } catch (saveError) {
      console.error('Failed to save edits:', saveError);
      setError(`Failed to save changes: ${saveError.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-600">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p>Loading document editor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-white p-8 shadow-xl">
          <div className="flex flex-col items-start gap-3">
            <div className="flex items-center gap-2 text-red-600">
              <PenSquare className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Editor unavailable</h2>
            </div>
            <p className="text-sm text-red-500">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/review')}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to review
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!formData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950/2 font-hind-siliguri">
      <div className="border-b border-gray-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/review')}
              className="rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
              aria-label="Back to review"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Edit Proverb</h1>
              <p className="text-sm text-gray-500">Document ID: {id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={!isDirty || saving}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                !isDirty || saving
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-white text-gray-700 shadow-sm hover:bg-gray-50'
              }`}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white transition ${
                !isDirty || saving
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200'
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
        {/* Proverb core */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl shadow-blue-50/40">
          <div className="mb-6 flex items-center gap-3">
            <Quote className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Core Proverb</h2>
              <p className="text-sm text-gray-500">Primary content visible to reviewers</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Bangla text</label>
              <AutoGrowTextarea
                value={formData.proverb.text}
                onChange={(event) => updateProverbField('text', event.target.value)}
                className="rounded-2xl border border-gray-200 bg-blue-50/40 px-4 py-3 text-base text-gray-800 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 font-hind-siliguri"
                placeholder="Enter the primary Bangla proverb"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Transliteration</label>
              <AutoGrowTextarea
                value={formData.proverb.transliteration}
                onChange={(event) => updateProverbField('transliteration', event.target.value)}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Akonṭokobiddho ki jane ..."
              />
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Literal translation</label>
              <AutoGrowTextarea
                value={formData.proverb.literal_translation}
                onChange={(event) => updateProverbField('literal_translation', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="The one not pierced by thorns..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">English equivalent</label>
              <input
                type="text"
                value={formData.proverb.english_equivalent}
                onChange={(event) => updateProverbField('english_equivalent', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Closest English proverb"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Normalized form</label>
              <input
                type="text"
                value={formData.proverb.normalized_form}
                onChange={(event) => updateProverbField('normalized_form', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Normalized Bangla text"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Tone</label>
              <input
                type="text"
                value={formData.proverb.tone}
                onChange={(event) => updateProverbField('tone', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="e.g. philosophical"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Figurative meaning</label>
            <AutoGrowTextarea
              value={formData.proverb.figurative_meaning}
              onChange={(event) => updateProverbField('figurative_meaning', event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="Explain the deeper significance"
            />
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <ChipInput
              label="Semantic themes"
              values={formData.proverb.semantic_theme}
              placeholder="Type a theme and press Enter"
              helper="Use tags like empathy, suffering, perspective"
              onAdd={(value) => addChip('proverb', 'semantic_theme', value)}
              onRemove={(value) => removeChip('proverb', 'semantic_theme', value)}
            />
            <ChipInput
              label="Context tags"
              values={formData.proverb.context_tags}
              placeholder="Add context tags"
              helper="Describe usage contexts such as daily life, personal experience"
              onAdd={(value) => addChip('proverb', 'context_tags', value)}
              onRemove={(value) => removeChip('proverb', 'context_tags', value)}
            />
          </div>
        </section>

        {/* Annotations */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl shadow-pink-50/40">
          <div className="mb-6 flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-rose-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cultural annotations</h2>
              <p className="text-sm text-gray-500">Interpretive layers and storytelling examples</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Moral lesson</label>
              <AutoGrowTextarea
                value={formData.annotations.moral_lesson}
                onChange={(event) => updateAnnotationField('moral_lesson', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                placeholder="Narrate the moral takeaway"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Emotion</label>
                <input
                  type="text"
                  value={formData.annotations.emotion}
                  onChange={(event) => updateAnnotationField('emotion', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  placeholder="e.g. irony"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Register</label>
                <input
                  type="text"
                  value={formData.annotations.register}
                  onChange={(event) => updateAnnotationField('register', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  placeholder="e.g. folk"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Usage frequency</label>
                <input
                  type="text"
                  value={formData.annotations.usage_frequency}
                  onChange={(event) => updateAnnotationField('usage_frequency', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  placeholder="e.g. common"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Popularity index</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.annotations.popularity_index}
                  onChange={(event) => updateAnnotationField('popularity_index', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  placeholder="0.00 - 1.00"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Example sentences</h3>
            <button
              type="button"
              onClick={addExample}
              className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
            >
              <Plus className="h-4 w-4" />
              Add example
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {formData.annotations.example_sentences.map((example, index) => (
              <ExampleSentenceCard
                key={`example-${index}`}
                index={index}
                example={example}
                onChange={handleExampleChange}
                onRemove={removeExample}
              />
            ))}

            {formData.annotations.example_sentences.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/60 p-6 text-sm text-gray-500">
                No example sentences yet. Add one to guide translators and narrators.
              </div>
            )}
          </div>
        </section>

        {/* Linguistic features */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl shadow-purple-50/40">
          <div className="mb-6 flex items-center gap-3">
            <Hash className="h-6 w-6 text-purple-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Linguistic features</h2>
              <p className="text-sm text-gray-500">Structural signatures that support computational analysis</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Rhyme pattern</label>
              <input
                type="text"
                value={formData.linguistic_features.rhyme_pattern}
                onChange={(event) => updateLinguisticField('rhyme_pattern', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                placeholder="e.g. assonance"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Meter type</label>
              <input
                type="text"
                value={formData.linguistic_features.meter_type}
                onChange={(event) => updateLinguisticField('meter_type', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                placeholder="e.g. rhythmic_prose"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Syntactic structure</label>
              <input
                type="text"
                value={formData.linguistic_features.syntactic_structure}
                onChange={(event) => updateLinguisticField('syntactic_structure', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                placeholder="e.g. interrogative"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Metaphor type</label>
              <input
                type="text"
                value={formData.linguistic_features.metaphor_type}
                onChange={(event) => updateLinguisticField('metaphor_type', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                placeholder="e.g. symbolism"
              />
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-gray-200 bg-purple-50/40 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Semantic roles</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-600">Agent</label>
                <input
                  type="text"
                  value={formData.linguistic_features.semantic_roles.agent}
                  onChange={(event) => updateSemanticRole('agent', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  placeholder="Primary actor"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-600">Action</label>
                <input
                  type="text"
                  value={formData.linguistic_features.semantic_roles.action}
                  onChange={(event) => updateSemanticRole('action', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  placeholder="Key action"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-600">Cause</label>
                <input
                  type="text"
                  value={formData.linguistic_features.semantic_roles.cause}
                  onChange={(event) => updateSemanticRole('cause', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  placeholder="Underlying cause"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Cross cultural */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl shadow-emerald-50/40">
          <div className="mb-6 flex items-center gap-3">
            <Languages className="h-6 w-6 text-emerald-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cross-cultural mapping</h2>
              <p className="text-sm text-gray-500">Bridge meanings across languages and traditions</p>
            </div>
          </div>

          <ChipInput
            label="Similar proverbs"
            values={formData.cross_cultural.similar_proverbs}
            placeholder="Add a related proverb"
            helper="Press Enter to capture each related proverb"
            onAdd={(value) => addChip('cross_cultural', 'similar_proverbs', value)}
            onRemove={(value) => removeChip('cross_cultural', 'similar_proverbs', value)}
          />

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">English equivalent</label>
              <input
                type="text"
                value={formData.cross_cultural.english_equivalent}
                onChange={(event) => updateCrossCulturalField('english_equivalent', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="No pain, no gain"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Hindi equivalent</label>
              <input
                type="text"
                value={formData.cross_cultural.hindi_equivalent}
                onChange={(event) => updateCrossCulturalField('hindi_equivalent', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Provide Hindi phrasing"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Arabic equivalent</label>
              <input
                type="text"
                value={formData.cross_cultural.arabic_equivalent}
                onChange={(event) => updateCrossCulturalField('arabic_equivalent', event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                placeholder="Arabic translation"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Edit;
