import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { routeEdgeIds } from "./router.js";
import { createHierarchy } from "./map-hierarchy.js";

const TYPE_COLORS = {
  star: 0xffd279,
  planet: 0x4fc5ff,
  station: 0xb7d5e7,
  moon: 0x8bb8d1,
  city: 0x75f0c1,
  outpost: 0xc9a56a,
  poi: 0xc58cff,
  lagrange: 0x65d6c4,
  planetoid: 0x8fb4ff,
  gateway: 0xffb55f,
  "jump-point": 0xd990ff,
  orbit: 0x67b8dc
};

export function createMap3D(container, universe, onNodeClick, onScopeRequest = () => {}) {
  const hierarchy = createHierarchy(universe);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02050b, 0.00225);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
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

  scene.add(new THREE.AmbientLight(0x9bc7df, 1.35));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(30, 80, 110);
  scene.add(keyLight);

  const contentGroup = new THREE.Group();
  const ringGroup = new THREE.Group();
  const edgeGroup = new THREE.Group();
  const overviewLinkGroup = new THREE.Group();
  scene.add(contentGroup, ringGroup, edgeGroup, overviewLinkGroup);
  addStarField(scene);

  const nodeMeshes = new Map();
  const nodeLabels = new Map();
  const edgeLines = new Map();
  const overviewLines = new Map();
  let scope = { level: "overview", system: null, anchorId: null };
  let route = null;
  let selectedNodeId = "";
  let scopeTransitionCooldown = 0;

  for (const node of universe.nodes) {
    if (node.visible === false || node.mapVisible === false || node.routeInternal === true) continue;
    const color = TYPE_COLORS[node.type] ?? 0x75d7ff;
    const radius = Number(node.radius || 0.7);
    const geometry = geometryForNode(node, radius);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: node.type === "star" ? 1.7 : 0.24,
      roughness: node.type === "star" ? 0.82 : 0.46,
      metalness: ["station", "gateway", "jump-point"].includes(node.type) ? 0.62 : 0.08,
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
      const glowMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.BackSide });
      const glow = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.1, 30, 20), glowMaterial);
      mesh.add(glow);
    }

    const labelElement = document.createElement("div");
    labelElement.className = `map-label type-${node.type}`;
    labelElement.textContent = node.overviewLabel || node.name;
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
    const material = new THREE.LineBasicMaterial({ color: 0x6bcff1, transparent: true, opacity: 0.52 });
    const line = new THREE.Line(geometry, material);
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
    applyScopeLayout();
    resetCamera();
  }

  function applyScopeLayout() {
    const visibleNodes = hierarchy.visibleNodesForScope(scope);
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
        label.textContent = scope.level === "overview" ? (node.overviewLabel || `${node.name} System`) : node.name;
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
      line.material.color.set(active ? 0x7ee8ff : (edge.kind === "jump" ? 0xbf7eff : 0x477e9d));
      line.material.opacity = active ? 1 : (edge.kind === "jump" ? 0.7 : 0.32);
    }

    rebuildRings(visibleNodes);
    applySelectionAndRoute();
  }

  function rebuildRings(visibleNodes) {
    clearGroup(ringGroup);
    if (scope.level === "overview") return;
    const radii = hierarchy.ringRadii(scope, visibleNodes);
    for (const radius of radii) {
      ringGroup.add(createOrbitRing(radius, 0x68cfff, scope.level === "local" ? 0.68 : 0.56));
      ringGroup.add(createOrbitRing(radius + 0.22, 0x68cfff, 0.12));
    }
    const axisLength = Math.max(45, ...(radii.map((value) => value + 12)));
    ringGroup.add(createAxis(axisLength, true));
    ringGroup.add(createAxis(axisLength, false));
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
    if (scope.level === "system" && mesh?.visible && node && ["planet", "planetoid", "orbit", "lagrange"].includes(node.type)) {
      const nextTarget = mesh.position.clone();
      const shift = nextTarget.clone().sub(controls.target);
      controls.target.copy(nextTarget);
      camera.position.add(shift);
      controls.update();
    }
    applySelectionAndRoute();
  }

  function applySelectionAndRoute() {
    const activeNodes = new Set(route?.nodeIds || []);
    for (const [nodeId, mesh] of nodeMeshes) {
      const node = hierarchy.nodesById.get(nodeId);
      const selected = selectedNodeId === nodeId;
      mesh.material.emissiveIntensity = selected ? 1.35 : (activeNodes.has(nodeId) ? 0.95 : (node?.type === "star" ? 1.7 : 0.24));
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
  if (node.type === "station") return new THREE.DodecahedronGeometry(radius, 1);
  if (["city", "outpost", "poi"].includes(node.type)) return new THREE.IcosahedronGeometry(radius, 1);
  return new THREE.SphereGeometry(radius, 30, 20);
}

function baseScaleForNode(node, scope) {
  if (scope.level === "overview") return 3.1;
  if (scope.level === "local" && node.id === scope.anchorId) return 2.3;
  if (node.type === "star") return 1.4;
  if (["gateway", "jump-point"].includes(node.type)) return 1.35;
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
}

function createOrbitRing(radius, color, opacity) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2);
  const points = curve.getPoints(192).map((point) => new THREE.Vector3(point.x, 0, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  return new THREE.LineLoop(geometry, material);
}

function createAxis(length, horizontal) {
  const points = horizontal
    ? [new THREE.Vector3(-length, 0, 0), new THREE.Vector3(length, 0, 0)]
    : [new THREE.Vector3(0, 0, -length), new THREE.Vector3(0, 0, length)];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineDashedMaterial({ color: 0x4a9cc4, transparent: true, opacity: 0.28, dashSize: 2.2, gapSize: 2.2 });
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

function addStarField(scene) {
  const count = 2000;
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
  scene.add(new THREE.Points(geometry, material));
}
