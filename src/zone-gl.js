/* Мини-WebGL для живого фона главной (zone-bg.js) вместо three.js.
   Фону нужно немного: плоскости с шейдерами (фото и туман), точки (пыль и искры), перспективная камера,
   смешивание обычное и сложением. three.js ради этого весил ~530 КБ, этот файл - несколько КБ.
   Имена и поведение повторяют three.js ровно в той части, что использует zone-bg.js (ShaderMaterial, Mesh, Points…),
   поэтому шейдеры и код сцены не менялись. Шейдеры - GLSL ES 1.00: их принимают и WebGL 1, и WebGL 2.
   Чего здесь нет (свет, тени, обычные материалы, вращение объектов, сортировка по глубине) - фону не нужно */

export const NormalBlending = 1;
export const AdditiveBlending = 2;
export const LinearFilter = 1006;
export const LinearSRGBColorSpace = "srgb-linear";
export const NoColorSpace = "";

export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
}
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
}

/* матрицы 4×4 по столбцам, как ждёт uniformMatrix4fv */
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
/* камера: положение и поворот (порядок осей XYZ, как Euler в three.js) -> матрица вида (обратная к матрице камеры) */
function viewMatrix(p, r) {
  const a = Math.cos(r.x),
    b = Math.sin(r.x),
    c = Math.cos(r.y),
    d = Math.sin(r.y),
    e = Math.cos(r.z),
    f = Math.sin(r.z);
  const ae = a * e,
    af = a * f,
    be = b * e,
    bf = b * f;
  /* поворот R (строки) - формула three.js Matrix4.makeRotationFromEuler для порядка XYZ */
  const R = [
    [c * e, -c * f, d],
    [af + be * d, ae - bf * d, -b * c],
    [bf - ae * d, be + af * d, a * c]
  ];
  /* обратная: Rᵀ и -Rᵀ·p */
  const m = new Float32Array(16);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[j * 4 + i] = R[j][i];
  for (let i = 0; i < 3; i++) m[12 + i] = -(R[0][i] * p.x + R[1][i] * p.y + R[2][i] * p.z);
  m[15] = 1;
  return m;
}

export class Scene {
  constructor() {
    this.children = [];
  }
  add(o) {
    this.children.push(o);
  }
}

export class PerspectiveCamera {
  constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
    Object.assign(this, { fov, aspect, near, far });
    this.position = new Vector3();
    this.rotation = new Vector3();
    this.projectionMatrix = new Float32Array(16);
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    const f = 1 / Math.tan((this.fov * Math.PI) / 360),
      n = this.near,
      fa = this.far,
      m = this.projectionMatrix;
    m.fill(0);
    m[0] = f / this.aspect;
    m[5] = f;
    m[10] = -(fa + n) / (fa - n);
    m[11] = -1;
    m[14] = (-2 * fa * n) / (fa - n);
  }
}

export class Float32BufferAttribute {
  constructor(array, itemSize) {
    this.array = array instanceof Float32Array ? array : new Float32Array(array);
    this.itemSize = itemSize;
    this.count = this.array.length / itemSize;
  }
}
export class BufferGeometry {
  constructor() {
    this.attributes = {};
    this.index = null;
  }
  setAttribute(name, attr) {
    this.attributes[name] = attr;
    return this;
  }
}
/* плоскость w×h в плоскости XY с центром в нуле; uv (0,0) - левый нижний угол, как в three.js */
export class PlaneGeometry extends BufferGeometry {
  constructor(w = 1, h = 1) {
    super();
    const x = w / 2,
      y = h / 2;
    this.setAttribute("position", new Float32BufferAttribute([-x, y, 0, x, y, 0, -x, -y, 0, x, -y, 0], 3));
    this.setAttribute("uv", new Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
    this.index = new Uint16Array([0, 2, 1, 2, 3, 1]);
  }
}

export class ShaderMaterial {
  constructor(o = {}) {
    this.uniforms = o.uniforms || {};
    this.defines = o.defines || {};
    this.vertexShader = o.vertexShader || "";
    this.fragmentShader = o.fragmentShader || "";
    this.transparent = !!o.transparent;
    this.blending = o.blending || NormalBlending;
  }
}

class Object3D {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = new Vector3();
    this.scale = new Vector3(1, 1, 1);
    this.renderOrder = 0;
    this.frustumCulled = true;
  }
}
export class Mesh extends Object3D {}
export class Points extends Object3D {}

export class Texture {
  constructor(image) {
    this.image = image;
    this.colorSpace = NoColorSpace;
    this.minFilter = LinearFilter;
    this.generateMipmaps = false;
    this._gl = null;
  }
  dispose() {
    if (this._gl) this._gl.ctx.deleteTexture(this._gl.tex);
    this._gl = null;
  }
}
export class TextureLoader {
  load(url, onLoad, onProgress, onError) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => onLoad && onLoad(new Texture(img));
    img.onerror = e => onError && onError(e);
    img.src = url;
  }
}

const PREFIX_V =
  "precision highp float;\nprecision highp int;\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\nattribute vec3 position;\nattribute vec2 uv;\n";
const PREFIX_F = "precision highp float;\nprecision highp int;\n";

export class WebGLRenderer {
  constructor(o = {}) {
    const opts = {
      alpha: !!o.alpha,
      antialias: !!o.antialias,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: o.powerPreference || "default"
    };
    this.domElement = o.canvas || document.createElement("canvas");
    const gl = this.domElement.getContext("webgl2", opts) || this.domElement.getContext("webgl", opts);
    if (!gl) throw new Error("WebGL недоступен");
    this.gl = gl;
    this.pixelRatio = 1;
    this.outputColorSpace = LinearSRGBColorSpace;
    this.programs = new Map();
    this.buffers = new WeakMap();
    /* пустая чёрная текстура вместо ещё не загруженной (как в three.js) */
    this.empty = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.empty);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  }
  setPixelRatio(r) {
    this.pixelRatio = r;
  }
  getPixelRatio() {
    return this.pixelRatio;
  }
  setSize(w, h) {
    const c = this.domElement;
    c.width = Math.floor(w * this.pixelRatio);
    c.height = Math.floor(h * this.pixelRatio);
    this.gl.viewport(0, 0, c.width, c.height);
  }
  program(mat) {
    let p = this.programs.get(mat);
    if (p) return p;
    const gl = this.gl;
    const defs = Object.entries(mat.defines)
      .map(([k, v]) => "#define " + k + " " + v + "\n")
      .join("");
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost())
        throw new Error("Шейдер: " + gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, PREFIX_V + defs + mat.vertexShader));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, PREFIX_F + defs + mat.fragmentShader));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost())
      throw new Error("Шейдер: " + gl.getProgramInfoLog(prog));
    const uni = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) || 0;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      uni[info.name] = { loc: gl.getUniformLocation(prog, info.name), type: info.type };
    }
    p = { prog, uni, attr: {} };
    this.programs.set(mat, p);
    return p;
  }
  buffer(attr, target) {
    let b = this.buffers.get(attr);
    if (!b) {
      const gl = this.gl;
      b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, attr.array || attr, gl.STATIC_DRAW);
      this.buffers.set(attr, b);
    }
    return b;
  }
  texture(tex, unit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    if (!tex) return gl.bindTexture(gl.TEXTURE_2D, this.empty);
    if (tex._gl && tex._gl.ctx === gl) return gl.bindTexture(gl.TEXTURE_2D, tex._gl.tex);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex.image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    tex._gl = { ctx: gl, tex: t };
  }
  render(scene, camera) {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const view = viewMatrix(camera.position, camera.rotation);
    /* непрозрачное - раньше прозрачного, внутри - по renderOrder (как в three.js) */
    const list = scene.children
      .slice()
      .sort((a, b) => a.material.transparent - b.material.transparent || a.renderOrder - b.renderOrder);
    for (const o of list) {
      const m = o.material,
        p = this.program(m);
      gl.useProgram(p.prog);
      if (!m.transparent) gl.disable(gl.BLEND);
      else {
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD);
        if (m.blending === AdditiveBlending) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      }
      const model = new Float32Array(16);
      model[0] = o.scale.x;
      model[5] = o.scale.y;
      model[10] = o.scale.z;
      model[12] = o.position.x;
      model[13] = o.position.y;
      model[14] = o.position.z;
      model[15] = 1;
      let unit = 0;
      for (const [name, u] of Object.entries(p.uni)) {
        if (name === "modelViewMatrix") gl.uniformMatrix4fv(u.loc, false, mul(view, model));
        else if (name === "projectionMatrix") gl.uniformMatrix4fv(u.loc, false, camera.projectionMatrix);
        else {
          const v = m.uniforms[name] && m.uniforms[name].value;
          if (u.type === gl.SAMPLER_2D) {
            this.texture(v, unit);
            gl.uniform1i(u.loc, unit++);
          } else if (typeof v === "number") gl.uniform1f(u.loc, v);
          else if (v && "z" in v) gl.uniform3f(u.loc, v.x, v.y, v.z);
          else if (v) gl.uniform2f(u.loc, v.x, v.y);
        }
      }
      const g = o.geometry,
        used = [];
      let count = 0;
      for (const [name, a] of Object.entries(g.attributes)) {
        let loc = p.attr[name];
        if (loc === undefined) loc = p.attr[name] = gl.getAttribLocation(p.prog, name);
        if (loc < 0) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer(a, gl.ARRAY_BUFFER));
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, a.itemSize, gl.FLOAT, false, 0, 0);
        used.push(loc);
        count = a.count;
      }
      if (o instanceof Points) gl.drawArrays(gl.POINTS, 0, g.attributes.position.count);
      else if (g.index) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer(g.index, gl.ELEMENT_ARRAY_BUFFER));
        gl.drawElements(gl.TRIANGLES, g.index.length, gl.UNSIGNED_SHORT, 0);
      } else gl.drawArrays(gl.TRIANGLES, 0, count);
      used.forEach(l => gl.disableVertexAttribArray(l));
    }
  }
}
