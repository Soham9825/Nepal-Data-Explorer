import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { SectionCard } from '../components/ui/Card';
import { BtnPrimary } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import auth from '../services/auth';
import { API_BASE_URL } from '../config';

const SUPPORT_EMAIL = 'nepaldataexplorer@gmail.com';

const inputClass =
  "w-full px-4 py-3 border border-outline-variant font-sans text-sm text-onSurface bg-surface-lowest outline-none rounded-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-hanken";

export default function Support() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [feedback, setFeedback] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const cachedUser = auth.getCachedUser();
    if (cachedUser?.email) {
      setForm((current) => ({ ...current, email: cachedUser.email }));
      return;
    }
    auth.getCurrentUser().then((user) => {
      if (user?.email) setForm((current) => ({ ...current, email: user.email }));
    });
  }, []);

  const faqs = [
    { q: 'What data sources does Nepal Data Explorer use?', a: 'We aggregate from Nepal Rastra Bank (NRB), Central Bureau of Statistics (CBS), Department of Tourism (DoT), Ministry of Finance (MoF), and World Bank Open Data — all publicly available official sources.' },
    { q: 'How frequently is data updated?', a: 'Economic indicators (inflation, forex) update monthly. GDP & annual figures update annually after CBS publishes. Tourism data updates monthly via DoT.' },
    { q: 'Can I download raw datasets?', a: 'Yes — visit the Reports or Research Data pages. CSV and PDF exports are available for all indicator series.' },
    { q: 'How do AI Predictions work?', a: 'Our ML models are trained on historical NRB and CBS time-series. Forecasts use a blend of ARIMA, regression, and ensemble methods with confidence intervals shown.' },
    { q: 'How do I compare provinces?', a: 'Use the Compare Data page in the sidebar. Select up to 4 provinces and any indicator to generate side-by-side charts.' },
  ];

  const contacts = [
    { icon: 'email', label: 'Email Support', value: SUPPORT_EMAIL, color: '#0051d5' },
    { icon: 'phone', label: 'Helpline', value: '+977-9805446836', color: '#7a5100' },
    { icon: 'chat', label: 'Live Chat', value: 'Available 9 AM – 5 PM NST', color: '#b70011' },
  ];

  const updateForm = (event) => setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));

  const readJsonResponse = async (response) => {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('We could not connect to support right now. Please try again.');
    }
    const result = await response.json();
    if (response.status === 401 || response.status === 403) {
      throw new Error('Your session has expired. Please sign in again before sending a message.');
    }
    if (!response.ok) throw new Error(result.message || result.detail || 'We could not send your message. Please try again.');
    return result;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSending(true);
    setFeedback(null);
    try {
      if (!auth.getAccessToken()) {
        throw new Error('Please sign in again before sending a message.');
      }
      const csrfResponse = await fetch(`${API_BASE_URL}/accounts/api/csrf/`, { credentials: 'include' });
      const csrf = await readJsonResponse(csrfResponse);
      const response = await fetch(`${API_BASE_URL}/accounts/api/support/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf.csrfToken || csrf.csrf_token,
          ...auth.authenticatedHeaders(),
        },
        body: JSON.stringify(form),
      });
      const result = await readJsonResponse(response);
      if (result.status === 'blocked') {
        setFeedback({ type: 'blocked', message: result.message });
      } else if (result.status === 'warning') {
        setFeedback({ type: 'warning', message: result.message });
        setForm({ name: '', email: form.email, subject: '', message: '' });
      } else {
        setFeedback({ type: result.status === 'allowed' ? 'success' : 'error', message: result.message || 'Your message was sent successfully.' });
        setForm({ name: '', email: form.email, subject: '', message: '' });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'We could not send your message. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout pageTitle="Support & Help">
      <div className="w-full space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-2xl font-bold text-onSurface font-hanken">
            Support & Help
          </h3>
          <p className="text-onSurface-variant text-sm font-hanken mt-1">
            Documentation, FAQs and contact options
          </p>
        </div>

        {/* Contact Cards - Full Width Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {contacts.map((c, i) => (
            <div
              key={i}
              className="bg-surface border border-outline-variant p-6 card-shadow flex flex-col items-center text-center gap-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              style={{ borderTop: `3px solid ${c.color}` }}
            >
              <Icon name={c.icon} size={32} color={c.color} />
              <div className="text-[10px] font-bold text-onSurface-variant uppercase tracking-[0.05em] font-hanken">
                {c.label}
              </div>
              <div className="text-sm font-semibold text-onSurface font-hanken break-all">
                {c.value}
              </div>
            </div>
          ))}
        </section>

        {/* FAQ Section - Full Width */}
        <SectionCard
          title="Frequently Asked Questions"
          subtitle="Common questions about data, sources & features"
          className="w-full"
        >
          <div className="w-full">
            {faqs.map((f, i) => (
              <div key={i} className={`py-4 ${i < faqs.length - 1 ? 'border-b border-outline-variant' : ''}`}>
                <div className="flex items-start gap-3 mb-1.5">
                  <Icon name="help_outline" size={20} color="#b70011" className="mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-onSurface font-hanken">{f.q}</div>
                    <div className="text-sm text-onSurface-variant leading-relaxed mt-1 font-hanken">{f.a}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Contact Form - Full Width */}
        <SectionCard
          title="Send a Message"
          subtitle={`We typically respond within 1 business day — messages go to ${SUPPORT_EMAIL}`}
          className="w-full"
        >
          <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                name="name"
                value={form.name}
                onChange={updateForm}
                placeholder="Full Name"
                className={inputClass}
              />
              <input
                type="email"
                name="email"
                value={form.email}
                readOnly
                placeholder="Account Email"
                className={`${inputClass} bg-surface-high`}
              />
            </div>
            <input
              name="subject"
              value={form.subject}
              onChange={updateForm}
              placeholder="Subject"
              className={inputClass}
            />
            <textarea
              name="message"
              value={form.message}
              onChange={updateForm}
              placeholder="Describe your issue or question..."
              rows={5}
              className={`${inputClass} resize-y`}
            />
            {feedback && (
              <div
                role="status"
                className={`text-sm font-hanken px-4 py-3 border-l-4 ${
                  feedback.type === 'blocked' || feedback.type === 'error'
                    ? 'border-[#b70011] bg-[#b70011]/5 text-[#b70011]'
                    : feedback.type === 'warning'
                      ? 'border-[#7a5100] bg-[#7a5100]/5 text-[#7a5100]'
                      : 'border-[#0f7a3d] bg-[#0f7a3d]/5 text-[#0f7a3d]'
                }`}
              >
                {feedback.message}
              </div>
            )}
            <div>
              <BtnPrimary type="submit" disabled={sending} className="px-6 py-3">
                <Icon name="send" size={18} color="#fff" />
                {sending ? 'Checking...' : 'Send Message'}
              </BtnPrimary>
            </div>
          </form>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}