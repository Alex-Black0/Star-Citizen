import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { routeEdgeIds } from "./router.js";
import { createHierarchy } from "./map-hierarchy.js";

const TYPE_COLORS = {
  star: 0xffd279,
  planet: 0x4fc5ff,
  station: 0xd6e7f2,
  moon: 0x8bb8d1,
  city: 0x79f2c2,
  outpost: 0xd4a875,
  poi: 0xc58cff,
  lagrange: 0x65d6c4,
  planetoid: 0x8fb4ff,
  gateway: 0xffb55f,
  "jump-point": 0xd990ff,
  orbit: 0x67b8dc
};

const THEMES = {
  overview: {
    background: "#030812",
    fog: 0x040813,
    ambient: 0x9ec7de,
    ring: 0x73d9ff,
    axis: 0x4d9ec6,
    edge: 0x4a82a7,
    jump: 0xc28cff,
    nebula: ["#123258", "#0b1d34", "#1a4668"],
    starfield: "#c7ebff"
  },
  Stanton: {
    background: "#07101c",
    fog: 0x08111d,
    ambient: 0x9dd9ff,
    ring: 0x7ad9ff,
    axis: 0x5bb5db,
    edge: 0x5086a9,
    jump: 0xd3a2ff,
    nebula: ["#133e68", "#0a2038", "#0f2b49"],
    starfield: "#d6f0ff"
  },
  Pyro: {
    background: "#160704",
    fog: 0x180704,
    ambient: 0xffc8a6,
    ring: 0xffc0a6,
    axis: 0xd38d73,
    edge: 0xb17661,
    jump: 0xf0b0ff,
    nebula: ["#7e2f14", "#3d1208", "#a3481b"],
    starfield: "#ffe3d2"
  },
  Nyx: {
    background: "#040912",
    fog: 0x040912,
    ambient: 0xacc1ff,
    ring: 0x96b8ff,
    axis: 0x6787ca,
    edge: 0x5670aa,
    jump: 0xcaa4ff,
    nebula: ["#1b2550", "#09112f", "#202c60"],
    starfield: "#d9defa"
  }
};

export function createMap3D(container, universe, onNodeClick, onScopeRequest = () => {}) {
  const hierarchy = createHierarchy(universe);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.inset = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  container.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 10;
  controls.maxDistance = 720;
  controls.zoomToCursor = true;

  const ambientLight = new THREE.AmbientLight(0x9bc7df, 1.4);
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(30, 80, 110);
  scene.add(ambientLight, keyLight);

  const contentGroup = new THREE.Group();
  const ringGroup = new THREE.Group();
  const edgeGroup = new THREE.Group();
  const overviewLinkGroup = new THREE.Group();
  const detailLineGroup = new THREE.Group();
  const detailLabelGroup = new THREE.Group();
  const nebulaGroup = new THREE.Group();
  scene.add(contentGroup, ringGroup, edgeGroup, overviewLinkGroup, detailLineGroup, detailLabelGroup, nebulaGroup);

  const starfield = addStarField(scene);
  const nebulae = addNebulae(nebulaGroup);

  const nodeMeshes = new Map();
  const nodeLabels = new Map();
  const edgeLines = new Map();
  const overviewLines = new Map();
  let scope = { level: "overview", system: null, anchorId: null };
  let route = null;
  let selectedNodeId = "";
  let scopeTransitionCooldown = 0;
  let currentTheme = THEMES.overview;
  let currentVisibleNodes = [];

  for (const node of universe.nodes) {
    if (node.visible === false || node.mapVisible === false || node.routeInternal === true) continue;
    const color = Number(node.color ? parseInt(String(node.color).replace("#", ""), 16) : TYPE_COLORS[node.type] ?? 0x75d7ff);
    const radius = Number(node.radius || 0.7);
    const geometry = geometryForNode(node, radius);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: node.type === "star" ? 1.65 : node.type === "gateway" ? 0.55 : 0.24,
      roughness: node.type === "star" ? 0.82 : 0.46,
      metalness: ["station", "gateway", "jump-point"].includes(node.type) ? 0.64 : 0.08,
      transparent: true,
      opacity: 1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.nodeId = node.id;
    mesh.userData.nodeType = node.type;
    mesh.userData.baseScale = 1;
    mesh.visible = false;
    contentGroup.add(mesh);
    nodeMeshes.set(node.id, mesh);

    if (node.type === "star") {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 2.2, 30, 20),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.BackSide })
      );
      mesh.add(glow);
    }
    if (["planet", "planetoid", "moon"].includes(node.type)) {
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.11, 24, 18),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: node.type === "moon" ? 0.1 : 0.16, side: THREE.BackSide })
      );
      mesh.add(atmosphere);
    }

    const labelElement = document.createElement("div");
    labelElement.className = `map-label type-${node.type}`;
    labelElement.innerHTML = `<span class="node-icon node-icon-${node.type}">${iconGlyph(node.type)}</span><span class="node-label-text">${escapeHtml(node.overviewLabel || node.name)}</span>`;
    const label = new CSS2DObject(labelElement);
    label.position.set(0, radius + 1.25, 0);
    mesh.add(label);
    nodeLabels.set(node.id, labelElement);
  }

  for (const edge of universe.edges) {
    if (edge.visible === false) continue;
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const material = new THREE.LineBasicMaterial({
      color: edge.kind === "jump" ? 0xbf7eff : 0x477e9d,
      transparent: true,
      opacity: 0
    });
    const line = new THREE.Line(geometry, material);
    line.userData.edgeId = edge.id;
    line.userData.kind = edge.kind;
    line.userData.baseVisible = edge.baseVisible !== false;
    line.visible = false;
    edgeGroup.add(line);
    edgeLines.set(edge.id, line);
  }

  for (const link of hierarchy.overviewLinks()) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...link.fromPosition),
      new THREE.Vector3(...link.toPosition)
    ]);
    const material = new THREE.LineDashedMaterial({ color: 0x6bcff1, transparent: true, opacity: 0.52, dashSize: 7, gapSize: 5 });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.visible = false;
    overviewLinkGroup.add(line);
    overviewLines.set(link.id, line);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown = null;

  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointerDown = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener("pointerup", handlePointerUp);

  function handlePointerUp(event) {
    if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const visibleMeshes = [...nodeMeshes.values()].filter((mesh) => mesh.visible);
    const hits = raycaster.intersectObjects(visibleMeshes, false);
    if (hits.length > 0) onNodeClick(hits[0].object.userData.nodeId);
  }

  function setScope(nextScope) {
    scope = { level: "overview", system: null, anchorId: null, ...nextScope };
    applyTheme();
    applyScopeLayout();
    resetCamera();
  }

  function applyTheme() {
    const theme = THEMES[scope.system] || THEMES.overview;
    currentTheme = theme;
    scene.background = new THREE.Color(theme.background);
    scene.fog = new THREE.FogExp2(theme.fog, scope.level === "overview" ? 0.0015 : 0.0022);
    ambientLight.color.set(theme.ambient);
    keyLight.color.set(scope.system === "Pyro" ? 0xffd1b2 : scope.system === "Nyx" ? 0xd6ddff : 0xffffff);
    container.dataset.theme = scope.system || "overview";
    if (starfield?.material) starfield.material.color.set(theme.starfield);
    nebulae.forEach((nebula, index) => {
      nebula.material.color.set(theme.nebula[index % theme.nebula.length]);
      nebula.material.opacity = scope.level === "overview" ? 0.16 : 0.26;
    });
  }

  function applyScopeLayout() {
    const visibleNodes = hierarchy.visibleNodesForScope(scope);
    currentVisibleNodes = visibleNodes;
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const activeEdges = routeEdgeIds(route);

    for (const [nodeId, mesh] of nodeMeshes) {
      const node = hierarchy.nodesById.get(nodeId);
      mesh.visible = visibleIds.has(nodeId);
      if (!mesh.visible) continue;
      mesh.position.set(...hierarchy.displayPosition(node, scope));
      mesh.userData.baseScale = baseScaleForNode(node, scope);
      const label = nodeLabels.get(nodeId);
      if (label) {
        const labelText = scope.level === "overview" ? (node.overviewLabel || `${node.name} System`) : node.name;
        const textElement = label.querySelector(".node-label-text");
        if (textElement) textElement.textContent = labelText;
        label.classList.toggle("system-label", scope.level === "overview");
        label.classList.toggle("local-label", scope.level === "local");
      }
    }

    for (const line of overviewLines.values()) line.visible = scope.level === "overview";

    for (const edge of universe.edges) {
      const line = edgeLines.get(edge.id);
      if (!line) continue;
      const fromNode = hierarchy.nodesById.get(edge.from);
      const toNode = hierarchy.nodesById.get(edge.to);
      const endpointsVisible = fromNode && toNode && visibleIds.has(fromNode.id) && visibleIds.has(toNode.id);
      const active = activeEdges.has(edge.id);
      line.visible = scope.level !== "overview" && endpointsVisible && (line.userData.baseVisible || active);
      if (!line.visible) continue;
      updateLineGeometry(line, hierarchy.displayPosition(fromNode, scope), hierarchy.displayPosition(toNode, scope));
      line.material.color.set(active ? 0x7ee8ff : (edge.kind === "jump" ? currentTheme.jump : currentTheme.edge));
      line.material.opacity = active ? 1 : (edge.kind === "jump" ? 0.72 : 0.36);
    }

    rebuildRings(visibleNodes);
    rebuildDetailSpokes(visibleNodes);
    applySelectionAndRoute();
  }

  function rebuildRings(visibleNodes) {
    clearGroup(ringGroup);
    if (scope.level === "overview") return;
    const radii = hierarchy.ringRadii(scope, visibleNodes);
    for (const radius of radii) {
      ringGroup.add(createOrbitRing(radius, currentTheme.ring, scope.level === "local" ? 0.82 : 0.7, 2.3));
      ringGroup.add(createOrbitRing(radius + 0.22, currentTheme.ring, 0.18, 1.2));
    }
    const axisLength = Math.max(45, ...(radii.map((value) => value + 12)));
    ringGroup.add(createAxis(axisLength, true, currentTheme.axis));
    ringGroup.add(createAxis(axisLength, false, currentTheme.axis));
  }

  function rebuildDetailSpokes(visibleNodes) {
    clearGroup(detailLineGroup);
    clearCssGroup(detailLabelGroup);
    if (!selectedNodeId || scope.level === "overview") return;
    const selectedNode = hierarchy.nodesById.get(selectedNodeId);
    if (!selectedNode || !visibleNodes.some((node) => node.id === selectedNodeId)) return;

    const selectedPosition = hierarchy.displayPosition(selectedNode, scope);
    const candidates = visibleNodes
      .filter((node) => node.id !== selectedNodeId)
      .filter((node) => scope.level === "local"
        ? ["station", "moon", "city", "outpost", "poi", "planet", "planetoid"].includes(node.type)
        : ["planet", "planetoid", "station", "gateway", "moon", "city", "outpost"].includes(node.type))
      .sort((a, b) => distance3(selectedPosition, hierarchy.displayPosition(a, scope)) - distance3(selectedPosition, hierarchy.displayPosition(b, scope)));

    const limitedCandidates = scope.level === "local" ? candidates.slice(0, 8) : candidates.slice(0, 10);
    for (const node of limitedCandidates) {
      const targetPosition = hierarchy.displayPosition(node, scope);
      const line = createDashedLine(selectedPosition, targetPosition, currentTheme.ring);
      detailLineGroup.add(line);

      const mid = [
        (selectedPosition[0] + targetPosition[0]) / 2,
        (selectedPosition[1] + targetPosition[1]) / 2,
        (selectedPosition[2] + targetPosition[2]) / 2
      ];
      const labelElement = document.createElement("div");
      labelElement.className = "distance-label";
      labelElement.textContent = `${formatDistance(readableDistanceBetween(universe.edges, selectedNode, node))} Gm`;
      const label = new CSS2DObject(labelElement);
      label.position.set(mid[0], mid[1], mid[2]);
      detailLabelGroup.add(label);
    }
  }

  function resetCamera() {
    if (scope.level === "overview") {
      camera.position.set(0, 190, 310);
      controls.target.set(0, 0, 0);
      controls.minDistance = 110;
      controls.maxDistance = 650;
    } else if (scope.level === "local") {
      const radii = hierarchy.ringRadii(scope, hierarchy.visibleNodesForScope(scope));
      const extent = Math.max(32, ...(radii.map((value) => value)));
      camera.position.set(0, extent * 1.15, extent * 1.75);
      controls.target.set(0, 0, 0);
      controls.minDistance = 7;
      controls.maxDistance = Math.max(140, extent * 5);
    } else {
      const radii = hierarchy.ringRadii(scope, hierarchy.visibleNodesForScope(scope));
      const extent = Math.max(65, ...(radii.map((value) => value)));
      camera.position.set(0, extent * 1.35, extent * 2.05);
      controls.target.set(0, 0, 0);
      controls.minDistance = 24;
      controls.maxDistance = Math.max(330, extent * 5);
    }
    controls.update();
  }

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let animationFrame = 0;
  function animate() {
    controls.update();
    const cameraDistance = camera.position.distanceTo(controls.target);
    const now = performance.now();
    if (now > scopeTransitionCooldown) {
      if (scope.level === "system" && cameraDistance > controls.maxDistance * 0.88) {
        scopeTransitionCooldown = now + 1200;
        onScopeRequest({ level: "overview", system: null, anchorId: null });
      } else if (scope.level === "local" && cameraDistance > controls.maxDistance * 0.82) {
        scopeTransitionCooldown = now + 1200;
        onScopeRequest({ level: "system", system: scope.system, anchorId: null });
      } else if (scope.level === "system" && selectedNodeId && hierarchy.hasLocalChildren(selectedNodeId) && cameraDistance < 42) {
        const selected = hierarchy.nodesById.get(selectedNodeId);
        if (selected) {
          scopeTransitionCooldown = now + 1200;
          onScopeRequest({ level: "local", system: selected.system, anchorId: selected.id });
        }
      }
    }
    for (const [nodeId, mesh] of nodeMeshes) {
      if (!mesh.visible) continue;
      if (mesh.userData.nodeType === "jump-point") mesh.rotation.z += 0.0015;
      if (mesh.userData.nodeType === "station") mesh.rotation.y += 0.002;
      const node = hierarchy.nodesById.get(nodeId);
      const dynamicScale = screenScaleForDistance(cameraDistance, scope.level);
      const activeBoost = route?.nodeIds?.includes(nodeId) ? 1.28 : 1;
      const selectedBoost = selectedNodeId === nodeId ? 1.18 : 1;
      mesh.scale.setScalar(mesh.userData.baseScale * dynamicScale * activeBoost * selectedBoost);
      const label = nodeLabels.get(nodeId);
      if (label) label.classList.toggle("zoom-distant", shouldDimLabel(node, scope, cameraDistance));
    }
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    animationFrame = requestAnimationFrame(animate);
  }
  animate();

  function updateRoute(nextRoute) {
    route = nextRoute;
    applyScopeLayout();
  }

  function setSelected(nodeId) {
    selectedNodeId = nodeId || "";
    const mesh = nodeMeshes.get(selectedNodeId);
    const node = hierarchy.nodesById.get(selectedNodeId);
    if (scope.level === "system" && mesh?.visible && node && ["planet", "planetoid", "orbit", "lagrange", "station"].includes(node.type)) {
      const nextTarget = mesh.position.clone();
      const shift = nextTarget.clone().sub(controls.target);
      controls.target.copy(nextTarget);
      camera.position.add(shift);
      controls.update();
    }
    rebuildDetailSpokes(currentVisibleNodes);
    applySelectionAndRoute();
  }

  function applySelectionAndRoute() {
    const activeNodes = new Set(route?.nodeIds || []);
    for (const [nodeId, mesh] of nodeMeshes) {
      const node = hierarchy.nodesById.get(nodeId);
      const selected = selectedNodeId === nodeId;
      mesh.material.emissiveIntensity = selected ? 1.35 : (activeNodes.has(nodeId) ? 0.95 : (node?.type === "star" ? 1.65 : node?.type === "gateway" ? 0.55 : 0.24));
      const label = nodeLabels.get(nodeId);
      label?.classList.toggle("route", activeNodes.has(nodeId));
      label?.classList.toggle("selected", selected);
    }
  }

  setScope(scope);

  return {
    updateRoute,
    setSelected,
    setScope,
    resetCamera,
    getScope: () => ({ ...scope }),
    destroy() {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      controls.dispose();
      renderer.dispose();
      container.replaceChildren();
    }
  };
}

function geometryForNode(node, radius) {
  if (node.type === "jump-point") return new THREE.TorusGeometry(radius, Math.max(0.18, radius * 0.17), 16, 58);
  if (node.type === "gateway") return new THREE.OctahedronGeometry(radius, 1);
  if (node.type === "station") return new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, radius * 1.5, 6);
  if (["city", "outpost", "poi"].includes(node.type)) return new THREE.IcosahedronGeometry(radius, 1);
  return new THREE.SphereGeometry(radius, 30, 20);
}

function baseScaleForNode(node, scope) {
  if (scope.level === "overview") return 3.1;
  if (scope.level === "local" && node.id === scope.anchorId) return 2.3;
  if (node.type === "star") return 1.4;
  if (["gateway", "jump-point"].includes(node.type)) return 1.35;
  if (node.type === "station") return scope.level === "local" ? 1.35 : 1.15;
  return scope.level === "local" ? 1.15 : 1;
}

function screenScaleForDistance(distance, level) {
  const divisor = level === "overview" ? 260 : level === "local" ? 70 : 150;
  return THREE.MathUtils.clamp(distance / divisor, 0.72, level === "overview" ? 1.35 : 2.15);
}

function shouldDimLabel(node, scope, distance) {
  if (scope.level === "overview") return false;
  if (scope.level === "system") {
    if (["star", "planet", "planetoid", "gateway"].includes(node.type)) return false;
    return distance > 190;
  }
  if (node.id === scope.anchorId || ["station", "moon"].includes(node.type)) return false;
  return distance > 95;
}

function updateLineGeometry(line, from, to) {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...from),
    new THREE.Vector3(...to)
  ]);
  if (line.computeLineDistances) line.computeLineDistances();
}

function createOrbitRing(radius, color, opacity, linewidth = 1.8) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2);
  const points = curve.getPoints(192).map((point) => new THREE.Vector3(point.x, 0, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, linewidth });
  return new THREE.LineLoop(geometry, material);
}

function createAxis(length, horizontal, color) {
  const points = horizontal
    ? [new THREE.Vector3(-length, 0, 0), new THREE.Vector3(length, 0, 0)]
    : [new THREE.Vector3(0, 0, -length), new THREE.Vector3(0, 0, length)];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.28, dashSize: 2.2, gapSize: 2.2 });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

function createDashedLine(from, to, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...from),
    new THREE.Vector3(...to)
  ]);
  const material = new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.4, dashSize: 1.3, gapSize: 1.1 });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }
}

function clearCssGroup(group) {
  while (group.children.length) group.remove(group.children[0]);
}

function addStarField(scene) {
  const count = 2600;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = 240 + Math.random() * 650;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi);
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xa5dfff, size: 0.8, transparent: true, opacity: 0.78, sizeAttenuation: true });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}

function addNebulae(group) {
  const texture = makeGlowTexture();
  const positions = [
    [-180, -40, -280],
    [190, 55, -240],
    [0, -70, -330]
  ];
  return positions.map((position, index) => {
    const material = new THREE.SpriteMaterial({ map: texture, color: 0x335b7a, transparent: true, opacity: 0.18, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(...position);
    sprite.scale.setScalar(index === 2 ? 420 : 360);
    group.add(sprite);
    return sprite;
  });
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 24, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.24)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function readableDistanceBetween(edges, fromNode, toNode) {
  const direct = edges.find((edge) => (edge.from === fromNode.id && edge.to === toNode.id) || (edge.from === toNode.id && edge.to === fromNode.id));
  if (direct) return Number(direct.distance);
  return distance3(fromNode.position, toNode.position);
}

function formatDistance(value) {
  return Number(value).toFixed(value < 10 ? 2 : value < 100 ? 1 : 0);
}

function iconGlyph(type) {
  return {
    star: "✦",
    planet: "◯",
    planetoid: "⬤",
    moon: "○",
    station: "⌬",
    city: "⬡",
    outpost: "◫",
    poi: "✚",
    gateway: "◈",
    "jump-point": "◎",
    lagrange: "◇",
    orbit: "⬢"
  }[type] || "•";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
