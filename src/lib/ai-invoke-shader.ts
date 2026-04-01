/**
 * AI Invoke ripple effect — real pixel displacement via SVG filter
 * + WebGL gradient overlay.
 *
 * The SVG filter applies a displacement map to the actual DOM element,
 * warping rendered pixels like looking through water. A hidden canvas
 * generates the displacement map each frame as expanding concentric
 * rings from the click point. A separate WebGL canvas draws the
 * subtle color gradient overlay on top.
 */

// ---- Displacement map renderer (2D Canvas) ----

/**
 * Paints concentric rings centered at (ox, oy) into a canvas.
 * Red channel  = X displacement (128 = none, >128 = right, <128 = left)
 * Green channel = Y displacement (128 = none, >128 = down, <128 = up)
 */
function paintDisplacementMap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ox: number,  // origin in pixels
  oy: number,
  progress: number,
  maxRadiusPx: number,
) {
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  const eased = 1 - Math.pow(1 - progress, 2.5);
  const radiusPx = eased * maxRadiusPx;
  const fadeOut = Math.pow(Math.max(0, 1 - progress / 0.85), 1.5);

  // Ring wavelength in pixels — bigger = wider rings
  const wavelength = 40;
  const freq = (2 * Math.PI) / wavelength;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - ox;
      const dy = y - oy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Distance from the ripple front
      const rippleDist = dist - radiusPx;
      const normRipple = rippleDist / maxRadiusPx;

      // Ring intensity — gaussian envelope around the wavefront
      const envelope = Math.exp(-normRipple * normRipple * 8) * fadeOut;

      // Sine rings
      const wave = Math.sin(rippleDist * freq) * envelope;

      // Displacement direction: radially outward from origin
      const angle = Math.atan2(dy, dx);
      const dispX = Math.cos(angle) * wave;
      const dispY = Math.sin(angle) * wave;

      // Encode into RGB: 128 = zero, ±1 maps to 0..255
      const idx = (y * w + x) * 4;
      data[idx]     = Math.round(128 + dispX * 127); // R → X
      data[idx + 1] = Math.round(128 + dispY * 127); // G → Y
      data[idx + 2] = 128;                            // B unused
      data[idx + 3] = 255;                            // A
    }
  }

  ctx.putImageData(imageData, 0, 0);
}


// ---- SVG filter manager ----

let filterCounter = 0;

interface DisplacementFilter {
  svgEl: SVGSVGElement;
  feImage: SVGFEImageElement;
  feDisplacement: SVGElement;
  filterId: string;
}

function createDisplacementFilter(scale: number): DisplacementFilter {
  const ns = "http://www.w3.org/2000/svg";
  const filterId = `ai-ripple-disp-${++filterCounter}`;

  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";

  const defs = document.createElementNS(ns, "defs");
  const filter = document.createElementNS(ns, "filter");
  filter.setAttribute("id", filterId);
  filter.setAttribute("x", "-10%");
  filter.setAttribute("y", "-10%");
  filter.setAttribute("width", "120%");
  filter.setAttribute("height", "120%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  // feImage — will be updated each frame with the displacement map data URL
  const feImage = document.createElementNS(ns, "feImage") as SVGFEImageElement;
  feImage.setAttribute("result", "dispMap");
  feImage.setAttribute("preserveAspectRatio", "none");

  // feDisplacementMap — uses red/green channels for X/Y displacement
  const feDisplacement = document.createElementNS(ns, "feDisplacementMap");
  feDisplacement.setAttribute("in", "SourceGraphic");
  feDisplacement.setAttribute("in2", "dispMap");
  feDisplacement.setAttribute("scale", String(scale));
  feDisplacement.setAttribute("xChannelSelector", "R");
  feDisplacement.setAttribute("yChannelSelector", "G");

  filter.appendChild(feImage);
  filter.appendChild(feDisplacement);
  defs.appendChild(filter);
  svg.appendChild(defs);
  document.body.appendChild(svg);

  return { svgEl: svg, feImage, feDisplacement, filterId };
}


// ---- WebGL gradient overlay (subtle color wash) ----

const VERTEX_SRC = /* glsl */ `
  attribute vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAGMENT_SRC = /* glsl */ `
  precision mediump float;
  uniform vec2  u_resolution;
  uniform float u_progress;
  uniform vec2  u_origin;
  uniform float u_maxRadius;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    uv.y = 1.0 - uv.y;

    float aspect = u_resolution.x / u_resolution.y;
    vec2 cuv = vec2(uv.x * aspect, uv.y);
    vec2 cor = vec2(u_origin.x * aspect, u_origin.y);
    float dist = length(cuv - cor);

    float t = u_progress;
    float eased = 1.0 - pow(1.0 - t, 2.5);
    float radius = eased * u_maxRadius;
    float normRipple = (dist - radius) / u_maxRadius;

    // Soft glow at wavefront
    float glow = exp(-normRipple * normRipple * 6.0) * smoothstep(0.0, 0.04, eased);

    // Subtle fill behind front
    float normDist = dist / u_maxRadius;
    float normRadius = radius / u_maxRadius;
    float fill = smoothstep(normRadius + 0.1, normRadius - 0.2, normDist) * 0.2;

    // Muted color
    vec3 cyan   = vec3(0.10, 0.40, 0.65);
    vec3 purple = vec3(0.30, 0.15, 0.55);
    float colorT = smoothstep(0.0, 0.7, normDist);
    vec3 col = mix(cyan, purple, colorT);

    float alpha = glow * 0.35 + fill * 0.4;
    alpha = clamp(alpha, 0.0, 0.30);
    alpha *= smoothstep(1.0, 0.6, t) * smoothstep(0.0, 0.04, t);

    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("Shader compile:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function linkProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("Program link:", gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

function computeMaxRadius(originX: number, originY: number, aspect: number): number {
  const corners = [[0, 0], [aspect, 0], [0, 1], [aspect, 1]];
  const ox = originX * aspect;
  const oy = originY;
  let max = 0;
  for (const [cx, cy] of corners) {
    const d = Math.sqrt((cx - ox) ** 2 + (cy - oy) ** 2);
    if (d > max) max = d;
  }
  return max * 1.15;
}


// ---- Public API ----

export interface ShaderRippleOptions {
  /** Animation duration in ms (default 2500). */
  duration?: number;
  /** SVG displacement scale — how much pixels warp (default 30). */
  displacementScale?: number;
}

export function createShaderRipple(
  targetEl: HTMLElement,
  clickX: number,
  clickY: number,
  onDone: () => void,
  opts: ShaderRippleOptions = {},
) {
  const { duration = 2500, displacementScale = 30 } = opts;
  const rect = targetEl.getBoundingClientRect();

  const originX = Math.max(0, Math.min(1, (clickX - rect.left) / rect.width));
  const originY = Math.max(0, Math.min(1, (clickY - rect.top) / rect.height));
  const aspect = rect.width / rect.height;
  const maxRadius = computeMaxRadius(originX, originY, aspect);

  // ---- Displacement map canvas (hidden, low-res for perf) ----
  const dispScale = 0.15; // render at 15% of element size
  const dispW = Math.max(32, Math.round(rect.width * dispScale));
  const dispH = Math.max(8, Math.round(rect.height * dispScale));
  const dispCanvas = document.createElement("canvas");
  dispCanvas.width = dispW;
  dispCanvas.height = dispH;
  const dispCtx = dispCanvas.getContext("2d")!;

  // Origin in displacement canvas pixels
  const dispOx = originX * dispW;
  const dispOy = originY * dispH;
  // Max radius in pixels (use the longer axis)
  const maxRadiusPx = Math.sqrt(
    Math.max(dispOx, dispW - dispOx) ** 2 + Math.max(dispOy, dispH - dispOy) ** 2,
  ) * 1.15;

  // ---- SVG displacement filter ----
  const filter = createDisplacementFilter(displacementScale);
  targetEl.style.filter = `url(#${filter.filterId})`;

  // ---- WebGL gradient overlay ----
  const glCanvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  glCanvas.width = Math.round(rect.width * dpr);
  glCanvas.height = Math.round(rect.height * dpr);
  glCanvas.style.cssText = [
    "position:fixed",
    `top:${rect.top}px`,
    `left:${rect.left}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    "pointer-events:none",
    "z-index:50",
    "border-radius:4px",
  ].join(";");
  document.body.appendChild(glCanvas);

  const gl = glCanvas.getContext("webgl", { alpha: true, premultipliedAlpha: true });
  let prog: WebGLProgram | null = null;
  let uProg: WebGLUniformLocation | null = null;

  if (gl) {
    prog = linkProgram(gl);
    if (prog) {
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(prog, "a_position");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.uniform2f(gl.getUniformLocation(prog, "u_resolution"), glCanvas.width, glCanvas.height);
      gl.uniform2f(gl.getUniformLocation(prog, "u_origin"), originX, originY);
      gl.uniform1f(gl.getUniformLocation(prog, "u_maxRadius"), maxRadius);
      uProg = gl.getUniformLocation(prog, "u_progress");
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  // ---- Animation loop ----
  const t0 = performance.now();
  let raf = 0;
  let done = false;

  function cleanup() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);

    // Remove SVG filter
    targetEl.style.filter = "";
    filter.svgEl.remove();

    // Remove gradient overlay
    glCanvas.remove();

    onDone();
  }

  function tick(now: number) {
    if (done) return;
    const p = Math.min((now - t0) / duration, 1);

    // 1. Paint displacement map
    paintDisplacementMap(dispCtx, dispW, dispH, dispOx, dispOy, p, maxRadiusPx);
    const dataUrl = dispCanvas.toDataURL();
    filter.feImage.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
    filter.feImage.setAttribute("href", dataUrl);

    // Animate displacement scale: ramp up fast, sustain, then ease out
    const scaleT = p < 0.15
      ? p / 0.15                         // ramp up
      : p < 0.7
        ? 1.0                            // sustain
        : 1.0 - (p - 0.7) / 0.3;        // ease out
    const currentScale = displacementScale * scaleT * scaleT * (3 - 2 * scaleT);
    filter.feDisplacement.setAttribute("scale", String(currentScale));

    // 2. Render gradient overlay
    if (gl && prog) {
      gl.uniform1f(uProg, p);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (p < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      cleanup();
    }
  }

  raf = requestAnimationFrame(tick);
  setTimeout(cleanup, duration + 500);
}
