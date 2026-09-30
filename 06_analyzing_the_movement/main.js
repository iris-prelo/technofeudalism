const TAG_IDS = new Set([0, 1, 2, 3]);
const mapWidth = 1498;
const mapHeight = 927;
const TAG_WORLD_SIZE = 80;
const TAG_WORLD_POSITIONS = {
  0: { x: 100, y: 100 },
  1: { x: mapWidth - 100, y: 100 },
  2: { x: mapWidth - 100, y: mapHeight - 100 },
  3: { x: 100, y: mapHeight - 100 }
};
const circleRadius = 16;

let circleX = mapWidth / 2;
let circleY = mapHeight / 2;
let detectedTags = {};
let apriltag = null;
let detecting = false;
let cameraHeading = 0;
let cameraPoseValid = false;
let smoothedCameraX = null;
let smoothedCameraY = null;
let smoothedCameraHeading = null;

let video;
let cameraOverlay;
let cameraCanvas;
let cameraStream;
let cameraSelect;
let selectedCameraId = "";
let cameraWidth = 640;
let cameraHeight = 480;

async function setup() {
  const trackingCanvas = createCanvas(mapWidth, mapHeight);
  trackingCanvas.parent(document.getElementById("tracking-layer"));

  video = document.getElementById("video");
  cameraOverlay = document.getElementById("camera-overlay");
  cameraSelect = document.getElementById("camera-select");

  cameraSelect.addEventListener("change", async () => {
    selectedCameraId = cameraSelect.value;
    await startCamera();
  });

  if (!video) {
    setStatus("Video element not found");
    return;
  }

  await startCamera();
  if (!cameraStream) return;

  await startAprilTag();
}

async function startCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }

  const videoConstraints = {
    width: { ideal: cameraWidth },
    height: { ideal: cameraHeight }
  };

  if (selectedCameraId) {
    videoConstraints.deviceId = { exact: selectedCameraId };
  } else {
    videoConstraints.facingMode = "environment";
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
    video.srcObject = cameraStream;
    await video.play();
    await updateCameraList();

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      cameraWidth = video.videoWidth;
      cameraHeight = video.videoHeight;
    }

    cameraCanvas = document.createElement("canvas");
    cameraCanvas.width = cameraWidth;
    cameraCanvas.height = cameraHeight;
    cameraOverlay.width = cameraWidth;
    cameraOverlay.height = cameraHeight;
    setStatus("Camera ready - loading AprilTag...");
  } catch (error) {
    console.error("Camera error:", error);
    setStatus("Could not access camera");
  }
}

async function updateCameraList() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter(device => device.kind === "videoinput");
  cameraSelect.replaceChildren();

  cameras.forEach((camera, index) => {
    const option = document.createElement("option");
    option.value = camera.deviceId;
    option.textContent = camera.label || `Camera ${index + 1}`;
    cameraSelect.appendChild(option);
  });

  const activeTrack = cameraStream?.getVideoTracks()[0];
  selectedCameraId = activeTrack?.getSettings().deviceId || selectedCameraId;
  if (selectedCameraId) cameraSelect.value = selectedCameraId;
  cameraSelect.disabled = cameras.length < 2;
}

async function startAprilTag() {
  try {
    setStatus("Loading AprilTag WASM...");
    const worker = new Worker("apriltag/apriltag.js");
    const Apriltag = Comlink.wrap(worker);

    apriltag = await new Apriltag(Comlink.proxy(() => {
      setStatus("AprilTag ready - show all 4 tags");
      requestAnimationFrame(detectFrame);
    }));
  } catch (error) {
    console.error("AprilTag initialization error:", error);
    setStatus("AprilTag failed - check console");
  }
}

async function detectFrame() {
  if (!apriltag || !video || video.readyState < 2 || detecting) {
    requestAnimationFrame(detectFrame);
    return;
  }

  detecting = true;
  const context = cameraCanvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(video, 0, 0, cameraWidth, cameraHeight);

  try {
    const pixels = context.getImageData(0, 0, cameraWidth, cameraHeight).data;
    const grayscalePixels = new Uint8Array(cameraWidth * cameraHeight);

    for (let pixel = 0, gray = 0; pixel < pixels.length; pixel += 4, gray++) {
      grayscalePixels[gray] = Math.round((pixels[pixel] + pixels[pixel + 1] + pixels[pixel + 2]) / 3);
    }

    const detections = await apriltag.detect(grayscalePixels, cameraWidth, cameraHeight);
    detectedTags = {};
    for (const detection of detections) {
      if (TAG_IDS.has(detection.id)) detectedTags[detection.id] = detection;
    }
    drawCameraOverlay();
    calculateCameraPose();

    const numberOfTags = Object.keys(detectedTags).length;
    if (numberOfTags > 0) {
      if (cameraPoseValid) {
        setStatus(`Tracking - ${numberOfTags}/4 tags | camera ${Math.round(circleX)}, ${Math.round(circleY)} | heading ${Math.round(cameraHeading)} deg`);
      } else {
        setStatus(`Tracking - ${numberOfTags}/4 AprilTags detected`);
      }
    } else {
      cameraPoseValid = false;
      setStatus("Show the AprilTags - 0/4 detected");
    }
  } catch (error) {
    console.error("AprilTag detection error:", error);
  }

  detecting = false;
  requestAnimationFrame(detectFrame);
}

function calculateCameraPose() {
  const correspondences = [];
  const halfTagSize = TAG_WORLD_SIZE / 2;

  for (const detection of Object.values(detectedTags)) {
    const worldCenter = TAG_WORLD_POSITIONS[detection.id];
    const corners = detection.corners;
    if (!worldCenter || !Array.isArray(corners) || corners.length < 4) continue;

    const worldCorners = [
      { x: -halfTagSize, y: -halfTagSize },
      { x: halfTagSize, y: -halfTagSize },
      { x: halfTagSize, y: halfTagSize },
      { x: -halfTagSize, y: halfTagSize }
    ].map(corner => ({
      x: worldCenter.x + corner.x,
      y: worldCenter.y + corner.y
    }));

    for (let cornerIndex = 0; cornerIndex < 4; cornerIndex++) {
      correspondences.push({ world: worldCorners[cornerIndex], image: corners[cornerIndex] });
    }
  }

  const homography = solveHomography(correspondences);
  if (!homography) {
    cameraPoseValid = false;
    return;
  }

  const imageCenter = { x: cameraWidth / 2, y: cameraHeight / 2 };
  const mapPosition = projectImageToWorld(homography, imageCenter);
  const imageUp = projectImageToWorld(homography, {
    x: imageCenter.x,
    y: imageCenter.y - Math.min(cameraWidth, cameraHeight) * 0.15
  });
  if (!mapPosition || !imageUp) {
    cameraPoseValid = false;
    return;
  }

  const heading = Math.atan2(imageUp.y - mapPosition.y, imageUp.x - mapPosition.x) * 180 / Math.PI;
  const poseSmoothing = 0.25;
  smoothedCameraX = smoothedCameraX === null ? mapPosition.x : lerp(smoothedCameraX, mapPosition.x, poseSmoothing);
  smoothedCameraY = smoothedCameraY === null ? mapPosition.y : lerp(smoothedCameraY, mapPosition.y, poseSmoothing);
  smoothedCameraHeading = smoothedCameraHeading === null
    ? heading
    : interpolateAngle(smoothedCameraHeading, heading, poseSmoothing);
  circleX = constrain(smoothedCameraX, circleRadius, mapWidth - circleRadius);
  circleY = constrain(smoothedCameraY, circleRadius, mapHeight - circleRadius);
  cameraHeading = smoothedCameraHeading;
  cameraPoseValid = true;
}

function interpolateAngle(from, to, amount) {
  const difference = ((to - from + 540) % 360) - 180;
  return from + difference * amount;
}

function solveHomography(correspondences) {
  if (correspondences.length < 4) return null;

  const matrix = Array.from({ length: 8 }, () => Array(9).fill(0));
  for (const correspondence of correspondences) {
    const { x, y } = correspondence.world;
    const { x: imageX, y: imageY } = correspondence.image;
    addHomographyEquation(matrix, [x, y, 1, 0, 0, 0, -imageX * x, -imageX * y], imageX);
    addHomographyEquation(matrix, [0, 0, 0, x, y, 1, -imageY * x, -imageY * y], imageY);
  }

  for (let pivot = 0; pivot < 8; pivot++) {
    let pivotRow = pivot;
    for (let row = pivot + 1; row < 8; row++) {
      if (Math.abs(matrix[row][pivot]) > Math.abs(matrix[pivotRow][pivot])) pivotRow = row;
    }
    if (Math.abs(matrix[pivotRow][pivot]) < 1e-9) return null;
    [matrix[pivot], matrix[pivotRow]] = [matrix[pivotRow], matrix[pivot]];

    const pivotValue = matrix[pivot][pivot];
    for (let column = pivot; column <= 8; column++) matrix[pivot][column] /= pivotValue;
    for (let row = 0; row < 8; row++) {
      if (row === pivot) continue;
      const factor = matrix[row][pivot];
      for (let column = pivot; column <= 8; column++) matrix[row][column] -= factor * matrix[pivot][column];
    }
  }

  return [...matrix.map(row => row[8]), 1];
}

function addHomographyEquation(matrix, coefficients, result) {
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      matrix[row][column] += coefficients[row] * coefficients[column];
    }
    matrix[row][8] += coefficients[row] * result;
  }
}

function projectImageToWorld(homography, imagePoint) {
  const [h0, h1, h2, h3, h4, h5, h6, h7] = homography;
  const determinant = h0 * (h4 - h5 * h7) - h1 * (h3 - h5 * h6) + h2 * (h3 * h7 - h4 * h6);
  if (Math.abs(determinant) < 1e-9) return null;

  const inverse = [
    (h4 - h5 * h7) / determinant,
    (h2 * h7 - h1) / determinant,
    (h1 * h5 - h2 * h4) / determinant,
    (h5 * h6 - h3) / determinant,
    (h0 - h2 * h6) / determinant,
    (h2 * h3 - h0 * h5) / determinant,
    (h3 * h7 - h4 * h6) / determinant,
    (h1 * h6 - h0 * h7) / determinant,
    (h0 * h4 - h1 * h3) / determinant
  ];
  const denominator = inverse[6] * imagePoint.x + inverse[7] * imagePoint.y + inverse[8];
  if (Math.abs(denominator) < 1e-9) return null;
  return {
    x: (inverse[0] * imagePoint.x + inverse[1] * imagePoint.y + inverse[2]) / denominator,
    y: (inverse[3] * imagePoint.x + inverse[4] * imagePoint.y + inverse[5]) / denominator
  };
}

function drawCameraOverlay() {
  if (!cameraOverlay) return;

  const context = cameraOverlay.getContext("2d");
  context.clearRect(0, 0, cameraWidth, cameraHeight);
  context.lineJoin = "round";
  context.font = "600 13px monospace";
  context.textBaseline = "top";

  for (const detection of Object.values(detectedTags)) {
    const corners = detection.corners;
    if (!Array.isArray(corners) || corners.length < 4) continue;

    const xValues = corners.map(corner => corner.x);
    const yValues = corners.map(corner => corner.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const angle = Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x) * 180 / Math.PI;
    const center = detection.center || {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
    const label = `ID ${detection.id}  X ${Math.round(center.x)} Y ${Math.round(center.y)}  W ${Math.round(maxX - minX)} H ${Math.round(maxY - minY)}  ${Math.round(angle)} deg`;
    const labelHeight = 20;
    const labelWidth = context.measureText(label).width + 12;
    const labelX = Math.max(0, Math.min(minX, cameraWidth - labelWidth));
    const labelY = Math.max(0, minY - labelHeight - 4);

    context.strokeStyle = "#23f0a8";
    context.lineWidth = 3;
    context.strokeRect(minX, minY, maxX - minX, maxY - minY);
    context.beginPath();
    context.moveTo(corners[0].x, corners[0].y);
    for (const corner of corners.slice(1)) context.lineTo(corner.x, corner.y);
    context.closePath();
    context.strokeStyle = "#ffe66d";
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = "rgba(8, 18, 25, 0.88)";
    context.fillRect(labelX, labelY, labelWidth, labelHeight);
    context.fillStyle = "#ffffff";
    context.fillText(label, labelX + 6, labelY + 3);

    context.fillStyle = "#ffe66d";
    for (const corner of corners) {
      context.beginPath();
      context.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function draw() {
  clear();
  drawTagMapDebug();
  noStroke();
  fill(25, 25, 25, 230);
  stroke(255, 255, 255, 220);
  strokeWeight(5);
  circle(circleX, circleY, circleRadius * 2);
  if (cameraPoseValid) {
    const headingLength = 45;
    stroke(255, 230, 109, 240);
    strokeWeight(4);
    line(
      circleX,
      circleY,
      circleX + Math.cos(cameraHeading * Math.PI / 180) * headingLength,
      circleY + Math.sin(cameraHeading * Math.PI / 180) * headingLength
    );
  }
}

function drawTagMapDebug() {
  textAlign(CENTER, CENTER);
  textSize(14);
  strokeWeight(2);

  for (const [id, position] of Object.entries(TAG_WORLD_POSITIONS)) {
    const isVisible = Boolean(detectedTags[id]);
    fill(isVisible ? "#23f0a8" : "#23f0a866");
    stroke(isVisible ? "#ffffff" : "#23f0a8");
    circle(position.x, position.y, 22);
    noStroke();
    fill("#082019");
    text(`T${id}`, position.x, position.y);
    fill(isVisible ? "#23f0a8" : "#52756b");
    textSize(11);
    text(`${Math.round(position.x)}, ${Math.round(position.y)}`, position.x, position.y + 19);
    textSize(14);
  }
}

function setStatus(message) {
  const status = document.getElementById("status");
  if (status) status.textContent = message;
}
