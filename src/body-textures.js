import * as THREE from "three";

const textureCache = new Map();
const materialCache = new Map();

const BODY_TEXTURE_PRESETS = {
  hurston: { kind: "rocky", palette: ["#754c2f", "#86613a", "#9d7d55", "#6a3d24"], atmosphere: "#9ec4e4", continents: true, haze: 0.25, roughness: 0.95 },
  arccorp: { kind: "urban", palette: ["#7d5d57", "#857a73", "#66514f", "#b6885b"], atmosphere: "#a4d7ff", lights: "#ffc168", grid: true, roughness: 0.78 },
  crusader: { kind: "gas", palette: ["#d7ccb9", "#bda88e", "#97826d", "#ece2d5"], atmosphere: "#d8ecff", bands: 7, roughness: 0.45 },
  microtech: { kind: "ice", palette: ["#c9e9ee", "#a6d0df", "#f5fbff", "#8cc1ce"], atmosphere: "#bcecff", icecaps: true, roughness: 0.72 },
  arial: { kind: "moon", palette: ["#8e7f69", "#a69681", "#6d5d48"], atmosphere: "#8cc0d8", craters: 22 },
  aberdeen: { kind: "volcanic", palette: ["#d1af54", "#9e7832", "#b88c30", "#5a3f18"], atmosphere: "#d8b260", craters: 14, fissures: true },
  magda: { kind: "moon", palette: ["#8d877f", "#a39d94", "#6f6d67"], atmosphere: "#c6d0de", craters: 18 },
  ita: { kind: "moon", palette: ["#a3b0b7", "#758b98", "#596e79"], atmosphere: "#b5e5ff", craters: 16 },
  lyria: { kind: "moon", palette: ["#9ea8b4", "#c0c8d2", "#727d87"], atmosphere: "#b3c8dc", craters: 20 },
  wala: { kind: "moon", palette: ["#857362", "#977e6c", "#c0a68a"], atmosphere: "#b7cad1", craters: 12 },
  cellin: { kind: "moon", palette: ["#7d6755", "#98836d", "#50453c"], atmosphere: "#b3c5d5", craters: 16 },
  daymar: { kind: "desert", palette: ["#d9c28a", "#c7a96b", "#ad8b56", "#f2ddb0"], atmosphere: "#ecd6a7", dunes: true, roughness: 0.88 },
  yela: { kind: "icy-rock", palette: ["#dddfe8", "#b3c0d0", "#8897a8"], atmosphere: "#d8ebff", craters: 22, icecaps: true },
  calliope: { kind: "ice", palette: ["#d8e7f0", "#c1d8e2", "#f6fbff"], atmosphere: "#d8f1ff", icecaps: true, craters: 8 },
  clio: { kind: "ice", palette: ["#f3f6fb", "#d8dfe8", "#b7c7d6"], atmosphere: "#e2f5ff", icecaps: true, roughness: 0.68 },
  euterpe: { kind: "ice", palette: ["#b8e1e7", "#8dc7d4", "#effbff"], atmosphere: "#bbf0ff", icecaps: true, roughness: 0.74 },
  "pyro-1": { kind: "volcanic", palette: ["#46352d", "#6e4b39", "#a77445", "#2a1a14"], atmosphere: "#d88d5f", fissures: true, craters: 8 },
  monox: { kind: "volcanic", palette: ["#d5a38b", "#a46b58", "#77463a", "#f1c8ba"], atmosphere: "#ffd0c0", fissures: true },
  bloom: { kind: "volcanic", palette: ["#66595b", "#91807a", "#332a2a", "#b8aba2"], atmosphere: "#d1c1c0", craters: 14 },
  "pyro-iv": { kind: "gas", palette: ["#989445", "#70773b", "#c4c45f", "#50552b"], atmosphere: "#ebef94", bands: 6, roughness: 0.38 },
  "pyro-v": { kind: "gas", palette: ["#83923f", "#5d6b28", "#b0b55a", "#414d1d"], atmosphere: "#d0e871", bands: 7, roughness: 0.35 },
  terminus: { kind: "desert", palette: ["#d7cbb1", "#b5ab95", "#877f70", "#f0e6d3"], atmosphere: "#dfe7ef", craters: 10 },
  delamar: { kind: "rocky", palette: ["#5a6779", "#7a8898", "#3d4654", "#9eaaba"], atmosphere: "#b1c5dd", craters: 18 }
};

const DEFAULTS_BY_SYSTEM = {
  Stanton: { kind: "rocky", palette: ["#7aa4c0", "#4e7f9f", "#bfd7e6", "#52708a"], atmosphere: "#b7e9ff" },
  Pyro: { kind: "volcanic", palette: ["#ac7455", "#d39b7a", "#704430", "#f0cab3"], atmosphere: "#f9c0a2" },
  Nyx: { kind: "rocky", palette: ["#879ab7", "#66758e", "#bcc8db", "#48566d"], atmosphere: "#c8daf0" }
};

export function buildMaterialForNode(node, colorNumber) {
  const key = `${node.id}:${node.type}:${node.system || "none"}`;
  if (materialCache.has(key)) return materialCache.get(key).clone();

  const color = new THREE.Color(colorNumber ?? 0x75d7ff);
  let material;
  if (node.type === "star") {
    const preset = getBodyPreset(node);
    const starMap = makeStarTexture(node, preset, 1024, 1024);
    material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveMap: starMap,
      map: starMap,
      emissiveIntensity: 1.8,
      roughness: 0.86,
      metalness: 0,
      transparent: true,
      opacity: 1
    });
  } else if (["planet", "moon", "planetoid"].includes(node.type)) {
    const preset = getBodyPreset(node);
    const { albedo, roughnessMap, bumpMap } = makePlanetTextures(node, preset);
    material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: color.clone().multiplyScalar(0.22),
      map: albedo,
      roughnessMap,
      bumpMap,
      bumpScale: node.type === "moon" ? 0.17 : 0.1,
      roughness: preset.roughness ?? (node.type === "moon" ? 0.92 : 0.8),
      metalness: 0.03,
      transparent: true,
      opacity: 1
    });
  } else if (node.type === "station") {
    const stationMap = makeStationTexture(node);
    material = new THREE.MeshStandardMaterial({
      color: 0xe4ebf2,
      emissive: 0xbfd0e0,
      map: stationMap,
      emissiveMap: stationMap,
      emissiveIntensity: 0.28,
      roughness: 0.4,
      metalness: 0.72,
      transparent: true,
      opacity: 1
    });
    stationMap.wrapS = stationMap.wrapT = THREE.RepeatWrapping;
    stationMap.repeat.set(1, 2);
  } else if (node.type === "gateway") {
    material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      roughness: 0.24,
      metalness: 0.72,
      transparent: true,
      opacity: 1
    });
  } else {
    material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.24,
      roughness: 0.46,
      metalness: ["jump-point"].includes(node.type) ? 0.64 : 0.08,
      transparent: true,
      opacity: 1
    });
  }

  materialCache.set(key, material);
  return material.clone();
}

export function getAtmosphereColor(node, fallbackColorNumber) {
  const preset = getBodyPreset(node);
  return new THREE.Color(preset.atmosphere || fallbackColorNumber || 0x9ad8ff);
}

function getBodyPreset(node) {
  return BODY_TEXTURE_PRESETS[node.id] || DEFAULTS_BY_SYSTEM[node.system] || DEFAULTS_BY_SYSTEM.Stanton;
}

function makePlanetTextures(node, preset) {
  const cacheKey = `planet:${node.id}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const seed = hashString(node.id);
  const random = mulberry32(seed);

  // base
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  const palette = preset.palette;
  gradient.addColorStop(0, palette[0]);
  gradient.addColorStop(0.35, palette[1] || palette[0]);
  gradient.addColorStop(0.7, palette[2] || palette[1] || palette[0]);
  gradient.addColorStop(1, palette[3] || palette[2] || palette[0]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (preset.kind === "gas") {
    drawBands(ctx, width, height, palette, preset.bands || 6, random);
    drawClouds(ctx, width, height, palette, random, 0.11);
  } else {
    drawNoiseBlotches(ctx, width, height, palette, random, preset.kind === "urban" ? 240 : 180, preset.kind === "ice" ? 0.28 : 0.42);
    if (preset.continents || preset.kind === "rocky" || preset.kind === "desert") {
      drawContinents(ctx, width, height, palette, random, preset.kind === "desert" ? 0.2 : 0.34);
    }
    if (preset.dunes) drawDunes(ctx, width, height, random);
    if (preset.grid) drawUrbanGrid(ctx, width, height, random, preset.lights || "#ffc168");
    if (preset.fissures) drawLavaFissures(ctx, width, height, random);
    if (preset.craters) drawCraters(ctx, width, height, random, preset.craters);
    if (preset.icecaps) drawIceCaps(ctx, width, height, random);
  }
  drawLatitudinalShading(ctx, width, height, preset.haze || 0.16);

  const roughnessCanvas = document.createElement("canvas");
  roughnessCanvas.width = width;
  roughnessCanvas.height = height;
  const roughCtx = roughnessCanvas.getContext("2d");
  roughCtx.fillStyle = preset.kind === "gas" ? "#7a7a7a" : "#b5b5b5";
  roughCtx.fillRect(0, 0, width, height);
  if (preset.kind === "urban") {
    roughCtx.fillStyle = "rgba(70,70,70,0.7)";
    for (let i = 0; i < 320; i += 1) {
      roughCtx.fillRect(random() * width, random() * height, 2 + random() * 6, 2 + random() * 6);
    }
  }
  if (preset.craters) drawCraters(roughCtx, width, height, mulberry32(seed + 111), Math.round(preset.craters * 0.85), true);
  if (preset.fissures) drawLavaFissures(roughCtx, width, height, mulberry32(seed + 222), true);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext("2d");
  bumpCtx.fillStyle = "#808080";
  bumpCtx.fillRect(0, 0, width, height);
  if (preset.craters) drawCraters(bumpCtx, width, height, mulberry32(seed + 333), preset.craters, true, true);
  if (preset.dunes) drawDunes(bumpCtx, width, height, mulberry32(seed + 444), true);
  if (preset.fissures) drawLavaFissures(bumpCtx, width, height, mulberry32(seed + 555), true, true);

  const albedo = makeTexture(canvas);
  const roughnessMap = makeTexture(roughnessCanvas);
  const bumpMap = makeTexture(bumpCanvas);
  const result = { albedo, roughnessMap, bumpMap };
  textureCache.set(cacheKey, result);
  return result;
}

function makeStarTexture(node, preset, width, height) {
  const cacheKey = `star:${node.id}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const palette = preset.palette || ["#fff0c1", "#ffca6f", "#ff8b2a", "#fff5d8"];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(hashString(node.id));
  const gradient = ctx.createRadialGradient(width / 2, height / 2, width * 0.05, width / 2, height / 2, width * 0.55);
  gradient.addColorStop(0, palette[3] || "#fff5d8");
  gradient.addColorStop(0.35, palette[1] || palette[0]);
  gradient.addColorStop(0.8, palette[2] || palette[1]);
  gradient.addColorStop(1, palette[2] || palette[0]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 3200; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const r = random() * 4.5;
    ctx.fillStyle = `rgba(255,255,255,${0.02 + random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = makeTexture(canvas);
  textureCache.set(cacheKey, texture);
  return texture;
}

function makeStationTexture(node) {
  const cacheKey = `station:${node.id}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const width = 512;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const random = mulberry32(hashString(node.id));
  const baseGradient = ctx.createLinearGradient(0, 0, width, height);
  baseGradient.addColorStop(0, node.system === "Pyro" ? "#73645a" : "#6e7b88");
  baseGradient.addColorStop(1, node.system === "Pyro" ? "#41372f" : "#3f4a55");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(220,235,255,0.18)";
  for (let x = 0; x < width; x += 64) {
    for (let y = 0; y < height; y += 48) {
      ctx.strokeRect(x + 2, y + 2, 56, 40);
      if (random() > 0.78) {
        ctx.fillStyle = node.system === "Pyro" ? "rgba(255,202,120,0.45)" : "rgba(164,225,255,0.42)";
        ctx.fillRect(x + 8, y + 8, 16 + random() * 20, 5 + random() * 6);
      }
    }
  }
  const texture = makeTexture(canvas);
  textureCache.set(cacheKey, texture);
  return texture;
}

function drawBands(ctx, width, height, palette, count, random) {
  for (let i = 0; i < count * 3; i += 1) {
    const y = (i / (count * 3)) * height;
    const bandHeight = height / (count * 3) + random() * 18;
    ctx.fillStyle = addAlpha(palette[i % palette.length], 0.22 + random() * 0.16);
    ctx.fillRect(0, y, width, bandHeight);
  }
  for (let i = 0; i < 32; i += 1) {
    ctx.fillStyle = addAlpha(palette[(i + 1) % palette.length], 0.05 + random() * 0.08);
    ctx.beginPath();
    const y = random() * height;
    ctx.ellipse(random() * width, y, 80 + random() * 180, 12 + random() * 36, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClouds(ctx, width, height, palette, random, opacity = 0.08) {
  for (let i = 0; i < 60; i += 1) {
    ctx.fillStyle = addAlpha("#ffffff", opacity + random() * opacity);
    ctx.beginPath();
    ctx.ellipse(random() * width, random() * height, 30 + random() * 90, 12 + random() * 30, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNoiseBlotches(ctx, width, height, palette, random, count, opacity) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = addAlpha(palette[Math.floor(random() * palette.length)], opacity * (0.4 + random() * 0.9));
    ctx.beginPath();
    ctx.ellipse(random() * width, random() * height, 8 + random() * 45, 6 + random() * 35, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawContinents(ctx, width, height, palette, random, opacity) {
  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = addAlpha(palette[(i + 2) % palette.length], opacity + random() * 0.12);
    ctx.beginPath();
    const centerX = random() * width;
    const centerY = random() * height;
    const rx = 40 + random() * 110;
    const ry = 24 + random() * 70;
    for (let step = 0; step <= 18; step += 1) {
      const angle = (step / 18) * Math.PI * 2;
      const jitter = 0.68 + random() * 0.52;
      const x = centerX + Math.cos(angle) * rx * jitter;
      const y = centerY + Math.sin(angle) * ry * jitter;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawUrbanGrid(ctx, width, height, random, lightColor) {
  ctx.strokeStyle = addAlpha("#222933", 0.18);
  for (let x = 0; x < width; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let i = 0; i < 1800; i += 1) {
    ctx.fillStyle = addAlpha(lightColor, 0.12 + random() * 0.28);
    ctx.fillRect(random() * width, random() * height, 1 + random() * 2, 1 + random() * 2);
  }
}

function drawLavaFissures(ctx, width, height, random, grayscale = false, bump = false) {
  for (let i = 0; i < 20; i += 1) {
    ctx.strokeStyle = grayscale ? (bump ? "rgba(255,255,255,0.3)" : "rgba(90,90,90,0.45)") : `rgba(255,140,70,${0.18 + random() * 0.24})`;
    ctx.lineWidth = 1 + random() * 4;
    ctx.beginPath();
    let x = random() * width;
    let y = random() * height;
    ctx.moveTo(x, y);
    const segments = 5 + Math.floor(random() * 9);
    for (let s = 0; s < segments; s += 1) {
      x += -50 + random() * 100;
      y += -30 + random() * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawCraters(ctx, width, height, random, count, grayscale = false, bump = false) {
  for (let i = 0; i < count; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const r = 8 + random() * 26;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grayscale ? (bump ? "rgba(225,225,225,0.18)" : "rgba(110,110,110,0.16)") : "rgba(30,22,18,0.12)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.18, y - r * 0.12, r * 0.78, 0, Math.PI * 2);
    ctx.strokeStyle = grayscale ? (bump ? "rgba(240,240,240,0.24)" : "rgba(135,135,135,0.22)") : "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawIceCaps(ctx, width, height, random) {
  ctx.fillStyle = "rgba(248,252,255,0.56)";
  ctx.beginPath();
  ctx.ellipse(width / 2, 24, width * 0.42, 38 + random() * 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(width / 2, height - 24, width * 0.42, 38 + random() * 16, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDunes(ctx, width, height, random, grayscale = false) {
  for (let i = 0; i < 30; i += 1) {
    ctx.strokeStyle = grayscale ? "rgba(150,150,150,0.15)" : "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2 + random() * 2;
    ctx.beginPath();
    const startY = random() * height;
    ctx.moveTo(0, startY);
    for (let x = 0; x <= width; x += 40) {
      ctx.lineTo(x, startY + Math.sin((x / width) * Math.PI * 2 + random() * Math.PI) * (6 + random() * 16));
    }
    ctx.stroke();
  }
}

function drawLatitudinalShading(ctx, width, height, haze) {
  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, `rgba(255,255,255,${haze * 0.55})`);
  shade.addColorStop(0.18, "rgba(255,255,255,0)");
  shade.addColorStop(0.82, "rgba(0,0,0,0)");
  shade.addColorStop(1, `rgba(0,0,0,${haze * 0.6})`);
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
}

function makeTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function addAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;
  const number = Number.parseInt(value, 16);
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
