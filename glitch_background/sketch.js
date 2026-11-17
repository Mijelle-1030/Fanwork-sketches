// GLITCH SIGNAL — original p5.js motion background
// Press S to save a screenshot; space to pause; 1/2/3 to switch mood.
let pg;
let mode = 0;
let modeUntil = 0;
let tick = 0;
let paused = false;
let palette = ['#080510','#ff153e','#ff6b00','#f6ff00','#16ff47','#00f9ed','#034bff','#bd00ff','#ff32ce','#ffffff'];
const glyphs = '01<>#%$@!\/[]{}ERROR_SYS_;;::+=-';

function setup() {
  createCanvas(960, 540);
  pixelDensity(1);
  frameRate(24);
  noSmooth();
  pg = createGraphics(480, 270); // low resolution makes the image deliberately pixelated
  pg.pixelDensity(1);
  pg.noSmooth();
  textFont('monospace');
}

function draw() {
  if (paused) return;
  tick++;
  if (tick >= modeUntil) {
    mode = floor(random(4));
    modeUntil = tick + floor(random(7, 29));
  }
  pg.background(random() < 0.7 ? '#05030c' : random(palette));
  if (mode === 0) colorTear();
  if (mode === 1) corruptTerminal();
  if (mode === 2) noisySignal();
  if (mode === 3) brokenBlocks();
  horizontalTears();
  if (random() < 0.13) flashBand();
  scanlines();
  // Occasionally duplicate a stripe offset to create an RGB-channel displacement.
  background(0);
  image(pg, 0, 0, width, height);
  if (random() < 0.28) {
    let y = floor(random(0, 255));
    let h = floor(random(3, 24));
    tint(random() < 0.5 ? color(255, 40, 200, 95) : color(30, 230, 255, 95));
    image(pg, random(-40, 40), y * 2, width, h * 2, 0, y, 480, h);
    noTint();
  }
}

function colorTear() {
  let y = 0;
  while (y < 270) {
    const h = floor(random(1, 24));
    pg.noStroke(); pg.fill(random(palette));
    pg.rect(0, y, 480, h);
    if (random() < 0.66) {
      pg.fill(random(palette));
      pg.rect(random(-40, 320), y, random(30, 360), random(1, h + 1));
    }
    y += h;
  }
  pg.blendMode(ADD);
  for (let i = 0; i < 26; i++) {
    pg.fill(random([color(255,0,50,125),color(0,255,220,125),color(240,0,255,125)]));
    pg.rect(random(-40,480), random(270), random(10,240), random(1,6));
  }
  pg.blendMode(BLEND);
}

function corruptTerminal() {
  pg.fill(0);pg.rect(0,0,480,270);
  pg.textFont('monospace');
  pg.textSize(random([7,8,9,10]));
  pg.textStyle(BOLD);
  for (let y = 5; y < 270; y += 9) {
    if (random() < 0.17) continue;
    pg.fill(random(['#ffffff','#ff236c','#27ff39','#03f9ff','#e3d700','#ab1aff']));
    let line = '';
    const len = floor(random(25,115));
    for (let j = 0; j < len; j++) line += glyphs[floor(random(glyphs.length))];
    pg.text(line, random(-80,10), y);
  }
  if (random() < 0.6) {pg.noStroke();pg.fill(0);pg.rect(random(150,370),0,random(50,180),270);}
}

function noisySignal() {
  pg.noStroke();
  let bg = random(['#e9ff20','#ff00a6','#12ffff','#ec2800','#1100da']);
  pg.background(bg);
  for (let i = 0; i < 6500; i++) {
    pg.fill(random(palette));
    pg.rect(random(480),random(270),random(1,5),random(1,3));
  }
  for (let i = 0; i < 45; i++) {
    pg.fill(random(palette));
    pg.rect(random(-80,430),random(270),random(20,330),random(1,8));
  }
}

function brokenBlocks() {
  pg.background('#03030b');
  pg.noStroke();
  for (let i = 0; i < 260; i++) {
    const y = floor(random(270));
    const h = floor(random(1,13));
    pg.fill(random(palette));
    pg.rect(random(-50,480),y,random(5,340),h);
  }
  for (let i = 0; i < 220; i++) {
    pg.fill(random(palette));
    pg.rect(random(480),random(270),random(2,22),random(1,7));
  }
}

function horizontalTears() {
  pg.noStroke();
  for (let i = 0; i < 32; i++) {
    let y = floor(random(270));
    pg.fill(random(palette));
    pg.rect(random(-60,420),y,random(15,400),random(1,4));
  }
  for (let i = 0; i < 12; i++) {
    let y = floor(random(270));
    pg.fill(random() < 0.6 ? '#020105' : random(palette));
    pg.rect(random(-30,300),y,random(50,320),random(1,10));
  }
}

function flashBand() {
  pg.noStroke();pg.fill(random(['#ffffff','#00ffff','#ff004c','#ffe900']));
  pg.rect(0,random(0,220),480,random(8,70));
}

function scanlines() {
  pg.stroke(0,60);pg.strokeWeight(1);
  for (let y = 0; y < 270; y += 3) pg.line(0,y,480,y);
  pg.noStroke();
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('glitch-frame','png');
  if (key === ' ') { paused = !paused; return false; }
  if (key === '1') { mode = 0; modeUntil = tick + 999999; }
  if (key === '2') { mode = 1; modeUntil = tick + 999999; }
  if (key === '3') { mode = 2; modeUntil = tick + 999999; }
  if (key === '0') modeUntil = 0;
}
