const canvas = document.getElementById('gameCanva');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const startBtn = document.querySelector('.startBtn');

const images = {
    fabric: new Image(),
    dye: new Image(),
    needle: new Image(),
    scissors: new Image(),
    river: new Image(),
    beer: new Image(),
    gear: new Image(),
    raft: new Image(),
    lehmann: new Image()
};

images.fabric.src = 'assets/img/elements/ingredients/fabric.svg';
images.dye.src = 'assets/img/elements/ingredients/dye.svg';
images.needle.src = 'assets/img/elements/ingredients/needle.svg';
images.scissors.src = 'assets/img/elements/ingredients/scissors.svg';
images.river.src = 'assets/img/river.svg';
images.beer.src = 'assets/img/elements/malus/beer4.svg';
images.gear.src = 'assets/img/elements/malus/gear.svg';
images.raft.src = 'assets/img/elements/floss-idle-no-sail-transp.png';
images.lehmann.src = 'assets/img/elements/lehmann.png';

Object.keys(images).forEach(key => {
    images[key].onerror = () => console.error(`Erreur de chargement pour l'image: ${key}`);
});

const ingredientMap = {
    1: 'fabric',
    2: 'dye',
    3: 'needle',
    4: 'scissors'
};

const friction = 0.75;
const sensitivity = 0.08;
const waveAmplitude = 0.2;
const waveFrequency = 0.03;

let H, W;
let player = { x: 0, y: 0, w: 90, h: 120, vx: 0, ax: 0, state: 'front', frame: 0 };
let objects = [];
let objectSize = 40;
const spawnSpeed = 2;
const sineTable = Array.from({ length: 360 }, (_, i) => Math.sin(i * Math.PI / 180));
let frameCount = 0;

let recipe = [1, 2, 3, 4];
let currentRecipeIndex = 0;
let gameActive = false;
let victory = false;
let isPaused = false;

// --- CONFIGURATIONS CINEMATIQUES ---
const introSteps = [
    {
        background: 'assets/img/background-mobile.png',
        music: ['assets/audio/intro_theme.mp3', 0.5],
        actions: [
            {
                type: 'spawn', id: 'seb', x: 0.2, y: 0.8, sprite: 'assets/img/elements/lehmann.png',
                anims: { idle: { srcY: 0, frameW: 24, frameH: 52, frames: 8, fps: 10 } }, scale: 3
            },
            { type: 'wait', duration: 500 }
        ],
        speaker: 'seb',
        text: "Seriously, that pigeon... What’s its problem? Did it mistake my shoulder for a deployment zone?"
    },
    {
        speaker: 'seb',
        text: "My shirt's CSS is completely broken. I can't stay like this. I need a new outfit, and I need it fast."
    },
    {
        actions: [
            { type: 'spawn', id: 'dollfus', x: 0.8, y: 0.8, sprite: 'assets/img/elements/dollfus.png', anims: { idle: { srcY: 0, frameW: 109, frameH: 191, cols: 4, frames: 4, fps: 8 } }, scale: 0.7, flip: true },
            { type: 'wait', duration: 800 },
            { type: 'flip', id: 'seb', flip: true }
        ],
        speaker: 'dollfus',
        text: "Halt, you impudent youth! You dare tread upon Mulhouse soil in such rags?"
    },
    {
        speaker: 'dollfus',
        text: "Head to the Place de la Concorde. There, you shall find enough to 'compile' a suit worthy of an 18th-century Mulhousien."
    },
    {
        actions: [
            { type: 'remove', id: 'dollfus' },
            { type: 'flip', id: 'seb', flip: false }
        ],
        speaker: 'seb',
        text: "Okay, the ghost is a bit old-school, but he’s right. To the river! Time to craft a little textile patch."
    }
];

const victorySteps = [
    {
        background: 'assets/img/background2.png',
        actions: [
            { type: 'spawn', id: 'dollfus', x: 0.8, y: 0.8, sprite: 'assets/img/elements/dollfus.png', anims: { idle: { srcY: 0, frameW: 109, frameH: 191, cols: 4, frames: 4, fps: 8 } }, scale: 0.7, flip:true }
        ],
        speaker: 'dollfus',
        text: "Wait... let me look at that texture. That indigo hue... those cross-stitched fibers..."
    },
    {
        speaker: 'dollfus',
        text: "By the heavens! This is my own high-grade calico! He has pillaged the private reserves of the Dollfus family!"
    },
    {
        speaker: 'dollfus',
        text: "How dare he steal the soul of the 'Manchester of France'? This was destined for Europe's finest markets, not for a... a 'Developer'!"
    },
    {
        speaker: 'dollfus',
        text: "I am beyond furious. This is a violation of my legacy! A total breach of my industrial protocol!"
    },
    {
        speaker: 'dollfus',
        text: "I will pursue Him through every alley of Mulhouse! From the Rebberg to the banks of the Ill!"
    }
];

let controlsInverted = false;
let inversionTimer = 0;
const INVERSION_DURATION = 180;

let isOiled = false;
let oilTimer = 0;
const OIL_DURATION = 300;

let isImmobilized = false;
let immobilizationTimer = 0;
const IMMOBILIZATION_DURATION = 120;

let beerLevel = 0;
let beerTimer = 0;
const BEER_DURATION = 400;

let backgroundY = 0;
let keys = { ArrowLeft: false, ArrowRight: false };

let backtrack = null;

/**
 * Configuration du sprite Radeau (652x896)
 * Divisé en lignes: 1=Face, 2=Gauche, 3=Droite. 4 colonnes (idle)
 * Modifiez sx, sy, sw, sh pour un redécoupage précis.
 * Modifiez ox, oy pour recentrer l'image dessinée et éviter le tremblement !
 */
const raftConfig = {
    front: [
        { sx: 0, sy: 0, sw: 163, sh: 224, ox: 0, oy: 0 },
        { sx: 163, sy: 0, sw: 163, sh: 224, ox: 0, oy: 0 },
        { sx: 326, sy: 0, sw: 163, sh: 224, ox: 0, oy: 0 },
        { sx: 489, sy: 0, sw: 163, sh: 224, ox: 0, oy: 0 }
    ],
    left: [
        { sx: 0, sy: 224, sw: 163, sh: 224, ox: 0, oy: 0 },
        { sx: 163, sy: 224, sw: 163, sh: 224, ox: 0, oy: 0 },
        { sx: 326, sy: 224, sw: 163, sh: 224, ox: 0, oy: 0 },
        { sx: 489, sy: 224, sw: 163, sh: 224, ox: 0, oy: 0 }
    ],
    right: [
        { sx: 0, sy: 448, sw: 163, sh: 224, ox: 0, oy: 0 },
        { sx: 163, sy: 448, sw: 163, sh: 224, ox: 0, oy: 0 },
        { sx: 326, sy: 448, sw: 163, sh: 224, ox: 0, oy: 0 },
        { sx: 489, sy: 448, sw: 163, sh: 224, ox: 0, oy: 0 }
    ]
};

/**
 * Configuration du sprite Personnage (lehmann.png)
 * La ligne 1 contient 8 frames d'inactivité (Idle).
 * Modifiez ox et oy pour recentrer et attacher le joueur sur le radeau.
 */
const lehmannConfig = [
    { sx: 0, sy: 0, sw: 24, sh: 52, ox: 0, oy: 0 },
    { sx: 24, sy: 0, sw: 24, sh: 52, ox: 0, oy: 0 },
    { sx: 48, sy: 0, sw: 24, sh: 52, ox: 0, oy: 0 },
    { sx: 72, sy: 0, sw: 24, sh: 52, ox: 0, oy: 0 },
    { sx: 96, sy: 0, sw: 24, sh: 52, ox: 0, oy: 0 },
    { sx: 120, sy: 0, sw: 24, sh: 52, ox: 0, oy: 0 },
    { sx: 144, sy: 0, sw: 24, sh: 52, ox: 0, oy: 0 },
    { sx: 168, sy: 0, sw: 24, sh: 52, ox: 0, oy: 0 }
];

/**
 * Adjusts canvas dimensions to match the window viewport size.
 * Scales object sizes responsively for PC, tablet, or mobile.
 * Repositions the player relative to the new dimensions.
 */
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    W = canvas.width;
    H = canvas.height;

    if (W > 1024) {
        objectSize = 50;
    } else if (W > 600) {
        objectSize = 40;
    } else {
        objectSize = 30;
    }

    player.x = (W / 2) - (player.w / 2);
    player.y = H - player.h - 50;
}

/**
 * Evaluates the player's acceleration and determines final velocity using friction.
 * Halts motion instantly if the player is currently immobilized by a malus.
 * Ensures the player strictly stays within relative boundary margins.
 */
function updatePhysics() {
    if (isImmobilized) {
        player.vx = 0;
        player.ax = 0;
        return;
    }

    player.vx += player.ax;
    player.vx *= friction;
    player.x += player.vx;

    const margin = W * 0.13;

    if (player.x < margin) {
        player.x = margin;
        player.vx = 0;
    }
    if (player.x > W - player.w - margin) {
        player.x = W - player.w - margin;
        player.vx = 0;
    }
}

/**
 * Periodically generates downward-falling entities onto the canvas.
 * Spawns both required recipe items and random malus traps based on probabilities.
 * Assigns a random phase offset to each object for asynchronous wave interpolation.
 */
function spawnObject() {
    frameCount++;
    if (frameCount % 120 === 0) {
        const rand = Math.random();
        let type, id;

        if (rand < 0.5) {
            type = 'good';
            id = recipe[currentRecipeIndex];
        } else if (rand < 0.8) {
            type = 'good';
            id = Math.floor(Math.random() * 4) + 1;
        } else {
            type = 'malus';
            id = Math.floor(Math.random() * 2) + 1;
            if (Math.random() > 0.5) id = 3;
        }

        const margin = W * 0.15;
        const spawnX = margin + Math.random() * (W - objectSize - 2 * margin);
        const phase = Math.random() * Math.PI * 2;
        const phaseIndex = Math.floor((phase * 180) / Math.PI) % sineTable.length;

        objects.push({ x: spawnX, y: -objectSize, w: objectSize, h: objectSize, type: type, id: id, phase: phase, phaseIndex: phaseIndex });
    }
}

/**
 * Iterates over generated structural objects, applying sinusoidal wave transformations to their descent.
 * Detects geometric collision overlapping with the player, calling pickup logic upon overlap.
 * Garbage-collects objects that safely moved completely off the bottom bounds of the canvas.
 */
function updateObjects() {
    for (let i = objects.length - 1; i >= 0; i--) {
        let obj = objects[i];
        const waveOffset = waveAmplitude * sineTable[(frameCount + obj.phaseIndex) % sineTable.length];
        obj.y += spawnSpeed + waveOffset;

        // Réduction de la zone de collision (hitbox) d'environ 25-30%
        let hitX = player.x + 15;
        let hitY = player.y + 20;
        let hitW = player.w - 30;
        let hitH = player.h - 40;

        if (rectIntersect(hitX, hitY, hitW, hitH, obj.x, obj.y, obj.w, obj.h)) {
            handlePickup(obj);
            objects.splice(i, 1);
            continue;
        }

        if (obj.y > H) {
            objects.splice(i, 1);
        }
    }
}

/**
 * Confirms boolean geometric bounds interception recursively checking two respective quadrilaterals.
 */
function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
}

/**
 * Dynamically rewrites and synchronizes the active recipe user interface.
 * Manages item styling to demonstrate gathered, active, or missing state classes.
 */
function updateRecipeUI() {
    const wrapper = document.getElementById('recipe-container');
    const container = document.getElementById('recipe-items');

    if (gameActive && !victory) {
        wrapper.style.display = 'flex';
    } else {
        wrapper.style.display = 'none';
        return;
    }

    container.innerHTML = '';

    recipe.forEach((id, index) => {
        const item = document.createElement('div');
        item.className = 'recipe-item';

        const type = ingredientMap[id];
        if (type) {
            item.classList.add(`item-${type}`);
        }

        if (index < currentRecipeIndex) {
            item.classList.add('collected');
        } else if (index === currentRecipeIndex) {
            item.classList.add('current');
        }

        container.appendChild(item);
    });
}

/**
 * Resolves logic consequence directly resulting from a player collision.
 * Correct components progress the recipe sequence, incorrect items penalize by resetting, and maluses apply temporal status ailments.
 */
function handlePickup(obj) {
    if (obj.type === 'good') {
        if (obj.id === recipe[currentRecipeIndex]) {
            currentRecipeIndex++;
            updateRecipeUI();
            if (currentRecipeIndex === recipe.length) {
                gameActive = false;
                victory = true;
            }
        } else {
            currentRecipeIndex = 0;
            updateRecipeUI();
        }
    } else {
        if (obj.id === 1 || obj.id === 2) {
            isImmobilized = true;
            immobilizationTimer = IMMOBILIZATION_DURATION;
        } else if (obj.id === 3) {
            controlsInverted = true;
            inversionTimer = BEER_DURATION;
            beerLevel = 4;
            beerTimer = BEER_DURATION;
            updateBeerUI();
        }
    }
}

/**
 * Selectively updates the visual DOM to map towards the prevailing tier integer of the beer malus.
 */
function updateBeerUI() {
    const beerUI = document.getElementById('beer-status');
    if (beerLevel > 0) {
        beerUI.style.display = 'block';
        beerUI.className = `beer-${beerLevel}`;
    } else {
        beerUI.style.display = 'none';
    }
}

/**
 * Executes a recursive requestAnimationFrame mainloop.
 * Invokes background rendering logic, dictates entity state management processing, and draws graphical elements conditionally via contexts.
 */
function draw() {
    if (typeof Cinematic !== 'undefined' && Cinematic.isPlaying()) {
        requestAnimationFrame(draw);
        return;
    }

    requestAnimationFrame(draw);

    if (victory) {
        document.getElementById('pause-btn').style.display = 'none';
        document.getElementById('recipe-container').style.display = 'none';
        document.getElementById('beer-status').style.display = 'none';
        document.getElementById('victoryScreen').style.display = 'flex';
        if (backtrack) {
            backtrack.pause();
            backtrack = null;
        }
        return;
    }

    if (isPaused) {
        if (backtrack) {
            backtrack.pause();
        }
        return;
    }

    ctx.clearRect(0, 0, W, H);

    // Pixel-Art effect : désactive le lissage de l'image
    ctx.imageSmoothingEnabled = false;

    backgroundY += spawnSpeed + waveAmplitude * sineTable[frameCount % sineTable.length];
    if (images.river.complete && images.river.naturalWidth !== 0) {
        const imgH = W * (images.river.naturalHeight / images.river.naturalWidth);
        const yOffset = backgroundY % imgH;

        for (let y = yOffset - imgH; y < H; y += imgH) {
            ctx.drawImage(images.river, 0, y, W, imgH);
        }
    } else {
        ctx.fillStyle = "#29a4dc";
        ctx.fillRect(0, 0, W, H);
    }

    if (!gameActive) return;

    if (controlsInverted) {
        inversionTimer--;
        if (inversionTimer <= 0) controlsInverted = false;
    }
    if (isOiled) {
        oilTimer--;
        if (oilTimer <= 0) isOiled = false;
    }
    if (isImmobilized) {
        immobilizationTimer--;
        if (immobilizationTimer <= 0) isImmobilized = false;
    }
    if (beerLevel > 0) {
        beerTimer--;
        if (beerTimer <= 0) {
            controlsInverted = false;
            inversionTimer = 0;
        }
        let newLevel = Math.ceil((beerTimer / BEER_DURATION) * 4);
        if (newLevel !== beerLevel) {
            beerLevel = newLevel;
            updateBeerUI();
        }
    }

    handleKeyboardInput();
    updatePhysics();
    spawnObject();
    updateObjects();

    objects.forEach(obj => {
        let currentImg = null;
        if (obj.type === 'good') {
            currentImg = images[ingredientMap[obj.id]];
        } else {
            if (obj.id === 1 || obj.id === 2) currentImg = images.gear;
            if (obj.id === 3) currentImg = images.beer;
        }

        if (currentImg && currentImg.complete && currentImg.naturalWidth !== 0) {
            ctx.drawImage(currentImg, obj.x, obj.y, obj.w, obj.h);
        } else {
            ctx.fillStyle = obj.type === 'good' ? "#4CAF50" : "#F44336";
            ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
            ctx.fillStyle = "white";
            ctx.font = "bold 14px Arial";
            ctx.textAlign = "center";
            ctx.fillText(obj.id, obj.x + obj.w / 2, obj.y + obj.h / 2 + 5);
        }
    });

    drawPlayer();

}

/**
 * Gère le dessin du radeau et du joueur superposé.
 */
function drawPlayer() {
    // 1. Détermine le sens du radeau (reste de face comme demandé)
    player.state = 'front';

    // Animation du radeau (1 frame toutes les 15 boucles)
    if (frameCount % 15 === 0) {
        player.frame = (player.frame + 1) % 4;
    }
    const currentRaftConfig = raftConfig[player.state][player.frame];

    // Dessin du radeau
    if (images.raft.complete && images.raft.naturalWidth !== 0) {
        ctx.drawImage(
            images.raft,
            currentRaftConfig.sx, currentRaftConfig.sy,
            currentRaftConfig.sw, currentRaftConfig.sh,
            player.x + currentRaftConfig.ox, player.y + currentRaftConfig.oy,
            player.w, player.h
        );
    } else {
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(player.x, player.y, player.w, player.h);
    }

    // 2. Animation et dessin du personnage (plus rapide, 8 frames toutes les 7 frames)
    let charFrame = Math.floor(frameCount / 7) % 8;
    const currentCharConfig = lehmannConfig[charFrame];

    // Le ratio du sprite est environ 24x44, on le réduit considérablement
    const charW = player.w * 0.45; // plus petit
    const charH = player.h * 0.75; // plus petit

    // Orientation du personnage selon la vitesse
    let charScaleX = 1;
    // Si l'affichage pointe dans le mauvais sens, on inverse simplement la condition :
    if (player.vx < -0.5) {
        charScaleX = -1;
    } else if (player.vx > 0.5) {
        charScaleX = 1;
    }

    // Position finale (centrée sur le radeau + offsets de configuration)
    let finalX = player.x + (player.w - charW) / 2 + currentRaftConfig.ox + currentCharConfig.ox;
    let finalY = player.y + (player.h - charH) / 2 - 5 + currentRaftConfig.oy + currentCharConfig.oy;

    ctx.save();
    if (charScaleX === -1) {
        ctx.scale(-1, 1);
        finalX = -finalX - charW;
    }

    if (images.lehmann.complete && images.lehmann.naturalWidth !== 0) {
        ctx.drawImage(
            images.lehmann,
            currentCharConfig.sx, currentCharConfig.sy,
            currentCharConfig.sw, currentCharConfig.sh,
            finalX, finalY,
            charW, charH
        );
    }
    ctx.restore();
}

/**
 * Calculates responsive analog lateral acceleration mapping mapped natively onto device orientation architecture.
 */
window.addEventListener('deviceorientation', (event) => {
    if (event.gamma !== null) {
        let currentSense = isOiled ? sensitivity / 2 : sensitivity;
        let tilt = event.gamma * currentSense;
        if (controlsInverted) tilt *= -1;
        player.ax = tilt;
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key in keys) keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key in keys) keys[e.key] = false;
});

/**
 * Reads local keyboard states converting active boolean bounds recursively onto dynamic player coordinate orientation.
 */
function handleKeyboardInput() {
    let currentSense = isOiled ? sensitivity / 2 : sensitivity;
    let tilt = 0;
    if (keys.ArrowLeft) tilt = -5 * currentSense;
    if (keys.ArrowRight) tilt = 5 * currentSense;

    if (tilt !== 0) {
        if (controlsInverted) tilt *= -1;
        player.ax = tilt;
    } else if (typeof DeviceOrientationEvent === 'undefined') {
        player.ax = 0;
    }
}

/**
 * Employs a Fisher-Yates descending pass iteration modifying internal initial arrays towards randomness.
 */
function shuffleRecipe() {
    for (let i = recipe.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [recipe[i], recipe[j]] = [recipe[j], recipe[i]];
    }
}

document.getElementById('pause-btn').addEventListener('click', () => {
    isPaused = true;
    document.getElementById('pauseScreen').style.display = 'flex';
    document.getElementById('pause-btn').style.display = 'none';
});

document.getElementById('resumeBtn').addEventListener('click', () => {
    isPaused = false;
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('pause-btn').style.display = 'flex';
    backtrack.play();
});

document.getElementById('restartBtn').addEventListener('click', () => {
    isPaused = false;
    gameActive = false;
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('pause-btn').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
    document.getElementById('recipe-container').style.display = 'none';
    document.getElementById('beer-status').style.display = 'none';
});

document.getElementById('quitBtn').addEventListener('click', () => {
    isPaused = false;
    victory = true;
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('pause-btn').style.display = 'none';
    document.getElementById('recipe-container').style.display = 'none';
    document.getElementById('beer-status').style.display = 'none';
});

startBtn.addEventListener('click', () => {
    startScreen.style.display = 'none';

    backtrack = new Audio('../assets/sounds/jeu2.mp3');
    backtrack.loop = true;
    backtrack.play();

    document.getElementById('pause-btn').style.display = 'flex';
    gameActive = true;

    currentRecipeIndex = 0;
    victory = false;
    isPaused = false;
    objects = [];
    beerLevel = 0;
    beerTimer = 0;
    isImmobilized = false;
    controlsInverted = false;
    updateBeerUI();
    shuffleRecipe();
    updateRecipeUI();

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState !== 'granted') {
                    alert("L'accès aux capteurs est nécessaire pour jouer !");
                }
            })
            .catch(console.error);
    }
});

document.getElementById('victoryRestartBtn').addEventListener('click', () => {
    document.getElementById('victoryScreen').style.display = 'none';
    startBtn.click();
});

document.getElementById('victoryContinueBtn').addEventListener('click', () => {
    document.getElementById('victoryScreen').style.display = 'none';
    victory = false;
    Cinematic.play(canvas, victorySteps, () => {
        document.getElementById('startScreen').style.display = 'flex';
    });
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
draw();

// Lancer la cinématique d'intro au chargement
document.getElementById('startScreen').style.display = 'none';
Cinematic.play(canvas, introSteps, () => {
    document.getElementById('startScreen').style.display = 'flex';
});
