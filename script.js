// ---------------------------------------------
// Script principal de Contraseña Lab
// - Tema claro/oscuro
// - Tabs
// - Generador y fuerza
// - HIBP
// - Fuerza bruta
// ---------------------------------------------

// Referencias generales
const themeToggle = document.getElementById('themeToggle');
const tabButtons = Array.from(document.querySelectorAll('.tab-link'));
const tabPanels = Array.from(document.querySelectorAll('.panel'));

// Inputs sincronizados entre secciones
const passwordInputs = Array.from(document.querySelectorAll('[data-sync="password"]'));
const generatorInput = document.getElementById('passwordInput');
const hibpInput = document.getElementById('hibpPassword');
const bruteInput = document.getElementById('brutePassword');

// Botones de ojo
const visibilityToggles = Array.from(document.querySelectorAll('[data-visibility-target]'));

// Controles del generador
const copyBtn = document.getElementById('copyBtn');
const lengthSlider = document.getElementById('lengthSlider');
const lengthDisplay = document.getElementById('lengthDisplay'); // input number a la derecha
const includeLowercase = document.getElementById('includeLowercase');
const includeUppercase = document.getElementById('includeUppercase');
const includeNumbers = document.getElementById('includeNumbers');
const includeSymbols = document.getElementById('includeSymbols');
const generatorFeedback = document.getElementById('generatorFeedback');
const generateBtn = document.getElementById('generateBtn');

// Elementos de fuerza de contraseña
const strengthFill = document.getElementById('strengthFill');
const strengthLevel = document.getElementById('strengthLevel');
const strengthScore = document.getElementById('strengthScore');
const strengthMessage = document.getElementById('strengthMessage');

// Elementos HIBP
const breachStatus = document.getElementById('breachStatus');
const breachCounter = document.getElementById('breachCounter');

// Elementos de fuerza bruta
const bruteTargets = {
  cpu: { time: document.getElementById('cpuTime'), bar: document.getElementById('cpuBar'), rate: 1e7 },
  gpu: { time: document.getElementById('gpuTime'), bar: document.getElementById('gpuBar'), rate: 1e9 },
  distributed: { time: document.getElementById('distributedTime'), bar: document.getElementById('distributedBar'), rate: 1e12 }
};

// Constantes y helpers
const THEME_STORAGE_KEY = 'password-dashboard-theme';
const textEncoder = new TextEncoder();
const generatorToggles = [includeLowercase, includeUppercase, includeNumbers, includeSymbols].filter(Boolean);

// Patrones que penalizan la contraseña
const keyboardPatterns = ['qwerty', 'asdf', 'zxcv', '1q2w3e', 'qaz', 'wsx', 'wasd'];
const commonWords = [
  'password', 'contraseña', 'admin', 'welcome', 'dragon', 'monkey', 'football', 'baseball', 'iloveyou',
  'qwerty', 'abc123', 'letmein', 'master', 'princess', 'azerty', 'clave', 'security', 'pass', 'login'
];

// Rangos de fuerza según entropía
const strengthLevels = [
  { label: 'Muy débil',  minEntropy: 0,  color: 'var(--strength-red)',    description: 'Añade longitud y variedad para incrementar la entropía.' },
  { label: 'Débil',      minEntropy: 36, color: 'var(--strength-orange)', description: 'Incorpora mayúsculas, números y símbolos para reforzarla.' },
  { label: 'Media',      minEntropy: 50, color: 'var(--strength-yellow)', description: 'Aceptable, pero podrías extenderla para mayor seguridad.' },
  { label: 'Fuerte',     minEntropy: 65, color: 'var(--strength-green)',  description: 'Buena entropía y diversidad de caracteres.' },
  { label: 'Muy fuerte', minEntropy: 80, color: 'var(--strength-blue)',   description: 'Excelente. Difícil de predecir incluso con ataques avanzados.' }
];

let currentPassword = '';
let breachTimer;
let breachAbortController;

// longitud válida actual (para slider y generar)
let lastValidLength = 20;

// --------------------------------------------------
// Inicio
// --------------------------------------------------
init();

function init() {
  setupTheme();           // Tema claro/oscuro
  setupTabs();            // Tabs navegación

  const defaultTab = tabButtons.find((button) => button.classList.contains('active')) || tabButtons[0];
  if (defaultTab) {
    activateTab(defaultTab.dataset.target, defaultTab);
  }

  setupPasswordSync();    // Sincronizar campos
  setupGeneratorControls();
  setupVisibilityToggles();
  setupCopyButton();

  // Estado inicial sin contraseña
  updateStrength('');
  updateBruteForce('');
  updateCopyState('');
  resetBreachState();
  // Importante: NO generamos una contraseña al cargar
}

/* ==============================
   Tema claro / oscuro
============================== */
function setupTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const initialTheme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark';
  applyTheme(initialTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    });
  }
}

function applyTheme(theme) {
  const normalized = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = normalized;
  const isLight = normalized === 'light';

  if (themeToggle) {
    themeToggle.classList.toggle('is-light', isLight);
    themeToggle.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
    const label = themeToggle.querySelector('.theme-toggle__label');
    if (label) {
      label.textContent = isLight ? 'Modo claro' : 'Modo oscuro';
    }
  }
}

/* ==============================
   Navegación entre pestañas
============================== */
function setupTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.target, button));
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
    const visible = panel.id === targetId;
    panel.classList.toggle('active', visible);
    panel.toggleAttribute('hidden', !visible);
  });
}

/* ==============================
   Sincronización de contraseñas
============================== */
function setupPasswordSync() {
  passwordInputs.forEach((input) => {
    input.addEventListener('input', (event) => {
      setPassword(event.target.value);
    });
  });
}

/* ==============================
   Generador de contraseñas
============================== */
function setupGeneratorControls() {
  if (!lengthSlider || !lengthDisplay || !generateBtn) return;

  // Valores iniciales
  lengthSlider.value = String(lastValidLength);
  lengthDisplay.value = String(lastValidLength);

  // Slider -> input numérico
  lengthSlider.addEventListener('input', () => {
    const value = parseInt(lengthSlider.value, 10) || lastValidLength;
    lastValidLength = value;
    lengthDisplay.value = String(value);
  });

  // Input numérico -> slider (permitir estados intermedios)
  lengthDisplay.addEventListener('input', () => {
    const raw = lengthDisplay.value;

    // Permitir borrar completamente sin forzar nada
    if (raw === '') {
      return;
    }

    let value = parseInt(raw, 10);
    if (Number.isNaN(value)) {
      return;
    }

    // Solo sincronizamos el slider si está dentro de rango
    if (value >= 8 && value <= 60) {
      lastValidLength = value;
      lengthSlider.value = String(value);
    }
  });

  // Al salir del campo, sí normalizamos al rango 8–60
  lengthDisplay.addEventListener('blur', () => {
    let value = parseInt(lengthDisplay.value, 10);

    if (Number.isNaN(value)) {
      value = lastValidLength;
    }

    value = Math.min(60, Math.max(8, value));
    lastValidLength = value;
    lengthDisplay.value = String(value);
    lengthSlider.value = String(value);
  });

  generatorToggles.forEach((toggle) => {
    toggle.addEventListener('change', updateGeneratorAvailability);
  });
  updateGeneratorAvailability();

  // Click en "Generar contraseña"
  generateBtn.addEventListener('click', () => {
    const sets = getActiveCharSets();
    if (sets.length === 0) {
      setGeneratorFeedback('Selecciona al menos un grupo de caracteres.', 'warn');
      return;
    }

    const length = lastValidLength || 20;
    const password = buildPassword(length, sets);

    // Actualiza todos los campos sincronizados
    setPassword(password);

    // Evitar abrir teclado en móvil: no hacemos focus al input
    if (/Mobi|Android/i.test(navigator.userAgent)) {
      generatorInput?.blur();
    }

    setGeneratorFeedback('Contraseña generada y sincronizada.', 'success');
  });
}

// Devuelve los tipos de caracteres activos
function getActiveCharSets() {
  const sets = [];
  if (includeLowercase?.checked) sets.push('abcdefghijklmnopqrstuvwxyz');
  if (includeUppercase?.checked) sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  if (includeNumbers?.checked)   sets.push('0123456789');
  if (includeSymbols?.checked)   sets.push("!@#$%^&*()-_=+[]{}<>?/|~.,:;'\"`");
  return sets;
}

// Construye una contraseña segura
function buildPassword(length, sets) {
  if (sets.length === 0) return '';
  const pool = sets.join('');
  const characters = [];

  // Garantizar al menos un carácter de cada tipo
  sets.forEach((set) => {
    characters.push(pickRandomChar(set));
  });

  // Rellenar el resto
  for (let i = characters.length; i < length; i += 1) {
    characters.push(pickRandomChar(pool));
  }

  // Mezclar
  shuffleArray(characters);
  return characters.join('').slice(0, length);
}

// Caracter aleatorio usando crypto
function pickRandomChar(source) {
  if (!source.length) return '';
  const index = secureRandomIndex(source.length);
  return source.charAt(index);
}

// Índice aleatorio seguro
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

// Mezcla array (Fisher–Yates)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = secureRandomIndex(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/* ==============================
   Estado común de la contraseña
============================== */
function setPassword(value) {
  currentPassword = value;

  // Actualizar todos los inputs sincronizados
  passwordInputs.forEach((input) => {
    input.value = value;
  });

  updateStrength(value);
  updateBruteForce(value);
  updateCopyState(value);
  scheduleBreachCheck(value);
}

/* Feedback visual del generador */
function updateGeneratorAvailability() {
  if (!generateBtn) return;
  const available = generatorToggles.some((toggle) => toggle.checked);
  generateBtn.disabled = !available;
  if (!available) {
    setGeneratorFeedback('Activa al menos una opción de caracteres.', 'warn');
  } else {
    setGeneratorFeedback('', '');
  }
}

function setGeneratorFeedback(message, type) {
  if (!generatorFeedback) return;
  generatorFeedback.textContent = message;
  generatorFeedback.className = 'generator-feedback';
  if (type) {
    generatorFeedback.classList.add(`feedback-${type}`);
  }
}

/* Copiar contraseña */
function setupCopyButton() {
  if (!copyBtn) return;
  copyBtn.addEventListener('click', async () => {
    if (!currentPassword) {
      setGeneratorFeedback('No hay contraseña para copiar.', 'warn');
      return;
    }
    try {
      await navigator.clipboard.writeText(currentPassword);
      setGeneratorFeedback('Contraseña copiada al portapapeles.', 'success');
    } catch {
      setGeneratorFeedback('No se pudo copiar automáticamente.', 'error');
    }
  });
}

function updateCopyState(password) {
  if (!copyBtn) return;
  copyBtn.disabled = !password;
}

/* ==============================
   Botones de ojo (mostrar/ocultar)
============================== */
function setupVisibilityToggles() {
  visibilityToggles.forEach((button) => {
    const targetId = button.getAttribute('data-visibility-target');
    if (!targetId) return;

    const input = document.getElementById(targetId);
    if (!input) return;

    button.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.classList.toggle('is-active', !showing);
      button.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
    });
  });
}

/* ==============================
   Fuerza de contraseña (entropía)
============================== */
function updateStrength(password) {
  if (!password) {
    strengthFill.style.width = '0%';
    strengthFill.style.setProperty('--fill-color', 'var(--strength-red)');
    strengthLevel.textContent = 'Muy débil';
    strengthScore.textContent = '0 bits';
    strengthMessage.textContent = 'Genera o escribe una contraseña para evaluar su entropía.';
    return;
  }

  const evaluation = evaluatePassword(password);
  const level = strengthLevels.reduce(
    (acc, item) => (evaluation.effectiveEntropy >= item.minEntropy ? item : acc),
    strengthLevels[0]
  );

  // Barra 0%–100%
  const fillPercent = Math.max(0, Math.min(100, Math.round((evaluation.effectiveEntropy / 80) * 100)));

  strengthFill.style.width = `${fillPercent}%`;
  strengthFill.style.setProperty('--fill-color', level.color);
  strengthLevel.textContent = level.label;
  strengthScore.textContent = `≈ ${Math.round(evaluation.effectiveEntropy)} bits`;
  strengthMessage.textContent = evaluation.message || level.description;
}

// Calcula entropía y penalizaciones
function evaluatePassword(password) {
  const length = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^\w\s]/.test(password);
  const hasSpace = /\s/.test(password);
  const categories = [hasLower, hasUpper, hasNumber, hasSymbol, hasSpace].filter(Boolean).length;

  let charsetSize = 0;
  if (hasLower) charsetSize += 26;
  if (hasUpper) charsetSize += 26;
  if (hasNumber) charsetSize += 10;
  if (hasSymbol) charsetSize += 33;
  if (hasSpace) charsetSize += 1;
  charsetSize = Math.max(charsetSize, 1);

  const entropy = length * Math.log2(charsetSize);
  const patterns = detectPatterns(password);
  const effectiveEntropy = Math.max(0, entropy - patterns.penalty * 0.5);

  let message = '';
  if (patterns.flags.length > 0) {
    message = `Se detectaron patrones: ${patterns.flags.join(', ')}.`;
  } else if (entropy < 45) {
    message = 'Incrementa la entropía agregando longitud y caracteres poco comunes.';
  } else if (categories < 3) {
    message = 'Mezcla distintos tipos de caracteres para reforzarla aún más.';
  } else {
    message = 'Sin patrones evidentes. Mantén esta contraseña en secreto y única.';
  }

  return { entropy, effectiveEntropy, message };
}

// Detección de patrones débiles
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
    flags.push('sustituciones conocidas');
    penalty += 12;
  }

  return { flags, penalty };
}

function hasSequentialPattern(text) {
  const sequences = ['abcdefghijklmnopqrstuvwxyz', '0123456789'];
  return sequences.some(
    (sequence) => containsSequence(text, sequence) || containsSequence(text, reverse(sequence))
  );
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

/* ==============================
   HIBP (Have I Been Pwned)
============================== */
function scheduleBreachCheck(password) {
  if (!breachStatus || !breachCounter) return;

  if (breachTimer) clearTimeout(breachTimer);
  if (breachAbortController) breachAbortController.abort();

  if (!password) {
    resetBreachState();
    return;
  }

  breachStatus.innerHTML = '<span class="spinner" aria-hidden="true"></span> Consultando Have I Been Pwned...';
  breachCounter.textContent = '';

  // Delay para no llamar a la API en cada tecla
  breachTimer = setTimeout(async () => {
    try {
      await performBreachCheck(password);
    } catch (error) {
      if (error.name === 'AbortError') return;
      breachStatus.textContent = 'No fue posible contactar con el servicio en este momento.';
    }
  }, 600);
}

function resetBreachState() {
  if (!breachStatus || !breachCounter) return;
  breachStatus.textContent = 'Introduce una contraseña para consultar Have I Been Pwned.';
  breachCounter.textContent = '';
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
    breachStatus.textContent = '⚠️ Esta contraseña aparece en filtraciones conocidas.';
    breachCounter.textContent = `Veces encontradas: ${Number(count).toLocaleString('es-ES')}`;
  } else {
    breachStatus.textContent = '✅ No se encontraron coincidencias para esta contraseña.';
    breachCounter.textContent = '';
  }

  breachAbortController = undefined;
}

// SHA-1 para HIBP
async function sha1(message) {
  const data = textEncoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/* ==============================
   Fuerza bruta
============================== */
function updateBruteForce(password) {
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/\d/.test(password))   charsetSize += 10;
  if (/[^\w\s]/.test(password)) charsetSize += 33;
  if (/\s/.test(password))   charsetSize += 1;
  charsetSize = Math.max(charsetSize, 1);

  if (!password) {
    Object.values(bruteTargets).forEach(({ time, bar }) => {
      time.textContent = 'Ingresa una contraseña.';
      bar.style.setProperty('--bar-scale', '0.06');
    });
    return;
  }

  const log10Combinations = password.length * Math.log10(charsetSize);

  Object.values(bruteTargets).forEach((target) => {
    const log10Rate = Math.log10(target.rate);
    const log10Seconds = log10Combinations - log10Rate;
    target.time.textContent = formatTime(log10Seconds);
    const scale = Math.max(0.06, Math.min(1, (log10Seconds + 2) * 0.07));
    target.bar.style.setProperty('--bar-scale', scale.toFixed(3));
  });
}

// Formatea el tiempo estimado
function formatTime(log10Seconds) {
  if (!isFinite(log10Seconds)) {
    return 'Tiempo incalculable';
  }

  const units = [
    { name: 'segundos', log: 0 },
    { name: 'minutos',  log: Math.log10(60) },
    { name: 'horas',    log: Math.log10(3600) },
    { name: 'días',     log: Math.log10(86400) },
    { name: 'años',     log: Math.log10(31557600) },
    { name: 'siglos',   log: Math.log10(3155760000) }
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
