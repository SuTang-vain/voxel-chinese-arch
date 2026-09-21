/**
 * 天光系统：晨曦 / 正午 / 黄昏三套光照预设，支持平滑过渡。
 * 天穹为自定义着色器（三段渐变 + 日晕），光源为平行光（主光 + 补光）+ 半球光。
 */
import * as THREE from 'three';

export const SKIES = {
  dawn: {
    label: '晨曦',
    sun: { az: 104, el: 24 },
    sunColor: 0xffdcb0, sunIntensity: 3.8,
    skyTop: '#3d6193', skyMid: '#9db5cf', skyBottom: '#f7dcb6',
    glowColor: '#ffb877', glow: 0.5,
    fogColor: '#cdc8bd', fogNear: 360, fogFar: 2000,
    hemiSky: 0xa9c4e2, hemiGround: 0x6a6552, hemiIntensity: 1.3,
    fillColor: 0x93a8c4, fillIntensity: 0.45,
    lantern: 0.35, exposure: 1.0, ambientColor: 0x7a8298, ambientIntensity: 0.32,
  },
  noon: {
    label: '正午',
    sun: { az: 205, el: 62 },
    sunColor: 0xfff8ea, sunIntensity: 3.2,
    skyTop: '#2c67ae', skyMid: '#7aace0', skyBottom: '#d5e6f4',
    glowColor: '#ffffff', glow: 0.16,
    fogColor: '#c9daea', fogNear: 420, fogFar: 2400,
    hemiSky: 0xbcd6f0, hemiGround: 0x6f6a58, hemiIntensity: 1.5,
    fillColor: 0xb8c8dc, fillIntensity: 0.5,
    lantern: 0.0, exposure: 1.0, ambientColor: 0x9fb4cc, ambientIntensity: 0.34,
  },
  dusk: {
    label: '黄昏',
    sun: { az: 254, el: 33 },
    sunColor: 0xffc894, sunIntensity: 4.5,
    skyTop: '#1f3465', skyMid: '#8d6e79', skyBottom: '#ffcb8e',
    glowColor: '#ff9a4a', glow: 0.6,
    fogColor: '#d8ac88', fogNear: 340, fogFar: 2000,
    hemiSky: 0xcfab93, hemiGround: 0x6d6049, hemiIntensity: 1.35,
    fillColor: 0xb08c8c, fillIntensity: 0.45,
    lantern: 1.6, exposure: 1.14, ambientColor: 0x6b5a55, ambientIntensity: 0.38,
  },
};

const SKY_R = 1400;

export class SkyRig {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.cur = null;
    this.from = null;
    this.to = null;
    this.t = 1;
    this.dur = 1.3;

    // ── 天穹 ──
    this.uniforms = {
      top: { value: new THREE.Color('#22386b') },
      mid: { value: new THREE.Color('#93697a') },
      bottom: { value: new THREE.Color('#ffc98a') },
      glowColor: { value: new THREE.Color('#ff9a4a') },
      glow: { value: 0.6 },
      sunDir: { value: new THREE.Vector3(0, 0.3, 1) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `varying vec3 vPos;
        void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
        uniform vec3 glowColor; uniform float glow; uniform vec3 sunDir;
        varying vec3 vPos;
        void main(){
          vec3 d = normalize(vPos);
          float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 c = mix(bottom, mid, smoothstep(0.42, 0.56, h));
          c = mix(c, top, smoothstep(0.52, 0.98, h));
          float sd = max(dot(d, normalize(sunDir)), 0.0);
          c += glowColor * (pow(sd, 6.0) * 0.55 + pow(sd, 60.0) * 1.4) * glow;
          gl_FragColor = vec4(c, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 32, 20), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // ── 日轮 ──
    this.disk = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture('#ffffff', '#ffd9a0'),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false,
      transparent: true,
    }));
    this.disk.scale.setScalar(320);
    this.disk.renderOrder = -9;
    scene.add(this.disk);

    // ── 光源 ──
    this.sun = new THREE.DirectionalLight(0xffae63, 3.1);
    this.sun.castShadow = true;
    const S = 168;
    const cam = this.sun.shadow.camera;
    cam.left = -S; cam.right = S; cam.top = S * 1.1; cam.bottom = -S * 1.1;
    cam.near = 1; cam.far = 900;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.08;
    this.shadowTarget = new THREE.Object3D();
    this.shadowTarget.position.set(0, 6, -18);
    scene.add(this.shadowTarget);
    this.sun.target = this.shadowTarget;
    scene.add(this.sun);

    this.fill = new THREE.DirectionalLight(0xa8848c, 0.2);
    scene.add(this.fill);

    this.hemi = new THREE.HemisphereLight(0xc2947f, 0x5a5040, 0.5);
    scene.add(this.hemi);

    // 兜底环境光：避免阴影处死黑（体素明暗层次）
    this.ambient = new THREE.AmbientLight(0x6b5a55, 0.35);
    scene.add(this.ambient);

    this.fog = new THREE.Fog(0xd8ac88, 340, 2000);
    scene.fog = this.fog;

    this.set('dusk', true);
  }

  /** 切换预设（interpolate=false 时立即生效） */
  set(key, instant = false) {
    const p = SKIES[key] ?? SKIES.dusk;
    this.key = key;
    const from = this.cur ?? {};
    this.from = from;
    this.to = p;
    this.t = instant ? 1 : 0;
    if (instant) this.apply(p, p, 1);
  }

  /**
   * 依据方位/高度角计算太阳方向（单位向量，从场景原点指向太阳）。
   * 坐标约定：+x = 东、+z = **南**（山门在 zFront=46 一侧即南）；az 是**罗盘方位**：
   * 0 = 北、90 = 东、180 = 南、270 = 西（故 104 = 日出偏南、205 = 午后偏西、254 = 日落偏西）。
   * 早期 z 写成 `+cos(el)cos(az)`，把整条日轨镜像到了北半空间 —— 正午太阳跑到了北边、
   * 阴影朝南（用户最先在正午看出）；改成 `-cos(...)` 后三个预设都落在 +z（南）半空间。
   * 天穹日晕、太阳圆盘、平行光三者共用此向量（改一处即同时生效）。
   */
  static dirOf(sun) {
    const el = (sun.el * Math.PI) / 180, az = (sun.az * Math.PI) / 180;
    return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
  }

  apply(a, b, t) {
    const lerp = (x, y) => x + (y - x) * t;
    const col = (x, y) => {
      const c1 = new THREE.Color(typeof x === 'string' ? x : x);
      const c2 = new THREE.Color(typeof y === 'string' ? y : y);
      return c1.lerp(c2, t);
    };
    const sunA = SkyRig.dirOf(a.sun ?? b.sun), sunB = SkyRig.dirOf(b.sun ?? a.sun);
    const dir = sunA.clone().lerp(sunB, t).normalize();
    if (this.rigDir === undefined) this.rigDir = dir.clone();
    this.rigDir.copy(dir);

    this.uniforms.top.value.copy(col(a.skyTop ?? b.skyTop, b.skyTop));
    this.uniforms.mid.value.copy(col(a.skyMid ?? b.skyMid, b.skyMid));
    this.uniforms.bottom.value.copy(col(a.skyBottom ?? b.skyBottom, b.skyBottom));
    this.uniforms.glowColor.value.copy(col(a.glowColor ?? b.glowColor, b.glowColor));
    this.uniforms.glow.value = lerp(a.glow ?? b.glow, b.glow);
    this.uniforms.sunDir.value.copy(dir);

    this.disk.position.copy(dir).multiplyScalar(SKY_R * 0.72);
    this.disk.material.color.copy(col(a.glowColor ?? b.glowColor, b.glowColor));
    this.disk.material.opacity = Math.min(1, 0.5 + (b.glow ?? 0.4));

    this.sun.color.copy(col(a.sunColor ?? b.sunColor, b.sunColor));
    this.sun.intensity = lerp(a.sunIntensity ?? b.sunIntensity, b.sunIntensity);
    this.sun.position.copy(dir).multiplyScalar(430).add(this.shadowTarget.position);
    this.fill.color.copy(col(a.fillColor ?? b.fillColor, b.fillColor));
    this.fill.intensity = lerp(a.fillIntensity ?? b.fillIntensity, b.fillIntensity);
    this.fill.position.copy(dir).multiplyScalar(-1).setY(0.6).normalize().multiplyScalar(300);
    this.hemi.color.copy(col(a.hemiSky ?? b.hemiSky, b.hemiSky));
    this.hemi.groundColor.copy(col(a.hemiGround ?? b.hemiGround, b.hemiGround));
    this.hemi.intensity = lerp(a.hemiIntensity ?? b.hemiIntensity, b.hemiIntensity);
    this.ambient.color.copy(col(a.ambientColor ?? b.ambientColor, b.ambientColor));
    this.ambient.intensity = lerp(a.ambientIntensity ?? b.ambientIntensity, b.ambientIntensity);

    this.fog.color.copy(col(a.fogColor ?? b.fogColor, b.fogColor));
    this.fog.near = lerp(a.fogNear ?? b.fogNear, b.fogNear);
    this.fog.far = lerp(a.fogFar ?? b.fogFar, b.fogFar);
    this.renderer.toneMappingExposure = lerp(a.exposure ?? b.exposure, b.exposure);
    this.lantern = lerp(a.lantern ?? b.lantern, b.lantern);
    this.cur = { ...b, __mix: t };
  }

  /** 每帧推进过渡 */
  update(dt) {
    if (this.t >= 1) return false;
    this.t = Math.min(1, this.t + dt / this.dur);
    const e = this.t < 0.5 ? 4 * this.t ** 3 : 1 - (-2 * this.t + 2) ** 3 / 2;
    this.apply(this.from, this.to, e);
    return true;
  }
}

/** 径向渐变贴图（日轮/光晕） */
function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.25, inner);
  grd.addColorStop(0.5, 'rgba(255,220,170,0.35)');
  grd.addColorStop(1, 'rgba(255,190,130,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
