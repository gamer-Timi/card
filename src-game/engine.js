(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GameEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CATEGORIES = [
    { key: 'n1', label: '1', name: '数字 1', kind: 'number', face: 1 },
    { key: 'n2', label: '2', name: '数字 2', kind: 'number', face: 2 },
    { key: 'n3', label: '3', name: '数字 3', kind: 'number', face: 3 },
    { key: 'n4', label: '4', name: '数字 4', kind: 'number', face: 4 },
    { key: 'n5', label: '5', name: '数字 5', kind: 'number', face: 5 },
    { key: 'n6', label: '6', name: '数字 6', kind: 'number', face: 6 },
    { key: 'fullHouse', label: '葫芦', name: '葫芦', kind: 'fixed', value: 20 },
    { key: 'smallStraight', label: '小顺子', name: '小顺子', kind: 'fixed', value: 20 },
    { key: 'largeStraight', label: '大顺子', name: '大顺子', kind: 'fixed', value: 30 },
    { key: 'four', label: '4条', name: '4条', kind: 'fixed', value: 20 },
    { key: 'five', label: '5条', name: '5条', kind: 'fixed', value: 30 }
  ];

  const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

  const RULES = {
    n1: '选择数字栏 1：得分为最终五颗骰子中所有 1 的点数总和。',
    n2: '选择数字栏 2：得分为最终五颗骰子中所有 2 的点数总和。',
    n3: '选择数字栏 3：得分为最终五颗骰子中所有 3 的点数总和。',
    n4: '选择数字栏 4：得分为最终五颗骰子中所有 4 的点数总和。',
    n5: '选择数字栏 5：得分为最终五颗骰子中所有 5 的点数总和。',
    n6: '选择数字栏 6：得分为最终五颗骰子中所有 6 的点数总和。',
    fullHouse: '葫芦栏：最终骰面为「三颗同点 + 两颗同点」时，得 20 分。',
    smallStraight: '小顺子栏：最终骰面中能找出四颗连续点数时，得 20 分；6 与 1 视为连续。',
    largeStraight: '大顺子栏：最终骰面为五颗连续点数时，得 30 分；6 与 1 视为连续。',
    four: '4条栏：最终骰面中至少有四颗相同点数时，得 20 分。',
    five: '5条栏：最终骰面五颗点数全部相同时，得 30 分。'
  };

  function emptyCard() {
    const card = {};
    for (const c of CATEGORIES) card[c.key] = null;
    return card;
  }

  function cloneCard(card) { return { ...card }; }

  function countsOf(dice) {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const d of dice) counts[d]++;
    return counts;
  }

  function hasSmallStraight(dice) {
    const set = new Set(dice);
    for (let start = 1; start <= 6; start++) {
      let ok = true;
      for (let k = 0; k < 4; k++) {
        const v = ((start - 1 + k) % 6) + 1;
        if (!set.has(v)) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  function hasLargeStraight(dice) {
    const set = new Set(dice);
    if (set.size < 5) return false;
    for (let start = 1; start <= 6; start++) {
      let ok = true;
      for (let k = 0; k < 5; k++) {
        const v = ((start - 1 + k) % 6) + 1;
        if (!set.has(v)) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  function hasFullHouse(dice) {
    const counts = countsOf(dice);
    const groups = [1, 2, 3, 4, 5, 6].map(v => counts[v]).filter(Boolean).sort();
    return groups.length === 2 && groups[0] === 2 && groups[1] === 3;
  }

  function scoreHand(dice, key) {
    if (!dice || dice.length !== 5) return 0;
    const cat = CATEGORY_BY_KEY[key];
    if (!cat) return 0;
    if (cat.kind === 'number') return dice.filter(d => d === cat.face).length * cat.face;
    const counts = countsOf(dice);
    const max = Math.max(...Object.values(counts));
    if (key === 'fullHouse') return hasFullHouse(dice) ? 20 : 0;
    if (key === 'smallStraight') return hasSmallStraight(dice) ? 20 : 0;
    if (key === 'largeStraight') return hasLargeStraight(dice) ? 30 : 0;
    if (key === 'four') return max >= 4 ? 20 : 0;
    if (key === 'five') return max === 5 ? 30 : 0;
    return 0;
  }

  function potentialScores(dice, card) {
    const out = {};
    for (const c of CATEGORIES) {
      if (card[c.key] == null) out[c.key] = scoreHand(dice, c.key);
    }
    return out;
  }

  function cardTotal(card) {
    return CATEGORIES.reduce((sum, c) => sum + (card[c.key] == null ? 0 : card[c.key]), 0);
  }

  function filledCount(card) {
    return CATEGORIES.reduce((n, c) => n + (card[c.key] == null ? 0 : 1), 0);
  }

  function isCardFull(card) { return filledCount(card) === CATEGORIES.length; }

  function firstUnused(card) {
    for (const c of CATEGORIES) if (card[c.key] == null) return c.key;
    return null;
  }

  function bestCategory(dice, card) {
    let bestKey = null, bestScore = -1;
    for (const c of CATEGORIES) {
      if (card[c.key] != null) continue;
      const s = scoreHand(dice, c.key);
      if (s > bestScore) { bestScore = s; bestKey = c.key; }
    }
    return { key: bestKey || firstUnused(card), score: Math.max(0, bestScore) };
  }

  const VALUES = [1, 2, 3, 4, 5, 6];

  function valueCombos(n) {
    const out = [];
    const rec = (start, arr) => {
      if (arr.length === n) { out.push(arr.slice()); return; }
      for (let i = start; i < VALUES.length; i++) {
        arr.push(VALUES[i]);
        rec(i, arr);
        arr.pop();
      }
    };
    rec(0, []);
    return out;
  }

  const COMBOS_1 = valueCombos(1);
  const COMBOS_2 = valueCombos(2);
  const COMBOS_BY_COUNT = { 0: [[]], 1: COMBOS_1, 2: COMBOS_2 };

  function maxPotential(dice, card) {
    let best = 0;
    for (const c of CATEGORIES) {
      if (card[c.key] != null) continue;
      best = Math.max(best, scoreHand(dice, c.key));
    }
    return best;
  }

  function subsetsOfSize(n, maxSize) {
    const out = [];
    const rec = (start, arr) => {
      if (arr.length >= 1 && arr.length <= maxSize) out.push(arr.slice());
      if (arr.length === maxSize) return;
      for (let i = start; i < n; i++) {
        arr.push(i);
        rec(i + 1, arr);
        arr.pop();
      }
    };
    rec(0, []);
    return out;
  }

  function chooseAIFix(dice, threeAvailable, card) {
    const maxFix = threeAvailable ? 3 : 2;
    const subsets = subsetsOfSize(dice.length, maxFix);
    let best = null;

    for (const subset of subsets) {
      const n = subset.length;
      const activeShare = n === 1 ? 2 : n === 2 ? 1 : 0;
      const fixed = subset.map(i => dice[i]);
      const rest = dice.filter((_, i) => !subset.includes(i));
      const humanCount = 2;
      let worst = Infinity;

      // Opponent can choose any two remaining values; evaluate AI's best
      // response against each hostile pair, then keep the worst case.
      for (const human of COMBOS_BY_COUNT[humanCount]) {
        let bestAgainst = 0;
        for (const own of COMBOS_BY_COUNT[activeShare]) {
          const hand = fixed.concat(own, human);
          bestAgainst = Math.max(bestAgainst, maxPotential(hand, card));
        }
        worst = Math.min(worst, bestAgainst);
        if (worst <= (best ? best.worst : -1)) break;
      }

      // Prefer not to spend the once-per-game three-die fix for no gain.
      const score = worst - (n === 3 ? 1.2 : 0);
      if (!best || score > best.score || (score === best.score && n < best.subset.length)) {
        best = { subset, score, worst, activeShare };
      }
    }

    return {
      indices: best ? best.subset.slice().sort((a, b) => a - b) : [0],
      activeShare: best ? best.activeShare : 2
    };
  }

  function chooseActiveAdjustment(fixedDice, count, card, opponentValues) {
    let best = null;
    for (const own of COMBOS_BY_COUNT[count]) {
      const hand = fixedDice.concat(own, opponentValues);
      const score = maxPotential(hand, card);
      if (!best || score > best.score) best = { values: own.slice(), score };
    }
    return best ? best.values : [];
  }

  function chooseSabotage(fixedDice, count, card, opponentValues) {
    let best = null;
    for (const own of COMBOS_BY_COUNT[count]) {
      const hand = fixedDice.concat(opponentValues, own);
      const score = maxPotential(hand, card);
      if (!best || score < best.score) best = { values: own.slice(), score };
    }
    return best ? best.values : [];
  }

  function shuffleDice(dice, rng = Math.random) {
    const a = dice.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function rollFive(rng = Math.random) {
    return Array.from({ length: 5 }, () => 1 + Math.floor(rng() * 6));
  }

  /* ----------------------------- strong AI -------------------------------- */
  const AI_LEVELS = ['gua', 'hang', 'ren', 'bot', 'trash'];
  const DEFAULT_AI_LEVEL = 'hang';

  const AI_LEVEL_ALIASES = {
    gua: 'gua', '挂': 'gua',
    hang: 'hang', '夯': 'hang',
    ren: 'ren', '人上人': 'ren',
    bot: 'bot', '人机': 'bot',
    trash: 'trash', '拉完了': 'trash'
  };

  function normalizeAILevel(level) {
    const key = String(level || '').trim();
    return AI_LEVEL_ALIASES[key] || DEFAULT_AI_LEVEL;
  }

  function adjustedOptions(values) {
    let out = [[]];
    for (const v of values) {
      const a = v === 1 ? 6 : v - 1;
      const b = v === 6 ? 1 : v + 1;
      const options = a === b ? [a] : [a, b];
      const next = [];
      for (const prefix of out) for (const x of options) next.push(prefix.concat(x));
      out = next;
    }
    return out;
  }

  function indexCombos(n, k) {
    if (k <= 0) return [[]];
    const out = [];
    const rec = (start, arr) => {
      if (arr.length === k) { out.push(arr.slice()); return; }
      for (let i = start; i < n; i++) {
        arr.push(i);
        rec(i + 1, arr);
        arr.pop();
      }
    };
    rec(0, []);
    return out;
  }

  function maxUnusedScore(hand, card) {
    let best = 0;
    for (const c of CATEGORIES) {
      if (card[c.key] != null) continue;
      best = Math.max(best, scoreHand(hand, c.key));
    }
    return best;
  }

  const ALL_FIVE = (() => {
    const out = [];
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++)
      for (let d = 1; d <= 6; d++) for (let e = 1; e <= 6; e++) out.push([a, b, c, d, e]);
    return out;
  })();

  const CATEGORY_EV = (() => {
    const ev = {};
    for (const c of CATEGORIES) {
      let sum = 0;
      for (const hand of ALL_FIVE) sum += scoreHand(hand, c.key);
      ev[c.key] = sum / ALL_FIVE.length;
    }
    return ev;
  })();

  function chooseScoreShadow(dice, card) {
    let bestKey = null;
    let bestValue = -Infinity;
    let bestScore = -1;
    let maxCurrent = 0;
    for (const c of CATEGORIES) if (card[c.key] == null) maxCurrent = Math.max(maxCurrent, scoreHand(dice, c.key));
    for (const c of CATEGORIES) {
      if (card[c.key] != null) continue;
      const s = scoreHand(dice, c.key);
      if (maxCurrent > 0 && s === 0) continue;
      const value = s - CATEGORY_EV[c.key];
      if (value > bestValue || (value === bestValue && s > bestScore)) {
        bestValue = value;
        bestScore = s;
        bestKey = c.key;
      }
    }
    if (!bestKey) bestKey = firstUnused(card);
    return { key: bestKey, score: bestKey ? scoreHand(dice, bestKey) : 0 };
  }

  function chooseScoreLookahead(dice, card, samples = 14) {
    const unused = CATEGORIES.filter(c => card[c.key] == null);
    if (unused.length <= 2) {
      let best = null;
      for (const c of unused) {
        const s = scoreHand(dice, c.key);
        if (!best || s > best.score) best = { key: c.key, score: s };
      }
      return best || { key: firstUnused(card), score: 0 };
    }
    const scores = new Map(unused.map(c => [c.key, scoreHand(dice, c.key)]));
    const maxCurrent = Math.max(0, ...scores.values());
    const candidates = maxCurrent > 0 ? unused.filter(c => scores.get(c.key) > 0) : unused;
    let best = null;
    for (const c of candidates) {
      const current = scores.get(c.key);
      let total = current * samples;
      for (let n = 0; n < samples; n++) {
        const futureCard = { ...card };
        futureCard[c.key] = current;
        let future = 0;
        for (let t = 0; t < unused.length - 1; t++) {
          const hand = rollFive();
          const pick = chooseScoreShadow(hand, futureCard);
          future += pick.score;
          futureCard[pick.key] = pick.score;
        }
        total += future;
      }
      if (!best || total > best.total || (total === best.total && current > best.score)) {
        best = { key: c.key, score: current, total };
      }
    }
    return best || chooseScoreShadow(dice, card);
  }

  function aiStrategy(level, kind) {
    const lv = normalizeAILevel(level);
    if (lv === 'gua') return kind === 'adjust' ? 'cheat' : 'optimal';
    if (lv === 'trash') return 'random';
    if (lv === 'hang') return 'optimal';
    const r = Math.random();
    if (lv === 'ren') return r < 0.5 ? 'optimal' : 'random';
    if (lv === 'bot') {
      if (r < 0.10) return 'strong';
      if (r < 0.15) return 'optimal';
      return 'greedy';
    }
    return 'greedy';
  }

  function randomFix(dice, threeAvailable) {
    const maxFix = threeAvailable ? 3 : 2;
    const count = 1 + Math.floor(Math.random() * maxFix);
    const idx = dice.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return { indices: idx.slice(0, count).sort((a, b) => a - b), activeShare: count === 1 ? 2 : 1 };
  }

  function evaluateFix(dice, subset, card, mode) {
    const fixed = subset.map(i => dice[i]);
    const remaining = dice.filter((_, i) => !subset.includes(i));
    const n = subset.length;
    const ownCount = n === 1 ? 2 : 1;
    const splits = indexCombos(remaining.length, ownCount);
    let total = 0;
    for (const ownIdx of splits) {
      const ownVals = ownIdx.map(i => remaining[i]);
      const humanVals = remaining.filter((_, i) => !ownIdx.includes(i));
      const ownOpts = adjustedOptions(ownVals);
      const humanOpts = mode === 'greedy' ? [humanVals] : adjustedOptions(humanVals);
      let bestOwn = -Infinity;
      for (const own of ownOpts) {
        let worst = Infinity;
        let sum = 0;
        for (const human of humanOpts) {
          const hand = fixed.concat(own, human);
          const value = maxUnusedScore(hand, card);
          worst = Math.min(worst, value);
          sum += value;
        }
        const value = mode === 'expected' ? sum / humanOpts.length : worst;
        bestOwn = Math.max(bestOwn, value);
      }
      total += bestOwn;
    }
    let value = splits.length ? total / splits.length : 0;
    if (n === 3) value -= 1.0;
    return value;
  }

  function chooseFixStrong(dice, threeAvailable, card, mode) {
    const maxFix = threeAvailable ? 3 : 2;
    const subsets = subsetsOfSize(dice.length, maxFix);
    let best = null;
    for (const subset of subsets) {
      const value = evaluateFix(dice, subset, card, mode);
      if (!best || value > best.value || (value === best.value && subset.length < best.indices.length)) {
        best = { indices: subset.slice().sort((a, b) => a - b), value };
      }
    }
    return { indices: best ? best.indices : [0], activeShare: best && best.indices.length === 1 ? 2 : 1 };
  }

  function aiChooseFix(dice, threeAvailable, card, level) {
    const strategy = aiStrategy(level, 'fix');
    if (strategy === 'random') return randomFix(dice, threeAvailable);
    if (strategy === 'greedy') return chooseFixStrong(dice, threeAvailable, card, 'greedy');
    if (strategy === 'strong') return chooseFixStrong(dice, threeAvailable, card, 'expected');
    return chooseFixStrong(dice, threeAvailable, card, 'maximin');
  }

  function aiChooseAdjust(fixedDice, ownValues, opponentValues, aiActive, aiCard, humanCard, level, options = {}) {
    const strategy = aiStrategy(level, 'adjust');
    const ownOpts = adjustedOptions(ownValues);
    if (strategy === 'random') return ownOpts[Math.floor(Math.random() * ownOpts.length)].slice();
    const cheatFinal = options.cheat && Array.isArray(options.humanFinal) ? options.humanFinal.slice() : null;
    const card = aiActive ? aiCard : humanCard;
    let best = null;
    for (const own of ownOpts) {
      let score;
      if (cheatFinal) {
        const hand = fixedDice.concat(own, cheatFinal);
        score = maxUnusedScore(hand, card);
      } else if (strategy === 'greedy') {
        const hand = fixedDice.concat(own, opponentValues);
        score = maxUnusedScore(hand, card);
      } else {
        const humanOpts = adjustedOptions(opponentValues);
        let worst = aiActive ? Infinity : -Infinity;
        let sum = 0;
        for (const human of humanOpts) {
          const hand = fixedDice.concat(own, human);
          const value = maxUnusedScore(hand, card);
          worst = aiActive ? Math.min(worst, value) : Math.max(worst, value);
          sum += value;
        }
        score = strategy === 'strong' ? sum / humanOpts.length : worst;
      }
      if (!best || (aiActive ? score > best.score : score < best.score)) {
        best = { values: own.slice(), score };
      }
    }
    return best ? best.values : ownOpts[0].slice();
  }

  function randomScore(dice, card) {
    const unused = CATEGORIES.filter(c => card[c.key] == null);
    if (!unused.length) return { key: firstUnused(card), score: 0 };
    const c = unused[Math.floor(Math.random() * unused.length)];
    return { key: c.key, score: scoreHand(dice, c.key) };
  }

  function aiChooseScore(dice, card, level) {
    const strategy = aiStrategy(level, 'score');
    if (strategy === 'random') return randomScore(dice, card);
    if (strategy === 'greedy') return bestCategory(dice, card);
    if (strategy === 'strong') return chooseScoreShadow(dice, card);
    return chooseScoreLookahead(dice, card);
  }

  /* --------------------------- tutorial data ---------------------------- */
  // The opening hand is deliberately "scattered": it contains no combination
  // category. Whatever pair the player fixes, the AI can answer with the pair
  // in this table and keep the final hand at 2-3 ones with no combination.
  const TUTORIAL_OPENING = [1, 1, 1, 3, 5];
  const TUTORIAL_AI_FIRST = [2, 3, 4, 5, 6];
  const TUTORIAL_RESPONSE = {
    '1,1': { 1: [2, 3], 2: [1, 3], 3: [1, 2], 4: [1, 2], 5: [1, 2], 6: [1, 2] },
    '1,3': { 1: [1, 2], 2: [1, 1], 3: [1, 2], 4: [1, 1], 5: [1, 1], 6: [1, 1] },
    '1,5': { 1: [1, 2], 2: [1, 1], 3: [1, 1], 4: [1, 1], 5: [1, 2], 6: [1, 1] },
    '3,5': { 1: [1, 1], 2: [1, 1], 3: [1, 1], 4: [1, 1], 5: [1, 1], 6: [1, 1] }
  };

  const TUTORIAL_AI_CARD = {
    n1: 4, n2: 8, n3: 12, n4: 12, n5: 15, n6: 18,
    fullHouse: 20, smallStraight: 20, largeStraight: 0,
    four: 20, five: 30
  };

  function tutorialPlayerCard(onesValue) {
    return {
      n1: onesValue, n2: 6, n3: 9, n4: 8, n5: 10, n6: 12,
      fullHouse: 20, smallStraight: 20, largeStraight: 30,
      four: null, five: 30
    };
  }

  function tutorialAiResponse(fixedValues, playerValue) {
    const pair = fixedValues.slice().sort((a, b) => a - b).join(',');
    const row = TUTORIAL_RESPONSE[pair] || TUTORIAL_RESPONSE['3,5'];
    return (row[playerValue] || [1, 1]).slice();
  }

  return {
    CATEGORIES,
    CATEGORY_BY_KEY,
    RULES,
    emptyCard,
    cloneCard,
    countsOf,
    hasSmallStraight,
    hasLargeStraight,
    hasFullHouse,
    scoreHand,
    potentialScores,
    cardTotal,
    filledCount,
    isCardFull,
    firstUnused,
    bestCategory,
    AI_LEVELS,
    DEFAULT_AI_LEVEL,
    normalizeAILevel,
    aiChooseFix,
    aiChooseAdjust,
    aiChooseScore,
    chooseAIFix,
    chooseActiveAdjustment,
    chooseSabotage,
    shuffleDice,
    rollFive,
    valueCombos,
    maxPotential,
    TUTORIAL_OPENING,
    TUTORIAL_AI_FIRST,
    TUTORIAL_RESPONSE,
    TUTORIAL_AI_CARD,
    tutorialPlayerCard,
    tutorialAiResponse
  };
});
