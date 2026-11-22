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
