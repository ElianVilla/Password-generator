const passwordInput = document.getElementById('passwordInput');
const toggleVisibility = document.getElementById('toggleVisibility');
const lengthSlider = document.getElementById('lengthSlider');
const lengthDisplay = document.getElementById('lengthDisplay');
const includeLowercase = document.getElementById('includeLowercase');
const includeUppercase = document.getElementById('includeUppercase');
const includeNumbers = document.getElementById('includeNumbers');
const includeSymbols = document.getElementById('includeSymbols');
const generateBtn = document.getElementById('generateBtn');
const copyBtn = document.getElementById('copyBtn');
const generatorFeedback = document.getElementById('generatorFeedback');
const meterFill = document.getElementById('meterFill');
const strengthLabel = document.getElementById('strengthLabel');
const strengthScore = document.getElementById('strengthScore');
const strengthDescription = document.getElementById('strengthDescription');
const issuesList = document.getElementById('issuesList');
const recommendationsList = document.getElementById('recommendationsList');
const breachStatus = document.getElementById('breachStatus');
const breachCounter = document.getElementById('breachCounter');
const downloadQrButton = document.getElementById('downloadQr');
const qrContainer = document.getElementById('qrContainer');
const bruteTargets = {
  cpu: { time: document.getElementById('cpuTime'), bar: document.getElementById('cpuBar'), rate: 1e7 },
  gpu: { time: document.getElementById('gpuTime'), bar: document.getElementById('gpuBar'), rate: 1e9 },
  distributed: { time: document.getElementById('distributedTime'), bar: document.getElementById('distributedBar'), rate: 1e12 }
};

const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

let breachTimer;
let breachAbortController;
let qrInstance;

const generatorToggles = [includeLowercase, includeUppercase, includeNumbers, includeSymbols].filter(Boolean);
const keyboardPatterns = ['qwerty', 'asdf', 'zxcv', '1q2w3e', 'qaz', 'wsx', 'wasd'];
const commonWords = [
  'password', 'contraseña', 'admin', 'welcome', 'dragon', 'monkey', 'football', 'baseball', 'iloveyou',
  'qwerty', 'abc123', 'letmein', 'master', 'princess', 'azerty', 'clave', 'security', 'pass', 'login'
];
const strengthLevels = [
  { label: 'Muy débil', min: 0, color: 'var(--color-danger)', description: 'Introduce una contraseña para comenzar el análisis.' },
  { label: 'Débil', min: 20, color: 'var(--color-warning)', description: 'Demasiado corta o predecible. Añade longitud y variedad.' },
  { label: 'Media', min: 40, color: 'var(--color-caution)', description: 'Aceptable, pero puede reforzarse con más símbolos y longitud.' },
  { label: 'Fuerte', min: 65, color: 'var(--color-strong)', description: 'Una contraseña sólida que resiste ataques comunes.' },
  { label: 'Muy fuerte', min: 85, color: 'var(--color-ultra)', description: 'Excelente. Presenta gran entropía y complejidad.' }
];

const textEncoder = new TextEncoder();

init();

function init() {
  setupTabs();
  setupGenerator();
  setupPasswordField();
  setupQrModule();
  updateInsights('');
  updateStrength('');
  updateBruteForce('');
  updateCopyState('');
}

function setupTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.target;
      activateTab(targetId, button);
    });
  });
}

function activateTab(targetId, button) {
  tabButtons.forEach((tab) => {
    const isActive = tab === button;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  tabPanels.forEach((panel) => {
    const show = panel.id === targetId;
    panel.classList.toggle('active', show);
    panel.toggleAttribute('hidden', !show);
  });
}

function setupPasswordField() {
  passwordInput.addEventListener('input', (event) => {
    const password = event.target.value;
    updateStrength(password);
    updateInsights(password);
    scheduleBreachCheck(password);
    updateQr(password);
    updateBruteForce(password);
    updateCopyState(password);
  });

  toggleVisibility.addEventListener('click', () => {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    toggleVisibility.classList.toggle('is-active', !showing);
    toggleVisibility.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
  });
}

function setupGenerator() {
  if (!lengthSlider || !lengthDisplay || !generateBtn) {
    return;
  }

  lengthDisplay.textContent = lengthSlider.value;
  lengthSlider.addEventListener('input', () => {
    lengthDisplay.textContent = lengthSlider.value;
  });

  generatorToggles.forEach((toggle) => {
    toggle.addEventListener('change', updateGeneratorAvailability);
  });

  updateGeneratorAvailability();

  generateBtn.addEventListener('click', () => {
    const length = Number(lengthSlider.value);
    const sets = getActiveCharSets();

    if (sets.length === 0) {
      setGeneratorFeedback('Selecciona al menos un grupo de caracteres para generar una contraseña.', 'warn');
      return;
    }

    const password = buildPassword(length, sets);
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    setGeneratorFeedback('Nueva contraseña generada y lista para analizar.', 'success');
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const value = passwordInput.value;
      if (!value) {
        setGeneratorFeedback('No hay contraseña para copiar. Escribe o genera una primero.', 'warn');
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        setGeneratorFeedback('Contraseña copiada al portapapeles.', 'success');
      } catch (error) {
        setGeneratorFeedback('No se pudo copiar automáticamente, intenta hacerlo manualmente.', 'error');
      }
    });
  }
}

function updateGeneratorAvailability() {
  if (!generateBtn) return;
  const available = generatorToggles.some((toggle) => toggle.checked);
  generateBtn.disabled = !available;
  if (!available) {
    setGeneratorFeedback('Activa al menos una opción de caracteres para generar contraseñas seguras.', 'warn');
  } else if (generatorFeedback) {
    generatorFeedback.textContent = '';
    generatorFeedback.className = 'generator-feedback';
  }
}

function getActiveCharSets() {
  const sets = [];
  if (includeLowercase?.checked) {
    sets.push({ key: 'lowercase', chars: 'abcdefghijklmnopqrstuvwxyz' });
  }
  if (includeUppercase?.checked) {
    sets.push({ key: 'uppercase', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' });
  }
  if (includeNumbers?.checked) {
    sets.push({ key: 'numbers', chars: '0123456789' });
  }
  if (includeSymbols?.checked) {
    sets.push({ key: 'symbols', chars: "!@#$%^&*()-_=+[]{}<>?/|~.,:;'\"`" });
  }
  return sets;
}

function buildPassword(length, sets) {
  const pool = sets.map((set) => set.chars).join('');
  if (!pool) return '';

  const characters = [];

  sets.forEach((set) => {
    characters.push(pickRandomChar(set.chars));
  });

  for (let i = characters.length; i < length; i += 1) {
    characters.push(pickRandomChar(pool));
  }

  shuffleArray(characters);
  return characters.join('').slice(0, length);
}

function pickRandomChar(source) {
  if (!source.length) return '';
  const index = secureRandomIndex(source.length);
  return source.charAt(index);
}

function secureRandomIndex(length) {
  if (length <= 0) return 0;
  const maxUint = 0xffffffff;
  const limit = Math.floor((maxUint + 1) / length) * length;
  const random = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(random);
    value = random[0];
  } while (value >= limit);
  return value % length;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = secureRandomIndex(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function setGeneratorFeedback(message, type) {
  if (!generatorFeedback) return;
  generatorFeedback.textContent = message;
  generatorFeedback.className = `generator-feedback feedback-${type}`;
}

function updateCopyState(password) {
  if (!copyBtn) return;
  copyBtn.disabled = !password;
}

function updateStrength(password) {
  if (!password) {
    meterFill.style.width = '0%';
    meterFill.style.setProperty('--meter-color', 'var(--color-surface-muted)');
    strengthLabel.textContent = strengthLevels[0].label;
    strengthScore.textContent = '0 / 100';
    strengthDescription.textContent = strengthLevels[0].description;
    return;
  }

  const evaluation = evaluatePassword(password);
  const score = Math.round(evaluation.score);
  const level = strengthLevels.reduce((acc, level) => (score >= level.min ? level : acc), strengthLevels[0]);
  const easedWidth = Math.max(8, score);

  meterFill.style.width = `${Math.min(100, easedWidth)}%`;
  meterFill.style.setProperty('--meter-color', level.color);
  strengthLabel.textContent = level.label;
  strengthScore.textContent = `${score} / 100`;
  strengthDescription.textContent = evaluation.description || level.description;
}

function evaluatePassword(password) {
  const length = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^\w\s]/.test(password);
  const categories = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;

  let charsetSize = 0;
  if (hasLower) charsetSize += 26;
  if (hasUpper) charsetSize += 26;
  if (hasNumber) charsetSize += 10;
  if (hasSymbol) charsetSize += 33;
  if (/\s/.test(password)) charsetSize += 1;
  charsetSize = Math.max(charsetSize, 1);

  const entropy = length * Math.log2(charsetSize);

  const patterns = detectPatterns(password);
  const patternPenalty = patterns.penalty;

  const lengthScore = Math.min(30, length * 3);
  const varietyScore = Math.min(28, categories * 7);
  const entropyScore = Math.min(30, entropy);
  const bonus = length >= 16 ? 5 : 0;

  let score = lengthScore + varietyScore + entropyScore + bonus - patternPenalty;
  score = Math.min(100, Math.max(0, score));

  let description;
  if (patterns.flags.length > 0) {
    description = 'Se detectaron patrones que reducen la fortaleza: ' + patterns.flags.join(', ') + '.';
  } else if (entropy < 40) {
    description = 'Incrementa la entropía añadiendo más longitud y símbolos inesperados.';
  } else if (categories < 3) {
    description = 'Combina mayúsculas, minúsculas, números y símbolos para más resistencia.';
  } else if (length < 12) {
    description = 'Una contraseña más larga siempre ofrece una defensa superior.';
  } else {
    description = 'Tu contraseña presenta buena diversidad y sin patrones evidentes.';
  }

  return { score, description };
}

function detectPatterns(password) {
  const lower = password.toLowerCase();
  const flags = [];
  let penalty = 0;

  if (/(.)\1{2,}/.test(password)) {
    flags.push('repeticiones consecutivas');
    penalty += 12;
  }

  if (hasSequentialPattern(lower)) {
    flags.push('secuencias previsibles');
    penalty += 15;
  }

  if (keyboardPatterns.some((pattern) => lower.includes(pattern))) {
    flags.push('patrones de teclado');
    penalty += 18;
  }

  if (detectCommonWord(lower)) {
    flags.push('palabras comunes');
    penalty += 20;
  }

  if (/(19|20)\d{2}/.test(password)) {
    flags.push('fechas típicas');
    penalty += 10;
  }

  if (looksLikeSubstitution(lower)) {
    flags.push('sustituciones predecibles');
    penalty += 12;
  }

  return { flags, penalty };
}

function hasSequentialPattern(text) {
  const sequences = ['abcdefghijklmnopqrstuvwxyz', '0123456789'];
  return sequences.some((sequence) => containsSequence(text, sequence) || containsSequence(text, reverse(sequence)));
}

function containsSequence(text, sequence) {
  for (let i = 0; i < sequence.length - 3; i += 1) {
    const chunk = sequence.slice(i, i + 4);
    if (text.includes(chunk)) {
      return true;
    }
  }
  return false;
}

function reverse(text) {
  return text.split('').reverse().join('');
}

function detectCommonWord(lower) {
  return commonWords.some((word) => lower.includes(word));
}

function looksLikeSubstitution(lower) {
  const normalized = lower
    .replace(/[0@]/g, 'o')
    .replace(/[1!|l]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[8]/g, 'b');
  return detectCommonWord(normalized);
}

function updateInsights(password) {
  const insights = analysePassword(password);
  renderIssues(insights.issues);
  renderRecommendations(insights.recommendations);
}

function analysePassword(password) {
  if (!password) {
    return {
      issues: [{ title: 'Esperando contraseña', message: 'Introduce una contraseña para evaluar patrones de riesgo.', severity: 'info' }],
      recommendations: [
        { title: 'Empieza a escribir', message: 'Cada caracter ayuda al sistema a ofrecer recomendaciones personalizadas.', severity: 'tip' }
      ]
    };
  }

  const issues = [];
  const recommendations = new Map();
  const lower = password.toLowerCase();

  if (/(.)\1{2,}/.test(password)) {
    issues.push({
      title: 'Repeticiones consecutivas',
      message: 'Secuencias como "' + password.match(/(.)\1{2,}/)[0] + '" son fáciles de adivinar.',
      severity: 'high'
    });
    recommendations.set('symbols', {
      title: 'Introduce símbolos',
      message: 'Agrega símbolos y mezcla más caracteres para romper las repeticiones.',
      severity: 'tip'
    });
  }

  if (hasSequentialPattern(lower)) {
    issues.push({
      title: 'Secuencias detectadas',
      message: 'Evita cadenas continuas como abcd o 1234 que los atacantes prueban primero.',
      severity: 'medium'
    });
    recommendations.set('keyboard', {
      title: 'Evita secuencias predecibles',
      message: 'Rompe los patrones añadiendo saltos, mayúsculas y símbolos inesperados.',
      severity: 'tip'
    });
  }

  const keyboardHit = keyboardPatterns.find((pattern) => lower.includes(pattern));
  if (keyboardHit) {
    issues.push({
      title: 'Patrón de teclado',
      message: 'El patrón "' + keyboardHit + '" aparece con frecuencia en contraseñas filtradas.',
      severity: 'high'
    });
    recommendations.set('avoidKeyboard', {
      title: 'Evita patrones del teclado',
      message: 'Cambia la disposición de las teclas por un orden impredecible.',
      severity: 'tip'
    });
  }

  if (detectCommonWord(lower)) {
    issues.push({
      title: 'Palabra común encontrada',
      message: 'Las palabras de uso cotidiano reducen drásticamente la entropía.',
      severity: 'high'
    });
    recommendations.set('length', {
      title: 'Hazla más larga',
      message: 'Añade prefijos o sufijos únicos para alejarte de palabras comunes.',
      severity: 'tip'
    });
  }

  if (/(19|20)\d{2}/.test(password)) {
    issues.push({
      title: 'Posible fecha detectada',
      message: 'Los años como 1999 o 2024 son patrones que los atacantes prueban primero.',
      severity: 'medium'
    });
    recommendations.set('avoidDates', {
      title: 'Evita fechas obvias',
      message: 'Sustituye fechas significativas por combinaciones sin relación personal.',
      severity: 'tip'
    });
  }

  if (looksLikeSubstitution(lower)) {
    issues.push({
      title: 'Sustitución predecible',
      message: 'Cambios como "a" por "4" o "o" por "0" son ampliamente conocidos.',
      severity: 'medium'
    });
    recommendations.set('randomize', {
      title: 'Refuerza la aleatoriedad',
      message: 'Mezcla letras, números y símbolos sin depender de sustituciones típicas.',
      severity: 'tip'
    });
  }

  if (issues.length === 0) {
    issues.push({
      title: 'Sin patrones críticos',
      message: 'No se detectaron patrones obvios. Mantén la contraseña única y privada.',
      severity: 'success'
    });
  }

  const hasSymbols = /[^\w\s]/.test(password);
  const categories = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].reduce((count, regex) => (regex.test(password) ? count + 1 : count), 0);

  if (!hasSymbols) {
    recommendations.set('addSymbols', {
      title: 'Agrega símbolos para aumentar entropía',
      message: 'Integra caracteres como % $ # _ para ampliar el espacio de búsqueda.',
      severity: 'tip'
    });
  }

  if (categories < 3) {
    recommendations.set('mixTypes', {
      title: 'Combina más tipos de caracteres',
      message: 'Usa mayúsculas, minúsculas, números y símbolos para complicar el ataque.',
      severity: 'tip'
    });
  }

  if (password.length < 16) {
    recommendations.set('longer', {
      title: 'Una contraseña más larga siempre es más segura',
      message: 'Apunta a 16 caracteres o más para dificultar los ataques por fuerza bruta.',
      severity: 'tip'
    });
  }

  if (issues.some((issue) => issue.severity === 'high')) {
    recommendations.set('reset', {
      title: 'Considera regenerarla',
      message: 'Si la contraseña protege activos críticos, crea una nueva desde cero.',
      severity: 'alert'
    });
  }

  return { issues, recommendations: Array.from(recommendations.values()) };
}

function renderIssues(issues) {
  issuesList.innerHTML = '';
  issues.forEach((issue) => {
    const item = document.createElement('article');
    item.className = `info-card severity-${issue.severity}`;
    item.setAttribute('role', 'listitem');

    const title = document.createElement('h3');
    title.textContent = issue.title;

    const message = document.createElement('p');
    message.textContent = issue.message;

    item.appendChild(title);
    item.appendChild(message);
    issuesList.appendChild(item);
  });
}

function renderRecommendations(recommendations) {
  recommendationsList.innerHTML = '';
  if (recommendations.length === 0) {
    recommendationsList.innerHTML = '<p class="placeholder">Todo en orden. Continúa manteniendo buenas prácticas.</p>';
    return;
  }

  recommendations.forEach((recommendation) => {
    const item = document.createElement('article');
    item.className = `info-card recommendation severity-${recommendation.severity}`;
    item.setAttribute('role', 'listitem');

    const title = document.createElement('h3');
    title.textContent = recommendation.title;

    const message = document.createElement('p');
    message.textContent = recommendation.message;

    item.appendChild(title);
    item.appendChild(message);
    recommendationsList.appendChild(item);
  });
}

function scheduleBreachCheck(password) {
  if (breachTimer) {
    clearTimeout(breachTimer);
  }
  if (breachAbortController) {
    breachAbortController.abort();
  }

  if (!password) {
    breachStatus.textContent = 'Introduce una contraseña para comprobar si ha aparecido en filtraciones conocidas.';
    breachCounter.textContent = '';
    return;
  }

  breachStatus.innerHTML = '<span class="spinner" aria-hidden="true"></span> Consultando bases de datos cifradas...';
  breachCounter.textContent = '';

  breachTimer = setTimeout(async () => {
    try {
      await performBreachCheck(password);
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      breachStatus.textContent = 'No fue posible contactar con el servicio en este momento.';
    }
  }, 600);
}

async function performBreachCheck(password) {
  const hash = await sha1(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  breachAbortController = new AbortController();
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
    signal: breachAbortController.signal
  });

  if (!response.ok) {
    throw new Error('HIBP request failed');
  }

  const text = await response.text();
  const match = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith(suffix));

  if (match) {
    const [, count] = match.split(':');
    breachStatus.textContent = '⚠️ Esta contraseña ha aparecido en filtraciones conocidas.';
    breachCounter.textContent = `Veces encontradas: ${Number(count).toLocaleString('es-ES')}`;
  } else {
    breachStatus.textContent = '✅ No se encontraron coincidencias en la base de datos consultada.';
    breachCounter.textContent = '';
  }

  breachAbortController = undefined;
}

async function sha1(message) {
  const data = textEncoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function setupQrModule() {
  if (typeof QRCode === 'undefined') {
    return;
  }

  qrInstance = new QRCode(qrContainer, {
    text: ' ',
    width: 200,
    height: 200,
    colorDark: '#E6F4FF',
    colorLight: '#121826',
    correctLevel: QRCode.CorrectLevel.H
  });

  downloadQrButton.addEventListener('click', () => {
    if (!qrContainer) return;
    const canvas = qrContainer.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'password-qr.png';
    link.click();
  });
}

function updateQr(password) {
  if (!qrInstance) {
    return;
  }

  const normalized = password.trim();
  if (!normalized) {
    qrInstance.clear();
    qrInstance.makeCode(' ');
    downloadQrButton.disabled = true;
    downloadQrButton.textContent = 'Descargar PNG';
    return;
  }

  qrInstance.clear();
  qrInstance.makeCode(normalized);
  downloadQrButton.disabled = false;
  downloadQrButton.textContent = 'Descargar PNG';
}

function updateBruteForce(password) {
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/\d/.test(password)) charsetSize += 10;
  if (/[^\w\s]/.test(password)) charsetSize += 33;
  if (/\s/.test(password)) charsetSize += 1;
  charsetSize = Math.max(charsetSize, 1);

  if (!password) {
    Object.values(bruteTargets).forEach(({ time, bar }) => {
      time.textContent = 'Ingresa una contraseña.';
      bar.style.setProperty('--fill', '5%');
    });
    return;
  }

  const log10Combinations = password.length * Math.log10(charsetSize);

  Object.entries(bruteTargets).forEach(([key, target]) => {
    const log10Rate = Math.log10(target.rate);
    const log10Seconds = log10Combinations - log10Rate;
    target.time.textContent = formatTime(log10Seconds);
    const normalized = Math.max(5, Math.min(100, (log10Seconds + 2) * 6));
    target.bar.style.setProperty('--fill', `${normalized}%`);
  });
}

function formatTime(log10Seconds) {
  if (!isFinite(log10Seconds)) {
    return 'Tiempo incalculable';
  }

  const units = [
    { name: 'segundos', log: 0 },
    { name: 'minutos', log: Math.log10(60) },
    { name: 'horas', log: Math.log10(3600) },
    { name: 'días', log: Math.log10(86400) },
    { name: 'años', log: Math.log10(31557600) },
    { name: 'siglos', log: Math.log10(3155760000) }
  ];

  if (log10Seconds < -2) {
    const seconds = Math.pow(10, log10Seconds);
    return `≈ ${seconds.toFixed(3)} segundos`;
  }

  let unit = units[0];
  for (const current of units) {
    if (log10Seconds >= current.log) {
      unit = current;
    } else {
      break;
    }
  }

  const diff = log10Seconds - unit.log;

  if (diff > 15) {
    return `≈ 10^${diff.toFixed(1)} ${unit.name}`;
  }

  const value = Math.pow(10, diff);
  const formatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
  return `≈ ${formatter.format(value)} ${unit.name}`;
}
