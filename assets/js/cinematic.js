const Cinematic = (() => {

    const TYPEWRITER_SPEED  = 35;
    const BUBBLE_PADDING    = 10;
    const BUBBLE_MAX_WIDTH  = 220;
    const FONT_SIZE         = 24;
    const FONT_FAMILY       = '"RetroTalk", monospace';
    const INDICATOR_BLINK   = 500;
    const LINE_HEIGHT       = 1.45;
    const BUBBLE_GAP        = 10;
    const TAIL_SIZE         = 8;

    let _ctx, _canvas, _steps, _onComplete;
    let _stepIdx, _charIdx, _revealed;
    let _typing, _typeTimer;
    let _active = false;
    let _animId = null;
    let _background = '#0e0e1a';
    let _bgImage = null;
    let _bgCache = {};
    let _spriteCache = {};
    let _music = null;
    let _talkSfx = null;
    let _entities = {};
    let _animQueue = [];
    let _currentAnim = null;
    let _animStart = 0;
    let _waitingForActions = false;

    /**
     * Charge ou récupère depuis le cache une image de spritesheet.
     * @param {string} src - Chemin vers l'image.
     * @returns {HTMLImageElement} L'objet Image (peut ne pas être encore chargé).
     */
    function getSprite(src) {
        if (_spriteCache[src]) return _spriteCache[src];
        const img = new Image();
        img.src = src;
        _spriteCache[src] = img;
        return img;
    }

    /**
     * Convertit des coordonnées relatives (0-1) en pixels
     * sur le canvas. Le point d'ancrage est le centre de l'entité.
     * @param {number} rx - Position X relative (0 = gauche, 1 = droite).
     * @param {number} ry - Position Y relative (0 = haut, 1 = bas).
     * @param {number} ew - Largeur de l'entité en pixels.
     * @param {number} eh - Hauteur de l'entité en pixels.
     * @returns {{px: number, py: number}} Position en pixels.
     */
    function toPixel(rx, ry, ew, eh) {
        return {
            px: rx * _canvas.width - ew / 2,
            py: ry * _canvas.height - eh / 2
        };
    }

    /**
     * Découpe un texte en plusieurs lignes pour qu'il
     * tienne dans la largeur maximale donnée.
     * @param {string} text - Le texte à découper.
     * @param {number} maxW - Largeur maximale en pixels.
     * @returns {string[]} Tableau de lignes.
     */
    function wrapText(text, maxW) {
        const words = text.split(' ');
        const lines = [];
        let line = '';
        for (const word of words) {
            const test = line ? line + ' ' + word : word;
            if (_ctx.measureText(test).width > maxW && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    /**
     * Retourne la taille affichée d'une entité en pixels,
     * en tenant compte du scale et de l'animation courante.
     * @param {Object} e - L'entité.
     * @returns {{dw: number, dh: number}} Dimensions affichées.
     */
    function entityDisplaySize(e) {
        if (e.sprite && e.anims && e.anim) {
            const a = e.anims[e.anim];
            if (a) {
                const s = e.scale || 1;
                return { dw: a.frameW * s, dh: a.frameH * s };
            }
        }
        return { dw: e.w, dh: e.h };
    }

    /**
     * Traite la file d'actions du step courant frame par frame.
     * Gère les animations de déplacement avec easing, les spawns,
     * les suppressions, les flips, les waits, les labels et
     * les changements d'animation sprite.
     * Passe au dialogue une fois toutes les actions terminées.
     */
    function processActions() {
        if (!_active) return;

        if (_currentAnim) {
            const elapsed = Date.now() - _animStart;
            const t = Math.min(1, elapsed / _currentAnim.duration);
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

            const e = _entities[_currentAnim.id];
            if (e) {
                e.x = _currentAnim.fromX + (_currentAnim.toX - _currentAnim.fromX) * ease;
                e.y = _currentAnim.fromY + (_currentAnim.toY - _currentAnim.fromY) * ease;
            }
            if (t >= 1) _currentAnim = null;
            return;
        }

        if (_animQueue.length === 0) {
            _waitingForActions = false;
            startTyping();
            return;
        }

        const action = _animQueue.shift();

        switch (action.type) {
            case 'spawn': {
                const ent = {
                    x: action.x ?? 0.5,
                    y: action.y ?? 0.5,
                    w: action.w || 44,
                    h: action.h || 64,
                    color: action.color || '#b4cde8',
                    highlight: action.highlight || null,
                    outline: action.outline || '#6a94be',
                    label: action.label || null,
                    flip: action.flip || false,
                    sprite: null,
                    anims: null,
                    anim: null,
                    scale: action.scale || 1,
                    frame: 0,
                    lastFrameTime: 0,
                };
                if (action.sprite && action.anims) {
                    ent.sprite = getSprite(action.sprite);
                    ent.anims = action.anims;
                    ent.anim = action.anim || Object.keys(action.anims)[0];
                }
                _entities[action.id] = ent;
                break;
            }
            case 'move': {
                const e = _entities[action.id];
                if (!e) break;
                _currentAnim = {
                    id: action.id,
                    fromX: e.x, fromY: e.y,
                    toX: action.x ?? e.x,
                    toY: action.y ?? e.y,
                    duration: action.duration || 1000,
                };
                _animStart = Date.now();
                return;
            }
            case 'remove': {
                delete _entities[action.id];
                break;
            }
            case 'flip': {
                const e = _entities[action.id];
                if (e) e.flip = action.flip ?? !e.flip;
                break;
            }
            case 'wait': {
                _currentAnim = { id: '__wait', duration: action.duration || 500 };
                _animStart = Date.now();
                return;
            }
            case 'label': {
                const e = _entities[action.id];
                if (e) e.label = action.label;
                break;
            }
            case 'anim': {
                const e = _entities[action.id];
                if (e && e.anims && e.anims[action.anim]) {
                    if (e.anim !== action.anim) {
                        e.anim = action.anim;
                        e.frame = 0;
                        e.lastFrameTime = 0;
                    }
                }
                break;
            }
        }

        processActions();
    }

    /**
     * Dessine une entité sur le canvas : soit un sprite animé
     * depuis une spritesheet, soit un rectangle coloré de fallback.
     * @param {Object} e - L'entité à dessiner.
     * @param {number} now - Timestamp courant pour l'avancement des frames.
     */
    function drawEntity(e, now) {
        const hasSprite = e.sprite && e.sprite.complete && e.sprite.naturalWidth > 0
                          && e.anims && e.anim && e.anims[e.anim];

        if (hasSprite) {
            const a = e.anims[e.anim];
            const s = e.scale || 1;
            const dw = a.frameW * s;
            const dh = a.frameH * s;
            const pos = toPixel(e.x, e.y, dw, dh);

            if (a.fps > 0 && a.frames > 1 && now - e.lastFrameTime > 1000 / a.fps) {
                e.frame = (e.frame + 1) % a.frames;
                e.lastFrameTime = now;
            }

            const cols = a.cols || Math.floor(e.sprite.naturalWidth / a.frameW) || 1;
            const col = e.frame % cols;
            const row = Math.floor(e.frame / cols);

            const srcX = col * a.frameW;
            const srcY = a.srcY + row * a.frameH;

            _ctx.save();
            if (e.flip) {
                _ctx.translate(pos.px + dw, pos.py);
                _ctx.scale(-1, 1);
                _ctx.drawImage(e.sprite, srcX, srcY, a.frameW, a.frameH, 0, 0, dw, dh);
            } else {
                _ctx.drawImage(e.sprite, srcX, srcY, a.frameW, a.frameH, pos.px, pos.py, dw, dh);
            }
            _ctx.restore();
        } else if (!e.sprite) {
            const pos = toPixel(e.x, e.y, e.w, e.h);

            _ctx.save();
            if (e.flip) {
                _ctx.translate(pos.px + e.w, pos.py);
                _ctx.scale(-1, 1);
            } else {
                _ctx.translate(pos.px, pos.py);
            }

            _ctx.fillStyle = e.color;
            _ctx.fillRect(0, 0, e.w, e.h);

            if (e.highlight) {
                _ctx.fillStyle = e.highlight;
                _ctx.fillRect(4, 4, e.w - 8, Math.max(6, e.h * 0.2));
            }

            _ctx.strokeStyle = e.outline;
            _ctx.lineWidth = 2;
            _ctx.strokeRect(0, 0, e.w, e.h);

            if (e.label) {
                _ctx.fillStyle = '#fff';
                _ctx.font = 'bold 9px monospace';
                _ctx.textAlign = 'center';
                _ctx.textBaseline = 'middle';
                _ctx.fillText(e.label, e.w / 2, e.h / 2);
            }

            _ctx.restore();
        }
    }

    /**
     * Boucle de rendu principale de la cinématique.
     * Dessine le fond, toutes les entités vivantes, et la bulle
     * de dialogue au-dessus du speaker avec l'effet typewriter.
     */
    function render() {
        if (!_active) return;
        const w = _canvas.width;
        const h = _canvas.height;
        const step = _steps[_stepIdx];
        const now = performance.now();

        if (_bgImage && _bgImage.complete) {
            const scale = Math.max(w / _bgImage.naturalWidth, h / _bgImage.naturalHeight);
            const imgW = _bgImage.naturalWidth * scale;
            const imgH = _bgImage.naturalHeight * scale;
            const bgX = (w - imgW) / 2;
            const bgY = (h - imgH) / 2;
            _ctx.drawImage(_bgImage, bgX, bgY, imgW, imgH);
        } else {
            _ctx.fillStyle = _background;
            _ctx.fillRect(0, 0, w, h);
        }

        if (_waitingForActions) processActions();

        for (const id in _entities) {
            drawEntity(_entities[id], now);
        }

        if (!_waitingForActions && step.text && step.speaker) {
            const speakerEntity = _entities[step.speaker];
            if (speakerEntity) {
                const size = entityDisplaySize(speakerEntity);
                const pos = toPixel(speakerEntity.x, speakerEntity.y, size.dw, size.dh);
                const centerX = pos.px + size.dw / 2;
                const topY = pos.py;

                _ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
                const textMaxW = BUBBLE_MAX_WIDTH - BUBBLE_PADDING * 2;
                const fullLines = wrapText(step.text, textMaxW);
                const visLines = wrapText(_revealed, textMaxW);

                const lineH = FONT_SIZE * LINE_HEIGHT;
                const textH = fullLines.length * lineH;
                const bubbleH = textH + BUBBLE_PADDING * 2;

                let maxLineW = 0;
                for (const l of fullLines) {
                    const lw = _ctx.measureText(l).width;
                    if (lw > maxLineW) maxLineW = lw;
                }
                const bubbleW = maxLineW + BUBBLE_PADDING * 2;

                let bubbleX = centerX - bubbleW / 2;
                const bubbleY = topY - BUBBLE_GAP - TAIL_SIZE - bubbleH;

                if (bubbleX < 6) bubbleX = 6;
                if (bubbleX + bubbleW > w - 6) bubbleX = w - 6 - bubbleW;

                _ctx.fillStyle = '#fff';
                _ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
                _ctx.strokeStyle = '#222';
                _ctx.lineWidth = 2;
                _ctx.strokeRect(bubbleX, bubbleY, bubbleW, bubbleH);

                const tailX = Math.max(bubbleX + 12, Math.min(centerX, bubbleX + bubbleW - 12));
                _ctx.fillStyle = '#fff';
                _ctx.beginPath();
                _ctx.moveTo(tailX - TAIL_SIZE, bubbleY + bubbleH);
                _ctx.lineTo(tailX, bubbleY + bubbleH + TAIL_SIZE);
                _ctx.lineTo(tailX + TAIL_SIZE, bubbleY + bubbleH);
                _ctx.closePath();
                _ctx.fill();
                _ctx.strokeStyle = '#222';
                _ctx.lineWidth = 2;
                _ctx.beginPath();
                _ctx.moveTo(tailX - TAIL_SIZE, bubbleY + bubbleH);
                _ctx.lineTo(tailX, bubbleY + bubbleH + TAIL_SIZE);
                _ctx.lineTo(tailX + TAIL_SIZE, bubbleY + bubbleH);
                _ctx.stroke();
                _ctx.fillStyle = '#fff';
                _ctx.fillRect(tailX - TAIL_SIZE, bubbleY + bubbleH - 2, TAIL_SIZE * 2, 4);

                _ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
                _ctx.fillStyle = '#1a1a1a';
                _ctx.textAlign = 'left';
                _ctx.textBaseline = 'top';
                for (let i = 0; i < visLines.length; i++) {
                    _ctx.fillText(visLines[i], bubbleX + BUBBLE_PADDING, bubbleY + BUBBLE_PADDING + i * lineH);
                }

                if (!_typing) {
                    const blink = Math.floor(Date.now() / INDICATOR_BLINK) % 2 === 0;
                    if (blink) {
                        _ctx.fillStyle = '#888';
                        _ctx.font = `bold 12px ${FONT_FAMILY}`;
                        _ctx.textAlign = 'right';
                        _ctx.textBaseline = 'bottom';
                        _ctx.fillText('\u25BC', bubbleX + bubbleW - 6, bubbleY + bubbleH - 4);
                    }
                }
            }
        }

        _animId = requestAnimationFrame(render);
    }

    /**
     * Démarre l'effet typewriter sur le texte du step courant.
     * Ajoute une lettre toutes les TYPEWRITER_SPEED ms.
     * S'il n'y a pas de texte, passe automatiquement au step suivant.
     */
    function startTyping() {
        const step = _steps[_stepIdx];
        if (!step || !step.text) {
            _typing = false;
            _revealed = '';
            if (!_waitingForActions) {
                setTimeout(() => { if (_active) advanceStep(); }, 100);
            }
            return;
        }
        _charIdx = 0;
        _revealed = '';
        _typing = true;
        if (_talkSfx) {
            _talkSfx.currentTime = 0;
            _talkSfx.play();
        }
        clearInterval(_typeTimer);
        _typeTimer = setInterval(() => {
            if (_charIdx < step.text.length) {
                _revealed += step.text[_charIdx];
                _charIdx++;
            } else {
                _typing = false;
                clearInterval(_typeTimer);
                if (_talkSfx) _talkSfx.pause();
            }
        }, TYPEWRITER_SPEED);
    }

    /**
     * Affiche immédiatement tout le texte du step courant,
     * annulant l'effet typewriter en cours.
     */
    function skipTyping() {
        const step = _steps[_stepIdx];
        if (!step || !step.text) return;
        clearInterval(_typeTimer);
        _revealed = step.text;
        _typing = false;
        if (_talkSfx) _talkSfx.pause();
    }

    /**
     * Initialise un nouveau step : met à jour le fond,
     * charge la musique si spécifiée, puis lance les actions
     * ou le dialogue selon le contenu du step.
     */
    function beginStep() {
        const step = _steps[_stepIdx];
        if (!step) return;

        if (step.background) {
            _background = step.background;
            if (/\.(png|jpe?g|gif|webp|svg)$/i.test(step.background)) {
                if (_bgCache[step.background]) {
                    _bgImage = _bgCache[step.background];
                } else {
                    const img = new Image();
                    img.src = step.background;
                    _bgCache[step.background] = img;
                    _bgImage = img;
                }
            } else {
                _bgImage = null;
            }
        }

        if (step.music !== undefined) {
            if (_music) { _music.pause(); _music = null; }
            if (step.music) {
                _music = new Audio(step.music[0]);
                _music.volume = step.music[1];
                _music.loop = true;
                _music.play();
            }
        }

        if (step.actions && step.actions.length > 0) {
            _animQueue = [...step.actions];
            _waitingForActions = true;
            _currentAnim = null;
        } else {
            _waitingForActions = false;
            startTyping();
        }
    }

    /**
     * Passe au step suivant, ou termine la cinématique
     * si c'était le dernier step.
     */
    function advanceStep() {
        if (_stepIdx < _steps.length - 1) {
            _stepIdx++;
            beginStep();
        } else {
            stop();
            if (_onComplete) _onComplete();
        }
    }

    /**
     * Appelée quand le joueur interagit (tap, clic, espace).
     * Skip le typewriter si en cours, sinon passe au step suivant.
     * Bloquée tant que des actions sont en cours d'animation.
     */
    function advance() {
        if (!_active) return;
        if (_waitingForActions) return;

        if (_typing) {
            skipTyping();
            return;
        }

        advanceStep();
    }

    /**
     * Gère les taps et clics sur le canvas pendant la cinématique.
     * @param {Event} e - L'événement tactile ou souris.
     */
    function onTap(e) {
        if (e.type === 'touchstart') e.preventDefault();
        advance();
    }

    /**
     * Gère les touches clavier pendant la cinématique.
     * Espace et Entrée font avancer le dialogue.
     * @param {KeyboardEvent} e - L'événement clavier.
     */
    function onKey(e) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            advance();
        }
    }

    /**
     * Attache les écouteurs d'événements sur le canvas
     * et le clavier pour naviguer dans la cinématique.
     */
    function bindEvents() {
        _canvas.addEventListener('click', onTap);
        _canvas.addEventListener('touchstart', onTap, { passive: false });
        window.addEventListener('keydown', onKey);
    }

    /**
     * Détache tous les écouteurs posés par bindEvents.
     */
    function unbindEvents() {
        _canvas.removeEventListener('click', onTap);
        _canvas.removeEventListener('touchstart', onTap);
        window.removeEventListener('keydown', onKey);
    }

    /**
     * Lance une cinématique sur le canvas donné.
     * Réinitialise tout l'état interne et démarre le premier step.
     * @param {HTMLCanvasElement} canvas - Le canvas de rendu.
     * @param {Array} steps - Tableau de steps décrivant la cinématique.
     * @param {Function} onComplete - Callback appelé à la fin de la cinématique.
     */
    function play(canvas, steps, onComplete) {
        _canvas = canvas;
        _ctx = canvas.getContext('2d');
        _ctx.imageSmoothingEnabled = false;
        _steps = steps;
        _onComplete = onComplete;
        _stepIdx = 0;
        _charIdx = 0;
        _revealed = '';
        _typing = false;
        _active = true;
        _entities = {};
        _animQueue = [];
        _currentAnim = null;
        _waitingForActions = false;
        _background = '#0e0e1a';
        _bgImage = null;
        if (!_talkSfx) {
            _talkSfx = new Audio('../assets/sound/sfx/talking.mp3');
            _talkSfx.loop = true;
        }

        clearInterval(_typeTimer);
        if (_animId) cancelAnimationFrame(_animId);

        bindEvents();
        beginStep();
        render();
    }

    /**
     * Stoppe immédiatement la cinématique en cours :
     * arrête le rendu, le typewriter, la musique et les événements.
     */
    function stop() {
        _active = false;
        clearInterval(_typeTimer);
        if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
        if (_music) { _music.pause(); _music = null; }
        if (_talkSfx) { _talkSfx.pause(); _talkSfx.currentTime = 0; }
        unbindEvents();
    }

    /**
     * Indique si une cinématique est actuellement en cours de lecture.
     * @returns {boolean}
     */
    function isPlaying() {
        return _active;
    }

    return { play, stop, isPlaying };

})();
