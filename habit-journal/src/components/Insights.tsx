import { useMemo, useState } from 'react';
import type { AppData } from '../types';
import { analyze, benefit, LAGS, MIN_N, type PairResult } from '../stats/analyze';
import { evidence, evidenceLabel, fmt, fmtP, lagPhrase, lagShort } from './format';
import PairDetail from './PairDetail';
import ImpactBoard from './ImpactBoard';
import { habitOverlap } from '../stats/analyze';
import { IconSparkle } from './Icons';

interface Props { data: AppData; onLoadDemo: () => void; onGoJournal: () => void }

type LagSel = number | 'best';

export default function Insights({ data, onLoadDemo, onGoJournal }: Props) {
  const [lagSel, setLagSel] = useState<LagSel>('best');
  const [selected, setSelected] = useState<{ h: string; o: string; lag: number } | null>(null);
  const results = useMemo(() => analyze(data), [data]);
  const habits = data.habits.filter((h) => !h.archived);
  const outcomes = data.outcomes.filter((o) => !o.archived);
  const outcomeById = Object.fromEntries(data.outcomes.map((o) => [o.id, o]));
  const habitById = Object.fromEntries(data.habits.map((h) => [h.id, h]));
  const daysLogged = Object.keys(data.entries).length;

  const cell = (h: string, o: string): PairResult | undefined => {
    const rs = results.filter((r) => r.habitId === h && r.outcomeId === o);
    if (lagSel !== 'best') return rs.find((r) => r.lag === lagSel);
    const valid = rs.filter((r) => isFinite(r.p));
    if (!valid.length) return rs.find((r) => r.lag === 0);
    return valid.reduce((a, b) => (b.p < a.p ? b : a));
  };

  const ranked = results.filter((r) => isFinite(r.q)).sort((a, b) => a.p - b.p);
  const findings = ranked.filter((r) => r.q < 0.1);
  const trends = ranked.filter((r) => r.q >= 0.1 && r.p < 0.05).slice(0, 4);
  const testsRun = ranked.length;
  const overlap = useMemo(() => habitOverlap(data, 0.4), [data]);

  if (daysLogged < MIN_N) {
    return (
      <div className="empty fade-in">
        <div className="empty-icon"><IconSparkle width={34} height={34} /></div>
        <h2>Insights unlock after {MIN_N} days</h2>
        <p>You've logged <b>{daysLogged}</b> {daysLogged === 1 ? 'day' : 'days'}. With fewer days than that, any correlation is mostly noise.</p>
        <div className="progress"><div style={{ width: `${(daysLogged / MIN_N) * 100}%` }} /></div>
        <div className="empty-actions">
          <button className="primary-btn" onClick={onGoJournal}>Log today</button>
          <button className="secondary-btn" onClick={onLoadDemo}>Explore with demo data</button>
        </div>
      </div>
    );
  }

  const describe = (r: PairResult) => {
    const h = habitById[r.habitId], o = outcomeById[r.outcomeId];
    const dir = r.diff < 0 ? 'lower' : 'higher';
    const good = benefit(r, o.higherIsBetter) > 0;
    return { h, o, dir, good };
  };

  return (
    <div className="insights fade-in">
      <div className="stat-row">
        <div className="stat"><span className="stat-v">{daysLogged}</span><span className="stat-l">days logged</span></div>
        <div className="stat"><span className="stat-v">{testsRun}</span><span className="stat-l">tests run</span></div>
        <div className="stat"><span className="stat-v accent">{findings.length}</span><span className="stat-l">findings (FDR &lt; 10%)</span></div>
      </div>

      {findings[0] && (() => {
        const top = findings[0];
        const { h, o, good } = describe(top);
        return (
          <button className={`hero ${good ? 'good' : 'bad'}`} onClick={() => setSelected({ h: top.habitId, o: top.outcomeId, lag: top.lag })}>
            <div className="hero-eyebrow">Strongest finding</div>
            <div className="hero-title"><span className="dot" style={{ background: h.color }} /> {h.name} → {o.name}, {lagPhrase(top.lag)}</div>
            <div className="hero-nums">
              <div><span className="hero-n muted-n">{fmt(top.meanWithout, 1)}</span><span className="hero-l">without</span></div>
              <div className="hero-arrow">→</div>
              <div><span className="hero-n">{fmt(top.meanWith, 1)}</span><span className="hero-l">with {h.name.toLowerCase()}</span></div>
              <div className="hero-delta">{top.diff > 0 ? '+' : '−'}{fmt(Math.abs(top.diff), 1)}<span>/10</span></div>
            </div>
            <div className="hero-meta">r = {fmt(top.r)} · 95% CI [{fmt(top.ci[0])}, {fmt(top.ci[1])}] · q = {fmtP(top.q)} · {top.n} days</div>
          </button>
        );
      })()}

      <section className="card">
        <div className="card-head">
          <h2>Impact board</h2>
          <LagPicker value={lagSel} onChange={setLagSel} />
        </div>
        <p className="muted small">Average outcome on days <b>without</b> each habit (○) vs. days <b>with</b> it (●). Bold rows with ★ hold up after correcting for multiple tests. Click a row for details.</p>
        <ImpactBoard data={data} pick={cell} onSelect={(h, o, lag) => setSelected({ h, o, lag })} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Correlation map</h2>
          <LagPicker value={lagSel} onChange={setLagSel} />
        </div>
        <p className="muted small">
          Each cell shows the correlation between doing a habit and the outcome {lagSel === 'best' ? 'at the lag with the strongest signal' : lagPhrase(lagSel as number)}.
          <span className="legend"><i className="lg good" /> better <i className="lg bad" /> worse <i className="lg dim" /> not significant</span>
        </p>
        <div className="heatmap" style={{ gridTemplateColumns: `minmax(110px, 160px) repeat(${outcomes.length}, minmax(90px, 1fr))` }}>
          <div />
          {outcomes.map((o) => <div key={o.id} className="hm-col">{o.name}</div>)}
          {habits.map((h) => (
            <Row key={h.id}>
              <div className="hm-row"><span className="dot" style={{ background: h.color }} />{h.name}</div>
              {outcomes.map((o) => {
                const r = cell(h.id, o.id);
                if (!r || r.status !== 'ok') {
                  return <div key={o.id} className="hm-cell na" title={r?.status === 'no-variation' ? 'Habit almost always/never done' : 'Not enough data'}>n/a</div>;
                }
                const b = benefit(r, o.higherIsBetter);
                const ev = evidence(r);
                const sig = ev === 'strong' || ev === 'likely';
                const alpha = Math.min(1, Math.abs(r.r) * 1.6 + 0.08);
                const color = b > 0 ? `rgba(var(--good-rgb), ${alpha})` : `rgba(var(--bad-rgb), ${alpha})`;
                return (
                  <button
                    key={o.id}
                    className={`hm-cell ${sig ? 'sig' : 'dim'}`}
                    style={{ ['--cell' as string]: color }}
                    onClick={() => setSelected({ h: h.id, o: o.id, lag: r.lag })}
                    title={`r = ${fmt(r.r)}, q = ${fmtP(r.q)}, n = ${r.n}`}
                  >
                    <span className="hm-r">{r.r > 0 ? '+' : ''}{fmt(r.r)}</span>
                    <span className="hm-sub">{lagSel === 'best' ? lagShort(r.lag) + ' · ' : ''}{sig ? (ev === 'strong' ? '★★' : '★') : `q ${fmtP(r.q)}`}</span>
                  </button>
                );
              })}
            </Row>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>What the data says</h2></div>
        {findings.length === 0 && <p className="muted">No relationships survive the multiple-testing correction yet. Keep logging. Real effects of about 1.5 points usually show up after 30–60 days.</p>}
        <ul className="findings">
          {findings.map((r) => {
            const { h, o, dir, good } = describe(r);
            return (
              <li key={`${r.habitId}${r.outcomeId}${r.lag}`} className="finding" onClick={() => setSelected({ h: r.habitId, o: r.outcomeId, lag: r.lag })}>
                <span className={`badge ${good ? 'good' : 'bad'}`}>{good ? '↑ helps' : '↓ hurts'}</span>
                <div className="finding-body">
                  <div className="finding-title">
                    {o.name} is <b>{fmt(Math.abs(r.diff), 1)} pts {dir}</b> {lagPhrase(r.lag)} after <span className="dot" style={{ background: h.color }} /> {h.name}
                  </div>
                  <div className="finding-meta">
                    {fmt(r.meanWith, 1)} vs {fmt(r.meanWithout, 1)} · r = {fmt(r.r)} [{fmt(r.ci[0])}, {fmt(r.ci[1])}] · q = {fmtP(r.q)} · n = {r.n} · {evidenceLabel[evidence(r)]}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {trends.length > 0 && (
          <>
            <h3 className="subhead">Trends to watch <span className="muted small">(p &lt; 0.05 but likely chance after correction)</span></h3>
            <ul className="findings compact">
              {trends.map((r) => {
                const { h, o, dir } = describe(r);
                return (
                  <li key={`${r.habitId}${r.outcomeId}${r.lag}`} className="finding" onClick={() => setSelected({ h: r.habitId, o: r.outcomeId, lag: r.lag })}>
                    <div className="finding-body">
                      <div className="finding-title">{h.name} → {o.name} {dir} {lagPhrase(r.lag)} ({r.diff > 0 ? '+' : ''}{fmt(r.diff, 1)})</div>
                      <div className="finding-meta">p = {fmtP(r.p)} · q = {fmtP(r.q)} · n = {r.n}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {overlap.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Habits you do together</h2></div>
          <p className="muted small">These habits usually happen on the same days, so their effects are hard to tell apart. Try doing one without the other sometimes.</p>
          <ul className="overlap">
            {overlap.map((x) => (
              <li key={x.a + x.b}>
                <span className="dot" style={{ background: habitById[x.a].color }} /> {habitById[x.a].name}
                <span className="overlap-link">{x.r > 0 ? 'usually together' : 'rarely together'} · φ = {fmt(x.r)}</span>
                <span className="dot" style={{ background: habitById[x.b].color }} /> {habitById[x.b].name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="caveat">
        Correlation is not causation. Habits you tend to do together (e.g. cleanser + moisturizer) can't be separated here, and things you don't log
        (stress, weather, diet) may drive both. To test a habit properly, alternate it on and off for a few weeks.
      </p>

      {selected && (
        <PairDetail
          data={data}
          results={results}
          habitId={selected.h}
          outcomeId={selected.o}
          initialLag={selected.lag}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function LagPicker({ value, onChange }: { value: LagSel; onChange: (l: LagSel) => void }) {
  return (
    <div className="segmented" role="tablist">
      {(['best', ...LAGS] as LagSel[]).map((l) => (
        <button key={String(l)} className={value === l ? 'on' : ''} onClick={() => onChange(l)}>
          {l === 'best' ? 'Best lag' : lagShort(l)}
        </button>
      ))}
    </div>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => <>{children}</>;
