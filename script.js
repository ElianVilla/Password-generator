document.addEventListener('DOMContentLoaded', () => {
    const lengthRange = document.getElementById('lengthRange');
    const lengthInput = document.getElementById('length');
    const generateButton = document.getElementById('generate');
    const passwordInput = document.getElementById('passwordInput');
    const copyPasswordButton = document.getElementById('copiar');
    const passwordStatus = document.getElementById('passwordStatus');

    const generateEmailButton = document.getElementById('generateEmail');
    const copyEmailButton = document.getElementById('copyEmail');
    const emailAddress = document.getElementById('emailAddress');
    const emailStatus = document.getElementById('emailStatus');
    const emailInboxLink = document.getElementById('emailInboxLink');
    const themeToggle = document.getElementById('themeToggle');
    const rootElement = document.documentElement;
    const themeStorageKey = 'preferred-theme';

    const readStoredTheme = () => {
        try {
            return localStorage.getItem(themeStorageKey);
        } catch (error) {
            return null;
        }
    };

    const storeTheme = (theme) => {
        try {
            localStorage.setItem(themeStorageKey, theme);
        } catch (error) {
            // Ignoramos errores de almacenamiento (modo incógnito, etc.)
        }
    };

    const applyTheme = (theme) => {
        const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
        rootElement.setAttribute('data-theme', normalizedTheme);

        if (themeToggle) {
            const label = normalizedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
            themeToggle.setAttribute('aria-label', label);
            themeToggle.setAttribute('aria-pressed', normalizedTheme === 'dark');
            themeToggle.dataset.theme = normalizedTheme;
        }
    };

    const detectPreferredTheme = () => {
        const storedTheme = readStoredTheme();
        if (storedTheme === 'light' || storedTheme === 'dark') {
            return storedTheme;
        }

        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'dark' : 'light';
    };

    const initialTheme = detectPreferredTheme();
    applyTheme(initialTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = rootElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
            storeTheme(nextTheme);
        });
    }

    const characterSets = {
        Mayusculas: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        Minusculas: 'abcdefghijklmnopqrstuvwxyz',
        Numeros: '0123456789',
        Simbolos: '!@#$%^&*()-_+=<>?~'
    };

    const updateStatus = (element, message, type = 'info') => {
        if (!element) return;
        element.textContent = message;
        element.dataset.state = type;
        if (message) {
            element.classList.add('visible');
        } else {
            element.classList.remove('visible');
        }
    };

    const syncLengthInputs = value => {
        const sanitizedValue = Math.min(Math.max(parseInt(value, 10) || 6, 6), 64);
        lengthRange.value = sanitizedValue;
        lengthInput.value = sanitizedValue;
    };

    lengthRange.addEventListener('input', event => {
        syncLengthInputs(event.target.value);
    });

    lengthInput.addEventListener('input', event => {
        syncLengthInputs(event.target.value);
    });

    const getSelectedSets = () => {
        return Object.keys(characterSets).filter(key => {
            const checkbox = document.getElementById(`incluir${key}`);
            return checkbox && checkbox.checked;
        });
    };

    const buildPassword = (length, sets) => {
        if (sets.length === 0) {
            throw new Error('Selecciona al menos una categoría.');
        }

        const pool = sets.map(set => characterSets[set]).join('');
        const passwordCharacters = [];

        // Aseguramos que al menos un carácter de cada conjunto esté presente
        sets.forEach(set => {
            const characters = characterSets[set];
            const randomChar = characters[Math.floor(Math.random() * characters.length)];
            passwordCharacters.push(randomChar);
        });

        for (let i = passwordCharacters.length; i < length; i += 1) {
            const randomChar = pool[Math.floor(Math.random() * pool.length)];
            passwordCharacters.push(randomChar);
        }

        for (let i = passwordCharacters.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [passwordCharacters[i], passwordCharacters[j]] = [passwordCharacters[j], passwordCharacters[i]];
        }

        return passwordCharacters.join('').slice(0, length);
    };

    generateButton.addEventListener('click', () => {
        try {
            const length = parseInt(lengthInput.value, 10);
            const selectedSets = getSelectedSets();
            const password = buildPassword(length, selectedSets);
            passwordInput.value = password;
            updateStatus(passwordStatus, 'Contraseña generada correctamente.', 'success');
        } catch (error) {
            updateStatus(passwordStatus, error.message, 'error');
        }
    });

    const copyToClipboard = async (text) => {
        if (!text) {
            throw new Error('Nada para copiar aún.');
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    };

    copyPasswordButton.addEventListener('click', async () => {
        try {
            await copyToClipboard(passwordInput.value);
            updateStatus(passwordStatus, 'Contraseña copiada al portapapeles.', 'success');
        } catch (error) {
            updateStatus(passwordStatus, error.message, 'error');
        }
    });

    const createInboxLink = (email) => {
        const [login, domain] = email.split('@');
        return `https://www.1secmail.com/?login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}`;
    };

    generateEmailButton.addEventListener('click', async () => {
        updateStatus(emailStatus, 'Generando correo temporal…', 'info');
        emailAddress.textContent = '';
        emailInboxLink.hidden = true;
        copyEmailButton.disabled = true;

        try {
            const response = await fetch('https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1');
            if (!response.ok) {
                throw new Error('No se pudo obtener el correo temporal.');
            }

            const data = await response.json();
            const email = Array.isArray(data) ? data[0] : null;

            if (!email) {
                throw new Error('Respuesta inválida del servicio de correo.');
            }

            emailAddress.textContent = email;
            emailInboxLink.href = createInboxLink(email);
            emailInboxLink.hidden = false;
            copyEmailButton.disabled = false;
            updateStatus(emailStatus, 'Correo temporal listo para usar.', 'success');
        } catch (error) {
            updateStatus(emailStatus, error.message, 'error');
        }
    });

    copyEmailButton.addEventListener('click', async () => {
        try {
            await copyToClipboard(emailAddress.textContent);
            updateStatus(emailStatus, 'Correo copiado al portapapeles.', 'success');
        } catch (error) {
            updateStatus(emailStatus, error.message, 'error');
        }
    });
});
