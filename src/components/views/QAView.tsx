import React, { useCallback, useEffect, useState } from 'react';
import { HelpCircle, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { apiRequest } from '../../services/api';
import type { ContentItem, QASubmission } from '../../types/content';
import { ContentCard } from '../content/ContentCard';

export const QAView: React.FC = () => {
  const { language, user, setSection, showToast, offlineRecords, apiBaseUrl, isOnline, catalogVersion } = useApp();
  const [qaContent, setQaContent] = useState<ContentItem[]>([]);
  const [myQuestions, setMyQuestions] = useState<QASubmission[]>([]);
  const [topic, setTopic] = useState('Fiqh of Worship');
  const [questionText, setQuestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadQA = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ items: ContentItem[] }>('/api/content?category=qa&limit=25');
      setQaContent(res.items || []);
      if (user) {
        const myRes = await apiRequest<{ items: QASubmission[] }>('/api/user/qa');
        setMyQuestions(myRes.items || []);
      }
    } catch {
      const offline = offlineRecords
        .map((r) => r.itemSnapshot)
        .filter((i) => i.categorySlug === 'qa');
      setQaContent(Array.from(new Map(offline.map((i) => [i.id, i])).values()));
    } finally {
      setLoading(false);
    }
  }, [user, offlineRecords]);

  useEffect(() => {
    loadQA();
  }, [loadQA, apiBaseUrl, isOnline, catalogVersion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setSection('profile');
      showToast('Please sign in to submit a question.');
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest('/api/qa/submit', {
        method: 'POST',
        body: JSON.stringify({ topic, questionText }),
      });
      setQuestionText('');
      showToast('Question submitted to the scholar moderation queue (PENDING).');
      await loadQA();
    } catch (err: any) {
      showToast(err?.message || 'Unable to submit question.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t(language, 'qa')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Browse verified scholarly answers with audio, transcripts, and PDF fatwas, or submit a new question for review.
        </p>
      </div>

      {/* Ask a Question Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-[#131C1A]">
        <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
          <HelpCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          <h2>{t(language, 'askQuestion')}</h2>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Topic
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="Fiqh of Worship">Fiqh of Worship</option>
                <option value="Zakat & Finance">Zakat &amp; Finance</option>
                <option value="Family & Marriage">Family &amp; Marriage</option>
                <option value="Quran & Hadith">Quran &amp; Hadith</option>
                <option value="Ethics & Society">Ethics &amp; Society</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Your Question (reviewed before publication)
              </label>
              <textarea
                rows={3}
                required
                minLength={10}
                maxLength={2000}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Write your question clearly and respectfully..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user
                ? `Submitting as ${user.name}. Questions enter PENDING review.`
                : 'Sign in on the Profile page to submit and track your questions.'}
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 min-h-[42px] rounded-xl bg-[#0F4C3A] px-5 py-2 text-sm font-medium text-white hover:bg-[#0B3B2D] disabled:opacity-50 dark:bg-emerald-600 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting...' : t(language, 'submitQuestion')}</span>
            </button>
          </div>
        </form>
      </section>

      {/* My Submitted Questions */}
      {user && myQuestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            My Submitted Questions
          </h2>
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-[#131C1A]">
            {myQuestions.map((q) => (
              <div key={q.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {q.topic} · {q.createdAt.slice(0, 10)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{q.questionText}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 shrink-0">
                  Status: {q.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Published Q&A using Universal Content Engine */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
          Published Answers
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131C1A]" />
            ))}
          </div>
        ) : qaContent.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-1.5 dark:border-slate-800 dark:bg-[#131C1A]">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t(language, 'emptyCatalog')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reviewed and published scholarly answers will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {qaContent.map((item) => (
              <ContentCard key={item.id} item={item} queue={qaContent} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
