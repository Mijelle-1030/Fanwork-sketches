// EYE CONTACT
// 左侧：实时摄像头
// 右侧：L 的眼睛跟随食指移动

const ART_W = 1859;
const ART_H = 1668;

const VIDEO_W = 640;
const VIDEO_H = 480;

// 这两张 PNG 使用相同尺寸的透明画布
let peopleImage;
let eyeImage;

// 摄像头和手势识别
let video;
let handPose;
let hands = [];
let lastHandSeen = 0;
let modelStatus = "LOADING HAND TRACKING...";

// 眼白在原图中的位置
const EYE = {
  x: 602,
  y: 677,
  w: 221,
  h: 92
};

// 瞳孔在原图中的初始中心
const IRIS_CENTER = {
  x: 724,
  y: 719
};

const IRIS_RADIUS = 37;

// 控制眼球最多移动多远：单位是原图像素
const MAX_LOOK_X = 30;
const MAX_LOOK_Y = 15;

let eyeOffsetX = 0;
let eyeOffsetY = 0;
let targetX = 0;
let targetY = 0;

// 用于合成眼白和瞳孔的小画布
let eyeLayer;

function preload() {
  peopleImage = loadImage("assets/images/L_people.png");
  eyeImage = loadImage("assets/images/L_eye.png");
}

async function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  frameRate(30);

  eyeLayer = createGraphics(EYE.w, EYE.h);
  eyeLayer.pixelDensity(1);

  // 只获取摄像头画面，不获取麦克风声音
  video = createCapture(VIDEO);
  video.size(VIDEO_W, VIDEO_H);
  video.hide();

  try {
    handPose = await ml5.handPose({ maxHands: 1 });
    handPose.detectStart(video, gotHands);
    modelStatus = "SHOW YOUR HAND";
  } catch (error) {
    console.error("HandPose could not start:", error);
    modelStatus = "HAND TRACKING UNAVAILABLE";
  }
}

function draw() {
  background("#1b1b1b");

  updateEyePosition();
  updateEyeLayer();

  const layout = getLayout();

  drawCamera(layout.camera);
  drawCharacter(layout.character);

  drawLabels(layout);
}

// 接收 ml5 检测到的手
function gotHands(results) {
  hands = results;

  if (hands.length > 0) {
    lastHandSeen = millis();
  }
}

function updateEyePosition() {
  // 食指指尖是第 8 个关键点
  const finger = hands[0]?.keypoints?.[8];

  // 短暂丢失识别时不会立刻弹回中心
  const handIsRecent = millis() - lastHandSeen < 800;

  if (finger && handIsRecent) {
    // 左边显示的是镜像视频，所以这里也翻转 X 坐标
    const mirroredX = VIDEO_W - finger.x;

    targetX = map(
      mirroredX,
      0,
      VIDEO_W,
      -MAX_LOOK_X,
      MAX_LOOK_X
    );

    targetY = map(
      finger.y,
      0,
      VIDEO_H,
      -MAX_LOOK_Y,
      MAX_LOOK_Y
    );

    targetX = constrain(targetX, -MAX_LOOK_X, MAX_LOOK_X);
    targetY = constrain(targetY, -MAX_LOOK_Y, MAX_LOOK_Y);
  } else {
    // 手离开画面后，眼球缓慢回到中间
    targetX = 0;
    targetY = 0;
  }

  // 平滑移动，避免识别点抖动
  eyeOffsetX = lerp(eyeOffsetX, targetX, 0.14);
  eyeOffsetY = lerp(eyeOffsetY, targetY, 0.14);
}

function updateEyeLayer() {
  const ctx = eyeLayer.drawingContext;

  ctx.clearRect(0, 0, EYE.w, EYE.h);

  // 先从完整的 L_eye.png 中取出眼白区域
  ctx.drawImage(
    eyeImage.canvas,
    EYE.x, EYE.y, EYE.w, EYE.h,
    0, 0, EYE.w, EYE.h
  );

  // 换算成小画布里的位置
  const x = IRIS_CENTER.x - EYE.x + eyeOffsetX;
  const y = IRIS_CENTER.y - EYE.y + eyeOffsetY;

  // source-atop：后画的瞳孔只能出现在眼白的不透明区域
  ctx.globalCompositeOperation = "source-atop";

  // 浅紫色瞳孔
  ctx.fillStyle = "#806FF6";
  ctx.beginPath();
  ctx.arc(x, y, IRIS_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // 限制深紫色阴影只出现在圆形瞳孔内部
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, IRIS_RADIUS, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = "#33265E";
  ctx.beginPath();
  ctx.moveTo(x - IRIS_RADIUS - 2, y - IRIS_RADIUS - 2);
  ctx.lineTo(x + IRIS_RADIUS + 2, y - IRIS_RADIUS - 2);
  ctx.lineTo(x + IRIS_RADIUS + 2, y - 10);
  ctx.lineTo(x - IRIS_RADIUS - 2, y + 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

function getLayout() {
  if (width < 800) {
    // 窄屏：摄像头在上，人物在下
    return {
      camera: {
        x: width * 0.07,
        y: height * 0.05,
        w: width * 0.86,
        h: height * 0.28
      },
      character: {
        x: width * 0.02,
        y: height * 0.37,
        w: width * 0.96,
        h: height * 0.61
      }
    };
  }

  // 宽屏：摄像头在左，人物在右
  return {
    camera: {
      x: width * 0.055,
      y: height * 0.18,
      w: width * 0.40,
      h: height * 0.64
    },
    character: {
      x: width * 0.47,
      y: height * 0.04,
      w: width * 0.51,
      h: height * 0.93
    }
  };
}

function drawCamera(box) {
  // 细框，让视频与黑色背景有一点区分
  noFill();
  stroke(128, 111, 246, 110);
  strokeWeight(1);
  rect(box.x, box.y, box.w, box.h);

  if (!video || video.elt.readyState < 2) {
    noStroke();
    fill(180);
    textFont("monospace");
    textSize(13);
    textAlign(CENTER, CENTER);
    text("ALLOW CAMERA ACCESS", box.x + box.w / 2, box.y + box.h / 2);
    return;
  }

  // 视频填满框；多余的部分裁掉
  const scaleAmount = max(box.w / VIDEO_W, box.h / VIDEO_H);
  const drawW = VIDEO_W * scaleAmount;
  const drawH = VIDEO_H * scaleAmount;

  push();

  drawingContext.beginPath();
  drawingContext.rect(box.x, box.y, box.w, box.h);
  drawingContext.clip();

  // 镜像视频：你向右移动，屏幕中的自己也向右移动
  translate(box.x + box.w / 2, box.y + box.h / 2);
  scale(-1, 1);
  image(video, -drawW / 2, -drawH / 2, drawW, drawH);

  pop();

  drawTrackedFinger(box, scaleAmount);
}

function drawTrackedFinger(box, scaleAmount) {
  const finger = hands[0]?.keypoints?.[8];

  if (!finger || millis() - lastHandSeen >= 800) {
    return;
  }

  // 把识别坐标对应到镜像视频上
  const screenX =
    box.x + box.w / 2 +
    (VIDEO_W / 2 - finger.x) * scaleAmount;

  const screenY =
    box.y + box.h / 2 +
    (finger.y - VIDEO_H / 2) * scaleAmount;

  // 指尖在显示范围内才画标记
  if (
    screenX < box.x || screenX > box.x + box.w ||
    screenY < box.y || screenY > box.y + box.h
  ) {
    return;
  }

  noFill();
  stroke("#806FF6");
  strokeWeight(2);
  circle(screenX, screenY, 22);

  noStroke();
  fill("#806FF6");
  circle(screenX, screenY, 4);
}

function drawCharacter(box) {
  // 两张原图共享同一坐标，所以绘制时使用相同位置和比例
  const scaleAmount = min(box.w / ART_W, box.h / ART_H);
  const drawW = ART_W * scaleAmount;
  const drawH = ART_H * scaleAmount;

  const left = box.x + (box.w - drawW) / 2;
  const top = box.y + (box.h - drawH) / 2;

  push();
  translate(left, top);
  scale(scaleAmount);

  // 图层 1：眼白与被眼白裁切的瞳孔
  image(eyeLayer, EYE.x, EYE.y);

  // 图层 2：人物盖在眼睛前面，保留眼皮、头发的遮挡
  image(peopleImage, 0, 0);

  pop();
}

function drawLabels(layout) {
  noStroke();
  textFont("monospace");
  textSize(12);
  textAlign(LEFT, BOTTOM);

  fill("#806FF6");
  text(
    "CAMERA / 01",
    layout.camera.x,
    layout.camera.y - 10
  );

  fill(160);
  textAlign(LEFT, TOP);
  text(
    modelStatus,
    layout.camera.x,
    layout.camera.y + layout.camera.h + 12
  );
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}