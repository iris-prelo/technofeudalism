const TAG_IDS = new Set([0, 1, 2, 3]);
const mapWidth = 1498;
const mapHeight = 927;
const circleRadius = 16;
const movementScale = 1.25;
const movementDeadzone = 1.5;
const movementSmoothing = 0.18;
const maximumMovement = 10;

let circleX = mapWidth / 2;
let circleY = mapHeight / 2;
let detectedTags = {};
let previousTagCenters = {};
let apriltag = null;
let detecting = false;
let smoothedMovementX = 0;
let smoothedMovementY = 0;
let trackingStarted = false;

let video;
let cameraCanvas;
let cameraStream;
let cameraSelect;
let selectedCameraId = "";
let cameraWidth = 640;
let cameraHeight = 480;

function connectTerritoryMouse() {
  const iframe = document.querySelector(".territory-illustration");
  const territoryWindow = iframe?.contentWindow;
  const territoryDocument = territoryWindow?.document;
  const territoryMap = territoryDocument?.getElementById("map");

  if (!territoryMap) return;
  if (territoryMap.dataset.mouseBridgeConnected) return;
  territoryMap.dataset.mouseBridgeConnected = "true";

  territoryMap.addEventListener("pointermove", (event) => {
    if (trackingStarted || event.pointerType === "touch") return;

    const bounds = territoryMap.getBoundingClientRect();
    circleX = constrain(((event.clientX - bounds.left) / bounds.width) * mapWidth, circleRadius, mapWidth - circleRadius);
    circleY = constrain(((event.clientY - bounds.top) / bounds.height) * mapHeight, circleRadius, mapHeight - circleRadius);
  });
}

function updateTerritoryPopup() {
  const iframe = document.querySelector(".territory-illustration");
  iframe?.contentWindow?.setExternalPosition?.(circleX, circleY);
}

async function setup() {
  const trackingCanvas = createCanvas(mapWidth, mapHeight);
  trackingCanvas.parent(document.getElementById("tracking-layer"));

  const territoryIframe = document.querySelector(".territory-illustration");
  territoryIframe.addEventListener("load", connectTerritoryMouse);
  if (territoryIframe.contentDocument?.readyState === "complete") connectTerritoryMouse();

  video = document.getElementById("video");
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

  cameraCanvas = document.createElement("canvas");
  cameraCanvas.width = cameraWidth;
  cameraCanvas.height = cameraHeight;
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

    const numberOfTags = Object.keys(detectedTags).length;
    if (numberOfTags > 0) {
      calculateCameraMovement();
      setStatus(`Tracking - ${numberOfTags}/4 AprilTags detected`);
    } else {
      setStatus("Show the AprilTags - 0/4 detected");
    }
  } catch (error) {
    console.error("AprilTag detection error:", error);
  }

  detecting = false;
  requestAnimationFrame(detectFrame);
}

function calculateCameraMovement() {
  const currentTagIds = Object.keys(detectedTags);
  const movements = currentTagIds
    .filter(id => previousTagCenters[id])
    .map(id => ({
      x: detectedTags[id].center.x - previousTagCenters[id].x,
      y: detectedTags[id].center.y - previousTagCenters[id].y
    }));

  previousTagCenters = {};
  currentTagIds.forEach(id => {
    previousTagCenters[id] = {
      x: detectedTags[id].center.x,
      y: detectedTags[id].center.y
    };
  });

  if (movements.length === 0) return;

  const tagMovementX = movements.reduce((sum, movement) => sum + movement.x, 0) / movements.length;
  const tagMovementY = movements.reduce((sum, movement) => sum + movement.y, 0) / movements.length;
  const targetMovementX = Math.abs(tagMovementX) > movementDeadzone ? tagMovementX : 0;
  const targetMovementY = Math.abs(tagMovementY) > movementDeadzone ? tagMovementY : 0;

  smoothedMovementX += (targetMovementX - smoothedMovementX) * movementSmoothing;
  smoothedMovementY += (targetMovementY - smoothedMovementY) * movementSmoothing;

  const movementX = constrain(smoothedMovementX, -maximumMovement, maximumMovement);
  const movementY = constrain(smoothedMovementY, -maximumMovement, maximumMovement);

  circleX = constrain(circleX - movementX * movementScale, circleRadius, mapWidth - circleRadius);
  circleY = constrain(circleY - movementY * movementScale, circleRadius, mapHeight - circleRadius);
  trackingStarted = true;
  updateTerritoryPopup();
}

function draw() {
  clear();
  noStroke();
  fill(25, 25, 25, 230);
  stroke(255, 255, 255, 220);
  strokeWeight(5);
  circle(circleX, circleY, circleRadius * 2);
}

function setStatus(message) {
  const status = document.getElementById("status");
  if (status) status.textContent = message;
}
