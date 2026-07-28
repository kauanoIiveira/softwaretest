const firebaseConfig = {
  apiKey: "AIzaSyBUGvHMPXKfovhDeNuo5eOQO-rjzITKC8U",
  authDomain: "testedesoftwaree.firebaseapp.com",
  projectId: "testedesoftwaree",
  storageBucket: "testedesoftwaree.firebasestorage.app",
  messagingSenderId: "543010029681",
  appId: "1:543010029681:web:625ae54d9a22ebb25f9bd0",
  measurementId: "G-YGCB7DSHC3",
  databaseURL: "https://testedesoftwaree-default-rtdb.firebaseio.com"
};

let database = null;
try {
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  database = firebase.database(app);
} catch (error) {
  console.warn("Ranking online indisponível.", error);
}

const gameScores = { quiz: 0, palavras: 0, forca: 0 };
const gameComplete = { quiz: false, palavras: false, forca: false };

function setScoreButtonEnabled(game, enabled) {
  const button = document.querySelector(`[data-submit-score="${game}"]`);
  if (button) button.disabled = !enabled;
}

function normaliseName(name) {
  return name.trim().replace(/\s+/g, " ").slice(0, 18);
}

function localRanking(game) {
  try { return JSON.parse(localStorage.getItem(`testes-ranking-${game}`)) || []; }
  catch { return []; }
}

function renderRanking(game, entries) {
  const list = document.getElementById(`${game}-ranking`);
  const empty = list.parentElement.querySelector(".empty");
  const best = entries.sort((a, b) => b.score - a.score).slice(0, 5);
  list.innerHTML = "";
  best.forEach(entry => {
    const item = document.createElement("li");
    item.textContent = `${entry.name}  ${entry.score} pts`;
    list.appendChild(item);
  });
  empty.style.display = best.length ? "none" : "block";
}

function setRankingSource(game, source) {
  document.getElementById(`${game}-ranking`).closest(".ranking").dataset.source = source;
}

function loadRanking(game) {
  if (!database) {
    setRankingSource(game, "local");
    renderRanking(game, localRanking(game));
    return;
  }
  database.ref(`rankings/${game}`).on("value", snapshot => {
    setRankingSource(game, "online");
    renderRanking(game, Object.values(snapshot.val() || {}));
  }, () => {
    setRankingSource(game, "local");
    renderRanking(game, localRanking(game));
  });
}

async function saveScore(game) {
  const input = document.getElementById(`${game === "palavras" ? "word" : game === "forca" ? "hang" : game}-name`);
  const feedback = document.getElementById(`${game === "palavras" ? "word" : game === "forca" ? "hang" : game}-feedback`);
  const name = normaliseName(input.value);
  if (!gameComplete[game]) {
    feedback.textContent = "Conclua a atividade antes de salvar a pontuação.";
    return;
  }
  if (!name) {
    feedback.textContent = "Digite seu nome para entrar no ranking.";
    input.focus();
    return;
  }
  const entry = { name, score: gameScores[game], createdAt: Date.now() };
  try {
    if (!database) throw new Error("Firebase não iniciado");
    await database.ref(`rankings/${game}`).push(entry);
    setRankingSource(game, "online");
    feedback.textContent = "Pontuação salva no ranking online.";
    setScoreButtonEnabled(game, false);
  } catch (error) {
    const entries = localRanking(game);
    entries.push(entry);
    localStorage.setItem(`testes-ranking-${game}`, JSON.stringify(entries));
    setRankingSource(game, "local");
    renderRanking(game, entries);
    feedback.textContent = "Pontuação salva neste navegador. O ranking online está indisponível.";
    setScoreButtonEnabled(game, false);
  }
}

document.querySelectorAll("[data-submit-score]").forEach(button => {
  button.addEventListener("click", () => saveScore(button.dataset.submitScore));
});

const WORD_SIZE = 12;
const wordTargets = ["TESTE", "INTEGRACAO", "UNITARIO", "CARGA", "SEGURANCA", "REGRESSAO", "SISTEMA", "ACEITACAO", "DEFEITO", "FUNCAO"];
const wordDirections = ["h", "v", "h", "v", "h", "v", "h", "v", "h", "v"];
let wordStart = null;
let wordBoard = [];
const wordPaths = new Map();
const foundWords = new Set();

function wordCell(row, col) {
  return document.querySelector(`.word-cell[data-row="${row}"][data-col="${col}"]`);
}

function placeWord(word, direction) {
  const vertical = direction === "v";
  for (let attempt = 0; attempt < 500; attempt++) {
    const row = Math.floor(Math.random() * (vertical ? WORD_SIZE - word.length + 1 : WORD_SIZE));
    const col = Math.floor(Math.random() * (vertical ? WORD_SIZE : WORD_SIZE - word.length + 1));
    const cells = [...word].map((letter, index) => ({
      row: row + (vertical ? index : 0), col: col + (vertical ? 0 : index), letter
    }));
    if (cells.every(cell => !wordBoard[cell.row][cell.col] || wordBoard[cell.row][cell.col] === cell.letter)) {
      cells.forEach(cell => { wordBoard[cell.row][cell.col] = cell.letter; });
      wordPaths.set(word, { cells, direction });
      return true;
    }
  }
  return false;
}

function makeWordBoard() {
  wordBoard = Array.from({ length: WORD_SIZE }, () => Array(WORD_SIZE).fill(""));
  wordPaths.clear();
  wordTargets.forEach((word, index) => {
    const preferred = wordDirections[index];
    if (!placeWord(word, preferred) && !placeWord(word, preferred === "h" ? "v" : "h")) {
      throw new Error(`Não foi possível posicionar ${word}.`);
    }
  });
  wordBoard.forEach(row => row.forEach((letter, index) => {
    if (!letter) row[index] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  }));
}

function buildWordGame() {
  const board = document.getElementById("word-board");
  const list = document.getElementById("word-list");
  wordStart = null;
  foundWords.clear();
  gameComplete.palavras = false;
  gameScores.palavras = 0;
  setScoreButtonEnabled("palavras", false);
  makeWordBoard();
  board.innerHTML = "";
  list.innerHTML = "";
  wordTargets.forEach(word => {
    const path = wordPaths.get(word);
    const chip = document.createElement("span");
    chip.className = "word-chip";
    chip.dataset.word = word;
    chip.dataset.direction = path.direction;
    chip.dataset.startRow = path.cells[0].row;
    chip.dataset.startCol = path.cells[0].col;
    chip.dataset.endRow = path.cells[path.cells.length - 1].row;
    chip.dataset.endCol = path.cells[path.cells.length - 1].col;
    chip.setAttribute("aria-label", `${word}, ${path.direction === "h" ? "horizontal" : "vertical"}`);
    chip.innerHTML = `${word}<small>${path.direction === "h" ? "horizontal" : "vertical"}</small>`;
    list.appendChild(chip);
  });
  wordBoard.forEach((row, rowIndex) => row.forEach((letter, colIndex) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "word-cell";
    cell.dataset.row = rowIndex;
    cell.dataset.col = colIndex;
    cell.textContent = letter;
    cell.setAttribute("aria-label", `Linha ${rowIndex + 1}, coluna ${colIndex + 1}, letra ${letter}`);
    cell.addEventListener("click", () => chooseWordCell(rowIndex, colIndex));
    board.appendChild(cell);
  }));
}

function samePath(selected, path) {
  const direct = selected.every((cell, index) => cell.row === path[index].row && cell.col === path[index].col);
  const reversed = selected.every((cell, index) => cell.row === path[path.length - 1 - index].row && cell.col === path[path.length - 1 - index].col);
  return direct || reversed;
}

function chooseWordCell(row, col) {
  const status = document.getElementById("word-status");
  if (!wordStart) {
    wordStart = { row, col };
    wordCell(row, col).classList.add("selected");
    status.textContent = "Selecione agora a última letra.";
    return;
  }
  const start = wordStart;
  document.querySelectorAll(".word-cell.selected").forEach(cell => cell.classList.remove("selected"));
  wordStart = null;
  const rowStep = row === start.row ? 0 : Math.sign(row - start.row);
  const colStep = col === start.col ? 0 : Math.sign(col - start.col);
  if ((rowStep && colStep) || (!rowStep && !colStep)) {
    status.textContent = "A seleção deve ficar na horizontal ou vertical.";
    return;
  }
  const length = Math.max(Math.abs(row - start.row), Math.abs(col - start.col)) + 1;
  const selected = Array.from({ length }, (_, index) => ({ row: start.row + rowStep * index, col: start.col + colStep * index }));
  const word = wordTargets.find(target => !foundWords.has(target) && selected.length === target.length && samePath(selected, wordPaths.get(target).cells));
  if (!word) {
    status.textContent = "A sequência não corresponde a um termo pendente.";
    return;
  }
  foundWords.add(word);
  selected.forEach(cell => wordCell(cell.row, cell.col).classList.add("found"));
  document.querySelector(`.word-chip[data-word="${word}"]`).classList.add("found");
  gameScores.palavras = foundWords.size * 100;
  status.textContent = `${word} encontrado: ${foundWords.size} de ${wordTargets.length}.`;
  if (foundWords.size === wordTargets.length) {
    gameComplete.palavras = true;
    setScoreButtonEnabled("palavras", true);
    status.textContent = `Tabuleiro completo. Você fez ${gameScores.palavras} pontos.`;
  }
}

const hangWords = [
  { word: "REGRESSAO", hint: "Teste que verifica se uma alteração quebrou algo que funcionava." },
  { word: "INTEGRACAO", hint: "Teste que verifica se módulos funcionam juntos." },
  { word: "SEGURANCA", hint: "Teste que procura vulnerabilidades e exposição de dados." },
  { word: "UNITARIO", hint: "Teste de uma função ou parte pequena do código." }
];
let hangState = null;

function startHangman() {
  const item = hangWords[Math.floor(Math.random() * hangWords.length)];
  hangState = { ...item, guessed: new Set(), wrong: 0, finished: false };
  gameComplete.forca = false;
  gameScores.forca = 0;
  setScoreButtonEnabled("forca", false);
  document.getElementById("hang-feedback").textContent = "";
  renderHangman();
}

function renderHangman() {
  document.getElementById("hang-hint").textContent = `Pista: ${hangState.hint}`;
  document.getElementById("hang-word").textContent = [...hangState.word].map(letter => hangState.guessed.has(letter) ? letter : "_").join(" ");
  document.getElementById("hang-status").textContent = hangState.finished ? document.getElementById("hang-status").textContent : `Erros: ${hangState.wrong} de 6`;
  document.querySelectorAll(".hang-piece").forEach((piece, index) => piece.classList.toggle("show", index < hangState.wrong));
  const keypad = document.getElementById("hang-keypad");
  keypad.innerHTML = "";
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(letter => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = letter;
    button.disabled = hangState.guessed.has(letter) || hangState.finished;
    button.addEventListener("click", () => guessLetter(letter));
    keypad.appendChild(button);
  });
}

function guessLetter(letter) {
  hangState.guessed.add(letter);
  if (!hangState.word.includes(letter)) hangState.wrong++;
  const solved = [...hangState.word].every(character => hangState.guessed.has(character));
  const status = document.getElementById("hang-status");
  if (solved) {
    hangState.finished = true;
    gameComplete.forca = true;
    gameScores.forca = Math.max(80, 200 - hangState.wrong * 20);
    setScoreButtonEnabled("forca", true);
    status.textContent = `Palavra resolvida. Você fez ${gameScores.forca} pontos.`;
  } else if (hangState.wrong >= 6) {
    hangState.finished = true;
    status.textContent = `Fim de jogo. A palavra era ${hangState.word}.`;
  }
  renderHangman();
}

buildWordGame();
document.getElementById("hang-reset").addEventListener("click", startHangman);
startHangman();

// ---------- Nav scroll-spy ----------
const sections = document.querySelectorAll('main section[id]');
const navLinks = document.querySelectorAll('#nav a');

const spyObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const id = entry.target.getAttribute('id');
    const link = document.querySelector(`#nav a[href="#${id}"]`);
    if (entry.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      if (link) link.classList.add('active');
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });

sections.forEach(s => spyObserver.observe(s));

// ---------- Reveal on scroll ----------
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

sections.forEach(s => revealObserver.observe(s));

// ---------- Quiz ----------
const questions = [
  {
    question: "O que define um teste de software?",
    answers: [
      { text: "Executar o sistema e comparar o resultado com o esperado", correct: true },
      { text: "Escrever a documentação somente depois da entrega", correct: false },
      { text: "Publicar a versão e esperar relatos dos usuários", correct: false }
    ]
  },
  {
    question: "Qual é um objetivo direto dos testes?",
    answers: [
      { text: "Encontrar defeitos antes da publicação", correct: true },
      { text: "Eliminar a necessidade de manutenção", correct: false },
      { text: "Garantir que toda alteração seja aprovada", correct: false }
    ]
  },
  {
    question: "O que é um defeito, também chamado de bug?",
    answers: [
      { text: "Um problema no código, na interface ou na regra de negócio", correct: true },
      { text: "Um caso de teste executado sem falhas", correct: false },
      { text: "Um pedido de nova funcionalidade", correct: false }
    ]
  },
  {
    question: "Qual teste verifica partes pequenas do código?",
    answers: [
      { text: "Teste unitário", correct: true },
      { text: "Teste de integração", correct: false },
      { text: "Teste de sistema", correct: false }
    ]
  },
  {
    question: "Qual teste verifica a troca de dados entre módulos?",
    answers: [
      { text: "Teste de integração", correct: true },
      { text: "Teste unitário", correct: false },
      { text: "Teste de aceitação", correct: false }
    ]
  },
  {
    question: "Por que um defeito encontrado cedo costuma custar menos?",
    answers: [
      { text: "A equipe ainda conhece a alteração e evita retrabalho após a publicação", correct: true },
      { text: "Os testes substituem a revisão do código", correct: false },
      { text: "A equipe deixa de registrar os defeitos", correct: false }
    ]
  },
  {
    question: "Qual teste simula muitos acessos ao mesmo tempo?",
    answers: [
      { text: "Teste de carga", correct: true },
      { text: "Teste de segurança", correct: false },
      { text: "Teste de usabilidade", correct: false }
    ]
  },
  {
    question: "Qual teste observa se o usuário entende a interface?",
    answers: [
      { text: "Teste de usabilidade", correct: true },
      { text: "Teste de desempenho", correct: false },
      { text: "Teste de regressão", correct: false }
    ]
  },
  {
    question: "O que aconteceu com o FBI Virtual Case File?",
    answers: [
      { text: "O FBI encerrou o projeto após encontrar centenas de problemas", correct: true },
      { text: "O FBI colocou o sistema em operação sem alterações", correct: false },
      { text: "O sistema substituiu todos os arquivos físicos no prazo", correct: false }
    ]
  },
  {
    question: "Qual afirmação sobre testes está correta?",
    answers: [
      { text: "Os testes fornecem evidências e reduzem o risco da publicação", correct: true },
      { text: "Os testes garantem que o sistema nunca terá defeitos", correct: false },
      { text: "A equipe só deve testar depois que o sistema estiver no ar", correct: false }
    ]
  }
];

// shuffle helper (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const questionElement = document.getElementById("question");
const optionsElement = document.getElementById("options");
const nextButton = document.getElementById("next-btn");
const quizBody = document.getElementById("quiz-body");
const resultContainer = document.getElementById("result-container");
const scoreElement = document.getElementById("score");
const scoreMsgElement = document.getElementById("score-msg");
const scoreEmojiElement = document.getElementById("score-emoji");
const restartButton = document.getElementById("restart-btn");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("quiz-progress-label");

let currentQuestionIndex = 0;
let score = 0;
let runQuestions = [];

function startQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  gameComplete.quiz = false;
  gameScores.quiz = 0;
  setScoreButtonEnabled("quiz", false);
  runQuestions = shuffle(questions);
  resultContainer.style.display = "none";
  quizBody.style.display = "block";
  showQuestion();
}

function showQuestion() {
  resetState();
  const total = runQuestions.length;
  progressLabel.textContent = `Pergunta ${currentQuestionIndex + 1} de ${total}`;
  progressFill.style.width = `${(currentQuestionIndex / total) * 100}%`;

  let currentQuestion = runQuestions[currentQuestionIndex];
  questionElement.innerText = `${currentQuestionIndex + 1}. ${currentQuestion.question}`;

  const shuffledAnswers = shuffle(currentQuestion.answers);
  shuffledAnswers.forEach(answer => {
    const button = document.createElement("button");
    button.innerText = answer.text;
    button.classList.add("btn-option");
    if (answer.correct) button.dataset.correct = "true";
    button.addEventListener("click", selectAnswer);
    optionsElement.appendChild(button);
  });
}

function resetState() {
  nextButton.style.display = "none";
  while (optionsElement.firstChild) {
    optionsElement.removeChild(optionsElement.firstChild);
  }
}

function selectAnswer(e) {
  const selectedBtn = e.target;
  const isCorrect = selectedBtn.dataset.correct === "true";

  if (isCorrect) {
    selectedBtn.classList.add("correct");
    score++;
  } else {
    selectedBtn.classList.add("incorrect");
  }

  Array.from(optionsElement.children).forEach(button => {
    if (button.dataset.correct === "true") button.classList.add("correct");
    button.disabled = true;
  });

  const total = runQuestions.length;
  if (currentQuestionIndex < total - 1) {
    nextButton.style.display = "block";
  } else {
    progressFill.style.width = "100%";
    setTimeout(showScore, 900);
  }
}

function showScore() {
  quizBody.style.display = "none";
  resultContainer.style.display = "block";
  const total = runQuestions.length;
  const pct = score / total;
  gameScores.quiz = score * 100;
  gameComplete.quiz = true;
  setScoreButtonEnabled("quiz", true);

  scoreElement.innerText = `Você acertou ${score} de ${total} perguntas!`;

  scoreEmojiElement.textContent = "RESULTADO";
  if (pct === 1) {
    scoreMsgElement.textContent = "Você acertou todas as perguntas.";
  } else if (pct >= 0.7) {
    scoreMsgElement.textContent = "Você acertou a maior parte. Revise as respostas marcadas como erradas.";
  } else if (pct >= 0.4) {
    scoreMsgElement.textContent = "Releia os tipos de teste e os casos reais antes de refazer.";
  } else {
    scoreMsgElement.textContent = "Comece pelas seções Conceito e Por que testar e depois refaça o quiz.";
  }
}

nextButton.addEventListener("click", () => {
  currentQuestionIndex++;
  showQuestion();
});

restartButton.addEventListener("click", startQuiz);

["quiz", "palavras", "forca"].forEach(loadRanking);
lucide.createIcons();
startQuiz();
