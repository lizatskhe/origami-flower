console.log("starting");

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl", { alpha: true });
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);

let isFolding = false;

function startFolding() {
  console.log("starting flower folding");
  isFolding = true;
  currentFoldStep = 0;
  lastStepTime = 0;

  for (let fold of manualFolds) {
    fold.angle = 0;
    fold.active = false;
  }

  if (manualFolds.length > 0) {
    manualFolds[0].active = true;
    console.log("step 1");
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const foldBtn = document.getElementById('foldBtn');
  if (foldBtn) {
    foldBtn.addEventListener('click', () => {
      console.log('fold button clicked');
      startFolding();
    });
    console.log("button event listener added successfully");
  } else {
    console.error("could not find element with id 'foldBtn'");
  }
});

async function loadShaderSource(url) {
  const response = await fetch(url);
  return await response.text();
}

async function initShaders() {
  const vsSource = await loadShaderSource("shaders/vertex.glsl");
  const fsSource = await loadShaderSource("shaders/fragment.glsl");

  const vertexShader = compileShader(gl.VERTEX_SHADER, vsSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error("unable to initialize the shader:", gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("shader compile failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
console.log("shader program initialized");

class ParticleSystem {
  constructor(count = 50) {
    this.particles = [];
    this.count = count;
    this.initParticles();
    this.createBuffers();
  }

  initParticles() {
    for (let i = 0; i < this.count; i++) {
      this.particles.push({
        position: [
          (Math.random() - 0.5) * 4,  // x: spread around scene
          Math.random() * 2 + 0.5,   // y: float above ground
          (Math.random() - 0.5) * 4   // z: depth variation
        ],
        velocity: [
          (Math.random() - 0.5) * 0.02, 
          Math.random() * 0.01 + 0.005,  
          (Math.random() - 0.5) * 0.02
        ],
        size: Math.random() * 0.005 + 0.002, 
        life: Math.random(), 
        lifeSpeed: Math.random() * 0.5 + 0.5,
        rotationSpeed: (Math.random() - 0.5) * 2,
        rotation: Math.random() * Math.PI * 2
      });
    }
  }

  createBuffers() {
    const quadVertices = [
      -1, -1, 0, 1, -1, 0, 1, 1, 0,
      -1, -1, 0, 1, 1, 0, -1, 1, 0
    ];

    this.positions = [];
    this.sizes = [];
    this.alphas = [];

    for (let i = 0; i < this.count; i++) {
      for (let j = 0; j < 6; j++) { 
        this.positions.push(0, 0, 0); // will be updated
        this.sizes.push(0.01); // will be updated
        this.alphas.push(1.0); // will be updated
      }
    }

    this.quadGeometry = new Float32Array(quadVertices);
    this.positionArray = new Float32Array(this.positions);
    this.sizeArray = new Float32Array(this.sizes);
    this.alphaArray = new Float32Array(this.alphas);

    this.positionBuffer = gl.createBuffer();
    this.quadBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.quadGeometry, gl.STATIC_DRAW);
  }

  update(deltaTime) {
    let posIndex = 0;
    let sizeIndex = 0;
    let alphaIndex = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // update position
      p.position[0] += p.velocity[0];
      p.position[1] += p.velocity[1];
      p.position[2] += p.velocity[2];

      // update life
      p.life += p.lifeSpeed * deltaTime;
      if (p.life > Math.PI * 2) p.life = 0;

      // update rotation
      p.rotation += p.rotationSpeed * deltaTime;

      // reset particles that drift too far
      if (p.position[1] > 3) {
        p.position[1] = -0.5;
        p.position[0] = (Math.random() - 0.5) * 4;
        p.position[2] = (Math.random() - 0.5) * 4;
      }

      // swaying motion
      p.velocity[0] += (Math.random() - 0.5) * 0.0001;
      p.velocity[2] += (Math.random() - 0.5) * 0.0001;

      // clamp velocities
      p.velocity[0] = Math.max(-0.03, Math.min(0.03, p.velocity[0]));
      p.velocity[2] = Math.max(-0.03, Math.min(0.03, p.velocity[2]));

      const pulseAlpha = (Math.sin(p.life) + 1) * 0.3 + 0.2; // 0.2 to 0.8

      // create quad vertices for this particle
      const cos_r = Math.cos(p.rotation);
      const sin_r = Math.sin(p.rotation);

      const quadVerts = [ // a quad centered at (0, 0, 0)
        [-p.size, -p.size], [p.size, -p.size], [p.size, p.size],
        [-p.size, -p.size], [p.size, p.size], [-p.size, p.size]
      ];

      for (let j = 0; j < 6; j++) {
        const localX = quadVerts[j][0];
        const localY = quadVerts[j][1];
        const rotatedX = localX * cos_r - localY * sin_r;
        const rotatedY = localX * sin_r + localY * cos_r;

        this.positionArray[posIndex++] = p.position[0] + rotatedX; // final world space position of each vertex of the quad
        this.positionArray[posIndex++] = p.position[1] + rotatedY;
        this.positionArray[posIndex++] = p.position[2];

        this.sizeArray[sizeIndex++] = p.size;
        this.alphaArray[alphaIndex++] = pulseAlpha;
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positionArray, gl.DYNAMIC_DRAW);
  }

  render(attribLocations, uniformLocations) {
    gl.uniform1i(uniformLocations.isShadow, 0);
    gl.uniform1i(uniformLocations.isFlower, 0);
    gl.uniform1i(uniformLocations.isParticle, 1);
    gl.uniform3fv(uniformLocations.baseColor, [1.0, 0.9, 0.3]); // golden pollen color

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(attribLocations.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribLocations.position);

    gl.drawArrays(gl.TRIANGLES, 0, this.count * 6);
  }
}

// create a square paper
function createPaperGeometry(subdivisions = 10, scale = 0.3) {
  const positions = [];
  const normals = [];

  for (let i = 0; i < subdivisions; i++) {
    for (let j = 0; j < subdivisions; j++) {
      const x0 = (i / subdivisions - 0.5) * scale;
      const x1 = ((i + 1) / subdivisions - 0.5) * scale;
      const y0 = 0;
      const y1 = 0;
      const z0 = (j / subdivisions - 0.5) * scale;
      const z1 = ((j + 1) / subdivisions - 0.5) * scale;

      positions.push(x0, y0, z0, x1, y1, z0, x1, y1, z1);
      positions.push(x0, y0, z0, x1, y1, z1, x0, y0, z1);

      for (let k = 0; k < 6; k++) {
        normals.push(0, 1, 0);
      }
    }
  }

  console.log("geometry created: ", positions.length / 3, " vertices");
  console.log("paper size: ", scale, "x", scale, "units");

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
  };
}

function createShadowPlane() {
  const positions = [
    -2, -0.5, -2, 2, -0.5, -2, 2, -0.5, 2,
    -2, -0.5, -2, 2, -0.5, 2, -2, -0.5, 2
  ];

  const normals = [
    0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0
  ];

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
  };
}

function createShadowVertices(originalPositions, transformedPositions, lightPos) {
  const shadowPositions = [];
  const planeY = -0.49;

  for (let i = 0; i < transformedPositions.length; i += 3) {
    const vertex = [
      transformedPositions[i],
      transformedPositions[i + 1],
      transformedPositions[i + 2]
    ];

    const lightToVertex = [
      vertex[0] - lightPos[0],
      vertex[1] - lightPos[1],
      vertex[2] - lightPos[2]
    ];

    const t = (planeY - lightPos[1]) / lightToVertex[1];

    const shadowX = lightPos[0] + t * lightToVertex[0];
    const shadowZ = lightPos[2] + t * lightToVertex[2];

    shadowPositions.push(shadowX, planeY, shadowZ);
  }

  return new Float32Array(shadowPositions);
}

let manualFolds = [
  {
    axis: [-0.707, 0, -0.707],
    pivot: [-0.05, 0, 0.05],
    angle: 0,
    targetAngle: Math.PI / 2,
    speed: 1.0,
    condition: (pos) => pos[0] < -0.08 && pos[2] > 0.08,
    active: false
  },
  {
    axis: [-0.707, 0, 0.707],
    pivot: [0.05, 0, 0.05],
    angle: 0,
    targetAngle: Math.PI / 2,
    speed: 1.0,
    condition: (pos) => pos[0] > 0.08 && pos[2] > 0.08,
    active: false
  },
  {
    axis: [0.707, 0, -0.707],
    pivot: [-0.05, 0, -0.05],
    angle: 0,
    targetAngle: Math.PI / 2,
    speed: 1.0,
    condition: (pos) => pos[0] < -0.08 && pos[2] < -0.08,
    active: false
  },
  {
    axis: [0.707, 0, 0.707],
    pivot: [0.05, 0, -0.05],
    angle: 0,
    targetAngle: Math.PI / 2,
    speed: 1.0,
    condition: (pos) => pos[0] > 0.08 && pos[2] < -0.08,
    active: false
  },
  {
    axis: [0, 0, -1],
    pivot: [-0.12, 0, 0],
    angle: 0,
    targetAngle: Math.PI / 3,
    speed: 1.2,
    condition: (pos) => pos[0] < -0.05 && Math.abs(pos[2]) < 0.05,
    active: false
  },
  {
    axis: [0, 0, 1],
    pivot: [0.12, 0, 0],
    angle: 0,
    targetAngle: Math.PI / 3,
    speed: 1.2,
    condition: (pos) => pos[0] > 0.05 && Math.abs(pos[2]) < 0.05,
    active: false
  },
  {
    axis: [-1, 0, 0],
    pivot: [0, 0, 0.12],
    angle: 0,
    targetAngle: Math.PI / 3,
    speed: 1.2,
    condition: (pos) => pos[2] > 0.05 && Math.abs(pos[0]) < 0.05,
    active: false
  },
  {
    axis: [1, 0, 0],
    pivot: [0, 0, -0.12],
    angle: 0,
    targetAngle: Math.PI / 3,
    speed: 1.2,
    condition: (pos) => pos[2] < -0.05 && Math.abs(pos[0]) < 0.05,
    active: false
  }
];

let currentFoldStep = 0;
let stepDelay = 1000;
let lastStepTime = 0;

function createFolds(positions, subdivisions) {
  const folds = [];
  for (let i = 0; i < subdivisions; i++) {
    for (let j = 0; j < subdivisions; j++) {
      const baseIndex = (i * subdivisions + j) * 6 * 3;

      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 6; k++) {
        cx += positions[baseIndex + k * 3 + 0];
        cy += positions[baseIndex + k * 3 + 1];
        cz += positions[baseIndex + k * 3 + 2];
      }
      cx /= 6; cy /= 6; cz /= 6;

      folds.push({
        indices: Array.from({ length: 6 }, (_, k) => baseIndex + k * 3),
        pivot: [cx, cy, cz],
        axis: [1, 0, 0],
        angle: 0,
        targetAngle: Math.PI / 2,
        speed: 1.0,
      });
    }
  }

  return folds;
}

function rotatePointAroundAxis(point, pivot, axis, angle) {
  const out = glMatrix.vec3.create();
  const translated = glMatrix.vec3.create();
  glMatrix.vec3.subtract(translated, point, pivot);

  const rotationMatrix = glMatrix.mat4.create();
  glMatrix.mat4.fromRotation(rotationMatrix, angle, axis);

  glMatrix.vec3.transformMat4(translated, translated, rotationMatrix);
  glMatrix.vec3.add(out, translated, pivot);

  return out;
}

async function main() {
  const shaderProgram = await initShaders();
  gl.useProgram(shaderProgram);

  const attribLocations = {
    position: gl.getAttribLocation(shaderProgram, "aPosition"),
    normal: gl.getAttribLocation(shaderProgram, "aNormal"),
  };

  const uniformLocations = {
    projection: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
    modelView: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
    normalMatrix: gl.getUniformLocation(shaderProgram, "uNormalMatrix"),
    lightPos: gl.getUniformLocation(shaderProgram, "uLightPosition"),
    lightColor: gl.getUniformLocation(shaderProgram, "uLightColor"),
    lightIntensity: gl.getUniformLocation(shaderProgram, "uLightIntensity"),
    baseColor: gl.getUniformLocation(shaderProgram, "uBaseColor"),
    shininess: gl.getUniformLocation(shaderProgram, "uShininess"),
    viewPos: gl.getUniformLocation(shaderProgram, "uViewPos"),
    isShadow: gl.getUniformLocation(shaderProgram, "uIsShadow"),
    isFlower: gl.getUniformLocation(shaderProgram, "uIsFlower"),
    isParticle: gl.getUniformLocation(shaderProgram, "uIsParticle"),
  };

  const particleSystem = new ParticleSystem(60);
  console.log("particle system initialized with", particleSystem.count, "particles");

  const { positions, normals } = createPaperGeometry(20, 0.5);
  const originalPositions = new Float32Array(positions);
  const folds = createFolds(originalPositions, 20);

  const shadowPlane = createShadowPlane();

  console.log("folds created:", folds.length);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

  const shadowPlanePositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, shadowPlanePositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, shadowPlane.positions, gl.STATIC_DRAW);

  const shadowPlaneNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, shadowPlaneNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, shadowPlane.normals, gl.STATIC_DRAW);

  const shadowPositionBuffer = gl.createBuffer();

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let previousTime = 0;

  function render(time) {
    time *= 0.001;
    const deltaTime = time - previousTime;
    previousTime = time;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    particleSystem.update(deltaTime);

    if (isFolding) {
      let allCurrentStepsDone = true;

      for (let i = 0; i < manualFolds.length; i++) {
        const fold = manualFolds[i];

        if (!fold.active) continue;

        const deltaAngle = fold.speed * deltaTime;
        const remaining = fold.targetAngle - fold.angle;
        const step = Math.sign(remaining) * Math.min(Math.abs(remaining), deltaAngle);
        fold.angle += step;

        if (Math.abs(fold.angle - fold.targetAngle) > 0.01) {
          allCurrentStepsDone = false;
        } else {
          fold.angle = fold.targetAngle;
        }
      }

      if (allCurrentStepsDone) {
        if (lastStepTime === 0) {
          lastStepTime = time;
        } else if (time - lastStepTime > stepDelay / 1000) {
          currentFoldStep++;

          if (currentFoldStep < manualFolds.length) {
            manualFolds[currentFoldStep].active = true;
            lastStepTime = 0;
            console.log(`step ${currentFoldStep + 1}`);
          } else {
            console.log("flower folding complete");
            isFolding = false;
          }
        }
      }
    }

    gl.uniform1f(uniformLocations.shininess, 32.0);

    const aspect = canvas.width / canvas.height;
    const projectionMatrix = glMatrix.mat4.create();
    glMatrix.mat4.perspective(projectionMatrix, Math.PI / 3, aspect, 0.1, 100.0);

    const modelViewMatrix = glMatrix.mat4.create();
    glMatrix.mat4.translate(modelViewMatrix, modelViewMatrix, [0, -0.1, -0.8]);
    glMatrix.mat4.rotateY(modelViewMatrix, modelViewMatrix, time * 0.2);

    const viewMatrix = glMatrix.mat4.create();
    glMatrix.mat4.invert(viewMatrix, modelViewMatrix);

    const lightWorldPos = glMatrix.vec3.fromValues(2, 2, 1); // static light source
    // const lightWorldPos = glMatrix.vec3.fromValues( // light moves around
    //   2 * Math.cos(-time * 0.2),
    //   2,
    //   2 * Math.sin(-time * 0.2)
    // );

    // const lightWorldPos = glMatrix.vec3.fromValues( // light moves around
    //   1.5 * Math.cos(time * 0.2),
    //   2,
    //   1.0 * Math.sin(time * 0.2) + 1.5
    // );


    const lightViewPos = glMatrix.vec3.create();
    glMatrix.vec3.transformMat4(lightViewPos, lightWorldPos, modelViewMatrix);

    const cameraViewPos = glMatrix.vec3.fromValues(0, 0, 0);

    gl.uniform3fv(uniformLocations.lightPos, lightViewPos);
    gl.uniform3fv(uniformLocations.viewPos, cameraViewPos);


    console.log("Light World Pos:", lightWorldPos);
    console.log("Light View Pos:", lightViewPos);

    const lightModelPos = glMatrix.vec3.create();
    const inverseModelView = glMatrix.mat4.create();
    glMatrix.mat4.invert(inverseModelView, modelViewMatrix);
    glMatrix.vec3.transformMat4(lightModelPos, lightWorldPos, inverseModelView);



    gl.uniform3fv(uniformLocations.lightColor, [1, 1, 1]);
    gl.uniform1f(uniformLocations.lightIntensity, 1.2);
    gl.uniform3fv(uniformLocations.viewPos, cameraViewPos);


    const normalMatrix = glMatrix.mat4.create();
    glMatrix.mat4.invert(normalMatrix, modelViewMatrix);
    glMatrix.mat4.transpose(normalMatrix, normalMatrix);

    const transformedPositions = new Float32Array(originalPositions);

    for (const fold of manualFolds) {
      if (!fold.active && fold.angle === 0) continue;

      for (let i = 0; i < transformedPositions.length; i += 3) {
        const originalPos = glMatrix.vec3.fromValues(
          originalPositions[i],
          originalPositions[i + 1],
          originalPositions[i + 2]
        );

        const currentPos = glMatrix.vec3.fromValues(
          transformedPositions[i],
          transformedPositions[i + 1],
          transformedPositions[i + 2]
        );

        if (fold.condition && !fold.condition(originalPos)) continue;

        const rotated = rotatePointAroundAxis(currentPos, fold.pivot, fold.axis, fold.angle);

        transformedPositions[i + 0] = rotated[0];
        transformedPositions[i + 1] = rotated[1];
        transformedPositions[i + 2] = rotated[2];
      }
    }

    gl.uniformMatrix4fv(uniformLocations.projection, false, projectionMatrix);
    gl.uniformMatrix4fv(uniformLocations.modelView, false, modelViewMatrix);
    gl.uniformMatrix4fv(uniformLocations.normalMatrix, false, normalMatrix);

    // render shadow plane 
    gl.uniform1i(uniformLocations.isShadow, 0);
    gl.uniform1i(uniformLocations.isFlower, 0);
    gl.uniform1i(uniformLocations.isParticle, 0);
    gl.uniform3fv(uniformLocations.baseColor, [0.7, 1, 0.7]);


    gl.bindBuffer(gl.ARRAY_BUFFER, shadowPlanePositionBuffer);
    gl.vertexAttribPointer(attribLocations.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribLocations.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, shadowPlaneNormalBuffer);
    gl.vertexAttribPointer(attribLocations.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribLocations.normal);

    gl.drawArrays(gl.TRIANGLES, 0, shadowPlane.positions.length / 3);

    // render paper shadow
    gl.uniform1i(uniformLocations.isShadow, 1);
    gl.uniform1i(uniformLocations.isParticle, 0);

    const shadowPositions = createShadowVertices(originalPositions, transformedPositions, lightWorldPos);

    gl.bindBuffer(gl.ARRAY_BUFFER, shadowPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, shadowPositions, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(attribLocations.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribLocations.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(attribLocations.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribLocations.normal);

    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);

    // render the flower
    gl.uniform1i(uniformLocations.isShadow, 0);
    gl.uniform1i(uniformLocations.isFlower, 1);
    gl.uniform1i(uniformLocations.isParticle, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, transformedPositions, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(attribLocations.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribLocations.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(attribLocations.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribLocations.normal);

    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);

    // render particles
    particleSystem.render(attribLocations, uniformLocations);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
