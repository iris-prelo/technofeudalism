// ========================================
// APRILTAG SETTINGS
// ========================================

// The AprilTag ID that controls the circle

let targetTagID = 0;


// ========================================
// PATH
// ========================================

let path = [

  { x: 165, y: 165 },

  { x: 125, y: 425 },

  { x: 340, y: 340 },

  { x: 325, y: 125 },

  { x: 525, y: 370 },

  { x: 255, y: 485 },

  { x: 525, y: 510 }

];


// ========================================
// CIRCLE SETTINGS
// ========================================

let circleRadius = 12;

let lineThickness = 60;


// ========================================
// CURRENT PATH SEGMENT
// ========================================

// This prevents the circle from jumping
// between separate parts of the path.

let currentSegment = 0;


// ========================================
// APRILTAG VARIABLES
// ========================================

let apriltag = null;

let tagDetected = false;

let tagX = 0;

let tagY = 0;

let signalHoldDuration = 300;

let lastTagSeenAt = 0;

let circleX = path[0].x;

let circleY = path[0].y;

let circleIsInsidePath = true;

let insidePathCandidate = true;

let candidateFrames = 0;

let colorConfirmationFrames = 2;


// ========================================
// CAMERA
// ========================================

let video;

let cameraCanvas;

let cameraWidth = 640;

let cameraHeight = 480;


// ========================================
// DETECTION
// ========================================

let detecting = false;


// ========================================
// SETUP
// ========================================

async function setup() {

  createCanvas(
    650,
    650
  );


  // --------------------------------
  // Get video element
  // --------------------------------

  video =
    document.getElementById(
      "video"
    );


  // --------------------------------
  // Start webcam
  // --------------------------------

  try {

    const stream =
      await navigator.mediaDevices
        .getUserMedia({

          video: {

            width: {
              ideal: cameraWidth
            },

            height: {
              ideal: cameraHeight
            },

            facingMode: "user"
          },

          audio: false
        });


    video.srcObject = stream;

    await video.play();


    setStatus(
      "Camera ready — loading AprilTag..."
    );

  }

  catch (error) {

    console.error(error);

    setStatus(
      "Could not access camera"
    );

    return;
  }


  // --------------------------------
  // Create hidden detection canvas
  // --------------------------------

  cameraCanvas =
    document.createElement(
      "canvas"
    );


  cameraCanvas.width =
    cameraWidth;

  cameraCanvas.height =
    cameraHeight;


  // --------------------------------
  // Start AprilTag detector
  // --------------------------------

  startAprilTag();
}


// ========================================
// APRILTAG INITIALIZATION
// ========================================

async function startAprilTag() {

  try {

    setStatus(
      "Loading AprilTag WASM..."
    );


    // --------------------------------
    // Create Web Worker
    // --------------------------------

    const worker =
      new Worker(
        "apriltag/apriltag.js"
      );


    // --------------------------------
    // Connect Comlink to worker
    // --------------------------------

    const Apriltag =
      Comlink.wrap(
        worker
      );


    // --------------------------------
    // Create detector
    // --------------------------------

    apriltag =
      await new Apriltag(

        Comlink.proxy(

          () => {

            console.log(
              "AprilTag WASM ready!"
            );

            setStatus(
              "AprilTag ready — show tag ID " +
              targetTagID
            );


            // Start detection

            requestAnimationFrame(
              detectFrame
            );
          }

        )

      );


    // --------------------------------
    // We only need X/Y.
    //
    // We don't need pose estimation.
    // This makes detection lighter.
    // --------------------------------

    await apriltag.set_return_pose(
      0
    );


    await apriltag.set_return_solutions(
      0
    );


    await apriltag.set_max_detections(
      10
    );

  }

  catch (error) {

    console.error(
      "AprilTag initialization error:",
      error
    );


    setStatus(
      "AprilTag failed to load — check console"
    );
  }
}


// ========================================
// DETECT CAMERA FRAME
// ========================================

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


  // Don't start another detection
  // while one is still processing.

  if (detecting) {

    requestAnimationFrame(
      detectFrame
    );

    return;
  }


  detecting = true;


  // --------------------------------
  // Get canvas context
  // --------------------------------

  let ctx =
    cameraCanvas.getContext(
      "2d",
      {
        willReadFrequently: true
      }
    );


  // --------------------------------
  // Put current video frame
  // onto hidden canvas
  // --------------------------------

  ctx.drawImage(

    video,

    0,
    0,

    cameraWidth,
    cameraHeight

  );


  // --------------------------------
  // Get pixels
  // --------------------------------

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


  // --------------------------------
  // Convert RGB → grayscale
  // --------------------------------

  let pixels =
    imageData.data;


  let grayscalePixels =
    new Uint8Array(
      cameraWidth *
      cameraHeight
    );


  for (
    let i = 0, j = 0;

    i < pixels.length;

    i += 4, j++
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


  // --------------------------------
  // Detect AprilTags
  // --------------------------------

  try {

    let detections =
      await apriltag.detect(

        grayscalePixels,

        cameraWidth,

        cameraHeight

      );


    // --------------------------------
    // Look for our specific tag
    // --------------------------------

    let tagSeenThisFrame = false;


    for (
      let detection of detections
    ) {

      if (
        detection.id ===
        targetTagID
      ) {

        // AprilTag detector already
        // gives us its center.

        tagX =
          detection.center.x;

        tagY =
          detection.center.y;


        tagSeenThisFrame =
          true;


        break;
      }
    }


    if (tagSeenThisFrame) {

      lastTagSeenAt =
        performance.now();

    }


    tagDetected =
      tagSeenThisFrame ||
      (
        lastTagSeenAt > 0 &&
        performance.now() - lastTagSeenAt <= signalHoldDuration
      );


    if (tagSeenThisFrame) {

      setStatus(
        "AprilTag " +
        targetTagID +
        " detected"
      );

    }

    else if (tagDetected) {

      setStatus(
        "AprilTag " +
        targetTagID +
        " signal held"
      );

    }

    else {

      setStatus(
        "Looking for AprilTag " +
        targetTagID
      );
    }

  }

  catch (error) {

    console.error(
      "Detection error:",
      error
    );
  }


  detecting = false;


  // --------------------------------
  // Detect next frame
  // --------------------------------

  requestAnimationFrame(
    detectFrame
  );
}


// ========================================
// P5 DRAW
// ========================================

function draw() {

  background(
    245
  );


  // ======================================
  // DRAW GREY PATH
  // ======================================

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


  // ======================================
  // NO APRILTAG
  // ======================================

  if (!tagDetected) {

    drawCircle(
      circleX,
      circleY,
      circleIsInsidePath
    );

    return;
  }


  // ======================================
  // CAMERA → P5
  // ======================================

  let tagPosition =
    mapTagToCanvas(

      tagX,
      tagY

    );


  // ======================================
  // FIND CONNECTED SEGMENT
  // ======================================

  let segment =
    findAllowedSegment(
      tagPosition
    );


  if (
    segment !== -1
  ) {

    currentSegment =
      segment;
  }


  // ======================================
  // CURRENT SEGMENT
  // ======================================

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


  // ======================================
  // CLOSEST POINT
  // ======================================

  let closest =
    closestPointOnLine(

      tagPosition,

      a,
      b

    );


  // ======================================
  // DISTANCE FROM PATH
  // ======================================

  let distance =
    p5.Vector.dist(

      tagPosition,

      closest

    );


  // ======================================
  // MAXIMUM DISTANCE
  // ======================================

  let maxDistance =
    lineThickness / 2
    - circleRadius;


  let circlePosition =
    tagPosition.copy();

  let isInsidePath =
    distance <= maxDistance;

  circleX =
    circlePosition.x;

  circleY =
    circlePosition.y;

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


  // ======================================
  // DRAW CIRCLE
  // ======================================

  drawCircle(

    circlePosition.x,

    circlePosition.y,

    circleIsInsidePath

  );


  // ======================================
  // DEBUG
  // ======================================

  fill(
    40
  );

  noStroke();

  textSize(
    14
  );


  text(
    "AprilTag ID: " +
    targetTagID,

    15,
    height - 45
  );


  text(
    "Camera: " +
    Math.round(tagX) +
    " / " +
    Math.round(tagY),

    15,
    height - 25
  );
}


// ========================================
// MAP CAMERA POSITION TO P5
// ========================================

function mapTagToCanvas(
  x,
  y
) {

  let mappedX =
    map(

      x,

      0,
      cameraWidth,

      0,
      width

    );


  let mappedY =
    map(

      y,

      0,
      cameraHeight,

      0,
      height

    );


  return createVector(

    mappedX,

    mappedY

  );
}


// ========================================
// DRAW CIRCLE
// ========================================

function drawCircle(
  x,
  y,
  isInsidePath = true
) {

  noStroke();

  if (isInsidePath) {

    fill(
      255,
      80,
      80
    );

  }

  else {

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


// ========================================
// FIND ALLOWED SEGMENT
// ========================================

function findAllowedSegment(
  position
) {

  let candidates = [];


  // Current

  candidates.push(
    currentSegment
  );


  // Previous

  if (
    currentSegment > 0
  ) {

    candidates.push(
      currentSegment - 1
    );
  }


  // Next

  if (
    currentSegment <
    path.length - 2
  ) {

    candidates.push(
      currentSegment + 1
    );
  }


  let bestSegment =
    currentSegment;


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
      distance <
      bestDistance
    ) {

      bestDistance =
        distance;

      bestSegment =
        i;
    }
  }


  // --------------------------------
  // Only switch to a neighbouring
  // segment if the tag is actually
  // close to it.
  // --------------------------------

  let allowedDistance =
    lineThickness / 2;


  if (
    bestDistance <=
    allowedDistance
  ) {

    return bestSegment;
  }


  return currentSegment;
}


// ========================================
// CLOSEST POINT ON LINE
// ========================================

function closestPointOnLine(
  p,
  a,
  b
) {

  let line =
    p5.Vector.sub(

      b,

      a

    );


  let lengthSquared =
    line.magSq();


  if (
    lengthSquared === 0
  ) {

    return a.copy();
  }


  let t =
    p5.Vector.sub(

      p,

      a

    )
    .dot(line)
    /
    lengthSquared;


  t =
    constrain(

      t,

      0,

      1

    );


  return p5.Vector.add(

    a,

    p5.Vector.mult(

      line,

      t

    )

  );
}


// ========================================
// STATUS MESSAGE
// ========================================

function setStatus(
  message
) {

  let status =
    document.getElementById(
      "status"
    );


  if (status) {

    status.innerText =
      message;
  }
}