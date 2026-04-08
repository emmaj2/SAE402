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
    gear: new Image()
};

images.fabric.src = 'assets/img/elements/ingredients/fabric.svg';
images.dye.src = 'assets/img/elements/ingredients/dye.svg';
images.needle.src = 'assets/img/elements/ingredients/needle.svg';
images.scissors.src = 'assets/img/elements/ingredients/scissors.svg';
images.river.src = 'assets/img/river.svg';
images.beer.src = 'assets/img/elements/malus/beer4.svg';
images.gear.src = 'assets/img/elements/malus/gear.svg';

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
const sensitivity = 0.12;
const waveAmplitude = 0.2; 
const waveFrequency = 0.03; 

let H, W;
let player = { x: 0, y: 0, w: 60, h: 40, vx: 0, ax: 0 };
let objects = [];
let objectSize = 50; 
const spawnSpeed = 2; 
const sineTable = Array.from({ length: 360 }, (_, i) => Math.sin(i * Math.PI / 180));
let frameCount = 0;

let recipe = [1, 2, 3, 4]; 
let currentRecipeIndex = 0; 
let gameActive = false;
let victory = false;
let isPaused = false;

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
        objectSize = 65; 
    } else if (W > 600) {
        objectSize = 50; 
    } else {
        objectSize = 35; 
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

        if (rectIntersect(player.x, player.y, player.w, player.h, obj.x, obj.y, obj.w, obj.h)) {
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
    requestAnimationFrame(draw);

    if (victory) {
        document.getElementById('pause-btn').style.display = 'none';
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "white";
        ctx.font = "40px Arial";
        ctx.textAlign = "center";
        ctx.fillText("VICTOIRE !", W / 2, H / 2);
        return;
    }

    if (isPaused) {
        return;
    }

    ctx.clearRect(0, 0, W, H);

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
            ctx.fillText(obj.id, obj.x + obj.w/2, obj.y + obj.h/2 + 5);
        }
    });

    ctx.fillStyle = "#8B4513"; 
    ctx.fillRect(player.x, player.y, player.w, player.h);
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
    if (keys.ArrowLeft) tilt = -8 * currentSense;
    if (keys.ArrowRight) tilt = 8 * currentSense;
    
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

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
draw();
