// 图片都放在 assets/images/ 里
const ART_W = 1859;
const ART_H = 1668;

// L_eye.png 在原画布中的位置
const EYE = { x: 602, y: 677, w: 221, h: 92 };
const IRIS = { x: 724, y: 719, radius: 37 };

// 眼睛最多只移动这么远
const MAX_LOOK_X = 30;
const MAX_LOOK_Y = 15;

let peopleImage;
let eyeImage;
let eyeLayer;

let video;
let stream = null;
let handPose = null;
let handPosePromise;
let detecting = false;
let cameraOn = false;
let busy = false;
let hands = [];
let lastHandTime = 0;

let eyeX = 0;
let eyeY = 0;
let targetEyeX = 0;
let targetEyeY = 0;

let toggleButton;
let cameraSelect;
let statusText;

function preload() {
  peopleImage = loadImage("assets/images/L_people.png");
  eyeImage = loadImage("assets/images/L_eye.png");
}

function setup() {
  const size = stageSize();
  const canvas = createCanvas(size.w, size.h);
  canvas.parent("stage");
  pixelDensity(1);

  eyeLayer = createGraphics(EYE.w, EYE.h);
  eyeLayer.pixelDensity(1);

  // 创建一个隐藏的视频元素。摄像头由页面按钮启动。
  video = createVideo([]);
  video.hide();
  video.elt.muted = true;
  video.elt.autoplay = true;
  video.elt.setAttribute("playsinline", "");
  video.elt.setAttribute("webkit-playsinline", "");

  // 先加载模型；无需立刻开启摄像头
  handPosePromise = ml5.handPose({ maxHands: 1 });

  toggleButton = document.getElementById("camera-toggle");
  cameraSelect = document.getElementById("camera-select");
  statusText = document.getElementById("status");

  toggleButton.addEventListener("click", async () => {
    if (busy) return;

    if (cameraOn) {
      stopCamera();
    } else {
      await startCamera(cameraSelect.value);
    }
  });

  cameraSelect.addEventListener("change", async () => {
    if (!cameraOn || busy) return;
    await startCamera(cameraSelect.value);
  });

  if (navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", updateCameraList);
  }
}

function draw() {
  background("#1a1a1a");

  updateGaze();
  drawEyeLayer();

  const layout = getLayout();

  drawCameraPanel(layout.camera);
  drawCharacter(layout.character);
}

// 根据屏幕宽度决定左右排列还是上下排列
function stageSize() {
  const available = Math.max(280, window.innerWidth - 28);
  const w = Math.min(1100, available);
  const narrow = w < 700;

  return {
    w: Math.round(w),
    h: Math.round(narrow ? w * 1.72 : w * 0.59)
  };
}

function windowResized() {
  const size = stageSize();
  resizeCanvas(size.w, size.h);
}

function getLayout() {
  const narrow = width < 700;
  const pad = narrow ? 14 : 28;

  if (narrow) {
    const panelW = width - pad * 2;
    const cameraH = Math.round(panelW * 0.68);

    return {
      camera: {
        x: pad,
        y: 18,
        w: panelW,
        h: cameraH
      },
      character: {
        x: pad,
        y: cameraH + 34,
        w: panelW,
        h: height - cameraH - 52
      }
    };
  }

  const panelW = (width - pad * 3) / 2;

  return {
    camera: {
      x: pad,
      y: 20,
      w: panelW,
      h: height - 40
    },
    character: {
      x: pad * 2 + panelW,
      y: 20,
      w: panelW,
      h: height - 40
    }
  };
}

function drawCameraPanel(box) {
  if (cameraOn && video.elt.readyState >= 2) {
    drawCameraFrame(box);
    drawFingerMarker(box);
  } else {
    noStroke();
    fill(128, 111, 246);
    textFont("monospace");
    textSize(13);
    textAlign(CENTER, CENTER);
    text("CAMERA OFF", box.x + box.w / 2, box.y + box.h / 2);
  }
}

// 关键：按手机摄像头的真实比例裁切，绝不压扁画面
function drawCameraFrame(box) {
  const source = video.elt;
  const sourceW = source.videoWidth;
  const sourceH = source.videoHeight;

  if (!sourceW || !sourceH) return;

  const sourceRatio = sourceW / sourceH;
  const boxRatio = box.w / box.h;

  let cropX = 0;
  let cropY = 0;
  let cropW = sourceW;
  let cropH = sourceH;

  if (sourceRatio > boxRatio) {
    cropW = sourceH * boxRatio;
    cropX = (sourceW - cropW) / 2;
  } else {
    cropH = sourceW / boxRatio;
    cropY = (sourceH - cropH) / 2;
  }

  push();

  drawingContext.beginPath();
  drawingContext.rect(box.x, box.y, box.w, box.h);
  drawingContext.clip();

  // 自拍镜像
  translate(box.x + box.w, box.y);
  scale(-1, 1);

  drawingContext.drawImage(
    source,
    cropX, cropY, cropW, cropH,
    0, 0, box.w, box.h
  );

  pop();
}

function drawCharacter(box) {
  const scaleFactor = Math.min(box.w / ART_W, box.h / ART_H);
  const artW = ART_W * scaleFactor;
  const artH = ART_H * scaleFactor;
  const artX = box.x + (box.w - artW) / 2;
  const artY = box.y + (box.h - artH) / 2;

  // 眼睛在后
  image(
    eyeLayer,
    artX + EYE.x * scaleFactor,
    artY + EYE.y * scaleFactor,
    EYE.w * scaleFactor,
    EYE.h * scaleFactor
  );

  // 人物在前，遮住不该露出的眼球部分
  image(peopleImage, artX, artY, artW, artH);
}

function drawEyeLayer() {
  const ctx = eyeLayer.drawingContext;
  ctx.clearRect(0, 0, EYE.w, EYE.h);

  // 从 L_eye.png 截取白眼
  ctx.drawImage(
    eyeImage.canvas,
    EYE.x, EYE.y, EYE.w, EYE.h,
    0, 0, EYE.w, EYE.h
  );

  const x = IRIS.x - EYE.x + eyeX;
  const y = IRIS.y - EYE.y + eyeY;
  const r = IRIS.radius;

  // 只允许颜色出现在白眼图片的不透明部分
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";

  // 浅紫色瞳孔
  ctx.fillStyle = "#806FF6";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // 深紫色的斜向阴影
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = "#33265E";
  ctx.beginPath();
  ctx.moveTo(x - r - 2, y - r - 2);
  ctx.lineTo(x + r + 2, y - r - 2);
  ctx.lineTo(x + r + 2, y - 9);
  ctx.lineTo(x - r - 2, y + 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

function gotHands(results) {
  if (!cameraOn) return;

  hands = results;

  if (hands.length > 0) {
    lastHandTime = millis();
  }
}

function updateGaze() {
  if (cameraOn && hands.length > 0) {
    const tip = hands[0].keypoints?.[8];

    if (tip) {
      // 画面是镜像显示的，因此水平方向也做镜像
      const inputW = video.width || video.elt.videoWidth || 640;
      const inputH = video.height || video.elt.videoHeight || 480;

      const mirroredX = 1 - tip.x / inputW;
      const normalizedY = tip.y / inputH;

      targetEyeX = constrain(
        (mirroredX - 0.5) * MAX_LOOK_X * 2,
        -MAX_LOOK_X,
        MAX_LOOK_X
      );

      targetEyeY = constrain(
        (normalizedY - 0.5) * MAX_LOOK_Y * 2,
        -MAX_LOOK_Y,
        MAX_LOOK_Y
      );
    }
  } else if (!cameraOn || millis() - lastHandTime > 700) {
    targetEyeX = 0;
    targetEyeY = 0;
  }

  eyeX = lerp(eyeX, targetEyeX, 0.14);
  eyeY = lerp(eyeY, targetEyeY, 0.14);
}

async function startCamera(deviceId = "") {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("CAMERA REQUIRES HTTPS");
    return;
  }

  busy = true;
  toggleButton.disabled = true;
  cameraSelect.disabled = true;
  setStatus("CONNECTING...");

  // 切换设备前先释放原摄像头
  stopCameraStream();

  try {
    const constraints = {
      audio: false,
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: "user" }
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.elt.srcObject = stream;

    await video.elt.play();

    // 让 ml5 使用摄像头的实际宽高来计算手部坐标
    video.size(video.elt.videoWidth, video.elt.videoHeight);

    cameraOn = true;
    handPose = await handPosePromise;
    handPose.detectStart(video, gotHands);
    detecting = true;

    await updateCameraList();
    setStatus("TRACKING HAND");
  } catch (error) {
    console.error("Camera error:", error);
    stopCameraStream();
    setStatus(
      error.name === "NotAllowedError"
        ? "CAMERA PERMISSION DENIED"
        : "CAMERA UNAVAILABLE"
    );
  } finally {
    busy = false;
    toggleButton.disabled = false;
    cameraSelect.disabled = !cameraOn;
    toggleButton.textContent = cameraOn
      ? "TURN CAMERA OFF"
      : "TURN CAMERA ON";
    toggleButton.classList.toggle("is-on", cameraOn);
  }
}

function stopCamera() {
  stopCameraStream();
  setStatus("CAMERA OFF");
  toggleButton.textContent = "TURN CAMERA ON";
  toggleButton.classList.remove("is-on");
  cameraSelect.disabled = true;
}

function stopCameraStream() {
  cameraOn = false;
  hands = [];
  targetEyeX = 0;
  targetEyeY = 0;

  if (detecting && handPose) {
    handPose.detectStop();
    detecting = false;
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  if (video) {
    video.elt.pause();
    video.elt.srcObject = null;
  }
}

async function updateCameraList() {
  if (!navigator.mediaDevices?.enumerateDevices) return;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === "videoinput");

    const currentId =
      stream?.getVideoTracks()[0]?.getSettings().deviceId || "";

    cameraSelect.replaceChildren();

    if (cameras.length === 0) {
      cameraSelect.add(new Option("DEFAULT CAMERA", ""));
      return;
    }

    cameras.forEach((camera, index) => {
      const name = camera.label || `CAMERA ${index + 1}`;
      cameraSelect.add(new Option(name, camera.deviceId));
    });

    if (cameras.some(camera => camera.deviceId === currentId)) {
      cameraSelect.value = currentId;
    }
  } catch (error) {
    console.error("Could not list cameras:", error);
  }
}

function setStatus(message) {
  statusText.textContent = message;
}

function drawFingerMarker(box) {
  const tip = hands[0]?.keypoints?.[8]; // 食指指尖
  const sourceW = video.elt.videoWidth;
  const sourceH = video.elt.videoHeight;

  if (!tip || !sourceW || !sourceH) return;

  // 与 drawCameraFrame 使用相同的中央裁切
  const sourceRatio = sourceW / sourceH;
  const boxRatio = box.w / box.h;

  let cropX = 0;
  let cropY = 0;
  let cropW = sourceW;
  let cropH = sourceH;

  if (sourceRatio > boxRatio) {
    cropW = sourceH * boxRatio;
    cropX = (sourceW - cropW) / 2;
  } else {
    cropH = sourceW / boxRatio;
    cropY = (sourceH - cropH) / 2;
  }

  // 摄像画面是镜像的，所以 x 也要镜像
  const markerX = box.x + box.w
    - ((tip.x - cropX) / cropW) * box.w;
  const markerY = box.y
    + ((tip.y - cropY) / cropH) * box.h;

  push();

  // 手指走出摄像画面时，圈也不会画到人物那边
  drawingContext.beginPath();
  drawingContext.rect(box.x, box.y, box.w, box.h);
  drawingContext.clip();

  noFill();
  stroke(128, 111, 246);
  strokeWeight(3);
  circle(markerX, markerY, 28);

  noStroke();
  fill(128, 111, 246);
  circle(markerX, markerY, 6);

  pop();
}