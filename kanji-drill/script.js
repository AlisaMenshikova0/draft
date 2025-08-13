const DEFAULT_DATA_URL = "./data/n5.json";

const settingsKey = "kanji-drill-settings";
const statsKey = "kanji-drill-stats";

const elements = {
  modeSelect: document.getElementById("modeSelect"),
  contentSelect: document.getElementById("contentSelect"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  resetStatsBtn: document.getElementById("resetStatsBtn"),
  fileInput: document.getElementById("fileInput"),

  prompt: document.getElementById("prompt"),
  subPrompt: document.getElementById("subPrompt"),
  answerForm: document.getElementById("answerForm"),
  answerInput: document.getElementById("answerInput"),
  checkBtn: document.getElementById("checkBtn"),
  revealBtn: document.getElementById("revealBtn"),
  nextBtn: document.getElementById("nextBtn"),
  feedback: document.getElementById("feedback"),
  correctAnswers: document.getElementById("correctAnswers"),

  correctCount: document.getElementById("correctCount"),
  totalCount: document.getElementById("totalCount"),
  accuracy: document.getElementById("accuracy"),
  streak: document.getElementById("streak"),
};

/**
 * State
 */
const state = {
  allCards: [],
  queue: [],
  currentIndex: -1,
  expectedNow: "mixed", // 'reading' | 'meaning' | 'mixed'
  contentFilter: "both", // 'kanji' | 'word' | 'both'
  stats: { correct: 0, total: 0, streak: 0 },
  alreadyChecked: false,
};

/**
 * Utilities
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function saveSettings() {
  const payload = {
    mode: elements.modeSelect.value,
    content: elements.contentSelect.value,
  };
  try { localStorage.setItem(settingsKey, JSON.stringify(payload)); } catch {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(settingsKey);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj.mode) elements.modeSelect.value = obj.mode;
    if (obj.content) elements.contentSelect.value = obj.content;
  } catch {}
}

function saveStats() {
  try { localStorage.setItem(statsKey, JSON.stringify(state.stats)); } catch {}
}

function loadStats() {
  try {
    const raw = localStorage.getItem(statsKey);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (typeof obj.correct === "number") state.stats.correct = obj.correct;
    if (typeof obj.total === "number") state.stats.total = obj.total;
    if (typeof obj.streak === "number") state.stats.streak = obj.streak;
  } catch {}
}

function updateStatsUI() {
  const { correct, total } = state.stats;
  elements.correctCount.textContent = String(correct);
  elements.totalCount.textContent = String(total);
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  elements.accuracy.textContent = String(accuracy);
  elements.streak.textContent = String(state.stats.streak);
}

/**
 * Normalization and checking
 */
function katakanaToHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function toHiraganaFromRomaji(input) {
  // Basic Hepburn; good-enough mapping for drills.
  let s = input.toLowerCase().trim();
  // normalize long vowels: ou -> おう; oo -> おう; uu -> うう (left as-is)
  s = s.replace(/ou/g, "oU").replace(/oo/g, "oU"); // temporary mark U as long-vowel placeholder

  // handle double consonants -> small tsu, except for 'n'
  s = s.replace(/([^aeiou\s\d])\1/g, (m, c) => (c === 'n' ? 'nn' : 'っ' + c));

  // n' before vowels or y
  s = s.replace(/n([aeiouy])/g, "ん$1");
  // terminal n
  s = s.replace(/n$/g, "ん");

  const map = [
    // combined sounds first
    ["kyo","きょ"],["kya","きゃ"],["kyu","きゅ"],
    ["gyo","ぎょ"],["gya","ぎゃ"],["gyu","ぎゅ"],
    ["sho","しょ"],["sha","しゃ"],["shu","しゅ"],
    ["jyo","じょ"],["ja","じゃ"],["ju","じゅ"],["jo","じょ"],["ji","じ"],
    ["cho","ちょ"],["cha","ちゃ"],["chu","ちゅ"],["chi","ち"],
    ["nyo","にょ"],["nya","にゃ"],["nyu","にゅ"],
    ["hyo","ひょ"],["hya","ひゃ"],["hyu","ひゅ"],
    ["myo","みょ"],["mya","みゃ"],["myu","みゅ"],
    ["ryo","りょ"],["rya","りゃ"],["ryu","りゅ"],
    ["pyo","ぴょ"],["pya","ぴゃ"],["pyu","ぴゅ"],
    ["byo","びょ"],["bya","びゃ"],["byu","びゅ"],
    ["tyo","ちょ"],["dyo","ぢょ"],["dyu","ぢゅ"],["dya","ぢゃ"],
    ["tsu","つ"],["dzu","づ"],["du","づ"],
    ["fa","ふぁ"],["fi","ふぃ"],["fu","ふ"],["fe","ふぇ"],["fo","ふぉ"],
  ];
  for (const [ro, hi] of map) {
    s = s.replaceAll(ro, hi);
  }

  const singles = [
    ["a","あ"],["i","い"],["u","う"],["e","え"],["o","お"],
    ["ka","か"],["ki","き"],["ku","く"],["ke","け"],["ko","こ"],
    ["ga","が"],["gi","ぎ"],["gu","ぐ"],["ge","げ"],["go","ご"],
    ["sa","さ"],["si","し"],["su","す"],["se","せ"],["so","そ"],
    ["za","ざ"],["zi","じ"],["zu","ず"],["ze","ぜ"],["zo","ぞ"],
    ["ta","た"],["ti","ち"],["tu","つ"],["te","て"],["to","と"],
    ["da","だ"],["di","ぢ"],["du","づ"],["de","で"],["do","ど"],
    ["na","な"],["ni","に"],["nu","ぬ"],["ne","ね"],["no","の"],
    ["ha","は"],["hi","ひ"],["hu","ふ"],["he","へ"],["ho","ほ"],
    ["ba","ば"],["bi","び"],["bu","ぶ"],["be","べ"],["bo","ぼ"],
    ["pa","ぱ"],["pi","ぴ"],["pu","ぷ"],["pe","ぺ"],["po","ぽ"],
    ["ma","ま"],["mi","み"],["mu","む"],["me","め"],["mo","も"],
    ["ya","や"],["yu","ゆ"],["yo","よ"],
    ["ra","ら"],["ri","り"],["ru","る"],["re","れ"],["ro","ろ"],
    ["wa","わ"],["wi","うぃ"],["we","うぇ"],["wo","を"],
    ["va","ゔぁ"],["vi","ゔぃ"],["vu","ゔ"],["ve","ゔぇ"],["vo","ゔぉ"],
  ];
  for (const [ro, hi] of singles) {
    s = s.replaceAll(ro, hi);
  }

  // restore long 'o' marker to う
  s = s.replace(/U/g, "う");

  // leftover Latin letters become as-is; strip extra spaces
  return s.replace(/\s+/g, "");
}

function normalizeReading(input) {
  if (!input) return "";
  let s = input.trim();
  // normalize width and case
  s = s.normalize("NFKC");
  // convert katakana to hiragana
  s = katakanaToHiragana(s);
  // if contains Latin letters, convert romaji to hiragana
  if (/[A-Za-z]/.test(s)) {
    s = toHiraganaFromRomaji(s);
  }
  // remove spaces and punctuation
  s = s.replace(/[^\p{Script=Hiragana}\p{Script=Han}ー]/gu, "");
  // normalize choonpu: keep as is
  return s;
}

function normalizeMeaning(input) {
  if (!input) return "";
  let s = input.toLowerCase().trim();
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[^a-z0-9\s-]/g, " ");
  s = s.replace(/\b(the|to|a|an)\b/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function canonicalizeExpectedReadings(card) {
  if (card.type === "word") {
    return (card.reading || []).map(r => normalizeReading(r));
  }
  const onyomi = (card.onyomiKana || []).map(katakanaToHiragana).map(normalizeReading);
  const kunyomi = (card.kunyomiKana || []).map(normalizeReading);
  return [...onyomi, ...kunyomi].filter(Boolean);
}

function canonicalizeExpectedMeanings(card) {
  const arr = [
    ...(card.meanings || []),
    ...(card.altMeanings || []),
  ];
  return arr.map(normalizeMeaning).filter(Boolean);
}

function isCorrectReading(input, card) {
  const norm = normalizeReading(input);
  const expected = canonicalizeExpectedReadings(card);
  return expected.includes(norm);
}

function isCorrectMeaning(input, card) {
  const norm = normalizeMeaning(input);
  const expected = canonicalizeExpectedMeanings(card);
  return expected.includes(norm);
}

/**
 * Data loading
 */
async function loadDefaultData() {
  try {
    const res = await fetch(DEFAULT_DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    return json.cards || [];
  } catch (err) {
    console.warn("Failed to load data file, falling back to built-in sample.", err);
    return [
      { id: "kanji-日", type: "kanji", prompt: "日", onyomiKana: ["ニチ","ジツ"], kunyomiKana: ["ひ","び","か"], meanings: ["sun","day"], level: "N5" },
      { id: "kanji-人", type: "kanji", prompt: "人", onyomiKana: ["ジン","ニン"], kunyomiKana: ["ひと"], meanings: ["person","human"], level: "N5" },
      { id: "word-日本", type: "word", prompt: "日本", reading: ["にほん","にっぽん"], meanings: ["japan"], level: "N5" },
      { id: "kanji-大", type: "kanji", prompt: "大", onyomiKana: ["ダイ","タイ"], kunyomiKana: ["おお","おおきい"], meanings: ["big","large"], level: "N5" },
      { id: "word-学生", type: "word", prompt: "学生", reading: ["がくせい"], meanings: ["student"], level: "N5" },
    ];
  }
}

function rebuildQueue() {
  const type = elements.contentSelect.value; // kanji|word|both
  const filtered = state.allCards.filter(c => type === "both" ? true : c.type === type);
  state.queue = shuffle([...filtered]);
  state.currentIndex = -1;
}

function chooseExpectedForCard(card) {
  const mode = elements.modeSelect.value; // reading | meaning | mixed
  if (mode === "mixed") {
    // For kanji: prefer reading ~60% of time; for word: reading ~70%
    if (card.type === "word") {
      return Math.random() < 0.7 ? "reading" : "meaning";
    }
    return Math.random() < 0.6 ? "reading" : "meaning";
  }
  return mode;
}

function renderCard() {
  const card = state.queue[state.currentIndex];
  if (!card) return;
  const expected = chooseExpectedForCard(card);
  state.expectedNow = expected;
  state.alreadyChecked = false;

  elements.prompt.textContent = card.prompt;
  elements.subPrompt.textContent = expected === "reading" ? "Type the reading (かな / romaji)" : "Type the meaning (English)";
  elements.answerInput.value = "";
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback";
  elements.correctAnswers.hidden = true;
  elements.correctAnswers.textContent = "";
  elements.answerInput.focus();
}

function showCorrectAnswers(card) {
  const readings = canonicalizeExpectedReadings(card);
  const meanings = canonicalizeExpectedMeanings(card);
  const readingsDisplay = readings.join("、");
  const meaningsDisplay = meanings.join(", ");
  const lines = [];
  if (readings.length) lines.push(`Reading: ${readingsDisplay}`);
  if (meanings.length) lines.push(`Meaning: ${meaningsDisplay}`);
  elements.correctAnswers.textContent = lines.join(" \u00B7 ");
  elements.correctAnswers.hidden = false;
}

function nextCard() {
  if (state.queue.length === 0) return;
  state.currentIndex = (state.currentIndex + 1) % state.queue.length;
  renderCard();
}

function onCheck() {
  const card = state.queue[state.currentIndex];
  if (!card) return;
  const input = elements.answerInput.value;
  if (!input.trim()) {
    elements.feedback.textContent = "Type an answer";
    elements.feedback.className = "feedback no";
    return;
  }
  const expected = state.expectedNow;
  const ok = expected === "reading" ? isCorrectReading(input, card) : isCorrectMeaning(input, card);
  state.stats.total += 1;
  if (ok) {
    state.stats.correct += 1;
    state.stats.streak += 1;
    elements.feedback.textContent = "Correct!";
    elements.feedback.className = "feedback ok";
    state.alreadyChecked = true;
  } else {
    state.stats.streak = 0;
    elements.feedback.textContent = "Try again";
    elements.feedback.className = "feedback no";
  }
  updateStatsUI();
  saveStats();
}

function onReveal() {
  const card = state.queue[state.currentIndex];
  if (!card) return;
  showCorrectAnswers(card);
}

function onNext() {
  nextCard();
}

function onShuffle() {
  rebuildQueue();
  nextCard();
}

function onResetStats() {
  state.stats = { correct: 0, total: 0, streak: 0 };
  saveStats();
  updateStatsUI();
}

function bindUI() {
  elements.answerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    onCheck();
  });
  elements.revealBtn.addEventListener("click", onReveal);
  elements.nextBtn.addEventListener("click", onNext);
  elements.shuffleBtn.addEventListener("click", onShuffle);
  elements.resetStatsBtn.addEventListener("click", onResetStats);

  elements.modeSelect.addEventListener("change", () => { saveSettings(); renderCard(); });
  elements.contentSelect.addEventListener("change", () => { saveSettings(); rebuildQueue(); nextCard(); });

  elements.fileInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json.cards || !Array.isArray(json.cards)) throw new Error("Invalid dataset: missing 'cards' array");
      // Merge new cards (dedupe by id if provided)
      const incoming = json.cards;
      const seen = new Set(state.allCards.map(c => c.id).filter(Boolean));
      for (const c of incoming) {
        if (c.id && seen.has(c.id)) continue;
        state.allCards.push(c);
        if (c.id) seen.add(c.id);
      }
      rebuildQueue();
      nextCard();
      elements.feedback.textContent = `Loaded ${incoming.length} cards`;
      elements.feedback.className = "feedback ok";
    } catch (err) {
      elements.feedback.textContent = "Failed to load JSON";
      elements.feedback.className = "feedback no";
      console.error(err);
    } finally {
      elements.fileInput.value = "";
    }
  });

  // keyboard helpers
  document.addEventListener("keydown", (e) => {
    if (e.key === " ") { // space reveals
      e.preventDefault();
      onReveal();
    } else if (e.key.toLowerCase() === "n") {
      onNext();
    }
  });
}

async function init() {
  loadSettings();
  loadStats();
  updateStatsUI();

  const cards = await loadDefaultData();
  state.allCards = cards;
  rebuildQueue();
  nextCard();
  bindUI();
}

init();