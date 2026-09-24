
// ============================================================
// APRILTAG FLOOR CAMERA TRACKING
// ============================================================
//
// Four AprilTags are placed on the four corners of a square:
//
//       ID 0 ---------------- ID 1
//        |                      |
//        |                      |
//        |       CAMERA         |
//        |                      |
//       ID 3 ---------------- ID 2
//
// The webcam is held in the user's hands and points toward
// the floor.
//
// The camera position is calculated from the AprilTag poses.
// That position controls the p5 circle.
//
// ============================================================



// ============================================================
// APRILTAG SETTINGS
// ============================================================

// The four IDs used for the physical floor square.

const TAG_TOP_LEFT = 0;
const TAG_TOP_RIGHT = 1;
const TAG_BOTTOM_RIGHT = 2;
const TAG_BOTTOM_LEFT = 3;


// ------------------------------------------------------------
// IMPORTANT:
//
// Measure the actual AprilTag size.
//
// Example:
// if the black/white tag area is 10 cm wide:
//
//     TAG_SIZE = 0.10
//
// The AprilTag library expects meters.
// ------------------------------------------------------------

const TAG_SIZE = 0.18;


// ============================================================
// CAMERA SETTINGS
// ============================================================

let cameraWidth = 640;
let cameraHeight = 480;


// ------------------------------------------------------------
// Camera calibration
//
// These are approximate values.
//
// cx / cy = optical center.
//
// fx / fy = focal length in pixels.
//
// If tracking works but feels geometrically inaccurate,
// these are the values we should calibrate later.
// ------------------------------------------------------------

const FX = 600;
const FY = 600;

const CX = cameraWidth / 2;
const CY = cameraHeight / 2;


// ============================================================
// PHYSICAL FLOOR SQUARE
// ============================================================
//
// Define the actual positions of your four tags.
//
// The unit is METERS.
//
// Example:
// a 2 m × 2 m square:
//
//        0,0 ---------------- 2,0
//         |                    |
//         |                    |
//         |                    |
//        0,2 ---------------- 2,2
//
// Change FLOOR_WIDTH and FLOOR_HEIGHT to your actual square.
// ============================================================

const FLOOR_WIDTH = 1.0;
const FLOOR_HEIGHT = 1.0;


// Physical positions of the tags.

const floorTags = {

  0: {
    x: 0,
    y: 0
  },

  1: {
    x: FLOOR_WIDTH,
    y: 0
  },

  2: {
    x: FLOOR_WIDTH,
    y: FLOOR_HEIGHT
  },

  3: {
    x: 0,
    y: FLOOR_HEIGHT
  }

};


// ============================================================
// P5 CANVAS
// ============================================================

const canvasSize = 650;


// ============================================================
// PATH
// ============================================================
//
// This is your original path.
// The tracked camera position is mapped into this canvas.
//
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
// CIRCLE SETTINGS
// ============================================================

let circleRadius = 12;

let lineThickness = 60;


// ============================================================
// CURRENT PATH SEGMENT
// ============================================================
//
// This prevents the circle from jumping between unrelated
// parts of the path.
// ============================================================

let currentSegment = 0;


// ============================================================
// CIRCLE POSITION
// ============================================================

let circleX = canvasSize / 2;

let circleY = canvasSize / 2;


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
// This object stores the most recent detection for each
// of our four tags.
//
// ============================================================

let detectedTags = {};


// ============================================================
// CAMERA
// ============================================================

let video;

let cameraCanvas;


// ============================================================
// CAMERA POSITION
// ============================================================
//
// This is the camera position in physical floor coordinates.
//
// x = left/right
// y = forward/back
//
// ============================================================

let cameraFloorX = FLOOR_WIDTH / 2;

let cameraFloorY = FLOOR_HEIGHT / 2;


// ============================================================
// CAMERA POSITION HOLD
// ============================================================
//
// Keeps the last valid position for a short moment if a tag
// disappears for a frame.
// ============================================================

let lastPositionSeenAt = 0;

let positionHoldDuration = 250;


// ============================================================
// SETUP
// ============================================================

async function setup() {

  createCanvas(
    canvasSize,
    canvasSize
  );


  // ----------------------------------------------------------
  // Get video element
  // ----------------------------------------------------------

  video =
    document.getElementById(
      "video"
    );


  // ----------------------------------------------------------
  // Start webcam
  // ----------------------------------------------------------

  try {

    const stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          width: {
            ideal: cameraWidth
          },

          height: {
            ideal: cameraHeight
          },

          facingMode: "environment"

        },

        audio: false

      });


    video.srcObject =
      stream;


    await video.play();


    setStatus(
      "Camera ready — loading AprilTag..."
    );

  }

  catch (error) {

    console.error(
      error
    );

    setStatus(
      "Could not access camera"
    );

    return;

  }


  // ----------------------------------------------------------
  // Hidden canvas used for AprilTag detection
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
// APRILTAG INITIALIZATION
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

          }

        )

      );


    // --------------------------------------------------------
    // IMPORTANT:
    //
    // We now NEED pose estimation.
    //
    // Previously this was 0.
    // --------------------------------------------------------

    await apriltag.set_return_pose(
      1
    );


    // We don't need the alternative pose solution.

    await apriltag.set_return_solutions(
      0
    );


    // Detect all tags.

    await apriltag.set_max_detections(
      20
    );


    // --------------------------------------------------------
    // Tell AprilTag the physical size of our tags.
    // --------------------------------------------------------

    await apriltag.set_tag_size(
      TAG_TOP_LEFT,
      TAG_SIZE
    );

    await apriltag.set_tag_size(
      TAG_TOP_RIGHT,
      TAG_SIZE
    );

    await apriltag.set_tag_size(
      TAG_BOTTOM_RIGHT,
      TAG_SIZE
    );

    await apriltag.set_tag_size(
      TAG_BOTTOM_LEFT,
      TAG_SIZE
    );


    // --------------------------------------------------------
    // Give AprilTag approximate camera parameters.
    //
    // These are important for pose estimation.
    // --------------------------------------------------------

    await apriltag.set_camera_info(

      FX,
      FY,
      CX,
      CY

    );


    setStatus(
      "AprilTag ready — show all 4 tags"
    );


    requestAnimationFrame(
      detectFrame
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
// DETECT CAMERA FRAME
// ============================================================

async function detectFrame() {

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
  // Don't run multiple detections simultaneously.
  // ----------------------------------------------------------

  if (detecting) {

    requestAnimationFrame(
      detectFrame
    );

    return;

  }


  detecting = true;


  // ----------------------------------------------------------
  // Draw current camera frame to hidden canvas
  // ----------------------------------------------------------

  let ctx =
    cameraCanvas.getContext(

      "2d",

      {
        willReadFrequently: true
      }

    );


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
      error
    );

    detecting = false;

    requestAnimationFrame(
      detectFrame
    );

    return;

  }


  // ----------------------------------------------------------
  // Convert RGB → grayscale
  // ----------------------------------------------------------

  let pixels =
    imageData.data;


  let grayscalePixels =
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

    let detections =
      await apriltag.detect(

        grayscalePixels,

        cameraWidth,

        cameraHeight

      );


    // --------------------------------------------------------
    // Clear the current tag list.
    // --------------------------------------------------------

    detectedTags = {};


    // --------------------------------------------------------
    // Store our four tags.
    // --------------------------------------------------------

    for (
      let detection of detections
    ) {

      if (

        detection.id === TAG_TOP_LEFT ||

        detection.id === TAG_TOP_RIGHT ||

        detection.id === TAG_BOTTOM_RIGHT ||

        detection.id === TAG_BOTTOM_LEFT

      ) {

        detectedTags[
          detection.id
        ] = detection;

      }

    }


    // --------------------------------------------------------
    // Check how many of our four tags are visible.
    // --------------------------------------------------------

    let numberOfTags =
      Object.keys(
        detectedTags
      ).length;


    // --------------------------------------------------------
    // We need all four tags for reliable localization.
    // --------------------------------------------------------

    if (
      numberOfTags === 4
    ) {

      calculateCameraPosition();


      lastPositionSeenAt =
        performance.now();


      setStatus(
        "Tracking camera — 4 AprilTags detected"
      );

    }

    else {

      // ------------------------------------------------------
      // Temporarily keep the previous position.
      // ------------------------------------------------------

      if (

        lastPositionSeenAt > 0 &&

        performance.now() -
        lastPositionSeenAt <
        positionHoldDuration

      ) {

        setStatus(

          "Tracking — " +
          numberOfTags +
          "/4 tags visible"

        );

      }

      else {

        setStatus(

          "Show all 4 AprilTags — " +
          numberOfTags +
          "/4 detected"

        );

      }

    }

  }

  catch (error) {

    console.error(
      "Detection error:",
      error
    );

  }


  detecting = false;


  requestAnimationFrame(
    detectFrame
  );

}



// ============================================================
// CALCULATE CAMERA POSITION
// ============================================================
//
// Each AprilTag gives us its 3D pose.
//
// The pose tells us where the tag is relative to the camera.
//
// We reverse that transformation to calculate where the
// camera is relative to the tag.
//
// Because we know where each tag physically sits on the floor,
// we can then convert that into floor coordinates.
// ============================================================

function calculateCameraPosition() {

  let positions = [];


  // ----------------------------------------------------------
  // Process all four tags.
  // ----------------------------------------------------------

  for (
    let id of [
      TAG_TOP_LEFT,
      TAG_TOP_RIGHT,
      TAG_BOTTOM_RIGHT,
      TAG_BOTTOM_LEFT
    ]
  ) {

    let detection =
      detectedTags[id];


    if (
      !detection ||
      !detection.pose
    ) {

      continue;

    }


    let pose =
      detection.pose;


    let R =
      pose.R;


    let t =
      pose.t;


    // --------------------------------------------------------
    // Camera position in the tag coordinate system:
    //
    // cameraPosition = -R^T * t
    // --------------------------------------------------------

    let cameraX =
      -(
        R[0][0] * t[0] +
        R[1][0] * t[1] +
        R[2][0] * t[2]
      );


    let cameraY =
      -(
        R[0][1] * t[0] +
        R[1][1] * t[1] +
        R[2][1] * t[2]
      );


    // --------------------------------------------------------
    // Add the physical position of this tag.
    //
    // This converts from "relative to tag" to
    // "relative to the whole floor square".
    // --------------------------------------------------------

    let floorTag =
      floorTags[id];


    let worldX =
      floorTag.x +
      cameraX;


    let worldY =
      floorTag.y +
      cameraY;


    positions.push({

      x: worldX,

      y: worldY

    });

  }


  // ----------------------------------------------------------
  // We need at least one valid pose.
  // ----------------------------------------------------------

  if (
    positions.length === 0
  ) {

    return;

  }


  // ----------------------------------------------------------
  // Average all four estimates.
  //
  // This makes the position less noisy.
  // ----------------------------------------------------------

  let averageX = 0;

  let averageY = 0;


  for (
    let position of positions
  ) {

    averageX +=
      position.x;

    averageY +=
      position.y;

  }


  averageX /=
    positions.length;

  averageY /=
    positions.length;


  // ----------------------------------------------------------
  // Store camera position.
  // ----------------------------------------------------------

  cameraFloorX =
    averageX;

  cameraFloorY =
    averageY;


  // ----------------------------------------------------------
  // Map physical floor position to p5 canvas.
  // ----------------------------------------------------------

  updateCirclePosition();

}



// ============================================================
// UPDATE CIRCLE POSITION
// ============================================================

function updateCirclePosition() {

  // ----------------------------------------------------------
  // Convert floor coordinates → p5 coordinates.
  //
  // Floor:
  //
  //     0 ---------------- FLOOR_WIDTH
  //
  // Canvas:
  //
  //     0 ---------------- 650
  // ----------------------------------------------------------

  circleX =
    map(

      cameraFloorX,

      0,
      FLOOR_WIDTH,

      0,
      width

    );


  circleY =
    map(

      cameraFloorY,

      0,
      FLOOR_HEIGHT,

      0,
      height

    );


  // ----------------------------------------------------------
  // Keep circle inside the canvas.
  // ----------------------------------------------------------

  circleX =
    constrain(

      circleX,

      0,
      width

    );


  circleY =
    constrain(

      circleY,

      0,
      height

    );


  // ----------------------------------------------------------
  // Check whether the camera position is on the grey path.
  // ----------------------------------------------------------

  updatePathState();

}



// ============================================================
// UPDATE RED / BLUE STATE
// ============================================================

function updatePathState() {

  let position =
    createVector(

      circleX,
      circleY

    );


  // ----------------------------------------------------------
  // Find closest allowed segment.
  // ----------------------------------------------------------

  let segment =
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
  // Get current segment.
  // ----------------------------------------------------------

  let a =
    createVector(

      path[currentSegment].x,

      path[currentSegment].y

    );


  let b =
    createVector(

      path[currentSegment + 1].x,

      path[currentSegment + 1].y

    );


  // ----------------------------------------------------------
  // Find closest point on path.
  // ----------------------------------------------------------

  let closest =
    closestPointOnLine(

      position,

      a,

      b

    );


  // ----------------------------------------------------------
  // Distance from path.
  // ----------------------------------------------------------

  let distance =
    p5.Vector.dist(

      position,

      closest

    );


  // ----------------------------------------------------------
  // Maximum distance from the centre of the path.
  // ----------------------------------------------------------

  let maxDistance =
    lineThickness / 2
    - circleRadius;


  let isInsidePath =
    distance <= maxDistance;


  // ----------------------------------------------------------
  // Stabilise colour.
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
    let p of path
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
    Object.keys(detectedTags).length +
    "/4",

    15,
    height - 65

  );


  text(

    "Camera X: " +
    cameraFloorX.toFixed(2) +
    " m",

    15,
    height - 45

  );


  text(

    "Camera Y: " +
    cameraFloorY.toFixed(2) +
    " m",

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
  isInsidePath = true
) {

  noStroke();


  if (
    isInsidePath
  ) {

    // RED

    fill(

      255,
      80,
      80

    );

  }

  else {

    // BLUE

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
// FIND ALLOWED PATH SEGMENT
// ============================================================
//
// Only the current segment and its neighbours are considered.
// This prevents the circle from suddenly jumping to a
// completely different part of the path.
// ============================================================

function findAllowedSegment(
  position
) {

  let candidates = [];


  // Current segment

  candidates.push(
    currentSegment
  );


  // Previous segment

  if (
    currentSegment > 0
  ) {

    candidates.push(
      currentSegment - 1
    );

  }


  // Next segment

  if (
    currentSegment < path.length - 2
  ) {

    candidates.push(
      currentSegment + 1
    );

  }


  let bestSegment =
    -1;


  let bestDistance =
    Infinity;


  for (
    let i of candidates
  ) {

    let a =
      createVector(

        path[i].x,

        path[i].y

      );


    let b =
      createVector(

        path[i + 1].x,

        path[i + 1].y

      );


    let closest =
      closestPointOnLine(

        position,

        a,
        b

      );


    let distance =
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
  // Only switch to the segment if we are close enough.
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

  let line =
    p5.Vector.sub(
      b,
      a
    );


  let lineLengthSquared =
    line.magSq();


  if (
    lineLengthSquared === 0
  ) {

    return a.copy();

  }


  let pointFromA =
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
// STATUS
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