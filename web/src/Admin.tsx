import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * The admin page: every "did this route work?" a rider has sent, newest
 * first, with what we suggested beside what they say they actually do.
 *
 * Reached at <site>/?admin. Signing in is an emailed link; the database —
 * not this page — decides who may read the feedback (row-level security and
 * public.is_admin()), so a stranger who finds the URL sees nothing.
 */

type Status = 'new' | 'reviewed' | 'fixed' | 'dismissed';

interface Suggested {
  option?: string;
  modes?: string[];
  corridors?: string[];
  legs?: { mode: string; from: string; to: string; corridor: string | null }[];
  fare?: [number, number];
  minutes?: number;
  transfers?: number;
}

interface Row {
  id: string;
  created_at: string;
  verdict: 'correct' | 'wrong';
  reasons: string[];
  correction: string | null;
  minutes_taken: number | null;
  fare_paid_ngn: number | null;
  contact: string | null;
  from_name: string;
  to_name: string;
  suggested: Suggested;
  source: string;
  status: Status;
  admin_note: string | null;
  reviewed_at: string | null;
}

const REASON_LABEL: Record<string, string> = {
  wrong_bus: 'Wrong bus',
  wrong_stop: 'Wrong stop',
  faster_way: 'There’s a faster way',
  fare_wrong: 'Fare was wrong',
  took_longer: 'Took much longer',
  other: 'Something else',
};

const NGN = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "danfo to Ikeja (Under Bridge) → walk" — what we told the rider, in one line. */
const chain = (s: Suggested) =>
  (s.legs ?? []).map((l) => (l.mode === 'walk' ? 'walk' : `${l.mode} to ${l.to}`)).join(' → ') || s.option || '—';

function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [why, setWhy] = useState('');

  const send = async () => {
    setState('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // Back to this same page; Supabase appends its sign-in code.
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}?admin`, shouldCreateUser: false },
    });
    if (error) {
      setWhy(error.message);
      setState('failed');
    } else setState('sent');
  };

  return (
    <section className="admin-card">
      <h2 className="admin-h">Sign in</h2>
      {state === 'sent' ? (
        <p className="notice">Check your email for the sign-in link, then open it in this browser.</p>
      ) : (
        <form className="search" onSubmit={(e) => { e.preventDefault(); if (email.trim()) send(); }}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Admin email"
          />
          <button className="go" disabled={!email.trim() || state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Send link'}
          </button>
        </form>
      )}
      {state === 'failed' && <p className="notice bad">That did not send: {why}</p>}
    </section>
  );
}

function FeedbackCard({ row, onSave }: { row: Row; onSave: (id: string, status: Status, note: string) => Promise<void> }) {
  const [note, setNote] = useState(row.admin_note ?? '');
  const [saving, setSaving] = useState(false);
  const s = row.suggested ?? {};

  const save = async (status: Status) => {
    setSaving(true);
    await onSave(row.id, status, note);
    setSaving(false);
  };

  return (
    <article className={`admin-row verdict-${row.verdict}`}>
      <header className="admin-row-head">
        <span className={`tag ${row.verdict === 'wrong' ? 'tag-complex' : 'tag-easy'}`}>
          {row.verdict === 'wrong' ? 'Not correct' : 'Correct'}
        </span>
        <span className="tag">{row.status}</span>
        <span className="admin-when">{when(row.created_at)} · {row.source}</span>
      </header>

      <p className="admin-trip"><b>{row.from_name}</b> → <b>{row.to_name}</b></p>

      <div className="admin-compare">
        <div>
          <span className="label">We suggested</span>
          <p>{chain(s)}</p>
          <p className="admin-meta">
            {s.fare ? `${NGN(s.fare[0])}–${NGN(s.fare[1])}` : ''}{s.minutes ? ` · ${s.minutes} min` : ''}
            {typeof s.transfers === 'number' ? ` · ${s.transfers} change${s.transfers === 1 ? '' : 's'}` : ''}
          </p>
          {!!s.corridors?.length && <p className="admin-meta">Lines: {s.corridors.join(', ')}</p>}
        </div>
        <div>
          <span className="label">Rider says</span>
          {!!row.reasons.length && <p>{row.reasons.map((r) => REASON_LABEL[r] ?? r).join(' · ')}</p>}
          {row.correction && <p className="admin-quote">“{row.correction}”</p>}
          <p className="admin-meta">
            {row.fare_paid_ngn != null ? `Paid ${NGN(row.fare_paid_ngn)}` : ''}
            {row.minutes_taken != null ? `${row.fare_paid_ngn != null ? ' · ' : ''}Took ${row.minutes_taken} min` : ''}
          </p>
          {row.contact && <p className="admin-meta">Contact: {row.contact}</p>}
          {row.verdict === 'correct' && !row.correction && <p className="admin-meta">The route worked.</p>}
        </div>
      </div>

      <textarea
        className="admin-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="Note for yourself — what you checked or changed"
        aria-label="Admin note"
      />
      <div className="feedback-row">
        <button className="btn-ghost" disabled={saving} onClick={() => save('reviewed')}>Reviewed</button>
        <button className="btn-ghost yes" disabled={saving} onClick={() => save('fixed')}>Fixed in the data</button>
        <button className="btn-ghost" disabled={saving} onClick={() => save('dismissed')}>Dismiss</button>
      </div>
    </article>
  );
}

function Inbox({ session }: { session: Session }) {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [status, setStatus] = useState<Status | 'all'>('new');
  const [verdict, setVerdict] = useState<'all' | 'wrong' | 'correct'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    const { data: isAdmin } = await supabase.rpc('is_admin');
    setAdmin(!!isAdmin);
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('route_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) setFailed(error.message);
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (id: string, next: Status, note: string) => {
    const patch = { status: next, admin_note: note.trim() || null, reviewed_at: new Date().toISOString() };
    const { error } = await supabase.from('route_feedback').update(patch).eq('id', id);
    if (error) setFailed(error.message);
    else setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const shown = useMemo(
    () => rows.filter((r) => (status === 'all' || r.status === status) && (verdict === 'all' || r.verdict === verdict)),
    [rows, status, verdict],
  );

  // Which lines draw the most "not correct" — where fixing the data pays first.
  const worstLines = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of rows) {
      if (r.verdict !== 'wrong') continue;
      for (const c of r.suggested?.corridors ?? []) count.set(c, (count.get(c) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);

  const total = rows.length;
  const correct = rows.filter((r) => r.verdict === 'correct').length;
  const waiting = rows.filter((r) => r.status === 'new').length;

  if (admin === false) {
    return (
      <section className="admin-card">
        <p className="notice bad">{session.user.email} is not an admin, so there is nothing to show here.</p>
        <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </section>
    );
  }

  return (
    <>
      <section className="admin-stats">
        <div className="stat"><span className="stat-n">{total}</span><span className="label">reports</span></div>
        <div className="stat"><span className="stat-n">{total ? Math.round((correct / total) * 100) : 0}%</span><span className="label">said correct</span></div>
        <div className="stat"><span className="stat-n">{waiting}</span><span className="label">waiting for review</span></div>
      </section>

      {worstLines.length > 0 && (
        <section className="admin-card">
          <h2 className="admin-h">Lines with the most “not correct”</h2>
          <ol className="admin-lines">
            {worstLines.map(([line, n]) => <li key={line}><span>{line}</span><b>{n}</b></li>)}
          </ol>
        </section>
      )}

      <div className="admin-filters">
        <div className="options" role="group" aria-label="Status">
          {(['new', 'reviewed', 'fixed', 'dismissed', 'all'] as const).map((s) => (
            <button key={s} className="chip-btn" aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
        <div className="options" role="group" aria-label="Verdict">
          {(['all', 'wrong', 'correct'] as const).map((v) => (
            <button key={v} className="chip-btn" aria-pressed={verdict === v} onClick={() => setVerdict(v)}>
              {v === 'wrong' ? 'not correct' : v}
            </button>
          ))}
          <button className="chip-btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {failed && <p className="notice bad">{failed}</p>}
      {loading && <p className="hint">Loading…</p>}
      {!loading && !shown.length && <p className="notice">Nothing here yet.</p>}

      {shown.map((r) => <FeedbackCard key={r.id} row={r} onSave={save} />)}
    </>
  );
}

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <>
      <div className="stripe" role="presentation" />
      <main className="shell admin">
        <h1 className="wordmark">Waka<b>Way</b></h1>
        <p className="eyebrow">Admin · route feedback</p>
        {session && (
          <p className="locline">
            Signed in as {session.user.email} ·{' '}
            <button className="link-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </p>
        )}
        {!ready ? <p className="hint">Loading…</p> : session ? <Inbox session={session} /> : <SignIn />}
      </main>
      <div className="stripe" role="presentation" />
    </>
  );
}
