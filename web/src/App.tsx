import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { planJourney } from '@engine/services/journeyPlanner';
import { journeySteps, explainJourney, type JourneyStep } from '@engine/services/explainJourney';
import { searchPlaces, getPlaceDetails, isWithinLagos } from '@engine/services/placesService';
import { confirmRouteWorked } from '@engine/services/contribute';
import { supabase } from '@engine/lib/supabase';
import { GRAPH_STOPS } from '@engine/data/lagosRoutes';
import { haversineKm } from '@engine/services/routeGraph';
import type { SmartRouteResult, RouteOption, RouteLeg } from '@engine/services/smartRoutingService';

/**
 * WakaWay on the web.
 *
 * The whole product thesis is that the explanation is the thing — where to
 * stand, what the conductor shouts, what it should cost (ADR 0013). None of
 * that needs a map, which is why this shell ships without one: no install,
 * no 40 MB download, a link you can paste into WhatsApp.
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

  return (
    <p className="fare-talk">
      {who} for {flex.from.name} go call {fareRange(flex.priceMin, flex.priceMax)}. If e pass {NGN(flex.priceMax)}, tell am{' '}
      <b>“e no reach, na {NGN(flex.priceMax)} I dey pay”</b>.
    </p>
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
  const [email, setEmail] = useState('');
  const [askEmail, setAskEmail] = useState(false);
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
      // planJourney throws rather than inventing a route — the honest failure
      // the app shows on Home, in the same words.
      setError('We no sabi this road yet. Ask at the park, and tell us what you find.');
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

  const worked = useCallback(async () => {
    if (!result || !option) return;
    if (!signedIn) {
      setAskEmail(true);
      return;
    }
    const ok = await confirmRouteWorked(result, option);
    setSaid(
      ok ? 'Thank you — that corridor just got more trusted.' : 'Could not save that. Try again later.',
    );
  }, [result, option, signedIn]);

  const sendLink = useCallback(async () => {
    const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setSaid(err ? 'That did not send. Check the address.' : 'Check your email for the sign-in link.');
    if (!err) setAskEmail(false);
  }, [email]);

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

              <ol className="steps">
                {steps.map((s) => (
                  <Step key={`${s.legIndex}-${s.kind}-${s.n}`} step={s} />
                ))}
              </ol>

              <FareTalk legs={option.legs} />
            </article>

            <div className="actions">
              <button className="btn-ghost" onClick={share}>
                Share these directions
              </button>
              <button className="btn-ghost worked" onClick={worked}>
                Yes, e work
              </button>

              {askEmail && (
                <>
                  <div className="signin">
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      aria-label="Email for the sign-in link"
                    />
                    <button className="btn-ghost" onClick={sendLink} disabled={!email.trim()}>
                      Send link
                    </button>
                  </div>
                  <p className="hint">
                    Reports need a sign-in so one person cannot vote a corridor up a hundred times.
                  </p>
                </>
              )}
            </div>

            {said && <p className="notice">{said}</p>}
          </>
        )}

        <p className="foot">Fares are ranges, not promises. Tell us when one is wrong.</p>
      </main>

      <div className="stripe" role="presentation" />
    </>
  );
}
