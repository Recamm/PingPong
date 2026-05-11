/* =====================================================================
   PING PONG TOURNAMENT — app.js
   Vanilla JS, no dependencies. Works fully offline / GitHub Pages.
   Persists state in localStorage under key 'pp_tournament'.
===================================================================== */

'use strict';

// ─── STORAGE KEY ────────────────────────────────────────────────────
const STORAGE_KEY = 'pp_tournament';

// ─── STATE ──────────────────────────────────────────────────────────
let S = null; // the entire tournament state object

/*
  S = {
    name: string,
    teams: string[],
    groups: string[][],            // groups[g] = [teamName, ...]
    groupMatches: Match[],         // all group-phase matches
    qualifiers: string[],          // 8 team names ordered for bracket seeding
    bracket: {
      qf: Match[4],
      sf: Match[2],
      final: Match,
      third: Match
    },
    phase: 'setup' | 'groups' | 'knockout' | 'done'
  }

  Match = { home: string, away: string, homeScore: number|null, awayScore: number|null, group?: string }
*/

// ─── INIT ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const saved = loadState();
  if (saved) {
    S = saved;
    showPhase(S.phase);
    renderCurrentPhase();
  } else {
    showPhase('setup');
    bindSetup();
  }
});

// ─── PHASE NAVIGATION ────────────────────────────────────────────────
const PHASE_IDS = {
  setup:    'phase-setup',
  groups:   'phase-groups',
  knockout: 'phase-knockout',
  done:     'phase-podium',
};

function showPhase(phase) {
  Object.values(PHASE_IDS).forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('active');
  });
  document.getElementById(PHASE_IDS[phase]).classList.add('active');
}

function renderCurrentPhase() {
  if (S.phase === 'setup')    { bindSetup(); renderTeamsList(); }
  if (S.phase === 'groups')   { renderGroups(); bindGroupsAdvance(); }
  if (S.phase === 'knockout') { renderKnockout(); bindKnockoutAdvance(); }
  if (S.phase === 'done')     { renderPodium(); }
}

// ─── LOCAL STORAGE ────────────────────────────────────────────────────
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch(_) {}
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(_) { return null; }
}
function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

// ═════════════════════════════════════════════════════════════════════
//  PHASE 0 — SETUP
// ═════════════════════════════════════════════════════════════════════

function bindSetup() {
  const btnAdd    = document.getElementById('btn-add-team');
  const teamInput = document.getElementById('team-name-input');
  const btnStart  = document.getElementById('btn-start');

  if (!S) S = { name: '', teams: [], phase: 'setup' };

  const nameInput = document.getElementById('tournament-name');
  nameInput.value = S.name || '';
  nameInput.addEventListener('input', () => { S.name = nameInput.value.trim(); saveState(); });

  btnAdd.addEventListener('click', addTeam);
  teamInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTeam(); });
  btnStart.addEventListener('click', startTournament);

  renderTeamsList();
}

function addTeam() {
  const input = document.getElementById('team-name-input');
  const name = input.value.trim();
  if (!name) return;
  if (S.teams.includes(name)) { alert('Ya existe un equipo con ese nombre.'); return; }
  if (S.teams.length >= 16)   { alert('Máximo 16 equipos.'); return; }
  S.teams.push(name);
  input.value = '';
  input.focus();
  saveState();
  renderTeamsList();
}

function removeTeam(index) {
  S.teams.splice(index, 1);
  saveState();
  renderTeamsList();
}

function renderTeamsList() {
  const list    = document.getElementById('teams-list');
  const count   = document.getElementById('team-count');
  const hint    = document.getElementById('setup-hint');
  const btnStart = document.getElementById('btn-start');
  const n = S.teams.length;

  count.textContent = n;
  list.innerHTML = S.teams.map((t, i) => `
    <li class="team-item">
      <span class="team-item-num">${i + 1}.</span>
      <span class="team-item-name">${esc(t)}</span>
      <button class="btn-danger" onclick="removeTeam(${i})">✕</button>
    </li>
  `).join('');

  if (n < 8) {
    hint.textContent = `Agregá al menos ${8 - n} equipo${8 - n !== 1 ? 's' : ''} más para comenzar.`;
    btnStart.disabled = true;
  } else if (n > 16) {
    hint.textContent = 'Máximo 16 equipos.';
    btnStart.disabled = true;
  } else {
    hint.textContent = `${n} equipos listos. ¡Podés iniciar el torneo!`;
    btnStart.disabled = false;
  }
}

function startTournament() {
  const nameInput = document.getElementById('tournament-name');
  S.name = nameInput.value.trim() || 'Torneo Ping Pong';

  // Build groups
  S.groups = buildGroups(S.teams);
  S.groupMatches = buildGroupMatches(S.groups);
  S.bracket = null;
  S.qualifiers = null;
  S.phase = 'groups';
  saveState();

  showPhase('groups');
  renderGroups();
  bindGroupsAdvance();
}

// ═════════════════════════════════════════════════════════════════════
//  GROUP ALGORITHM
// ═════════════════════════════════════════════════════════════════════

function buildGroups(teams) {
  const n = teams.length;
  let numGroups;
  if      (n <= 8)  numGroups = 2;
  else if (n <= 12) numGroups = 3;
  else              numGroups = 4;

  // Shuffle teams for random seeding
  const shuffled = [...teams].sort(() => Math.random() - 0.5);

  // Distribute into groups (snake seeding)
  const groups = Array.from({ length: numGroups }, () => []);
  shuffled.forEach((team, i) => {
    const row = Math.floor(i / numGroups);
    const col = row % 2 === 0 ? i % numGroups : (numGroups - 1 - (i % numGroups));
    groups[col].push(team);
  });
  return groups;
}

function buildGroupMatches(groups) {
  const matches = [];
  groups.forEach((group, gi) => {
    const label = 'ABCD'[gi];
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        matches.push({ home: group[a], away: group[b], homeScore: null, awayScore: null, group: label });
      }
    }
  });
  return matches;
}

// ═════════════════════════════════════════════════════════════════════
//  STANDINGS
// ═════════════════════════════════════════════════════════════════════

function computeStandings(groupName, groupTeams) {
  const teams = groupTeams.map(name => ({
    name, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0
  }));
  const byName = Object.fromEntries(teams.map(t => [t.name, t]));

  const matches = S.groupMatches.filter(m => m.group === groupName && m.homeScore !== null);
  matches.forEach(m => {
    const h = byName[m.home], a = byName[m.away];
    if (!h || !a) return;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    h.gd = h.gf - h.ga;
    a.gd = a.gf - a.ga;

    if (m.homeScore > m.awayScore) { h.pts += 3; h.w++; a.l++; }
    else if (m.homeScore < m.awayScore) { a.pts += 3; a.w++; h.l++; }
    else { h.pts += 1; h.d++; a.pts += 1; a.d++; }
  });

  teams.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd  !== a.gd)  return b.gd  - a.gd;
    if (b.gf  !== a.gf)  return b.gf  - a.gf;
    // head to head
    const hth = S.groupMatches.find(m => m.group === groupName && ((m.home === a.name && m.away === b.name) || (m.home === b.name && m.away === a.name)));
    if (hth && hth.homeScore !== null) {
      const aIsHome = hth.home === a.name;
      const aScore  = aIsHome ? hth.homeScore : hth.awayScore;
      const bScore  = aIsHome ? hth.awayScore : hth.homeScore;
      return bScore - aScore;
    }
    return 0;
  });

  return teams;
}

// How many teams advance per group
function advancesPerGroup() {
  const n = S.groups.length;
  if (n === 2) return 4; // 2 groups × 4 = 8
  if (n === 3) return 2; // top 2 + 2 best thirds = 8
  return 2;              // 4 groups × 2 = 8
}

// ═════════════════════════════════════════════════════════════════════
//  RENDER GROUPS
// ═════════════════════════════════════════════════════════════════════

function renderGroups() {
  document.getElementById('groups-title').textContent = S.name;
  const container = document.getElementById('groups-container');
  container.innerHTML = '';

  const adv = advancesPerGroup();

  S.groups.forEach((group, gi) => {
    const label = 'ABCD'[gi];
    const standings = computeStandings(label, group);
    const matches   = S.groupMatches.filter(m => m.group === label);

    const block = document.createElement('div');
    block.className = 'group-block';
    block.innerHTML = `
      <div class="group-header">GRUPO ${label}</div>
      <table class="standings-table">
        <thead>
          <tr>
            <th>#</th><th>Equipo</th>
            <th title="Partidos jugados">PJ</th>
            <th title="Ganados">G</th>
            <th title="Empates">E</th>
            <th title="Perdidos">P</th>
            <th title="Goles a favor">GF</th>
            <th title="Diferencia de goles">DG</th>
            <th title="Puntos">PTS</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map((t, i) => {
            const pj = t.w + t.d + t.l;
            const advances = i < adv;
            const dashedRow = i === adv - 1 ? 'border-bottom-dash' : '';
            return `
              <tr class="${advances ? 'advances' : ''} ${dashedRow}">
                <td class="rank">${i + 1}</td>
                <td>${esc(t.name)}</td>
                <td>${pj}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
                <td>${t.gf}</td><td>${t.gd >= 0 ? '+' + t.gd : t.gd}</td>
                <td class="pts">${t.pts}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div class="fixtures-section">
        <div class="fixtures-title">Partidos</div>
        ${matches.map((m, mi) => {
          const globalIdx = S.groupMatches.indexOf(m);
          if (m.homeScore !== null) {
            const hWin = m.homeScore > m.awayScore;
            const aWin = m.awayScore > m.homeScore;
            return `
              <div class="fixture-row" data-idx="${globalIdx}">
                <div class="fixture-team home ${hWin ? 'winner' : (aWin ? 'loser' : '')}">${esc(m.home)}</div>
                <div class="fixture-score">
                  <span class="score-display">${m.homeScore} – ${m.awayScore}</span>
                  <button class="btn-save-score" onclick="editGroupScore(${globalIdx})">✎</button>
                </div>
                <div class="fixture-team away ${aWin ? 'winner' : (hWin ? 'loser' : '')}">${esc(m.away)}</div>
              </div>`;
          } else {
            return `
              <div class="fixture-row" data-idx="${globalIdx}">
                <div class="fixture-team home">${esc(m.home)}</div>
                <div class="fixture-score">
                  <input class="score-input" type="number" min="0" max="99" id="hs-${globalIdx}" placeholder="0" />
                  <span class="score-sep">–</span>
                  <input class="score-input" type="number" min="0" max="99" id="as-${globalIdx}" placeholder="0" />
                  <button class="btn-save-score" onclick="saveGroupScore(${globalIdx})">OK</button>
                </div>
                <div class="fixture-team away">${esc(m.away)}</div>
              </div>`;
          }
        }).join('')}
      </div>
    `;
    container.appendChild(block);
  });

  updateAdvanceButton();
}

function saveGroupScore(idx) {
  const hs = parseInt(document.getElementById(`hs-${idx}`)?.value, 10);
  const as = parseInt(document.getElementById(`as-${idx}`)?.value, 10);
  if (isNaN(hs) || isNaN(as) || hs < 0 || as < 0) {
    alert('Ingresá marcadores válidos (números ≥ 0).'); return;
  }
  S.groupMatches[idx].homeScore = hs;
  S.groupMatches[idx].awayScore = as;
  saveState();
  renderGroups();
}

function editGroupScore(idx) {
  S.groupMatches[idx].homeScore = null;
  S.groupMatches[idx].awayScore = null;
  saveState();
  renderGroups();
}

function allGroupMatchesPlayed() {
  return S.groupMatches.every(m => m.homeScore !== null);
}

function updateAdvanceButton() {
  const btn = document.getElementById('btn-advance-groups');
  if (!btn) return;
  btn.disabled = !allGroupMatchesPlayed();
}

function bindGroupsAdvance() {
  const btn = document.getElementById('btn-advance-groups');
  if (!btn) return;
  btn.replaceWith(btn.cloneNode(true)); // remove old listeners
  const freshBtn = document.getElementById('btn-advance-groups');
  freshBtn.addEventListener('click', advanceToKnockout);
  updateAdvanceButton();
}

// ═════════════════════════════════════════════════════════════════════
//  QUALIFICATION — pick 8 from groups
// ═════════════════════════════════════════════════════════════════════

function pickQualifiers() {
  const numGroups = S.groups.length;
  const adv = advancesPerGroup();
  const groupStandings = S.groups.map((g, gi) => computeStandings('ABCD'[gi], g));

  if (numGroups === 2) {
    // Top 4 from each group
    return [
      groupStandings[0][0].name, groupStandings[0][1].name,
      groupStandings[0][2].name, groupStandings[0][3].name,
      groupStandings[1][0].name, groupStandings[1][1].name,
      groupStandings[1][2].name, groupStandings[1][3].name,
    ];
    // Seeds: 1A, 2A, 3A, 4A, 1B, 2B, 3B, 4B  → QF seeded separately
  }

  if (numGroups === 3) {
    // Top 2 from each group (6 teams) + 2 best 3rd-placed teams
    const top2 = groupStandings.flatMap(s => [s[0], s[1]]);
    const thirds = groupStandings.map(s => s[2]).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd  !== a.gd)  return b.gd  - a.gd;
      return b.gf - a.gf;
    });
    const best2thirds = thirds.slice(0, 2);
    // return in group order (A1, A2, B1, B2, C1, C2, bestThird1, bestThird2)
    return [...top2.map(t => t.name), ...best2thirds.map(t => t.name)];
  }

  // 4 groups → top 2 each = 8
  return groupStandings.flatMap(s => [s[0].name, s[1].name]);
}

// QF seeding for 4-group format: 1A vs 2D, 1B vs 2C, 1C vs 2B, 1D vs 2A
// For 2-group format: treat as 4 "virtual" seeds each side
function seedQF(qualifiers) {
  const numGroups = S.groups.length;

  if (numGroups === 4) {
    // qualifiers = [1A, 2A, 1B, 2B, 1C, 2C, 1D, 2D]
    const [A1, A2, B1, B2, C1, C2, D1, D2] = qualifiers;
    return [
      { home: A1, away: D2 },
      { home: B1, away: C2 },
      { home: C1, away: B2 },
      { home: D1, away: A2 },
    ];
  }

  if (numGroups === 3) {
    // qualifiers = [A1, A2, B1, B2, C1, C2, T1, T2] (T = best thirds)
    const [A1, A2, B1, B2, C1, C2, T1, T2] = qualifiers;
    return [
      { home: A1, away: T2 },
      { home: B1, away: C2 },
      { home: C1, away: B2 },
      { home: A2, away: T1 },
    ];
  }

  // 2 groups: [A1, A2, A3, A4, B1, B2, B3, B4]
  const [A1, A2, A3, A4, B1, B2, B3, B4] = qualifiers;
  return [
    { home: A1, away: B4 },
    { home: A2, away: B3 },
    { home: B1, away: A4 },
    { home: B2, away: A3 },
  ];
}

// ═════════════════════════════════════════════════════════════════════
//  ADVANCE TO KNOCKOUT
// ═════════════════════════════════════════════════════════════════════

function advanceToKnockout() {
  S.qualifiers = pickQualifiers();
  const qfSeeds = seedQF(S.qualifiers);

  S.bracket = {
    qf: qfSeeds.map(m => ({ ...m, homeScore: null, awayScore: null })),
    sf: [
      { home: null, away: null, homeScore: null, awayScore: null },
      { home: null, away: null, homeScore: null, awayScore: null },
    ],
    final: { home: null, away: null, homeScore: null, awayScore: null },
    third: { home: null, away: null, homeScore: null, awayScore: null },
  };
  S.phase = 'knockout';
  saveState();
  showPhase('knockout');
  renderKnockout();
  bindKnockoutAdvance();
}

// ═════════════════════════════════════════════════════════════════════
//  BRACKET RENDER
// ═════════════════════════════════════════════════════════════════════

function renderKnockout() {
  document.getElementById('knockout-title').textContent = S.name;
  renderRound('qf-matches',    S.bracket.qf,   'qf');
  renderRound('sf-matches',    S.bracket.sf,   'sf');
  renderFinalRound();
  updateKnockoutAdvanceButton();
}

function renderRound(containerId, matches, roundKey) {
  const el = document.getElementById(containerId);
  el.innerHTML = matches.map((m, i) => bracketMatchHTML(m, roundKey, i)).join('');
}

function renderFinalRound() {
  const el = document.getElementById('final-matches');
  el.innerHTML = `
    <div class="round-label" style="font-size:9px;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-top:0;padding-bottom:8px;">Gran Final</div>
    ${bracketMatchHTML(S.bracket.final, 'final', 0)}
    <div class="third-place-label">3er Puesto</div>
    ${bracketMatchHTML(S.bracket.third, 'third', 0)}
  `;
}

function bracketMatchHTML(m, round, idx) {
  const playable = m.home && m.away && m.homeScore === null;
  const done     = m.homeScore !== null;
  const hWin = done && m.homeScore > m.awayScore;
  const aWin = done && m.awayScore > m.homeScore;

  const homeClass = done ? (hWin ? 'winner' : 'loser') : (m.home ? '' : 'tbd');
  const awayClass = done ? (aWin ? 'winner' : 'loser') : (m.away ? '' : 'tbd');

  const homeLabel = m.home ? esc(m.home) : 'Por definir';
  const awayLabel = m.away ? esc(m.away) : 'Por definir';

  let scoreHTML = '';
  if (done) {
    scoreHTML = `
      <div class="bracket-form">
        <span style="font-size:11px;color:var(--muted);">Resultado guardado</span>
        <button class="btn-save-score" style="font-size:10px;" onclick="editBracketScore('${round}',${idx})">✎</button>
      </div>`;
  } else if (playable) {
    scoreHTML = `
      <div class="bracket-form">
        <input class="score-input" type="number" min="0" max="99" id="bhs-${round}-${idx}" placeholder="0" />
        <span class="score-sep">–</span>
        <input class="score-input" type="number" min="0" max="99" id="bas-${round}-${idx}" placeholder="0" />
        <button class="btn-save-score" onclick="saveBracketScore('${round}',${idx})">OK</button>
      </div>`;
  }

  return `
    <div class="bracket-match ${done ? 'done' : (playable ? 'playable' : '')}">
      <div class="bracket-slot ${homeClass}">
        <span class="slot-name">${homeLabel}</span>
        ${done ? `<span class="slot-score">${m.homeScore}</span>` : ''}
      </div>
      <div class="bracket-slot ${awayClass}">
        <span class="slot-name">${awayLabel}</span>
        ${done ? `<span class="slot-score">${m.awayScore}</span>` : ''}
      </div>
      ${scoreHTML}
    </div>`;
}

function saveBracketScore(round, idx) {
  const hs = parseInt(document.getElementById(`bhs-${round}-${idx}`)?.value, 10);
  const as = parseInt(document.getElementById(`bas-${round}-${idx}`)?.value, 10);
  if (isNaN(hs) || isNaN(as) || hs < 0 || as < 0) {
    alert('Ingresá marcadores válidos.'); return;
  }
  if (hs === as) {
    alert('En eliminatorias no puede haber empate. Ingresá un ganador.'); return;
  }

  const match = getBracketMatch(round, idx);
  match.homeScore = hs;
  match.awayScore = as;

  const winner = hs > as ? match.home : match.away;
  const loser  = hs > as ? match.away : match.home;

  // Propagate winner/loser to next round
  propagate(round, idx, winner, loser);
  saveState();
  renderKnockout();
}

function editBracketScore(round, idx) {
  const match = getBracketMatch(round, idx);
  // Clear the propagated results downstream
  clearDownstream(round, idx);
  match.homeScore = null;
  match.awayScore = null;
  saveState();
  renderKnockout();
}

function getBracketMatch(round, idx) {
  if (round === 'qf')    return S.bracket.qf[idx];
  if (round === 'sf')    return S.bracket.sf[idx];
  if (round === 'final') return S.bracket.final;
  if (round === 'third') return S.bracket.third;
}

function propagate(round, idx, winner, loser) {
  if (round === 'qf') {
    // QF 0,1 → SF[0].home, SF[0].away
    // QF 2,3 → SF[1].home, SF[1].away
    const sfIdx   = idx < 2 ? 0 : 1;
    const isHome  = idx % 2 === 0;
    const sf      = S.bracket.sf[sfIdx];
    if (isHome) sf.home = winner; else sf.away = winner;
    // Losers go to 3rd place
    // We track them separately; the third match is filled after SF
  }
  if (round === 'sf') {
    // Winners → final; losers → 3rd
    const f = S.bracket.final;
    const t = S.bracket.third;
    if (idx === 0) { f.home = winner; t.home = loser; }
    else           { f.away = winner; t.away = loser; }
  }
  // 'final' and 'third' don't propagate further
}

function clearDownstream(round, idx) {
  if (round === 'qf') {
    const sfIdx  = idx < 2 ? 0 : 1;
    const isHome = idx % 2 === 0;
    const sf = S.bracket.sf[sfIdx];
    if (isHome) sf.home = null; else sf.away = null;
    sf.homeScore = null; sf.awayScore = null;
    clearDownstream('sf', sfIdx);
  }
  if (round === 'sf') {
    const f = S.bracket.final;
    const t = S.bracket.third;
    if (idx === 0) { f.home = null; t.home = null; }
    else           { f.away = null; t.away = null; }
    f.homeScore = null; f.awayScore = null;
    t.homeScore = null; t.awayScore = null;
  }
}

function allBracketDone() {
  const { qf, sf, final, third } = S.bracket;
  return (
    qf.every(m => m.homeScore !== null) &&
    sf.every(m => m.homeScore !== null) &&
    final.homeScore !== null &&
    third.homeScore !== null
  );
}

function updateKnockoutAdvanceButton() {
  const btn = document.getElementById('btn-advance-knockout');
  if (!btn) return;
  btn.disabled = !allBracketDone();
}

function bindKnockoutAdvance() {
  const btn = document.getElementById('btn-advance-knockout');
  if (!btn) return;
  btn.replaceWith(btn.cloneNode(true));
  const freshBtn = document.getElementById('btn-advance-knockout');
  freshBtn.addEventListener('click', advanceToPodium);
  updateKnockoutAdvanceButton();
}

// ═════════════════════════════════════════════════════════════════════
//  PODIUM
// ═════════════════════════════════════════════════════════════════════

function advanceToPodium() {
  S.phase = 'done';
  saveState();
  showPhase('done');
  renderPodium();
}

function renderPodium() {
  const f = S.bracket.final;
  const t = S.bracket.third;

  const champion = f.homeScore > f.awayScore ? f.home : f.away;
  const runnerUp  = f.homeScore > f.awayScore ? f.away : f.home;
  const third     = t.homeScore > t.awayScore ? t.home : t.away;

  document.getElementById('podium-1st').textContent = champion;
  document.getElementById('podium-2nd').textContent = runnerUp;
  document.getElementById('podium-3rd').textContent = third;

  document.getElementById('btn-reset').addEventListener('click', resetTournament);
}

function resetTournament() {
  if (!confirm('¿Seguro que querés iniciar un nuevo torneo? Se borrará todo el progreso.')) return;
  clearState();
  S = null;
  showPhase('setup');
  document.getElementById('tournament-name').value = '';
  // Re-init state
  S = { name: '', teams: [], phase: 'setup' };
  bindSetup();
  renderTeamsList();
}

// ─── UTILITY ─────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Expose functions called from inline HTML onclick handlers
window.removeTeam       = removeTeam;
window.saveGroupScore   = saveGroupScore;
window.editGroupScore   = editGroupScore;
window.saveBracketScore = saveBracketScore;
window.editBracketScore = editBracketScore;
