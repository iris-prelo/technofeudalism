// ============================================================
// APRILTAG CAMERA MOVEMENT TRACKING
// ============================================================
//
// Four AprilTags are placed at the four corners of a floor
// square:
//
//
//       ID 0 ---------------- ID 1
//        |                      |
//        |                      |
//        |          CAMERA      |
//        |                      |
//       ID 3 ---------------- ID 2
//
//
// The camera is held in the user's hands and points toward
// the floor.
//
// We detect all four tags and use their movement in the
// camera image to determine how the camera itself moved.
//
// No AprilTag pose estimation is used.
// No camera calibration is used.
// No tag-size information is needed.
//
// Existing AprilTag folder/API stays unchanged.
//
// ============================================================



// ============================================================
// APRILTAG IDS
// ============================================================

const TAG_TOP_LEFT = 0;

const TAG_TOP_RIGHT = 1;

const TAG_BOTTOM_RIGHT = 2;

const TAG_BOTTOM_LEFT = 3;



// ============================================================
// P5 CANVAS
// ============================================================

const canvasSize = 650;



// ============================================================
// YOUR PATH
// ============================================================

let path = [

  { x: 165, y: 165 },

  { x: 125, y: 425 },

  { x: 340, y: 340 },

  { x: 325, y: 125 },

  { x: 525, y: 370 },

  { x: 255, y: 485 },

  { x: 525, y: 510 }

];



// ============================================================
// CIRCLE
// ============================================================

let circleRadius = 12;

let circleX = canvasSize / 2;

let circleY = canvasSize / 2;



// ============================================================
// PATH
// ============================================================

let lineThickness = 60;

let currentSegment = 0;



// ============================================================
// RED / BLUE STATE
// ============================================================

let circleIsInsidePath = true;

let insidePathCandidate = true;

let candidateFrames = 0;

let colorConfirmationFrames = 2;



// ============================================================
// APRILTAG
// ============================================================

let apriltag = null;

let detecting = false;



// ============================================================
// DETECTED TAGS
// ============================================================
//
// Stores the most recent detection of each relevant tag.
//
// Example:
//
// detectedTags[0]
// detectedTags[1]
// detectedTags[2]
// detectedTags[3]
//
// ============================================================

let detectedTags = {};



// ============================================================
// CAMERA
// ============================================================

let video;

let cameraCanvas;

let cameraStream;

let cameraSelect;

let selectedCameraId = "";

let cameraWidth = 640;

let cameraHeight = 480;



// ============================================================
// TAG MOVEMENT
// ============================================================
//
// We calculate the average position of the four tags.
//
// Then we compare that average with the previous frame.
//
// If the camera moves RIGHT:
//
//     tags appear to move LEFT
//
// Therefore we move the circle RIGHT.
//
// ============================================================

let previousTagCenters = {};



// ============================================================
// MOVEMENT SETTINGS
// ============================================================

// Increase this if the circle moves too slowly.
//
// Decrease this if the circle moves too quickly.

const movementScale = 2.0;



// Ignore tiny movements caused by AprilTag detection noise.

const movementDeadzone = 1.5;



// ============================================================
// SETUP
// ============================================================

async function setup() {

  createCanvas(
    canvasSize,
    canvasSize
  );


  // ----------------------------------------------------------
  // Get webcam video element from HTML
  // ----------------------------------------------------------

  video =
    document.getElementById(
      "video"
    );

  cameraSelect =
    document.getElementById(
      "camera-select"
    );

  cameraSelect.addEventListener(
    "change",
    async () => {
      selectedCameraId = cameraSelect.value;
      await startCamera();
    }
  );


  if (!video) {

    console.error(
      "Could not find #video"
    );

    setStatus(
      "Video element not found"
    );

    return;

  }


  // ----------------------------------------------------------
  // Start camera
  // ----------------------------------------------------------

  await startCamera();


  if (!cameraStream) {

    return;

  }


  // ----------------------------------------------------------
  // Hidden canvas used to process webcam frames
  // ----------------------------------------------------------

  cameraCanvas =
    document.createElement(
      "canvas"
    );


  cameraCanvas.width =
    cameraWidth;

  cameraCanvas.height =
    cameraHeight;


  // ----------------------------------------------------------
  // Start AprilTag
  // ----------------------------------------------------------

  startAprilTag();

}



// ============================================================
// START CAMERA
// ============================================================

async function startCamera() {

  // ----------------------------------------------------------
  // Stop an existing stream first
  // ----------------------------------------------------------

  if (cameraStream) {

    cameraStream
      .getTracks()
      .forEach(
        (track) => track.stop()
      );

  }


  const videoConstraints = {

    width: {
      ideal: cameraWidth
    },

    height: {
      ideal: cameraHeight
    }

  };

  if (selectedCameraId) {
    videoConstraints.deviceId = {
      exact: selectedCameraId
    };
  }
  else {
    videoConstraints.facingMode = "environment";
  }

  try {

    cameraStream =
      await navigator.mediaDevices
        .getUserMedia({

          video: videoConstraints,

          audio: false

        });


    // --------------------------------------------------------
    // Connect camera to video element
    // --------------------------------------------------------

    video.srcObject =
      cameraStream;


    await video.play();

    await updateCameraList();


    // --------------------------------------------------------
    // Get actual camera dimensions
    // --------------------------------------------------------

    if (
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {

      cameraWidth =
        video.videoWidth;

      cameraHeight =
        video.videoHeight;


      cameraCanvas =
        document.createElement(
          "canvas"
        );


      cameraCanvas.width =
        cameraWidth;

      cameraCanvas.height =
        cameraHeight;

    }


    setStatus(
      "Camera ready — loading AprilTag..."
    );


    console.log(
      "Camera resolution:",
      cameraWidth,
      "x",
      cameraHeight
    );

  }


  catch (error) {

    console.error(
      "Camera error:",
      error
    );


    setStatus(
      "Could not access camera"
    );

  }

}


// Populate the selector after permission reveals camera labels.

async function updateCameraList() {

  const devices =
    await navigator.mediaDevices.enumerateDevices();

  const cameras =
    devices.filter(
      (device) => device.kind === "videoinput"
    );

  cameraSelect.replaceChildren();

  cameras.forEach(
    (camera, index) => {

      const option =
        document.createElement("option");

      option.value = camera.deviceId;

      option.textContent =
        camera.label || `Camera ${index + 1}`;

      cameraSelect.appendChild(option);

    }
  );

  const activeTrack =
    cameraStream && cameraStream.getVideoTracks()[0];

  const activeDeviceId =
    activeTrack && activeTrack.getSettings().deviceId;

  selectedCameraId = activeDeviceId || selectedCameraId;

  if (selectedCameraId) {
    cameraSelect.value = selectedCameraId;
  }

  cameraSelect.disabled = cameras.length < 2;

}



// ============================================================
// APRILTAG INITIALIZATION
// ============================================================
//
// IMPORTANT:
//
// We deliberately DO NOT call:
//
//     set_return_pose()
//     set_return_solutions()
//     set_tag_size()
//     set_camera_info()
//
// We only create the detector.
//
// This avoids the detector-option error:
//
//     this._set_detector_options is not a function
//
// ============================================================

async function startAprilTag() {

  try {

    setStatus(
      "Loading AprilTag WASM..."
    );


    // --------------------------------------------------------
    // Create worker
    // --------------------------------------------------------

    const worker =
      new Worker(
        "apriltag/apriltag.js"
      );


    // --------------------------------------------------------
    // Connect Comlink
    // --------------------------------------------------------

    const Apriltag =
      Comlink.wrap(
        worker
      );


    // --------------------------------------------------------
    // Create detector
    // --------------------------------------------------------

    apriltag =
      await new Apriltag(

        Comlink.proxy(

          () => {

            console.log(
              "AprilTag WASM ready!"
            );


            setStatus(
              "AprilTag ready — show all 4 tags"
            );


            requestAnimationFrame(
              detectFrame
            );

          }

        )

      );


  }


  catch (error) {

    console.error(
      "AprilTag initialization error:",
      error
    );


    setStatus(
      "AprilTag failed — check console"
    );

  }

}



// ============================================================
// DETECT FRAME
// ============================================================

async function detectFrame() {

  // ----------------------------------------------------------
  // Make sure AprilTag and camera are ready
  // ----------------------------------------------------------

  if (

    !apriltag ||

    !video ||

    video.readyState < 2

  ) {

    requestAnimationFrame(
      detectFrame
    );

    return;

  }


  // ----------------------------------------------------------
  // Prevent overlapping detections
  // ----------------------------------------------------------

  if (detecting) {

    requestAnimationFrame(
      detectFrame
    );

    return;

  }


  detecting = true;


  // ----------------------------------------------------------
  // Get canvas context
  // ----------------------------------------------------------

  const ctx =
    cameraCanvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );


  // ----------------------------------------------------------
  // Draw current webcam frame into hidden canvas
  // ----------------------------------------------------------

  ctx.drawImage(

    video,

    0,
    0,

    cameraWidth,
    cameraHeight

  );


  // ----------------------------------------------------------
  // Read pixels
  // ----------------------------------------------------------

  let imageData;


  try {

    imageData =
      ctx.getImageData(

        0,
        0,

        cameraWidth,
        cameraHeight

      );

  }


  catch (error) {

    console.error(
      "Could not read camera pixels:",
      error
    );


    detecting = false;


    requestAnimationFrame(
      detectFrame
    );

    return;

  }



  // ==========================================================
  // CONVERT RGB → GRAYSCALE
  // ==========================================================

  const pixels =
    imageData.data;


  const grayscalePixels =
    new Uint8Array(

      cameraWidth *
      cameraHeight

    );


  for (

    let i = 0,
        j = 0;

    i < pixels.length;

    i += 4,
    j++

  ) {

    grayscalePixels[j] =

      Math.round(

        (

          pixels[i] +

          pixels[i + 1] +

          pixels[i + 2]

        ) / 3

      );

  }



  // ==========================================================
  // APRILTAG DETECTION
  // ==========================================================

  try {

    const detections =
      await apriltag.detect(

        grayscalePixels,

        cameraWidth,

        cameraHeight

      );


    // --------------------------------------------------------
    // Clear previous tag detections
    // --------------------------------------------------------

    detectedTags = {};


    // --------------------------------------------------------
    // Find our four tags
    // --------------------------------------------------------

    for (
      const detection of detections
    ) {

      if (

        detection.id ===
        TAG_TOP_LEFT ||

        detection.id ===
        TAG_TOP_RIGHT ||

        detection.id ===
        TAG_BOTTOM_RIGHT ||

        detection.id ===
        TAG_BOTTOM_LEFT

      ) {

        detectedTags[
          detection.id
        ] = detection;

      }

    }


    // --------------------------------------------------------
    // Count visible tags
    // --------------------------------------------------------

    const numberOfTags =
      Object.keys(
        detectedTags
      ).length;


    // Use every tag visible in consecutive frames. This keeps
    // movement working even when one tag temporarily leaves view.

    if (numberOfTags > 0) {

      calculateCameraMovement();


      setStatus(
        "Tracking — " +
        numberOfTags +
        " AprilTags detected"
      );

    }


    // ========================================================
    // NOT ALL TAGS FOUND
    // ========================================================

    else {

      setStatus(

        "Show all 4 AprilTags — " +
        numberOfTags +
        "/4 detected"

      );

    }

  }


  catch (error) {

    console.error(
      "AprilTag detection error:",
      error
    );

  }


  detecting = false;


  // ----------------------------------------------------------
  // Continue detecting
  // ----------------------------------------------------------

  requestAnimationFrame(
    detectFrame
  );

}



// ============================================================
// CALCULATE CAMERA MOVEMENT
// ============================================================
//
// This is the main movement calculation.
//
// We don't need to know:
//
// - camera focal length
// - camera height
// - physical tag size
// - camera pose
//
// We simply observe how the four tags move inside the camera
// image.
//
// ============================================================

function calculateCameraMovement() {

  const currentTagIds = Object.keys(detectedTags);
  const movements = currentTagIds
    .filter((id) => previousTagCenters[id])
    .map((id) => ({
      x: detectedTags[id].center.x - previousTagCenters[id].x,
      y: detectedTags[id].center.y - previousTagCenters[id].y
    }));

  previousTagCenters = {};

  currentTagIds.forEach((id) => {
    previousTagCenters[id] = {
      x: detectedTags[id].center.x,
      y: detectedTags[id].center.y
    };
  });

  if (movements.length === 0) {
    return;
  }

  const tagMovementX =
    movements.reduce((sum, movement) => sum + movement.x, 0) /
    movements.length;

  const tagMovementY =
    movements.reduce((sum, movement) => sum + movement.y, 0) /
    movements.length;



  // ==========================================================
  // REMOVE SMALL DETECTION NOISE
  // ==========================================================

  let movementX = 0;

  let movementY = 0;


  if (
    Math.abs(tagMovementX) >
    movementDeadzone
  ) {

    movementX =
      tagMovementX;

  }


  if (
    Math.abs(tagMovementY) >
    movementDeadzone
  ) {

    movementY =
      tagMovementY;

  }



  // ==========================================================
  // REVERSE TAG MOVEMENT
  // ==========================================================
  //
  // Example:
  //
  // Camera moves RIGHT
  //        ↓
  // Tags appear to move LEFT
  //        ↓
  // movementX is negative
  //        ↓
  // circleX -= negative
  //        ↓
  // circle moves RIGHT
  //
  // ==========================================================

  circleX -=

    movementX *
    movementScale;


  circleY -=

    movementY *
    movementScale;



  // ==========================================================
  // KEEP CIRCLE INSIDE CANVAS
  // ==========================================================

  circleX =
    constrain(

      circleX,

      circleRadius,

      width -
      circleRadius

    );


  circleY =
    constrain(

      circleY,

      circleRadius,

      height -
      circleRadius

    );



  // ==========================================================
  // UPDATE PATH STATE
  // ==========================================================

  updatePathState();



  // ==========================================================
  // DEBUG
  // ==========================================================

  console.log(

    "Tag movement:",

    movementX.toFixed(2),

    movementY.toFixed(2),

    "| Circle:",

    circleX.toFixed(1),

    circleY.toFixed(1)

  );

}



// ============================================================
// UPDATE PATH STATE
// ============================================================

function updatePathState() {

  const position =
    createVector(

      circleX,

      circleY

    );


  // ----------------------------------------------------------
  // Find nearest allowed connected segment
  // ----------------------------------------------------------

  const segment =
    findAllowedSegment(
      position
    );


  if (
    segment !== -1
  ) {

    currentSegment =
      segment;

  }


  // ----------------------------------------------------------
  // Current path segment
  // ----------------------------------------------------------

  const a =
    createVector(

      path[currentSegment].x,

      path[currentSegment].y

    );


  const b =
    createVector(

      path[currentSegment + 1].x,

      path[currentSegment + 1].y

    );


  // ----------------------------------------------------------
  // Closest point on path
  // ----------------------------------------------------------

  const closest =
    closestPointOnLine(

      position,

      a,

      b

    );


  // ----------------------------------------------------------
  // Distance from circle to path
  // ----------------------------------------------------------

  const distance =
    p5.Vector.dist(

      position,

      closest

    );


  // ----------------------------------------------------------
  // Maximum allowed distance
  // ----------------------------------------------------------

  const maxDistance =

    lineThickness / 2 -
    circleRadius;


  const isInsidePath =

    distance <=
    maxDistance;


  // ----------------------------------------------------------
  // Colour confirmation
  // ----------------------------------------------------------

  if (

    isInsidePath ===
    insidePathCandidate

  ) {

    candidateFrames++;

  }

  else {

    insidePathCandidate =
      isInsidePath;

    candidateFrames =
      1;

  }


  // ----------------------------------------------------------
  // Actually change colour
  // ----------------------------------------------------------

  if (

    candidateFrames >=
    colorConfirmationFrames

  ) {

    circleIsInsidePath =
      insidePathCandidate;

  }

}



// ============================================================
// DRAW
// ============================================================

function draw() {

  background(
    245
  );


  // ==========================================================
  // GREY PATH
  // ==========================================================

  noFill();

  stroke(
    120
  );

  strokeWeight(
    lineThickness
  );

  strokeCap(
    ROUND
  );

  strokeJoin(
    ROUND
  );


  beginShape();


  for (
    const p of path
  ) {

    vertex(
      p.x,
      p.y
    );

  }


  endShape();



  // ==========================================================
  // CIRCLE
  // ==========================================================

  drawCircle(

    circleX,

    circleY,

    circleIsInsidePath

  );



  // ==========================================================
  // DEBUG INFORMATION
  // ==========================================================

  fill(
    40
  );

  noStroke();

  textSize(
    14
  );


  text(

    "AprilTags: " +

    Object.keys(
      detectedTags
    ).length +

    "/4",

    15,

    height - 45

  );


  text(

    "Circle: " +

    Math.round(circleX) +

    ", " +

    Math.round(circleY),

    15,

    height - 25

  );

}



// ============================================================
// DRAW CIRCLE
// ============================================================

function drawCircle(
  x,
  y,
  isInsidePath
) {

  noStroke();


  if (
    isInsidePath
  ) {

    // --------------------------------------------------------
    // RED
    // --------------------------------------------------------

    fill(

      255,
      80,
      80

    );

  }

  else {

    // --------------------------------------------------------
    // BLUE
    // --------------------------------------------------------

    fill(

      80,
      130,
      255

    );

  }


  circle(

    x,

    y,

    circleRadius * 2

  );

}



// ============================================================
// FIND ALLOWED SEGMENT
// ============================================================
//
// Only the current segment and its immediate neighbours are
// considered.
//
// This prevents the circle from jumping between disconnected
// parts of the path.
//
// ============================================================

function findAllowedSegment(
  position
) {

  let candidates = [];


  // ----------------------------------------------------------
  // Current segment
  // ----------------------------------------------------------

  candidates.push(
    currentSegment
  );


  // ----------------------------------------------------------
  // Previous segment
  // ----------------------------------------------------------

  if (
    currentSegment > 0
  ) {

    candidates.push(

      currentSegment - 1

    );

  }


  // ----------------------------------------------------------
  // Next segment
  // ----------------------------------------------------------

  if (

    currentSegment <
    path.length - 2

  ) {

    candidates.push(

      currentSegment + 1

    );

  }


  let bestSegment =
    -1;

  let bestDistance =
    Infinity;


  // ----------------------------------------------------------
  // Test candidate segments
  // ----------------------------------------------------------

  for (
    const i of candidates
  ) {

    const a =
      createVector(

        path[i].x,

        path[i].y

      );


    const b =
      createVector(

        path[i + 1].x,

        path[i + 1].y

      );


    const closest =
      closestPointOnLine(

        position,

        a,

        b

      );


    const distance =
      p5.Vector.dist(

        position,

        closest

      );


    if (
      distance < bestDistance
    ) {

      bestDistance =
        distance;

      bestSegment =
        i;

    }

  }


  // ----------------------------------------------------------
  // Only accept the segment if close enough
  // ----------------------------------------------------------

  if (

    bestDistance <=
    lineThickness / 2

  ) {

    return bestSegment;

  }


  return -1;

}



// ============================================================
// CLOSEST POINT ON LINE
// ============================================================

function closestPointOnLine(
  point,
  a,
  b
) {

  const line =
    p5.Vector.sub(

      b,

      a

    );


  const lineLengthSquared =
    line.magSq();


  // ----------------------------------------------------------
  // Avoid division by zero
  // ----------------------------------------------------------

  if (
    lineLengthSquared === 0
  ) {

    return a.copy();

  }


  const pointFromA =
    p5.Vector.sub(

      point,

      a

    );


  let t =

    pointFromA.dot(
      line
    ) /

    lineLengthSquared;


  t =
    constrain(

      t,

      0,

      1

    );


  return p5.Vector.add(

    a,

    line.mult(t)

  );

}



// ============================================================
// STATUS TEXT
// ============================================================

function setStatus(
  message
) {

  const status =
    document.getElementById(
      "status"
    );


  if (
    status
  ) {

    status.textContent =
      message;

  }

}