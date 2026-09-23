// ----------------------------------------
// PATH
// ----------------------------------------

let path = [
  { x: 165, y: 165 },
  { x: 125, y: 425 },
  { x: 340, y: 340 },
  { x: 325, y: 125 },
  { x: 525, y: 370 },
  { x: 255, y: 485 },
  { x: 525, y: 510 }
];


// ----------------------------------------
// SETTINGS
// ----------------------------------------

let circleRadius = 12;
let lineThickness = 60;


// ----------------------------------------
// CURRENT SEGMENT
// ----------------------------------------

// This remembers which part of the path
// the circle is currently on.

let currentSegment = 0;


// ----------------------------------------
// SETUP
// ----------------------------------------

function setup() {
  createCanvas(650, 650);
}


// ----------------------------------------
// DRAW
// ----------------------------------------

function draw() {

  background(245);


  // --------------------------------
  // DRAW GREY PATH
  // --------------------------------

  noFill();

  stroke(120);
  strokeWeight(lineThickness);

  strokeCap(ROUND);
  strokeJoin(ROUND);

  beginShape();

  for (let p of path) {
    vertex(p.x, p.y);
  }

  endShape();


  // --------------------------------
  // MOUSE
  // --------------------------------

  let mouse = createVector(mouseX, mouseY);


  // --------------------------------
  // FIND THE BEST CONNECTED SEGMENT
  // --------------------------------

  let segment = findAllowedSegment(mouse);


  if (segment !== -1) {
    currentSegment = segment;
  }


  // --------------------------------
  // GET CLOSEST POINT ON CURRENT
  // SEGMENT
  // --------------------------------

  let a = createVector(
    path[currentSegment].x,
    path[currentSegment].y
  );

  let b = createVector(
    path[currentSegment + 1].x,
    path[currentSegment + 1].y
  );


  let closest =
    closestPointOnLine(mouse, a, b);


  // --------------------------------
  // ALLOW THE CIRCLE TO MOVE
  // INSIDE THE THICK GREY LINE
  // --------------------------------

  let distance =
    p5.Vector.dist(mouse, closest);


  let maxDistance =
    lineThickness / 2 - circleRadius;


  let circlePosition;


  if (distance <= maxDistance) {

    // Mouse is inside the path
    // so circle follows mouse directly.

    circlePosition = mouse.copy();

  } else {

    // Mouse is outside.
    // Keep circle at the edge.

    let direction =
      p5.Vector.sub(mouse, closest);

    direction.normalize();

    circlePosition =
      p5.Vector.add(
        closest,
        p5.Vector.mult(
          direction,
          maxDistance
        )
      );
  }


  // --------------------------------
  // DRAW CIRCLE
  // --------------------------------

  noStroke();

  fill(255, 80, 80);

  circle(
    circlePosition.x,
    circlePosition.y,
    circleRadius * 2
  );
}


// ========================================
// FIND ALLOWED SEGMENT
// ========================================
//
// Only the current segment and its
// immediate neighbours are considered.
//
// This prevents the circle from jumping
// to a completely different part of
// the path.
// ========================================

function findAllowedSegment(mouse) {

  let candidates = [];


  // Current segment
  candidates.push(currentSegment);


  // Previous segment
  if (currentSegment > 0) {
    candidates.push(currentSegment - 1);
  }


  // Next segment
  if (currentSegment < path.length - 2) {
    candidates.push(currentSegment + 1);
  }


  let bestSegment = currentSegment;

  let bestDistance = Infinity;


  for (let i of candidates) {

    let a = createVector(
      path[i].x,
      path[i].y
    );

    let b = createVector(
      path[i + 1].x,
      path[i + 1].y
    );


    let closest =
      closestPointOnLine(
        mouse,
        a,
        b
      );


    let distance =
      p5.Vector.dist(
        mouse,
        closest
      );


    if (distance < bestDistance) {

      bestDistance = distance;

      bestSegment = i;
    }
  }


  // --------------------------------
  // IMPORTANT:
  //
  // Only change segment if the mouse
  // is actually close enough to the
  // neighbouring path.
  // --------------------------------

  let allowedDistance =
    lineThickness / 2;


  if (bestDistance <= allowedDistance) {
    return bestSegment;
  }


  return currentSegment;
}


// ========================================
// CLOSEST POINT ON LINE SEGMENT
// ========================================

function closestPointOnLine(p, a, b) {

  let line =
    p5.Vector.sub(b, a);

  let lengthSquared =
    line.magSq();


  // Avoid division by zero
  if (lengthSquared === 0) {
    return a.copy();
  }


  // Position along line
  let t =
    p5.Vector.sub(p, a)
      .dot(line)
    / lengthSquared;


  // Keep point between A and B
  t = constrain(t, 0, 1);


  return p5.Vector.add(
    a,
    p5.Vector.mult(
      line,
      t
    )
  );
}