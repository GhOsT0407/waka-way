import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { planJourney } from '@engine/services/journeyPlanner';
import { journeySteps, explainJourney, type JourneyStep } from '@engine/services/explainJourney';
import { searchPlaces, getPlaceDetails, isWithinLagos } from '@engine/services/placesService';
import { confirmRouteWorked } from '@engine/services/contribute';
import { supabase } from './supabase';
import { GRAPH_STOPS } from '@engine/data/lagosRoutes';
import { haversineKm } from '@engine/services/routeGraph';
import type { SmartRouteResult, RouteOption, RouteLeg } from '@engine/services/smartRoutingService';

/**
 * WakaWay on the web.
 *
 * The whole product thesis is that the explanation is the thing — where to
 * stand, what the conductor shouts, what it should cost (ADR 0013). None of
 * that needs a map, so the map is extra: it loads only once a route is on
 * screen, and the first page stays a light link you can paste into WhatsApp.
 *
 * Visual language follows the landing page — danfo livery stripe, condensed
 * display type, mono numerics — so the two web surfaces read as one site.
 * Every line of routing runs the same code the Expo app runs; this file is a
 * shell around it and owns no transport logic of its own.
 */

// Mirrors the trip-line pattern in client/src/components/home/SearchOverlay.tsx,
// which keeps it as a local const. Same grammar: "Ikeja to Lekki", "yaba -> cms".
const TRIP_RE = /^(?:from\s+)?(.{2,}?)\s+(?:to|→|->|-)\s+(.{2,})$/i;

const NGN = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');
const fareRange = (min: number, max: number) => (min === max ? NGN(max) : `${NGN(min)}–${NGN(max)}`);

type Resolved = { name: string; address: string; latitude: number; longitude: number };

// The map library is most of the page's weight; nobody pays for it until
// there is a route to draw.
const RouteMap = lazy(() => import('./RouteMap'));

// ─── Where the rider is standing ─────────────────────────────────────────────

type Fix = { latitude: number; longitude: number; accuracy: number; at: number };

/** A fix this recent is reused rather than asked for again on every search. */
const FIX_FRESH_MS = 2 * 60 * 1000;
/** Past this, the start is too rough to trust without telling the rider. */
const ROUGH_FIX_M = 500;

const TYPE_START = 'Type where you are instead — like “Yaba to Ikeja”.';

/** The browser's location, or a sentence saying plainly why we could not get it. */
function locate(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error(`This browser cannot share your location. ${TYPE_START}`));
      return;
    }
    if (!window.isSecureContext) {
      // Browsers only hand out location over HTTPS (or localhost).
      reject(new Error(`Location only works on a secure (https) link. ${TYPE_START}`));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }),
      (err) => {
        const why = err.code === err.PERMISSION_DENIED
          ? 'Location is turned off for this site.'
          : err.code === err.TIMEOUT
            ? 'Your phone took too long to find where you are.'
            : 'Your phone could not find where you are.';
        reject(new Error(`${why} ${TYPE_START}`));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

/** "near Ojodu Berger" — the stop a rider would name for where they stand. */
function nearestStopName(fix: { latitude: number; longitude: number }): string | null {
  let best: { name: string; km: number } | null = null;
  for (const s of GRAPH_STOPS) {
    const km = haversineKm(fix, s);
    if (!best || km < best.km) best = { name: s.name, km };
  }
  return best && best.km <= 2 ? best.name : null;
}

/** The nearest stop we know to a point, however far — for the "can't route" message. */
function nearestKnownStop(p: { latitude: number; longitude: number }): { name: string; km: number } {
  let best = { name: GRAPH_STOPS[0].name, km: Infinity };
  for (const s of GRAPH_STOPS) {
    const km = haversineKm(p, s);
    if (km < best.km) best = { name: s.name, km };
  }
  return best;
}

const describeFix = (fix: Fix) => {
  const near = nearestStopName(fix);
  const metres = Math.round(fix.accuracy);
  return `${near ? `near ${near}` : 'your current spot'} (±${metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`})`;
};

// ─── Typed places ────────────────────────────────────────────────────────────

/**
 * Text in, the few places it could mean out, best first. The rider sees which
 * one we picked and can switch — a silent first match is how "beger" once
 * became the centre of Lagos and every route started at CMS.
 */
async function candidates(text: string): Promise<Resolved[]> {
  const hits = await searchPlaces(text.trim());
  const out: Resolved[] = [];
  for (const h of hits.slice(0, 4)) {
    const d = await getPlaceDetails(h.placeId);
    if (d) out.push({ name: d.name, address: h.address, latitude: d.latitude, longitude: d.longitude });
  }
  return out;
}

/** The place we understood, with the other readings one tap away. */
function Pick({ label, list, index, onPick }: { label: string; list: Resolved[]; index: number; onPick: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  const current = list[index];
  return (
    <span className="pick">
      <span className="pick-label">{label}</span>
      <button
        className="pick-current"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={list.length < 2}
        title={list.length < 2 ? undefined : 'Not this place? Pick another'}
      >
        {current.name}
        {list.length > 1 && <span aria-hidden="true"> ▾</span>}
      </button>
      {open && (
        <span className="pick-list">
          {list.map((p, i) =>
            i === index ? null : (
              <button key={`${p.name}-${i}`} className="chip-btn pick-option" onClick={() => { setOpen(false); onPick(i); }}>
                {p.name}
                <span className="pick-sub">{p.address}</span>
              </button>
            ),
          )}
        </span>
      )}
    </span>
  );
}

const ASIDES: { key: keyof JourneyStep; label: string }[] = [
  { key: 'lookFor', label: 'Look for' },
  { key: 'boardAt', label: 'Where to stand' },
  { key: 'listenFor', label: 'Listen for' },
  { key: 'after', label: 'Your stop is after' },
];

function Step({ step }: { step: JourneyStep }) {
  return (
    <li className="step">
      <span className={`chip chip-${step.mode}`}>{step.mode}</span>

      <div className="step-body">
        <p className="step-title">
          <span className="n">{step.n}</span>
          {step.title}
        </p>
        {step.detail && <p className="step-detail">{step.detail}</p>}

        {/* The sentence that actually works at the park. The engine already
            quotes the words to say, so they are shown exactly as given. */}
        {step.say && <p className="step-say">{step.say}</p>}

        {ASIDES.map(({ key, label }) => {
          const value = step[key];
          return typeof value === 'string' && value ? (
            <p className="aside" key={key}>
              <span className="label">{label}</span>
              {value}
            </p>
          ) : null;
        })}

        {step.fare && (
          <span className="step-fare">
            {fareRange(step.fare.min, step.fare.max)}
            {step.fare.source === 'table' ? ' · published fare' : ' · rider-reported'}
          </span>
        )}

        {step.note && <p className="step-note">{step.note}</p>}
      </div>
    </li>
  );
}

/**
 * Conductors and riders re-price danfo, keke and okada on the spot. A
 * published LAMATA fare is not haggled, so advice to haggle over it — "if e
 * pass ₦450, tell am ₦450" — was nonsense. Only a negotiable fare gets this.
 */
function FareTalk({ legs }: { legs: RouteLeg[] }) {
  const flex = legs.find((l) =>
    (l.mode === 'danfo' || l.mode === 'keke' || l.mode === 'okada') && l.fareSource === 'band' && l.priceMax > 0);
  if (!flex) return null;
  const who = flex.mode === 'danfo' ? 'Conductor' : flex.mode === 'keke' ? 'Keke man' : 'Okada man';
  // "Conductor for Your location" reads as nonsense; a place is only named
  // when it is one a rider would recognise.
  const where = flex.from.name === 'Your location' ? '' : ` for ${flex.from.name}`;

  return (
    <p className="fare-talk">
      {who}{where} go call {fareRange(flex.priceMin, flex.priceMax)}. If e pass {NGN(flex.priceMax)}, tell am{' '}
      <b>“e no reach, na {NGN(flex.priceMax)} I dey pay”</b>.
    </p>
  );
}

/**
 * The route can be right and still not be how a local would go — a shortcut,
 * a better bus, a road that is never jammed. Always said; said louder when
 * part of the route is something we have not confirmed.
 */
function Caution({ option }: { option: RouteOption }) {
  const shaky = option.tags.includes('Unverified')
    || option.tags.includes('Far from known stops')
    || option.transfers >= 3
    || option.legs.some((l) => l.mayBeUnavailable || l.confidence === 'likely');
  return (
    <p className={`caution${shaky ? ' strong' : ''}`}>
      {shaky && <b>Parts of this route are not confirmed yet. </b>}
      Locals sometimes know a quicker way. Before you go, confirm with a conductor or someone at the park.
    </p>
  );
}

// ─── "Did this route work?" ──────────────────────────────────────────────────

type Reason = 'wrong_bus' | 'wrong_stop' | 'faster_way' | 'fare_wrong' | 'took_longer' | 'other';
const REASONS: { id: Reason; label: string }[] = [
  { id: 'wrong_bus', label: 'Wrong bus' },
  { id: 'wrong_stop', label: 'Wrong stop' },
  { id: 'faster_way', label: 'There’s a faster way' },
  { id: 'fare_wrong', label: 'Fare was wrong' },
  { id: 'took_longer', label: 'Took much longer' },
  { id: 'other', label: 'Something else' },
];

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
/** A whole number inside [min, max] from whatever was typed, or nothing. */
const wholeIn = (text: string, min: number, max: number) => {
  const n = parseInt(text.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** What we suggested, in a shape the admin page can show and count by line. */
function summarise(o: RouteOption) {
  return {
    option: o.name,
    recommended: o.isRecommended,
    modes: o.legs.map((l) => l.mode),
    corridors: [...new Set(o.legs.map((l) => l.corridorId).filter((c): c is string => !!c))],
    legs: o.legs.map((l) => ({ mode: l.mode, from: l.from.name, to: l.to.name, corridor: l.corridorId ?? null })),
    fare: [o.totalPriceMin, o.totalPriceMax],
    minutes: o.totalDurationMins,
    transfers: o.transfers,
    tags: o.tags,
  };
}

/**
 * The rider tells us whether the route worked, and if not, how they really
 * go. No account: a correction is worth more than a sign-in it would never
 * get past. Nothing sent here changes a route on its own — it lands in the
 * admin page for a person to check.
 */
function Feedback({ result, option, signedIn }: { result: SmartRouteResult; option: RouteOption; signedIn: boolean }) {
  const [stage, setStage] = useState<'ask' | 'no' | 'sending' | 'sent' | 'failed'>('ask');
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [correction, setCorrection] = useState('');
  const [minutes, setMinutes] = useState('');
  const [fare, setFare] = useState('');
  const [contact, setContact] = useState('');
  const [why, setWhy] = useState('');

  // A different route on screen deserves a fresh question.
  useEffect(() => {
    setStage('ask'); setReasons([]); setCorrection(''); setMinutes(''); setFare(''); setContact(''); setWhy('');
  }, [option.id]);

  const toggle = (r: Reason) => setReasons((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));
  const canSendNo = reasons.length > 0 || correction.trim().length > 0;

  const send = async (verdict: 'correct' | 'wrong') => {
    setStage('sending');
    const { error } = await supabase.from('route_feedback').insert({
      verdict,
      reasons: verdict === 'wrong' ? reasons : [],
      correction: correction.trim().slice(0, 1000) || null,
      minutes_taken: wholeIn(minutes, 1, 600),
      fare_paid_ngn: wholeIn(fare, 0, 100000),
      contact: contact.trim().slice(0, 120) || null,
      from_name: result.origin.name.slice(0, 120),
      // The start is often the rider's own location: rounded to ~110 m
      // here, and again by the database, so it is never their exact door.
      from_lat: round(result.origin.latitude, 3),
      from_lng: round(result.origin.longitude, 3),
      to_name: result.destination.name.slice(0, 120),
      to_lat: round(result.destination.latitude, 4),
      to_lng: round(result.destination.longitude, 4),
      suggested: summarise(option),
      depart_at: new Date().toISOString(),
      source: 'web',
    });
    if (error) {
      setWhy(/too much feedback/i.test(error.message)
        ? 'Too many reports from this network in the last hour. Try again later.'
        : 'That did not send. Check your connection and try again.');
      setStage('failed');
      return;
    }
    // Signed in, a "yes" also counts toward the line's trust badge, as in the app.
    if (verdict === 'correct' && signedIn) confirmRouteWorked(result, option).catch(() => {});
    setStage('sent');
  };

  return (
    <section className="feedback" aria-live="polite">
      {stage === 'ask' && (
        <>
          <p className="feedback-q">Did this route work for you?</p>
          <div className="feedback-row">
            <button className="btn-ghost yes" onClick={() => send('correct')}>Yes, e correct</button>
            <button className="btn-ghost no" onClick={() => setStage('no')}>No, e no correct</button>
          </div>
          <p className="hint">Tell us after you ride. No account needed.</p>
        </>
      )}

      {stage === 'no' && (
        <form
          className="feedback-form"
          onSubmit={(e) => { e.preventDefault(); if (canSendNo) send('wrong'); }}
        >
          <p className="feedback-q">What was wrong?</p>
          <div className="feedback-reasons" role="group" aria-label="What was wrong">
            {REASONS.map((r) => (
              <button
                type="button"
                key={r.id}
                className="chip-btn"
                aria-pressed={reasons.includes(r.id)}
                onClick={() => toggle(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <label className="field-label" htmlFor="fb-correction">How do you actually go?</label>
          <textarea
            id="fb-correction"
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="From Berger, enter Ikeja bus, drop at Allen, then walk…"
          />

          <div className="feedback-pair">
            <div>
              <label className="field-label" htmlFor="fb-fare">What you paid (₦)</label>
              <input id="fb-fare" inputMode="numeric" value={fare} onChange={(e) => setFare(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="field-label" htmlFor="fb-minutes">How long it took (min)</label>
              <input id="fb-minutes" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <label className="field-label" htmlFor="fb-contact">Phone or email, if we may ask you more</label>
          <input id="fb-contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} placeholder="Optional" />

          <div className="feedback-row">
            <button type="submit" className="go" disabled={!canSendNo}>Send</button>
            <button type="button" className="btn-ghost" onClick={() => setStage('ask')}>Cancel</button>
          </div>
          {!canSendNo && <p className="hint">Pick what was wrong, or tell us how you go.</p>}
        </form>
      )}

      {stage === 'sending' && <p className="hint">Sending…</p>}

      {stage === 'sent' && (
        <p className="notice">Thank you — we go check am. Every correction makes the next person’s route better.</p>
      )}

      {stage === 'failed' && (
        <p className="notice bad">
          {why}{' '}
          <button className="link-btn" onClick={() => setStage(reasons.length || correction ? 'no' : 'ask')}>Try again</button>
        </p>
      )}
    </section>
  );
}

/** Where the trip starts: the rider's own position, or places they typed. */
type Start = { kind: 'here'; fix: Fix } | { kind: 'typed'; list: Resolved[]; index: number };
interface Ends { start: Start; to: Resolved[]; ti: number }

const startPoint = (s: Start): Resolved =>
  s.kind === 'here'
    ? { name: 'Your location', address: describeFix(s.fix), latitude: s.fix.latitude, longitude: s.fix.longitude }
    : s.list[s.index];

export default function App() {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ends, setEnds] = useState<Ends | null>(null);
  const [result, setResult] = useState<SmartRouteResult | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);

  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const pendingFix = useRef<Promise<Fix> | null>(null);

  const [signedIn, setSignedIn] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  /**
   * The rider's position, asked for once and reused while fresh. Asked when
   * they start a search rather than on page load: a location prompt nobody
   * asked for reads as a page that wants to track you.
   */
  const getFix = useCallback(async (): Promise<Fix> => {
    if (fix && Date.now() - fix.at < FIX_FRESH_MS) return fix;
    if (!pendingFix.current) {
      setLocating(true);
      setLocError(null);
      pendingFix.current = locate()
        .then((f) => {
          if (!isWithinLagos(f.latitude, f.longitude)) {
            throw new Error(`You look to be outside Lagos, so we can't start from where you are. ${TYPE_START}`);
          }
          setFix(f);
          return f;
        })
        .catch((e: Error) => {
          setLocError(e.message);
          throw e;
        })
        .finally(() => {
          setLocating(false);
          pendingFix.current = null;
        });
    }
    return pendingFix.current;
  }, [fix]);

  const option: RouteOption | null = useMemo(() => {
    if (!result) return null;
    return result.options.find((o) => o.id === optionId) ?? result.options[0];
  }, [result, optionId]);

  const steps = useMemo(() => (option ? journeySteps(option) : []), [option]);

  /** Plan between two chosen places. */
  const plan = useCallback(async (from: Resolved, to: Resolved) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setSaid(null);
    try {
      const r = await planJourney({
        origin: { latitude: from.latitude, longitude: from.longitude },
        originName: from.name,
        destination: { latitude: to.latitude, longitude: to.longitude },
        destinationName: to.name,
      });
      setResult(r);
      setOptionId(r.recommendedOptionId);
    } catch {
      // planJourney throws rather than inventing a route. Say which end is off
      // our network and the nearest stop we do know, so the rider has
      // something to type instead of a dead end.
      const a = nearestKnownStop(from), b = nearestKnownStop(to);
      const far = a.km >= b.km ? { end: 'where you are starting', ...a } : { end: to.name, ...b };
      setError(
        far.km > 1
          ? `We no sabi road from ${far.end} yet — the nearest stop we know is ${far.name}, ${far.km.toFixed(1)} km away. Try searching from or to ${far.name}, and tell us how you go.`
          : 'We no sabi this road yet. Ask at the park, and tell us what you find.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const search = useCallback(async () => {
    const text = query.trim();
    if (!text) return;

    setBusy(true);
    setError(null);
    setResult(null);
    setEnds(null);
    setSaid(null);

    // "Yaba to Ikeja" plans between two typed places; anything else is a
    // destination, and the trip starts where the rider is standing.
    const match = text.match(TRIP_RE);
    let start: Start;
    let toList: Resolved[];

    if (match) {
      const [fromList, dest] = await Promise.all([candidates(match[1]), candidates(match[2])]);
      if (!fromList.length || !dest.length) {
        const missing = [!fromList.length && match[1], !dest.length && match[2]].filter(Boolean).join(' and ');
        setError(`We no fit find "${missing}". Try the bus stop or a landmark near it.`);
        setBusy(false);
        return;
      }
      start = { kind: 'typed', list: fromList, index: 0 };
      toList = dest;
    } else {
      const [here, dest] = await Promise.all([getFix().catch(() => null), candidates(text)]);
      if (!dest.length) {
        // Guessing a place we do not know is how a route ends up at CMS.
        setError(`We no fit find "${text}". Try the bus stop or a landmark near it.`);
        setBusy(false);
        return;
      }
      if (!here) {
        // The location line already says why, and how to type a start instead.
        setBusy(false);
        return;
      }
      start = { kind: 'here', fix: here };
      toList = dest;
    }

    const next: Ends = { start, to: toList, ti: 0 };
    setEnds(next);
    await plan(startPoint(start), toList[0]);
  }, [query, plan, getFix]);

  const repickStart = useCallback((i: number) => {
    if (!ends || ends.start.kind !== 'typed') return;
    const next: Ends = { ...ends, start: { ...ends.start, index: i } };
    setEnds(next);
    plan(startPoint(next.start), next.to[next.ti]);
  }, [ends, plan]);

  const repickDest = useCallback((i: number) => {
    if (!ends) return;
    const next: Ends = { ...ends, ti: i };
    setEnds(next);
    plan(startPoint(next.start), next.to[next.ti]);
  }, [ends, plan]);

  const share = useCallback(async () => {
    if (!result || !option) return;
    const text = explainJourney(option, result.origin.name, result.destination.name);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setSaid('Copied — paste it to whoever needs it.');
      }
    } catch {
      /* dismissed the share sheet; nothing to report */
    }
  }, [result, option]);

  // Each leg weighted by its minutes — the shape of the journey in one glance.
  const totalMins = option ? option.legs.reduce((t, l) => t + l.durationMins, 0) || 1 : 1;
  const typingATrip = TRIP_RE.test(query.trim());

  return (
    <>
      <div className="stripe" role="presentation" />

      <main className="shell">
        <h1 className="wordmark">
          Waka<b>Way</b>
        </h1>
        <p className="eyebrow">Lagos · danfo · BRT · keke · okada · rail</p>

        <div className="search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Starting to type is the moment to find where the rider is, so
            // the fix is usually ready by the time they press Waka.
            onFocus={() => { if (!fix && !locError) getFix().catch(() => {}); }}
            onKeyDown={(e) => e.key === 'Enter' && !busy && search()}
            placeholder="Where you dey go?"
            aria-label="Where are you going? Type your destination."
            autoComplete="off"
            enterKeyHint="search"
          />
          <button className="go" onClick={search} disabled={busy || !query.trim()}>
            {busy ? 'Finding…' : 'Waka'}
          </button>
        </div>

        {/* Where the trip will start, said before the rider commits to it. */}
        <p className={`locline${locError && !typingATrip ? ' bad' : ''}`} aria-live="polite">
          {typingATrip
            ? 'Starting from the first place you typed.'
            : locating
              ? 'Finding where you are…'
              : fix
                ? <>Starting from your location · {describeFix(fix)}{fix.accuracy > ROUGH_FIX_M ? ' — that is rough; if the start looks wrong, type where you are' : ''}</>
                : locError
                  ? locError
                  : 'Type where you are going. We start from where you are — or type “Yaba to Ikeja” to start somewhere else.'}
        </p>

        {ends && (
          <p className="resolved">
            {ends.start.kind === 'here' ? (
              <span className="pick">
                <span className="pick-label">From</span>
                <span className="pick-current pick-static">Your location</span>
              </span>
            ) : (
              <Pick label="From" list={ends.start.list} index={ends.start.index} onPick={repickStart} />
            )}
            <Pick label="To" list={ends.to} index={ends.ti} onPick={repickDest} />
          </p>
        )}

        {error && <p className="notice bad">{error}</p>}

        {result && option && (
          <>
            {result.options.length > 1 && (
              <div className="options" role="group" aria-label="Route options">
                {result.options.map((o) => (
                  <button
                    key={o.id}
                    className="chip-btn"
                    aria-pressed={o.id === option.id}
                    onClick={() => setOptionId(o.id)}
                  >
                    {/* Two chips both reading "Danfo" can't be told apart, so
                        when names repeat each carries its time. */}
                    {result.options.filter((x) => x.name === o.name).length > 1
                      ? `${o.name} · ${o.totalDurationMins} min`
                      : o.name}
                  </button>
                ))}
              </div>
            )}

            <article className="route">
              <div className="route-top">
                <div className="tags">
                  {option.isRecommended && <span className="tag tag-rec">Recommended</span>}
                  <span className={`tag tag-${String(option.complexity).toLowerCase()}`}>
                    {String(option.complexity).toLowerCase()}
                  </span>
                  {option.tags.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>

                <p className="fare">
                  {option.priceFormatted}
                  <small>total fare</small>
                </p>
              </div>

              <div className="modebar" aria-hidden="true">
                {option.legs.map((l, i) => (
                  <span
                    key={i}
                    style={{ flex: l.durationMins / totalMins, background: `var(--${l.mode})` }}
                  />
                ))}
              </div>

              <div className="route-meta">
                <span>{option.totalDurationMins} min door to door</span>
                {!!option.waitMins && <span>incl. {option.waitMins} min waiting</span>}
                <span>
                  {option.transfers} transfer{option.transfers === 1 ? '' : 's'}
                </span>
                <span>{option.walkMins} min walking</span>
                <span>{option.totalDistanceKm} km</span>
              </div>

              {option.complexityReasons.length > 0 && (
                <p className="reasons">{option.complexityReasons.join(' · ')}</p>
              )}

              <Suspense fallback={<div className="route-map" aria-hidden="true" />}>
                <RouteMap option={option} label={`Map of the route from ${result.origin.name} to ${result.destination.name}`} />
              </Suspense>

              <Caution option={option} />

              <ol className="steps">
                {steps.map((s) => (
                  <Step key={`${s.legIndex}-${s.kind}-${s.n}`} step={s} />
                ))}
              </ol>

              <FareTalk legs={option.legs} />
            </article>

            <Feedback result={result} option={option} signedIn={signedIn} />

            <div className="actions">
              <button className="btn-ghost" onClick={share}>
                Share these directions
              </button>
            </div>

            {said && <p className="notice">{said}</p>}
          </>
        )}

        {/* What WakaWay is, said once before the first search. Riders new to
            the site need it, and it is the words a search engine reads. */}
        {!result && !busy && !error && (
          <section className="about">
            <h2 className="about-h">How to move around Lagos, before you leave</h2>
            <p>
              Type where you dey go. WakaWay works out which danfo, BRT, keke, okada or train will
              get you there, where to stand at the park, what the conductor will call, what to tell
              them, and what the fare should be — from Ikorodu to Ajah, Berger to CMS, Festac to Ikeja.
            </p>
            <p>
              Lagos has no official danfo map, so the routes come from LAMATA lines, OpenStreetMap
              and riders. If one is wrong, tell us after you ride — it makes the next person’s
              route better.
            </p>
          </section>
        )}

        <p className="foot">Fares are ranges, not promises. Tell us when one is wrong.</p>
      </main>

      <div className="stripe" role="presentation" />
    </>
  );
}
