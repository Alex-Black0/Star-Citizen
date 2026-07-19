import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { routeEdgeIds } from "./router.js";

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
  "jump-point": 0xd990ff
};

export function createMap3D(container, universe, onNodeClick) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02050b, 0.0028);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 1600);
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
  controls.dampingFactor = 0.06;
  controls.minDistance = 15;
  controls.maxDistance = 650;

  scene.add(new THREE.AmbientLight(0x9bc7df, 1.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(30, 70, 100);
  scene.add(keyLight);

  const nodeMeshes = new Map();
  const nodeLabels = new Map();
  const edgeLines = new Map();
  const nodeLookup = new Map(universe.nodes.map((node) => [node.id, node]));

  addStarField(scene);
  addSystemRings(scene, universe.nodes);

  for (const edge of universe.edges) {
    if (edge.visible === false) continue;
    const from = nodeLookup.get(edge.from);
    const to = nodeLookup.get(edge.to);
    if (!from || !to) continue;

    const points = [new THREE.Vector3(...from.position), new THREE.Vector3(...to.position)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const baseOpacity = edge.baseVisible === false ? 0 : (edge.kind === "jump" ? 0.5 : 0.35);
    const material = new THREE.LineBasicMaterial({
      color: edge.kind === "jump" ? 0x9b68b8 : 0x31556c,
      transparent: true,
      opacity: baseOpacity
    });
    const line = new THREE.Line(geometry, material);
    line.userData.edgeId = edge.id;
    line.userData.kind = edge.kind;
    line.userData.baseVisible = edge.baseVisible !== false;
    scene.add(line);
    edgeLines.set(edge.id, line);
  }

  for (const node of universe.nodes) {
    if (node.visible === false || node.mapVisible === false) continue;
    const color = TYPE_COLORS[node.type] ?? 0x75d7ff;
    const radius = Number(node.radius || 0.7);
    const geometry = node.type === "jump-point"
      ? new THREE.TorusGeometry(radius, Math.max(0.18, radius * 0.18), 16, 54)
      : node.type === "gateway"
        ? new THREE.OctahedronGeometry(radius, 1)
        : node.type === "station"
          ? new THREE.DodecahedronGeometry(radius, 1)
          : new THREE.SphereGeometry(radius, 28, 18);

    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: node.type === "star" ? 1.65 : 0.22,
      roughness: node.type === "star" ? 0.8 : 0.48,
      metalness: node.type === "station" || node.type === "gateway" ? 0.65 : 0.08
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...node.position);
    mesh.userData.nodeId = node.id;
    mesh.userData.nodeType = node.type;
    mesh.userData.baseScale = 1;
    scene.add(mesh);
    nodeMeshes.set(node.id, mesh);

    if (node.type === "star") {
      const glowMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13, side: THREE.BackSide });
      const glow = new THREE.Mesh(new THREE.SphereGeometry(node.radius * 1.9, 28, 18), glowMaterial);
      mesh.add(glow);
    }

    const labelElement = document.createElement("div");
    labelElement.className = "map-label";
    labelElement.textContent = node.name;
    const label = new CSS2DObject(labelElement);
    label.position.set(0, radius + 1.2, 0);
    mesh.add(label);
    nodeLabels.set(node.id, labelElement);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function handlePointerUp(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...nodeMeshes.values()], false);
    if (hits.length > 0) onNodeClick(hits[0].object.userData.nodeId);
  }

  renderer.domElement.addEventListener("pointerup", handlePointerUp);

  function resetCamera() {
    camera.position.set(155, 125, 330);
    controls.target.set(135, 0, 15);
    controls.update();
  }
  resetCamera();

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
    for (const mesh of nodeMeshes.values()) {
      if (mesh.userData.nodeType === "jump-point") mesh.rotation.z += 0.001;
    }
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    animationFrame = requestAnimationFrame(animate);
  }
  animate();

  function updateRoute(route) {
    const activeEdges = routeEdgeIds(route);
    const activeNodes = new Set(route?.nodeIds || []);

    for (const [edgeId, line] of edgeLines) {
      const active = activeEdges.has(edgeId);
      line.material.color.set(active ? 0x6ce0ff : (line.userData.kind === "jump" ? 0x9b68b8 : 0x31556c));
      line.material.opacity = active ? 1 : (line.userData.baseVisible ? 0.35 : 0);
    }

    for (const [nodeId, mesh] of nodeMeshes) {
      const active = activeNodes.has(nodeId);
      mesh.scale.setScalar(active ? 1.35 : 1);
      const labelElement = nodeLabels.get(nodeId);
      labelElement?.classList.toggle("route", active);
    }
  }

  function setSelected(nodeId) {
    for (const [id, mesh] of nodeMeshes) {
      const selected = id === nodeId;
      mesh.material.emissiveIntensity = selected ? 1.15 : (nodeLookup.get(id)?.type === "star" ? 1.65 : 0.22);
    }
  }

  return {
    updateRoute,
    setSelected,
    resetCamera,
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

function addStarField(scene) {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = 220 + Math.random() * 500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xa5dfff, size: 0.75, transparent: true, opacity: 0.78, sizeAttenuation: true });
  scene.add(new THREE.Points(geometry, material));
}

function addSystemRings(scene, nodes) {
  const stars = nodes.filter((node) => node.type === "star");
  for (const star of stars) {
    for (const radius of [18, 36, 54]) {
      const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2);
      const points = curve.getPoints(128).map((point) => new THREE.Vector3(point.x + star.position[0], star.position[1], point.y + star.position[2]));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0x1a3b52, transparent: true, opacity: 0.16 });
      scene.add(new THREE.LineLoop(geometry, material));
    }
  }
}
