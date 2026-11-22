(function () {
  'use strict';

  const E = window.GameEngine;
  const $ = id => document.getElementById(id);
  const $$ = sel => Array.prototype.slice.call(document.querySelectorAll(sel));
  const TEST_MODE = new URLSearchParams(location.search).get('test') === '1';
  const PREVIEW = new URLSearchParams(location.search).get('preview') ||
    (location.hash.startsWith('#preview=') ? location.hash.slice(9) : null);
  const CLIENT_ID = (() => {
    try {
      let id = localStorage.getItem('timicard_client_id');
      if (!id) {
        id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        localStorage.setItem('timicard_client_id', id);
      }
      return id;
    } catch (err) {
      return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
  })();
  const CATS = E.CATEGORIES;
  const CAT_BY_KEY = E.CATEGORY_BY_KEY;

  const PIP_POSITIONS = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  const PHASE_LABEL = {
    idle: '等待开局',
    intro: '准备回合',
    rolling: '投骰中',
    rolled: '等待固定',
    fix: '固定骰子',
    fixed: '已固定',
    adjust: '暗调中',
    adjustWait: '等待对方',
    reveal: '揭晓',
    score: '计分中',
    scoreDone: '等待下一回合',
    over: '对局结束'
  };

  const S = {
    screen: 'menu',
    mode: 'ai',
    phase: 'idle',
    players: [],
    active: 0,
    turnNo: 0,
    dice: [],
    fixed: [],
    adjust: null,
    finalDice: [],
    scoreMode: false,
    scorePlayer: 0,
    scoreKey: null,
    scoreAllowed: null,
    tutorialStage: 'off',
    tutorialOnes: 0,
    gameToken: 0,
    turnToken: 0,
    timeouts: [],
    rollInterval: null,
    toastId: 0,
    bannerId: 0,
    timer: {
      active: false,
      end: 0,
      duration: 0,
      onTimeout: null,
      fired: false,
      token: 0
    },
    matchToken: 0,
    roomId: null,
    roomHost: false,
    roomPoll: null,
    matchBusy: false,
    coinToken: 0,
    coinTimer: null,
    coinAnim: null,
    diceAnim: null,
    coinRaf: 0,
    diceRaf: 0,
    viewPaperPlayer: null
  };

  /* ------------------------------- dom refs ------------------------------- */
  const dom = {
    menu: $('menuScreen'),
    rules: $('rulesScreen'),
    game: $('gameScreen'),
    hudOppName: $('hudOppName'),
    hudPlayerName: $('hudPlayerName'),
    hudOppScore: $('hudOppScore'),
    hudPlayerScore: $('hudPlayerScore'),
    hudRound: $('hudRound'),
    hudPhase: $('hudPhase'),
    footerTurn: $('footerTurn'),
    footerHint: $('footerHint'),
    tableDice: $('tableDice'),
    tableStatus: $('tableStatus'),
    turnBanner: $('turnBanner'),
    toast: $('toast'),
    tutorialCard: $('tutorialCard'),
    tutorialText: $('tutorialText'),
    particles: $('particles'),
    clockArc: $('clockArc'),
    clockHand: $('clockHand'),
    clockText: $('clockText'),
    miniPapers: [$('miniPaper0'), $('miniPaper1')],
    miniPlayerTitle: $('miniPlayerTitle'),
    miniOppTitle: $('miniOppTitle'),
    miniPlayerList: $('miniPlayerList'),
    miniOppList: $('miniOppList'),
    miniPlayerTotal: $('miniPlayerTotal'),
    miniOppTotal: $('miniOppTotal'),
    matchOverlay: $('matchOverlay'),
    matchTitle: $('matchTitle'),
    matchSub: $('matchSub'),
    matchSteps: $$('.match-steps span'),
    btnMatchCancel: $('btnMatchCancel'),
    coinCanvas: $('coinCanvas'),
    diceCanvas: $('diceCanvas'),
    tableStage: $('tableStage'),
    tableOuter: $('tableOuter'),
    diceOverlay: $('diceOverlay'),
    diceEyebrow: $('diceEyebrow'),
    diceTitle: $('diceTitle'),
    diceHint: $('diceHint'),
    diceRow: $('diceRow'),
    diceMeta: $('diceMeta'),
    diceNote: $('diceNote'),
    diceConfirm: $('diceConfirm'),
    diceTimer: $('diceTimer'),
    paperOverlay: $('paperOverlay'),
    paperKicker: $('paperKicker'),
    paperTitle: $('paperTitle'),
    paperTotal: $('paperTotal'),
    paperPreview: $('paperPreview'),
    paperBody: $('paperBody'),
    paperHint: $('paperHint'),
    paperConfirm: $('paperConfirm'),
    paperClose: $('paperClose'),
    btnViewTable: $('btnViewTable'),
    peekBar: $('peekBar'),
    btnBackScore: $('btnBackScore'),
    paperTimer: $('paperTimer'),
    rulePop: $('rulePop'),
    ruleTitle: $('ruleTitle'),
    ruleText: $('ruleText'),
    jumpOverlay: $('jumpOverlay'),
    jumpTitle: $('jumpTitle'),
    jumpText: $('jumpText'),
    resultOverlay: $('resultOverlay'),
    resultKicker: $('resultKicker'),
    resultTitle: $('resultTitle'),
    resultScore: $('resultScore'),
    resultCards: $('resultCards'),
    btnAgain: $('btnAgain'),
    btnResultMenu: $('btnResultMenu')
  };

  /* ------------------------------- utilities ------------------------------ */
  function cryptoRandom() {
    if (window.crypto && crypto.getRandomValues) {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] / 4294967296;
    }
    return Math.random();
  }

  async function tdb(action, params = {}) {
    const body = new URLSearchParams({
      user: 'computor',
      secret: '58787c39',
      action,
      ...params
    });
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 5500) : null;
    try {
      const res = await fetch('https://tinywebdb.appinventor.space/api', {
        method: 'POST',
        body,
        signal: controller ? controller.signal : undefined
      });
      const text = await res.text();
      return text ? JSON.parse(text) : {};
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function tagValue(response, tag) {
    if (response == null) return null;
    if (typeof response === 'string') return response;
    if (response[tag] !== undefined) return response[tag];
    if (response.value !== undefined) return response.value;
    return null;
  }

  async function getRoom(tag) {
    try {
      const res = await tdb('get', { tag });
      const raw = tagValue(res, tag);
      return raw == null ? null : roomPayload(raw);
    } catch (err) {
      return null;
    }
  }

  async function listRoomTags() {
    try {
      const page = await tdb('search', { no: '1', count: '100', tag: 'timicard_room_', type: 'tag' });
      if (page && Array.isArray(page.tag)) return page.tag;
      if (page && page.data && Array.isArray(page.data.tag)) return page.data.tag;
      return [];
    } catch (err) {
      return [];
    }
  }

  // Housekeeping for the room namespace described in 规则.txt. It only
  // removes rooms that have been untouched for a long time; active rooms and
  // rooms just created by another player are left alone.
  async function cleanupStaleRooms() {
    try {
      const last = Number(localStorage.getItem('timicard_cleanup_at') || 0);
      if (Date.now() - last < 5 * 60 * 1000) return 0;
      localStorage.setItem('timicard_cleanup_at', String(Date.now()));
    } catch (err) { /* storage can be disabled */ }

    let removed = 0;
    try {
      const tags = await listRoomTags();
      const now = Date.now();
      for (const tag of tags) {
        const room = await getRoom(tag);
        const updated = room && Number(room.updatedAt);
        if (!updated) continue;
        if (now - updated > 10 * 60 * 1000) {
          try { await tdb('delete', { tag }); removed++; } catch (err) { /* ignore one bad room */ }
        }
      }
    } catch (err) { /* network is optional */ }
    return removed;
  }

  function randomDie() { return 1 + Math.floor(cryptoRandom() * 6); }

  function later(ms, fn) {
    const token = S.gameToken;
    const id = setTimeout(() => {
      if (token === S.gameToken) fn();
    }, ms);
    S.timeouts.push(id);
    return id;
  }

  function clearLater() {
    S.timeouts.forEach(id => clearTimeout(id));
    S.timeouts = [];
    if (S.rollInterval) { clearInterval(S.rollInterval); S.rollInterval = null; }
  }

  function showScreen(name) {
    S.screen = name;
    dom.menu.classList.toggle('is-active', name === 'menu');
    dom.rules.classList.toggle('is-active', name === 'rules');
    dom.game.classList.toggle('is-active', name === 'game');
    if (name !== 'game') closeAllOverlays();
  }

  function openOverlay(el) {
    if (!el) return;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
  }

  function closeOverlay(el) {
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
  }

  function closeAllOverlays() {
    [dom.matchOverlay, dom.diceOverlay, dom.paperOverlay, dom.rulePop, dom.jumpOverlay, dom.resultOverlay]
      .forEach(closeOverlay);
  }

  function showToast(text, ms = 1500) {
    dom.toast.textContent = text;
    dom.toast.classList.add('is-visible');
    const id = ++S.toastId;
    setTimeout(() => {
      if (id === S.toastId) dom.toast.classList.remove('is-visible');
    }, ms);
  }

  function showBanner(text, ms = 1300) {
    dom.turnBanner.textContent = text;
    dom.turnBanner.classList.add('is-visible');
    const id = ++S.bannerId;
    setTimeout(() => {
      if (id === S.bannerId) dom.turnBanner.classList.remove('is-visible');
    }, ms);
  }

  function playerName(i) { return i === 0 ? '你' : '对手'; }

  function initPlayers() {
    S.players = [
      { id: 'you', name: '你', isHuman: true, card: E.emptyCard(), total: 0, threeFixUsed: false },
      { id: 'ai', name: '练习对手', isHuman: false, card: E.emptyCard(), total: 0, threeFixUsed: false }
    ];
  }

  function refreshPlayerTotal(i) {
    S.players[i].total = E.cardTotal(S.players[i].card);
  }

  function setTutorial(text) {
    dom.tutorialText.textContent = text || '';
    dom.tutorialCard.classList.toggle('is-visible', !!text);
  }

  function roundNumber() {
    return Math.min(11, Math.max(1, Math.floor(S.turnNo / 2) + 1));
  }

  function updateHUD() {
    const you = S.players[0], opp = S.players[1];
    if (!you || !opp) return;
    dom.hudOppScore.textContent = opp.total;
    dom.hudPlayerScore.textContent = you.total;
    dom.hudOppName.textContent = S.mode === 'tutorial' ? '教学对手' : '练习对手';
    dom.hudPlayerName.textContent = '你';
    dom.hudRound.textContent = '第 ' + roundNumber() + ' / 11 回合';
    dom.footerTurn.textContent = '第 ' + roundNumber() + ' / 11 回合';
    let phaseText = PHASE_LABEL[S.phase] || '等待开局';
    if (S.phase === 'intro') phaseText = S.active === 0 ? '你的回合' : '对方回合';
    if (S.phase === 'coin') phaseText = '投币中';
    if (S.phase === 'fix') phaseText = S.active === 0 ? '你正在固定骰子' : '对方正在固定骰子';
    if (S.phase === 'adjust') phaseText = '双方暗调中';
    if (S.phase === 'score') phaseText = S.scorePlayer === 0 ? '你正在计分' : '对方正在计分';
    dom.hudPhase.textContent = phaseText;
    dom.footerHint.textContent = '点击桌上的纸张可查看完整计分表';
    updateMiniPapers();
  }

  function renderMiniPaper(i) {
    const p = S.players[i];
    if (!p) return;
    const isYou = i === 0;
    const list = isYou ? dom.miniPlayerList : dom.miniOppList;
    const total = isYou ? dom.miniPlayerTotal : dom.miniOppTotal;
    const title = isYou ? dom.miniPlayerTitle : dom.miniOppTitle;
    title.textContent = isYou ? '你' : (S.mode === 'tutorial' ? '教学对手' : '对手');
    total.textContent = p.total;
    const rows = CATS.map(c => {
      const v = p.card[c.key];
      return `<span class="mini-paper-row${v == null ? '' : ' is-filled'}"><span>${c.label}</span><b>${v == null ? '·' : v}</b></span>`;
    }).join('');
    list.innerHTML = rows + `<span class="mini-paper-row mini-paper-row--total"><span>总和</span><b>${p.total}</b></span>`;
    const btn = dom.miniPapers[i];
    if (btn) btn.classList.toggle('is-active-paper', S.phase !== 'idle' && S.active === i);
  }

  function updateMiniPapers() {
    if (!S.players.length) return;
    renderMiniPaper(0);
    renderMiniPaper(1);
  }

  /* -------------------------------- timer -------------------------------- */
  const CLOCK_C = 320.44;

  function setMiniClock(el, remaining, duration, active) {
    if (!el) return;
    const span = el.querySelector('span');
    const em = el.querySelector('em');
    if (!span) return;
    if (!active) { span.textContent = '0'; if (em) em.textContent = 's'; el.classList.remove('is-urgent'); return; }
    const sec = Math.max(0, Math.ceil(remaining / 1000));
    span.textContent = sec;
    if (em) em.textContent = 's';
    el.classList.toggle('is-urgent', remaining <= 10000);
  }

  function tickClock() {
    const t = S.timer;
    let remaining = 0;
    if (t.active) remaining = Math.max(0, t.end - performance.now());
    const fraction = t.active && t.duration ? remaining / t.duration : 0;
    dom.clockArc.style.strokeDashoffset = String(CLOCK_C * (1 - fraction));
    dom.clockArc.classList.toggle('is-urgent', t.active && remaining <= 10000);
    dom.clockHand.style.transform = 'rotate(' + ((1 - fraction) * 360) + 'deg)';
    dom.clockText.textContent = t.active ? Math.ceil(remaining / 1000) : '0';
    setMiniClock(dom.diceTimer, remaining, t.duration, t.active && dom.diceOverlay.classList.contains('is-open'));
    setMiniClock(dom.paperTimer, remaining, t.duration, t.active && dom.paperOverlay.classList.contains('is-open'));
    if (t.active && remaining <= 0 && !t.fired) {
      t.fired = true;
      t.active = false;
      const cb = t.onTimeout;
      t.onTimeout = null;
      if (cb) setTimeout(cb, 0);
    }
  }
  setInterval(tickClock, 100);

  function startTimer(seconds, onTimeout) {
    const token = ++S.timer.token;
    S.timer = {
      active: true,
      end: performance.now() + seconds * 1000,
      duration: seconds * 1000,
      onTimeout,
      fired: false,
      token
    };
    tickClock();
  }

  function stopTimer() {
    S.timer.token++;
    S.timer.active = false;
    S.timer.fired = true;
    S.timer.onTimeout = null;
    tickClock();
  }

  function currentRemaining() {
    return S.timer.active ? Math.max(0, S.timer.end - performance.now()) : 0;
  }

  /* -------------------------------- dice UI ------------------------------- */
  function createDie(value, className) {
    const die = document.createElement('div');
    die.className = 'die' + (className ? ' ' + className : '');
    if (value == null) {
      die.classList.add('is-hidden');
      return die;
    }
    const positions = PIP_POSITIONS[value] || [];
    for (let i = 0; i < 9; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip' + (positions.includes(i) ? '' : ' is-off');
      if (value === 1) pip.classList.add('pip--one');
      die.appendChild(pip);
    }
    const label = document.createElement('span');
    label.className = 'die-value';
    label.textContent = value;
    die.appendChild(label);
    return die;
  }

  function createCubeFace(kind, value) {
    const face = document.createElement('div');
    face.className = 'cube-face cube-face--' + kind;
    const positions = PIP_POSITIONS[value] || [];
    for (let i = 0; i < 9; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip' + (positions.includes(i) ? '' : ' is-off');
      if (value === 1) pip.classList.add('pip--one');
      face.appendChild(pip);
    }
    return face;
  }

  function createCubeDie(value, className) {
    if (value == null) return createDie(null, className);
    const die = document.createElement('div');
    die.className = 'die die--cube' + (className ? ' ' + className : '');
    die.setAttribute('aria-label', value + ' 点');
    const cube = document.createElement('div');
    cube.className = 'cube';
    const rightValue = (value % 6) + 1;
    const topValue = ((value + 1) % 6) + 1;
    const faces = [
      ['front', value],
      ['back', 7 - value],
      ['right', rightValue],
      ['left', 7 - rightValue],
      ['top', topValue],
      ['bottom', 7 - topValue]
    ];
    faces.forEach(([kind, faceValue]) => cube.appendChild(createCubeFace(kind, faceValue)));
    die.appendChild(cube);
    const label = document.createElement('span');
    label.className = 'die-value';
    label.textContent = value;
    die.appendChild(label);
    return die;
  }

  function renderTableDice(dice, options = {}) {
    dom.tableDice.innerHTML = '';
    if (!dice || !dice.length) {
      for (let i = 0; i < 5; i++) {
        const die = createDie(null);
        die.classList.add('is-hidden');
        dom.tableDice.appendChild(die);
      }
      return;
    }
    dice.forEach((v, i) => {
      const die = createCubeDie(v, options.rolling ? 'is-rolling' : '');
      if (options.fixed && options.fixed.includes(i)) die.classList.add('is-fixed');
      dom.tableDice.appendChild(die);
    });
  }

  function renderRollingTable(dice) {
    dom.tableDice.innerHTML = '';
    const cubes = [];
    (dice || Array.from({ length: 5 }, () => randomDie())).forEach((value, i) => {
      const die = createCubeDie(value);
      die.classList.add('is-physics');
      const cube = die.querySelector('.cube');
      cubes.push({ die, cube, index: i });
      dom.tableDice.appendChild(die);
    });
    animateDiceCubes(cubes);
  }

  function animateDiceCubes(cubes) {
    if (S.diceRaf) cancelAnimationFrame(S.diceRaf);
    const started = performance.now();
    let last = started;
    const state = cubes.map((item, i) => ({
      ...item,
      y: -150 - i * 14,
      vy: 40 + i * 12,
      rx: 0,
      ry: 0,
      rz: 0,
      vx: 300 + i * 45,
      vyRot: 260 + i * 38,
      vz: 80 + i * 20
    }));

    function frame(now) {
      const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
      last = now;
      for (const s of state) {
        s.vy += 2600 * dt;
        s.y += s.vy * dt;
        s.rx += s.vx * dt;
        s.ry += s.vyRot * dt;
        s.rz += s.vz * dt;
        if (s.y >= 0) {
          s.y = 0;
          s.vy = -s.vy * 0.34;
          s.vx *= 0.58;
          s.vyRot *= 0.58;
          s.vz *= 0.58;
        }
        s.die.style.transform = 'translateY(' + s.y.toFixed(2) + 'px)';
        s.cube.style.transform = 'rotateX(' + s.rx.toFixed(1) + 'deg) rotateY(' + s.ry.toFixed(1) + 'deg) rotateZ(' + s.rz.toFixed(1) + 'deg)';
      }
      if (now - started < 900) {
        S.diceRaf = requestAnimationFrame(frame);
      } else {
        for (const s of state) {
          s.die.style.transform = '';
          s.cube.style.transform = 'rotateX(-13deg) rotateY(16deg) rotateZ(0deg)';
        }
        S.diceRaf = 0;
      }
    }
    S.diceRaf = requestAnimationFrame(frame);
  }

  function spawnParticles() {
    const rect = dom.game.getBoundingClientRect();
    dom.particles.innerHTML = '';
    const diceEls = dom.tableDice.querySelectorAll('.die');
    const anchors = [];
    diceEls.forEach(el => {
      const r = el.getBoundingClientRect();
      anchors.push([r.left - rect.left + r.width / 2, r.top - rect.top + r.height / 2]);
    });
    if (!anchors.length) anchors.push([rect.width / 2, rect.height * 0.64]);
    for (const [x, y] of anchors) {
      for (let k = 0; k < 8; k++) {
        const p = document.createElement('span');
        p.className = 'particle';
        const angle = Math.random() * Math.PI * 2;
        const dist = 24 + Math.random() * 68;
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--dy', (Math.sin(angle) * dist - 30) + 'px');
        p.style.animationDelay = (Math.random() * 0.12) + 's';
        dom.particles.appendChild(p);
      }
    }
    setTimeout(() => { dom.particles.innerHTML = ''; }, 1500);
  }

  function dissolveTableDice() {
    if (!dom.tableDice.querySelector('.die')) return;
    spawnParticles();
    dom.tableDice.innerHTML = '';
  }

  /* ------------------------------- paper UI ------------------------------- */
  function paperRowHTML(cat, card, options) {
    const usedValue = card[cat.key];
    const isUsed = usedValue != null;
    let potential = null;
    if (!isUsed && options.interactive) potential = E.scoreHand(options.dice, cat.key);
    const disabled = options.allowed && !isUsed && cat.key !== options.allowed;
    const selected = options.selected === cat.key && !isUsed && !disabled;
    const target = options.allowed === cat.key && !isUsed;
    const canSelect = options.interactive && !isUsed && !disabled;
    const valueText = isUsed ? usedValue : (options.interactive ? (potential == null ? 0 : potential) : '—');
    return `<div class="paper-row${isUsed ? ' is-used' : ''}${canSelect ? ' is-selectable' : ''}${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}${target ? ' is-tutorial-target' : ''}" data-key="${cat.key}">
      <div class="cat-name"><span>${cat.label}</span><button class="info-dot" type="button" data-info="${cat.key}" aria-label="${cat.name}规则">?</button></div>
      <div class="cat-desc">${E.RULES[cat.key] || ''}</div>
      <div class="cat-score">${valueText}</div>
    </div>`;
  }

  function renderPaper(playerIndex, options = {}) {
    const p = S.players[playerIndex];
    if (!p) return;
    const isScoring = !!options.scoring;
    const interactive = isScoring && playerIndex === 0;
    const allowed = isScoring ? options.allowed || null : null;
    const dice = options.dice || S.finalDice || [];
    const selected = isScoring ? S.scoreKey : null;
    const scrollTop = dom.paperBody.scrollTop;
    const rows = CATS.map(c => paperRowHTML(c, p.card, { interactive, dice, selected, allowed })).join('');
    dom.paperBody.innerHTML = rows + `<div class="paper-row paper-row--total"><div class="cat-name">总和</div><div class="cat-desc">当前已填栏目的合计，不是可填栏目</div><div class="cat-score">${p.total}</div></div>`;
    dom.paperBody.scrollTop = scrollTop;

    dom.paperKicker.textContent = isScoring ? 'CHOOSE A CATEGORY' : 'SCORE SHEET';
    dom.paperTitle.textContent = playerIndex === 0 ? '你的计分纸' : (S.mode === 'tutorial' ? '教学对手的计分纸' : '对手的计分纸');
    dom.paperTotal.textContent = p.total;
    const selectedCat = selected && CAT_BY_KEY[selected];
    const previewScore = selectedCat ? E.scoreHand(dice, selected) : 0;
    dom.paperPreview.textContent = selectedCat ? `选择【${selectedCat.label}】+${previewScore} → ${p.total + previewScore}` : '';
    dom.paperConfirm.classList.toggle('is-hidden', !interactive);
    dom.paperClose.classList.toggle('is-hidden', interactive);
    dom.btnViewTable.classList.toggle('is-hidden', !interactive);
    dom.paperConfirm.disabled = !interactive || !selected;
    dom.paperHint.textContent = interactive
      ? (allowed ? '教学：只能选择【' + CAT_BY_KEY[allowed].label + '】' : (selectedCat ? '已选中，可确认计分' : '点击一个未使用的栏目'))
      : (S.scoreMode ? '等待对方选择栏目…' : '点击问号查看栏目规则');
    dom.paperKicker.textContent = interactive ? 'CHOOSE A CATEGORY' : 'SCORE SHEET';
  }

  function openPaper(playerIndex, options = {}) {
    dom.paperOverlay.classList.remove('is-peeking');
    S.viewPaperPlayer = playerIndex;
    if (options.scoring) {
      S.scoreMode = true;
      S.scorePlayer = playerIndex;
      S.scoreKey = null;
      S.scoreAllowed = options.allowed || null;
    } else {
      S.scoreMode = false;
    }
    renderPaper(playerIndex, options);
    openOverlay(dom.paperOverlay);
  }

  function selectPaperCategory(key) {
    if (!S.scoreMode || S.scorePlayer !== 0) return;
    if (S.scoreAllowed && key !== S.scoreAllowed) {
      showToast('教学：本次只能选择指定栏目');
      return;
    }
    const cat = CAT_BY_KEY[key];
    if (!cat) return;
    const p = S.players[0];
    if (p.card[key] != null) return;
    S.scoreKey = key;
    renderPaper(0, { scoring: true, allowed: S.scoreAllowed, dice: S.finalDice });
  }

  function confirmPaper() {
    if (!S.scoreMode || S.scorePlayer !== 0) return;
    if (!S.scoreKey) { showToast('请先选择一个栏目'); return; }
    const key = S.scoreKey;
    closeOverlay(dom.paperOverlay);
    stopTimer();
    S.scoreMode = false;
    commitScore(key);
  }

  function openRule(key) {
    const cat = CAT_BY_KEY[key];
    if (!cat) return;
    dom.ruleTitle.textContent = cat.name;
    dom.ruleText.textContent = E.RULES[key] || '';
    openOverlay(dom.rulePop);
  }

  /* ------------------------------- screens -------------------------------- */
  function goMenu() {
    stopTimer();
    clearLater();
    releaseRoom();
    S.gameToken++;
    S.coinToken++;
    if (S.coinTimer) clearTimeout(S.coinTimer);
    if (S.coinRaf) cancelAnimationFrame(S.coinRaf);
    if (S.diceRaf) cancelAnimationFrame(S.diceRaf);
    if (S.coinAnim) S.coinAnim.cancel();
    if (S.diceAnim) S.diceAnim.cancel();
    S.coinTimer = null;
    S.coinRaf = 0;
    S.diceRaf = 0;
    S.coinAnim = null;
    S.diceAnim = null;
    if (dom.coinCanvas) dom.coinCanvas.classList.remove('is-active');
    dom.game.classList.remove('is-coining');
    S.phase = 'idle';
    S.tutorialStage = 'off';
    setTutorial('');
    closeAllOverlays();
    showScreen('menu');
  }

  function goRules() {
    showScreen('rules');
  }

  /* ----------------------------- game lifecycle --------------------------- */
  function startGame(mode) {
    stopTimer();
    clearLater();
    releaseRoom();
    S.gameToken++;
    S.mode = mode;
    S.phase = 'idle';
    S.active = 0;
    S.turnNo = 0;
    S.dice = [];
    S.fixed = [];
    S.adjust = null;
    S.finalDice = [];
    S.scoreMode = false;
    S.scoreKey = null;
    S.scoreAllowed = null;
    S.tutorialStage = mode === 'tutorial' ? 'coin' : 'off';
    S.tutorialOnes = 0;
    S.coinToken++;
    if (S.coinTimer) clearTimeout(S.coinTimer);
    if (S.coinRaf) cancelAnimationFrame(S.coinRaf);
    if (S.diceRaf) cancelAnimationFrame(S.diceRaf);
    if (S.coinAnim) S.coinAnim.cancel();
    if (S.diceAnim) S.diceAnim.cancel();
    S.coinTimer = null;
    S.coinRaf = 0;
    S.diceRaf = 0;
    S.coinAnim = null;
    S.diceAnim = null;
    if (dom.coinCanvas) dom.coinCanvas.classList.remove('is-active');
    dom.game.classList.remove('is-coining');
    initPlayers();
    S.timer.active = false;
    dom.diceOverlay.classList.remove('is-open');
    closeAllOverlays();
    showScreen('game');
    renderTableDice([]);
    dom.tableStatus.textContent = '投币决定先后';
    updateHUD();
    setTutorial(mode === 'tutorial' ? '教学关卡：硬币固定为「后」，对方先手。' : '');
    startCoin(mode === 'tutorial' ? '后' : (cryptoRandom() < 0.5 ? '先' : '后'));
  }

  function startCoin(forcedResult) {
    const token = ++S.coinToken;
    stopTimer();
    S.phase = 'coin';
    dom.tableStatus.textContent = '投币决定先后';
    updateHUD();
    if (S.coinTimer) clearTimeout(S.coinTimer);
    if (S.coinAnim) S.coinAnim.cancel();
    S.coinTimer = null;
    S.coinAnim = null;
    const result = forcedResult || (cryptoRandom() < 0.5 ? '先' : '后');

    if (TEST_MODE || !window.Anim3D) {
      S.coinTimer = setTimeout(() => finishCoin(result, token), 60);
      return;
    }

    const stageRect = dom.tableStage.getBoundingClientRect();
    const tableRect = dom.tableOuter.getBoundingClientRect();
    const W = Math.max(320, stageRect.width);
    const H = Math.max(240, stageRect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const tableX = tableRect.left + tableRect.width / 2 - stageRect.left;
    const tableY = tableRect.top + tableRect.height / 2 - stageRect.top;
    const radius = Math.max(40, Math.min(76, tableRect.width * 0.08, tableRect.height * 0.13));
    dom.coinCanvas.classList.add('is-active');
    dom.game.classList.add('is-coining');
    S.coinAnim = window.Anim3D.coin(dom.coinCanvas, {
      width: W,
      height: H,
      dpr: dpr,
      tableX: tableX,
      tableY: tableY,
      radius: radius,
      result: result,
      onDone: () => finishCoin(result, token)
    });
  }

  function finishCoin(result, token) {
    if (token !== S.coinToken) return;
    S.coinTimer = null;
    S.coinAnim = null;
    dom.coinCanvas.classList.remove('is-active');
    dom.game.classList.remove('is-coining');
    if (S.mode === 'tutorial') tutorialAiFirst();
    else beginTurn(result === '先' ? 0 : 1);
  }

  function beginTurn(active, options = {}) {
    if (S.phase === 'over') return;
    S.active = active;
    S.phase = 'intro';
    S.turnToken++;
    if (S.rollInterval) { clearInterval(S.rollInterval); S.rollInterval = null; }
    S.dice = [];
    S.fixed = [];
    S.adjust = null;
    S.finalDice = [];
    S.scoreMode = false;
    S.scoreKey = null;
    updateHUD();
    renderTableDice([]);
    dom.tableStatus.textContent = active === 0 ? '准备投骰' : '对方准备投骰';
    showBanner(active === 0 ? '轮到你了' : '轮到对方了');
    const token = S.turnToken;
    later(1150, () => {
      if (S.turnToken !== token) return;
      startRoll(options);
    });
  }

  function startRoll(options = {}) {
    stopTimer();
    S.phase = 'rolling';
    updateHUD();
    dom.tableStatus.textContent = '骰子投掷中…';
    const token = S.turnToken;
    const forced = options && options.forcedDice ? options.forcedDice.slice() : null;
    const finalDice = (forced || Array.from({ length: 5 }, () => randomDie())).sort((a, b) => a - b);

    if (TEST_MODE || !window.Anim3D || !dom.diceCanvas) {
      renderTableDice(finalDice);
      later(60, () => {
        if (S.turnToken !== token) return;
        afterRoll(finalDice, token);
      });
      return;
    }

    if (S.diceAnim) S.diceAnim.cancel();
    const stageRect = dom.tableStage.getBoundingClientRect();
    const diceRect = dom.tableDice.getBoundingClientRect();
    const tableRect = dom.tableOuter.getBoundingClientRect();
    const W = Math.max(320, stageRect.width);
    const H = Math.max(240, stageRect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const tableX = (diceRect.width ? diceRect.left + diceRect.width / 2 : tableRect.left + tableRect.width / 2) - stageRect.left;
    const tableY = (diceRect.height ? diceRect.top + diceRect.height / 2 : tableRect.top + tableRect.height / 2) - stageRect.top;
    const radius = Math.max(44, Math.min(72, tableRect.width * 0.065));
    dom.diceCanvas.classList.add('is-active');
    dom.tableDice.style.visibility = 'hidden';
    S.diceAnim = window.Anim3D.dice(dom.diceCanvas, {
      width: W,
      height: H,
      dpr: dpr,
      tableX: tableX,
      tableY: tableY,
      radius: radius,
      values: finalDice,
      onDone: () => {
        dom.diceCanvas.classList.remove('is-active');
        dom.tableDice.style.visibility = '';
        S.diceAnim = null;
        if (S.turnToken === token) afterRoll(finalDice, token);
      }
    });
  }

  function afterRoll(finalDice, token) {
    if (S.turnToken !== token) return;
    if (S.diceRaf) cancelAnimationFrame(S.diceRaf);
    S.diceRaf = 0;
    if (S.diceAnim) S.diceAnim.cancel();
    S.diceAnim = null;
    dom.diceCanvas.classList.remove('is-active');
    dom.tableDice.style.visibility = '';
    if (S.rollInterval) { clearInterval(S.rollInterval); S.rollInterval = null; }
    S.dice = finalDice.slice().sort((a, b) => a - b);
    S.phase = 'rolled';
    renderTableDice(S.dice);
    dom.tableStatus.textContent = '已投出 · 等待固定';
    updateHUD();
    if (S.active === 0) {
      later(420, () => { if (S.turnToken === token) openFix(); });
    } else {
      dom.tableStatus.textContent = '对方正在选择固定骰子…';
      later(820, () => { if (S.turnToken === token) aiFix(); });
    }
  }

  function fixRuleForStage() {
    if (S.mode === 'tutorial') {
      if (S.tutorialStage === 'p1fix') return { exact: 2, max: 2, allowed: null, hint: '教学：本次只能固定 2 颗骰子。' };
      if (S.tutorialStage === 'finalFix') {
        const allowed = S.dice.map((v, i) => v === 5 ? i : -1).filter(i => i >= 0);
        return { exact: 3, max: 3, allowed, hint: '教学：只能选择三颗 5。' };
      }
    }
    return { exact: null, max: S.players[S.active].threeFixUsed ? 2 : 3, allowed: null, hint: '点击骰子选择固定，再次点击取消。' };
  }

  function openFix() {
    S.phase = 'fix';
    S.fixed = [];
    const rule = fixRuleForStage();
    S.fixRule = rule;
    dom.diceEyebrow.textContent = S.active === 0 ? 'FIX THE DICE' : 'WAIT FOR OPPONENT';
    dom.diceTitle.textContent = S.active === 0 ? '选择要固定的骰子' : '对方正在固定骰子';
    dom.diceHint.textContent = rule.hint;
    dom.diceConfirm.textContent = '确定固定';
    dom.diceConfirm.disabled = true;
    dom.diceConfirm.classList.remove('is-hidden');
    dom.diceNote.textContent = S.players[S.active].threeFixUsed ? '固定三颗机会已使用' : '固定三颗机会可用';
    renderFixPanel();
    openOverlay(dom.diceOverlay);
    updateHUD();
    if (S.mode === 'tutorial' && S.tutorialStage === 'p1fix') {
      setTutorial('第一次投骰很散，凑不出搭配栏。按教学要求，只能固定 2 颗骰子。');
    } else if (S.mode === 'tutorial' && S.tutorialStage === 'finalFix') {
      setTutorial('最后一把：骰面出现三个 5。教学要求只能固定 3 颗，而且只能选这三个 5。');
    } else {
      setTutorial('');
    }
    startTimer(30, () => submitFix(true));
  }

  function renderFixPanel() {
    const rule = S.fixRule || { max: 2, exact: null, allowed: null };
    dom.diceRow.innerHTML = '';
    S.dice.forEach((v, i) => {
      const slot = document.createElement('div');
      slot.className = 'die-slot';
      const die = createDie(v, 'is-clickable');
      if (S.fixed.includes(i)) die.classList.add('is-selected');
      if (rule.allowed && !rule.allowed.includes(i)) die.classList.add('is-unavailable');
      die.addEventListener('click', () => toggleFix(i));
      slot.appendChild(die);
      if (rule.allowed && !rule.allowed.includes(i)) {
        const owner = document.createElement('span');
        owner.className = 'die-owner';
        owner.textContent = '不可固定';
        slot.appendChild(owner);
      }
      dom.diceRow.appendChild(slot);
    });
    const selected = S.fixed.length;
    dom.diceMeta.innerHTML = `<span>已选择 ${selected} / 最多 ${rule.max}</span><span class="meta-chip${S.players[S.active].threeFixUsed ? ' is-spent' : ''}">固定三颗：${S.players[S.active].threeFixUsed ? '已用' : '可用'}</span>`;
    dom.diceConfirm.disabled = rule.exact ? selected !== rule.exact : selected < 1;
  }

  function toggleFix(index) {
    if (S.phase !== 'fix' || S.active !== 0) return;
    const rule = S.fixRule || { max: 2, exact: null, allowed: null };
    if (rule.allowed && !rule.allowed.includes(index)) {
      showToast('教学：只能固定这三颗 5');
      return;
    }
    const at = S.fixed.indexOf(index);
    if (at >= 0) {
      S.fixed.splice(at, 1);
    } else {
      if (S.fixed.length >= rule.max) {
        showToast('达到可选择上限');
        return;
      }
      S.fixed.push(index);
    }
    renderFixPanel();
  }

  function submitFix(auto) {
    if (S.phase !== 'fix' || S.active !== 0) return;
    const rule = S.fixRule || { max: 2, exact: null, allowed: null };
    if (rule.exact && S.fixed.length !== rule.exact) {
      if (auto) {
        S.fixed = rule.allowed ? rule.allowed.slice(0, rule.exact) : S.dice.map((_, i) => i).slice(0, rule.exact);
      } else {
        showToast(rule.exact === 2 ? '教学：必须固定 2 颗' : '教学：必须固定 3 颗');
        return;
      }
    }
    if (S.fixed.length < 1) {
      if (auto) S.fixed = [0];
      else { showToast('至少固定一颗骰子'); return; }
    }
    if (S.fixed.length > rule.max) S.fixed = S.fixed.slice(0, rule.max);
    if (S.fixed.length === 3) S.players[S.active].threeFixUsed = true;
    if (S.mode === 'tutorial') {
      if (S.tutorialStage === 'p1fix') S.tutorialStage = 'p1adjust';
      else if (S.tutorialStage === 'finalFix') S.tutorialStage = 'finalAdjust';
    }
    stopTimer();
    closeOverlay(dom.diceOverlay);
    S.fixed.sort((a, b) => a - b);
    S.phase = 'fixed';
    dom.tableStatus.textContent = '已固定 ' + S.fixed.length + ' 颗骰子';
    renderTableDice(S.dice, { fixed: S.fixed });
    showToast('固定了 ' + S.fixed.length + ' 颗骰子', 900);
    updateHUD();
    const token = S.turnToken;
    later(420, () => { if (S.turnToken === token) setupAdjust(); });
  }

  function aiFix() {
    if (S.phase !== 'rolled' || S.active !== 1) return;
    const ai = S.players[1];
    const choice = E.chooseAIFix(S.dice, !ai.threeFixUsed, ai.card);
    S.fixed = choice.indices.slice();
    if (S.fixed.length === 3) ai.threeFixUsed = true;
    S.phase = 'fixed';
    renderTableDice(S.dice, { fixed: S.fixed });
    dom.tableStatus.textContent = '对方已固定 ' + S.fixed.length + ' 颗骰子';
    showToast('对方固定了 ' + S.fixed.length + ' 颗骰子', 1000);
    updateHUD();
    const token = S.turnToken;
    later(620, () => { if (S.turnToken === token) setupAdjust(); });
  }

  function setupAdjust() {
    dissolveTableDice();
    const fixed = S.fixed.slice().sort((a, b) => a - b);
    const fixedValues = fixed.map(i => S.dice[i]);
    const remaining = S.dice.map((_, i) => i).filter(i => !fixed.includes(i));
    const shuffled = E.shuffleDice(remaining, cryptoRandom);
    const fixedCount = fixed.length;
    const activeCount = fixedCount === 1 ? 2 : 1;
    const inactiveCount = fixedCount === 3 ? 1 : 2;
    const activeVals = shuffled.slice(0, activeCount).map(i => S.dice[i]);
    const inactiveVals = shuffled.slice(activeCount).map(i => S.dice[i]);
    const humanIsActive = S.active === 0;
    const humanValues = (humanIsActive ? activeVals : inactiveVals).slice();
    const hiddenCount = humanIsActive ? inactiveCount : activeCount;
    S.adjust = {
      fixedValues,
      fixedCount,
      activeCount,
      inactiveCount,
      humanIsActive,
      humanValues,
      hiddenCount,
      aiCount: humanIsActive ? inactiveCount : activeCount,
      aiValues: null
    };
    if (S.mode !== 'tutorial') {
      if (S.active === 0) {
        S.adjust.aiValues = E.chooseSabotage(fixedValues, S.adjust.hiddenCount, S.players[0].card, humanValues);
      } else {
        S.adjust.aiValues = E.chooseActiveAdjustment(fixedValues, S.adjust.hiddenCount, S.players[1].card, humanValues);
      }
    }
    S.phase = 'adjust';
    S.turnToken++;
    updateHUD();
    dom.tableStatus.textContent = '暗调阶段 · 双方各调各的骰子';
    dom.diceEyebrow.textContent = 'SECRET ADJUST';
    dom.diceTitle.textContent = humanIsActive ? '暗调你的骰子' : '暗调 · 你分到的骰子';
    dom.diceHint.textContent = humanValues.length
      ? '你分到 ' + humanValues.length + ' 颗，可左右调整；对方分到 ' + hiddenCount + ' 颗（暗置）。'
      : '你分到 0 颗骰子；对方将调整 ' + hiddenCount + ' 颗。';
    dom.diceConfirm.textContent = humanValues.length ? '确定调整' : '等待对方';
    dom.diceConfirm.disabled = false;
    dom.diceConfirm.classList.remove('is-hidden');
    dom.diceNote.textContent = '倒计时结束将按当前骰面确定';
    renderAdjustPanel();
    openOverlay(dom.diceOverlay);
    if (S.mode === 'tutorial') {
      if (S.tutorialStage === 'p1adjust') setTutorial('你分到 1 颗。把它调整好后确定；对方会补上两颗 1。');
      else if (S.tutorialStage === 'finalAdjust') setTutorial('你分到 1 颗，对方 1 颗（暗置）。对方会补一个 5；直接确定即可凑出四条 5。');
    } else {
      setTutorial('');
    }
    startTimer(60, () => submitAdjust(true));
    const token = S.turnToken;
    if (!humanValues.length) later(1800, () => { if (S.turnToken === token && S.phase === 'adjust') submitAdjust(true); });
  }

  function renderAdjustPanel() {
    const a = S.adjust;
    if (!a) return;
    const flipIndex = a.flipIndex;
    const flipDir = a.flipDir;
    a.flipIndex = null;
    a.flipDir = 0;
    dom.diceRow.innerHTML = '';
    a.fixedValues.forEach(v => {
      const slot = document.createElement('div');
      slot.className = 'die-slot';
      const die = createDie(v, 'is-fixed');
      slot.appendChild(die);
      const badge = document.createElement('span');
      badge.className = 'die-lock';
      badge.textContent = '固定';
      slot.appendChild(badge);
      const owner = document.createElement('span');
      owner.className = 'die-owner';
      owner.textContent = '锁定';
      slot.appendChild(owner);
      dom.diceRow.appendChild(slot);
    });
    a.humanValues.forEach((v, i) => {
      const slot = document.createElement('div');
      slot.className = 'die-slot die-slot--adjust';
      const left = document.createElement('button');
      left.className = 'die-arrow die-arrow--left';
      left.type = 'button';
      left.textContent = '‹';
      left.setAttribute('aria-label', '减一');
      left.addEventListener('click', () => changeAdjustValue(i, -1));
      const die = createDie(v);
      if (i === flipIndex) die.classList.add(flipDir < 0 ? 'is-value-flipping-left' : 'is-value-flipping-right');
      const right = document.createElement('button');
      right.className = 'die-arrow die-arrow--right';
      right.type = 'button';
      right.textContent = '›';
      right.setAttribute('aria-label', '加一');
      right.addEventListener('click', () => changeAdjustValue(i, 1));
      const owner = document.createElement('span');
      owner.className = 'die-owner';
      owner.textContent = '你的 ' + (i + 1);
      slot.appendChild(left);
      slot.appendChild(die);
      slot.appendChild(right);
      slot.appendChild(owner);
      dom.diceRow.appendChild(slot);
    });
    for (let i = 0; i < a.hiddenCount; i++) {
      const slot = document.createElement('div');
      slot.className = 'die-slot';
      const die = createDie(null);
      slot.appendChild(die);
      const owner = document.createElement('span');
      owner.className = 'die-owner';
      owner.textContent = '对方 ' + (i + 1);
      slot.appendChild(owner);
      dom.diceRow.appendChild(slot);
    }
    dom.diceMeta.innerHTML = `<span>固定 ${a.fixedCount} 颗</span><span>你 ${a.humanValues.length} 颗</span><span>对方 ${a.hiddenCount} 颗</span><span class="meta-chip">暗置中</span>`;
  }

  function changeAdjustValue(index, delta) {
    if (S.phase !== 'adjust' || !S.adjust) return;
    const v = S.adjust.humanValues[index] + delta;
    S.adjust.humanValues[index] = v < 1 ? 6 : v > 6 ? 1 : v;
    S.adjust.flipIndex = index;
    S.adjust.flipDir = delta;
    renderAdjustPanel();
  }

  function submitAdjust(auto) {
    if (S.phase !== 'adjust' || !S.adjust) return;
    const a = S.adjust;
    const token = S.turnToken;
    stopTimer();
    S.phase = 'adjustWait';
    dom.diceConfirm.disabled = true;
    dom.diceConfirm.textContent = '等待对方抉择…';
    dom.diceHint.textContent = '等待对方抉择…';
    dom.diceNote.textContent = '双方确认后将揭晓最终骰面';
    const fixedValues = a.fixedValues.slice();
    const humanValues = a.humanValues.slice();
    let aiValues = [];
    if (S.mode === 'tutorial' && S.tutorialStage === 'p1adjust') {
      const p = humanValues[0] || 1;
      aiValues = E.tutorialAiResponse(fixedValues, p);
    } else if (S.mode === 'tutorial' && S.tutorialStage === 'finalAdjust') {
      aiValues = [5];
    } else {
      aiValues = a.aiValues ? a.aiValues.slice() : [];
    }
    if (aiValues.length !== a.hiddenCount) {
      aiValues = Array.from({ length: a.hiddenCount }, () => 1 + Math.floor(cryptoRandom() * 6));
    }
    const final = fixedValues.concat(humanValues, aiValues).sort((x, y) => x - y);
    S.finalDice = final;
    if (S.mode === 'tutorial' && S.tutorialStage === 'p1adjust') {
      S.tutorialOnes = final.filter(v => v === 1).length;
    }
    later(780, () => {
      if (S.turnToken !== token) return;
      closeOverlay(dom.diceOverlay);
      S.phase = 'reveal';
      renderTableDice(final);
      dom.tableStatus.textContent = '最终骰面 · ' + final.join(' · ');
      updateHUD();
      spawnParticles();
      if (S.mode === 'tutorial') {
        if (S.tutorialStage === 'p1adjust') {
          setTutorial('最终骰面是 ' + final.join('、') + '。有三个 1，没有搭配栏。现在只能选择数字栏【1】。');
        } else if (S.tutorialStage === 'finalAdjust') {
          setTutorial('最终骰面凑出了四个 5。你的 4 条栏还没有填。');
        }
      }
      later(1200, () => {
        if (S.turnToken !== token) return;
        beginScorePhase();
      });
    });
  }

  function beginScorePhase() {
    S.phase = 'score';
    S.scoreMode = true;
    S.scorePlayer = S.active;
    S.scoreKey = null;
    if (S.active === 0) {
      let allowed = null;
      if (S.mode === 'tutorial') {
        if (S.tutorialStage === 'p1adjust') allowed = 'n1';
        else if (S.tutorialStage === 'finalAdjust') allowed = 'four';
      }
      S.scoreAllowed = allowed;
      dom.tableStatus.textContent = '选择计分栏 · 点击纸张中的栏目';
      openPaper(0, { scoring: true, allowed, dice: S.finalDice });
      updateHUD();
      if (S.mode === 'tutorial') {
        if (allowed === 'n1') setTutorial('选择数字栏【1】，得分为三个 1，共 3 分。');
        else if (allowed === 'four') setTutorial('选择【4条】栏，得 20 分。');
      }
      startTimer(30, () => {
        if (!S.scoreMode || S.scorePlayer !== 0) return;
        if (!S.scoreKey) {
          const key = S.scoreAllowed || E.firstUnused(S.players[0].card);
          S.scoreKey = key;
        }
        confirmPaper();
      });
    } else {
      S.scoreAllowed = null;
      updateHUD();
      dom.tableStatus.textContent = '对方正在计分…';
      setTutorial(S.mode === 'tutorial' ? S.tutorialText.textContent : '');
      const token = S.turnToken;
      later(950, () => {
        if (S.turnToken !== token || S.active !== 1) return;
        const best = E.bestCategory(S.finalDice, S.players[1].card);
        S.scoreKey = best.key;
        showToast('对手选择：' + CAT_BY_KEY[best.key].label + ' +' + best.score, 1500);
        dom.tableStatus.textContent = '对方选择【' + CAT_BY_KEY[best.key].label + '】 +' + best.score;
        later(850, () => { if (S.turnToken === token) commitScore(best.key); });
      });
    }
  }

  function commitScore(key) {
    const p = S.players[S.active];
    const score = E.scoreHand(S.finalDice, key);
    if (p.card[key] != null) return;
    p.card[key] = score;
    refreshPlayerTotal(S.active);
    S.turnNo++;
    S.phase = 'scoreDone';
    S.scoreMode = false;
    closeOverlay(dom.paperOverlay);
    closeOverlay(dom.rulePop);
    stopTimer();
    updateHUD();
    updateMiniPapers();
    showToast(playerName(S.active) + ' 选择【' + CAT_BY_KEY[key].label + '】 +' + score, 1600);
    dom.tableStatus.textContent = playerName(S.active) + ' 填入【' + CAT_BY_KEY[key].label + '】 +' + score;
    if (S.mode === 'tutorial') {
      if (S.tutorialStage === 'p1adjust') {
        S.tutorialStage = 'jump';
        setTutorial('');
        later(1500, tutorialJump);
        return;
      }
      if (S.tutorialStage === 'finalAdjust') {
        S.tutorialStage = 'done';
        later(1400, () => endGame(true));
        return;
      }
    }
    if (E.isCardFull(S.players[0].card) && E.isCardFull(S.players[1].card)) {
      later(1200, () => endGame(false));
      return;
    }
    S.active = 1 - S.active;
    const token = S.turnToken;
    updateHUD();
    later(1300, () => {
      if (S.turnToken === token) beginTurn(S.active);
    });
  }

  /* ------------------------------- tutorial -------------------------------- */
  function startTutorial() {
    startGame('tutorial');
  }

  function tutorialAiFirst() {
    S.phase = 'intro';
    S.active = 1;
    S.turnToken++;
    S.tutorialStage = 'aiFirst';
    S.players[1].card.smallStraight = 20;
    refreshPlayerTotal(1);
    updateHUD();
    setTutorial('先看对方完成一回合。本教学会固定他的结果为「小顺子 20」。');
    showBanner('轮到对方了');
    renderTableDice([2, 3, 4, 5, 6]);
    dom.tableStatus.textContent = '对手投出 2 · 3 · 4 · 5 · 6';
    showToast('对手选择：小顺子 +20', 1800);
    later(1900, () => {
      S.players[1].card.smallStraight = 20;
      refreshPlayerTotal(1);
      updateHUD();
      showToast('对手完成回合，轮到你了', 1200);
      S.active = 0;
      S.tutorialStage = 'p1fix';
      const hand = E.shuffleDice(E.TUTORIAL_OPENING, cryptoRandom);
      beginTurn(0, { forcedDice: hand });
    });
  }

  function tutorialJump() {
    S.tutorialStage = 'jump';
    const ones = S.tutorialOnes;
    const playerCard = E.tutorialPlayerCard(ones);
    const aiCard = { ...E.TUTORIAL_AI_CARD };
    S.players[0].card = playerCard;
    S.players[1].card = aiCard;
    refreshPlayerTotal(0);
    refreshPlayerTotal(1);
    S.turnNo = 20;
    updateHUD();
    updateMiniPapers();
    S.active = 0;
    const lead = S.players[1].total - S.players[0].total;
    dom.jumpTitle.textContent = '时间快进';
    dom.jumpText.textContent = '对方的计分纸已全部填完，你只差一个「4条」。此时对方总和 ' + S.players[1].total + '，你 ' + S.players[0].total + '，对方领先 ' + lead + ' 分。';
    openOverlay(dom.jumpOverlay);
    setTutorial('时间快进到最后一回合：你只差【4条】。对方领先 ' + lead + ' 分，填出 4 条就能反超。');
    later(2400, () => {
      closeOverlay(dom.jumpOverlay);
      S.tutorialStage = 'finalFix';
      const finalHand = E.shuffleDice([5, 5, 5, 2, 6], cryptoRandom);
      beginTurn(0, { forcedDice: finalHand });
    });
  }

  /* -------------------------------- result -------------------------------- */
  function renderResultCards() {
    return S.players.map((p, i) => {
      const rows = CATS.map(c => `<span>${c.label} <b>${p.card[c.key] == null ? '—' : p.card[c.key]}</b></span>`).join('');
      return `<div class="result-sheet"><h4>${i === 0 ? '你' : '对手'}<span class="result-total">${p.total}</span></h4><div class="result-sheet-grid">${rows}</div></div>`;
    }).join('');
  }

  function endGame(tutorialWin) {
    if (S.phase === 'over') return;
    S.phase = 'over';
    releaseRoom();
    S.scoreMode = false;
    stopTimer();
    closeOverlay(dom.paperOverlay);
    closeOverlay(dom.diceOverlay);
    closeOverlay(dom.rulePop);
    closeOverlay(dom.jumpOverlay);
    updateHUD();
    const you = S.players[0].total, opp = S.players[1].total;
    const win = you > opp;
    const tie = you === opp;
    dom.resultKicker.textContent = S.mode === 'tutorial' ? 'TUTORIAL CLEAR' : 'GAME OVER';
    dom.resultTitle.textContent = S.mode === 'tutorial'
      ? (win ? '教学完成 · 你赢了' : '教学完成')
      : (tie ? '平局' : win ? '你赢了' : '对手获胜');
    dom.resultScore.textContent = '你 ' + you + ' : ' + opp + ' 对手';
    dom.resultCards.innerHTML = renderResultCards();
    dom.btnAgain.textContent = S.mode === 'tutorial' ? '完成教学' : '再来一局';
    openOverlay(dom.resultOverlay);
    S.tutorialStage = 'done';
    setTutorial('');
  }

  /* ------------------------------ match flow ------------------------------ */
  async function releaseRoom() {
    if (S.roomPoll) clearInterval(S.roomPoll);
    S.roomPoll = null;
    const id = S.roomId;
    S.roomId = null;
    S.roomHost = false;
    if (!id) return;
    try {
      await tdb('delete', { tag: 'timicard_room_' + id });
    } catch (err) { /* the cleanup sweep will remove it later */ }
  }

  function roomPayload(raw) {
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      return null;
    }
  }

  async function startMatch() {
    releaseRoom();
    const token = ++S.matchToken;
    S.roomId = null;
    S.roomHost = false;
    S.matchBusy = true;
    dom.matchTitle.textContent = '匹配中';
    dom.matchSub.textContent = '正在搜索真人牌桌…';
    dom.matchSteps.forEach((s, i) => s.classList.toggle('is-on', i === 0));
    openOverlay(dom.matchOverlay);
    cleanupStaleRooms();

    let rooms = [];
    try {
      const tags = await listRoomTags();
      for (const tag of tags) {
        const room = await getRoom(tag);
        if (room && room.hostId !== CLIENT_ID) rooms.push({ tag, room });
      }
    } catch (err) { /* fall through to create */ }

    if (token !== S.matchToken) return;

    const now = Date.now();
    const open = rooms.find(x => x.room.status === 'open' && now - Number(x.room.updatedAt || 0) < 30000);
    if (open) {
      try {
        const room = { ...open.room, guestId: CLIENT_ID, status: 'matched', updatedAt: Date.now() };
        await tdb('update', { tag: open.tag, value: JSON.stringify(room) });
        if (token !== S.matchToken) return;
        S.roomId = open.tag.replace('timicard_room_', '');
        S.roomHost = false;
        dom.matchTitle.textContent = '已找到真人';
        dom.matchSub.textContent = '对手已加入 · 正在等待开局';
        dom.matchSteps.forEach(s => s.classList.add('is-on'));
        waitForMatchedRoom(token, true);
        return;
      } catch (err) { /* create a fresh room */ }
    }

    const id = 'R' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const room = {
      status: 'open',
      hostId: CLIENT_ID,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      game: 'xianhou'
    };
    try {
      await tdb('update', { tag: 'timicard_room_' + id, value: JSON.stringify(room) });
      if (token !== S.matchToken) return;
      S.roomId = id;
      S.roomHost = true;
      dom.matchTitle.textContent = '等待真人加入';
      dom.matchSub.textContent = '房间 ' + id + ' · 把页面发给朋友';
      dom.matchSteps.forEach((s, i) => s.classList.toggle('is-on', i <= 1));
      waitForMatchedRoom(token, false);
    } catch (err) {
      dom.matchTitle.textContent = '暂时无法联网';
      dom.matchSub.textContent = '可以直接进入人机练习';
    }
  }

  async function waitForMatchedRoom(token, alreadyMatched) {
    if (S.roomPoll) clearInterval(S.roomPoll);
    const poll = async () => {
      if (token !== S.matchToken || !S.roomId) return;
      try {
        const room = await getRoom('timicard_room_' + S.roomId);
        if (!room) {
          dom.matchTitle.textContent = '房间已关闭';
          dom.matchSub.textContent = '可以取消后重新匹配';
          return;
        }
        const matched = alreadyMatched || room.status === 'matched' || !!room.guestId;
        if (matched) {
          dom.matchTitle.textContent = '真人对手已就位';
          dom.matchSub.textContent = '联机对局同步即将接入';
          dom.matchSteps.forEach(s => s.classList.add('is-on'));
          return;
        }
        if (S.roomHost) {
          room.updatedAt = Date.now();
          await tdb('update', { tag: 'timicard_room_' + S.roomId, value: JSON.stringify(room) });
          dom.matchSub.textContent = '房间 ' + S.roomId + ' · 等待真人加入';
        }
      } catch (err) { /* keep waiting */ }
    };
    poll();
    S.roomPoll = setInterval(poll, 1500);
  }

  function cancelMatch() {
    S.matchToken++;
    S.matchBusy = false;
    if (S.roomPoll) clearInterval(S.roomPoll);
    S.roomPoll = null;
    releaseRoom();
    closeOverlay(dom.matchOverlay);
  }

  /* ------------------------------- bind UI -------------------------------- */
  $('btnRules').addEventListener('click', goRules);
  $('btnMatch').addEventListener('click', startMatch);
  $('btnRulesBack').addEventListener('click', goMenu);
  $('btnTutorial').addEventListener('click', startTutorial);
  $('btnMatchPractice').addEventListener('click', () => {
    S.matchToken++;
    releaseRoom();
    closeOverlay(dom.matchOverlay);
    startGame('ai');
  });
  $('btnPractice').addEventListener('click', () => { releaseRoom(); startGame('ai'); });
  $('btnMatchCancel').addEventListener('click', cancelMatch);
  $('btnQuit').addEventListener('click', () => {
    if (S.phase !== 'over' && S.players.length) {
      const ok = window.confirm('退出当前对局？');
      if (!ok) return;
    }
    goMenu();
  });

  dom.diceConfirm.addEventListener('click', () => {
    if (S.phase === 'fix') submitFix(false);
    else if (S.phase === 'adjust') submitAdjust(false);
  });

  [dom.miniPapers[0], dom.miniPapers[1]].forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (!S.players.length) return;
      if (S.phase === 'over') return;
      if (S.scoreMode && S.scorePlayer === i) {
        openPaper(i, { scoring: true, allowed: S.scoreAllowed, dice: S.finalDice });
        return;
      }
      if (S.scoreMode) return;
      openPaper(i, {});
    });
  });

  dom.paperBody.addEventListener('click', event => {
    const info = event.target.closest('[data-info]');
    if (info) {
      event.stopPropagation();
      openRule(info.getAttribute('data-info'));
      return;
    }
    const row = event.target.closest('.paper-row');
    if (!row || !S.scoreMode) return;
    const key = row.getAttribute('data-key');
    if (key) selectPaperCategory(key);
  });
  dom.paperBody.addEventListener('click', event => {
    if (!S.scoreMode) {
      const row = event.target.closest('.paper-row');
      if (row) openRule(row.getAttribute('data-key'));
    }
  });
  dom.paperConfirm.addEventListener('click', confirmPaper);
  dom.paperClose.addEventListener('click', () => closeOverlay(dom.paperOverlay));
  dom.btnViewTable.addEventListener('click', () => {
    if (!S.scoreMode) return;
    dom.paperOverlay.classList.add('is-peeking');
  });
  dom.btnBackScore.addEventListener('click', () => {
    dom.paperOverlay.classList.remove('is-peeking');
  });
  dom.paperOverlay.addEventListener('click', event => {
    if (event.target !== dom.paperOverlay) return;
    if (S.scoreMode) return;
    closeOverlay(dom.paperOverlay);
  });
  dom.rulePop.addEventListener('click', event => {
    if (event.target === dom.rulePop) closeOverlay(dom.rulePop);
  });
  $('ruleClose').addEventListener('click', () => closeOverlay(dom.rulePop));

  dom.btnAgain.addEventListener('click', () => {
    closeOverlay(dom.resultOverlay);
    if (S.mode === 'tutorial') { goRules(); return; }
    startGame('ai');
  });
  dom.btnResultMenu.addEventListener('click', () => {
    closeOverlay(dom.resultOverlay);
    goMenu();
  });

  window.addEventListener('beforeunload', () => {
    if (!S.roomId) return;
    try {
      const body = new URLSearchParams({
        user: 'computor',
        secret: '58787c39',
        action: 'delete',
        tag: 'timicard_room_' + S.roomId
      });
      fetch('https://tinywebdb.appinventor.space/api', { method: 'POST', body, keepalive: true });
    } catch (err) { /* best effort */ }
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (dom.rulePop.classList.contains('is-open')) closeOverlay(dom.rulePop);
      else if (dom.paperOverlay.classList.contains('is-open') && !S.scoreMode) closeOverlay(dom.paperOverlay);
    }
  });

  /* -------------------------------- debug --------------------------------- */
  window.__game = {
    engine: E,
    state: S,
    startAI() { startGame('ai'); },
    startTutorial,
    snapshot() {
      return {
        screen: S.screen,
        phase: S.phase,
        active: S.active,
        turnNo: S.turnNo,
        tutorialStage: S.tutorialStage,
        dice: S.dice.slice(),
        finalDice: S.finalDice.slice(),
        players: S.players.map(p => ({ name: p.name, card: { ...p.card }, total: p.total, threeFixUsed: p.threeFixUsed })),
        timer: { active: S.timer.active, remaining: currentRemaining() }
      };
    }
  };

  /* --------------------------------- boot --------------------------------- */
  initPlayers();
  if (PREVIEW === 'table') {
    S.mode = 'ai';
    S.phase = 'rolled';
    S.dice = [1, 2, 3, 4, 5];
    showScreen('game');
    renderTableDice(S.dice);
    dom.tableStatus.textContent = '三维骰子演示';
    updateHUD();
    return;
  }
  if (PREVIEW === 'timer') {
    S.mode = 'ai';
    showScreen('game');
    updateHUD();
    renderTableDice([]);
    startTimer(30, () => {});
    return;
  }
  showScreen('menu');
  tickClock();
  setTimeout(() => { cleanupStaleRooms(); }, 1200);

})();
