import { useCallback, useEffect, useMemo, useState } from 'react';
import { planJourney } from '@engine/services/journeyPlanner';
import { journeySteps, explainJourney, type JourneyStep } from '@engine/services/explainJourney';
import { searchPlaces, getPlaceDetails } from '@engine/services/placesService';
import { confirmRouteWorked } from '@engine/services/contribute';
import { supabase } from '@engine/lib/supabase';
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

type Resolved = { name: string; latitude: number; longitude: number };

/** Text in, a place out — the first match wins, as the app's search does. */
async function resolve(text: string): Promise<Resolved | null> {
  const hits = await searchPlaces(text.trim());
  if (!hits.length) return null;
  const details = await getPlaceDetails(hits[0].placeId);
  if (!details) return null;
  return { name: details.name, latitude: details.latitude, longitude: details.longitude };
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

        {/* The sentence that actually works at the park. */}
        {step.say && <p className="step-say">“{step.say}”</p>}

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
            {NGN(step.fare.min)}–{NGN(step.fare.max)}
            {step.fare.source === 'table' ? ' · published fare' : ' · rider-reported'}
          </span>
        )}

        {step.note && <p className="step-note">{step.note}</p>}
      </div>
    </li>
  );
}

/**
 * Conductors re-price danfo, keke and okada on the spot; BRT and rail are flat.
 * Arming the rider with the number and the words is the whole point — so this
 * only appears where the fare is actually negotiable.
 */
function FareTalk({ legs }: { legs: RouteLeg[] }) {
  const flex = legs.find((l) => l.mode === 'danfo' || l.mode === 'keke' || l.mode === 'okada');
  if (!flex) return null;

  return (
    <p className="fare-talk">
      Conductor for {flex.from.name} go call {NGN(flex.priceMin)}–{NGN(flex.priceMax)}. If e pass{' '}
      {NGN(flex.priceMax)}, tell am <b>“e no reach, na {NGN(flex.priceMax)} I dey pay”</b>.
    </p>
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SmartRouteResult | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);

  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [askEmail, setAskEmail] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const option: RouteOption | null = useMemo(() => {
    if (!result) return null;
    return result.options.find((o) => o.id === optionId) ?? result.options[0];
  }, [result, optionId]);

  const steps = useMemo(() => (option ? journeySteps(option) : []), [option]);

  const search = useCallback(async () => {
    const match = query.trim().match(TRIP_RE);
    if (!match) {
      setError('Type the trip as two places — for example "Ikeja to Lekki".');
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    setSaid(null);

    try {
      const [from, to] = await Promise.all([resolve(match[1]), resolve(match[2])]);

      // Say which end failed. "Nothing found" sends people back to retype a
      // place that was fine.
      if (!from || !to) {
        const missing = [!from && match[1], !to && match[2]].filter(Boolean).join(' and ');
        setError(`We no fit find ${missing}. Try a landmark or bus stop near it.`);
        return;
      }

      const plan = await planJourney({
        origin: { latitude: from.latitude, longitude: from.longitude },
        originName: from.name,
        destination: { latitude: to.latitude, longitude: to.longitude },
        destinationName: to.name,
      });

      setResult(plan);
      setOptionId(plan.recommendedOptionId);
    } catch {
      // planJourney throws rather than inventing a route — the honest failure
      // the app shows on Home, in the same words.
      setError('We no sabi this road yet. Ask at the park, and tell us what you find.');
    } finally {
      setBusy(false);
    }
  }, [query]);

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
            onKeyDown={(e) => e.key === 'Enter' && !busy && search()}
            placeholder="Ikeja to Lekki"
            aria-label="Where you dey go? Type two places, from and to."
            autoComplete="off"
            enterKeyHint="search"
          />
          <button className="go" onClick={search} disabled={busy || !query.trim()}>
            {busy ? 'Finding…' : 'Waka'}
          </button>
        </div>
        <p className="hint">Two places, like “Yaba to Ojota”. No account needed to search.</p>

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
                    {o.name}
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
