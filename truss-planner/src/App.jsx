import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Settings, ZoomIn, ZoomOut, RefreshCw, CheckCircle2, 
  Layers, Maximize, Printer, Save, FolderOpen, Cuboid, 
  MousePointerClick, X, Split, Trash2, Plus, Move, Wrench
} from 'lucide-react';

// --- CONFIGURAÇÕES E ALGORITMO ---

const CORNER_SIZE = 15;
const DEFAULT_PIECES = [20, 50, 70, 100, 120, 150, 170, 200, 220, 250, 270, 300];

const solveTruss = (target, pieces) => {
  if (target <= 0) return { pieces: [], exact: true, actualLength: 0 };
  const maxExtra = 50; 
  const maxLen = target + maxExtra;
  const dp = Array(maxLen + 1).fill(null);
  dp[0] = { count: 0, pieces: [] };
  const sortedPieces = [...pieces].sort((a, b) => b - a);

  for (let i = 1; i <= maxLen; i++) {
    let best = null;
    for (let p of sortedPieces) {
      if (i - p >= 0 && dp[i - p] !== null) {
        const candidateCount = dp[i - p].count + 1;
        if (!best || candidateCount < best.count) {
          best = { count: candidateCount, pieces: [...dp[i - p].pieces, p] };
        }
      }
    }
    dp[i] = best;
  }

  for (let i = target; i <= maxLen; i++) {
    if (dp[i]) {
      return { pieces: dp[i].pieces.sort((a, b) => b - a), exact: i === target, actualLength: i };
    }
  }
  return { pieces: [], exact: false, actualLength: 0 };
};

const getValidSplits = (targetSize, availablePieces) => {
  const results = [];
  const active = availablePieces.filter(p => p < targetSize);
  for (let p1 of active) {
    for (let p2 of active) {
      if (p1 + p2 === targetSize) results.push([p1, p2]);
      for (let p3 of active) {
        if (p1 + p2 + p3 === targetSize) results.push([p1, p2, p3]);
      }
    }
  }
  const unique = [];
  const seen = new Set();
  results.forEach(arr => {
    const key = arr.join(',');
    if (!seen.has(key)) { seen.add(key); unique.push(arr); }
  });
  return unique;
};

const calcularFerragens = (boxes, parafusosPorConexao = 4) => {
  let totalLigacoes = 0;
  boxes.forEach(box => {
    if (!box.plan) return;
    const contarLigacoesDaAresta = (pecas) => {
      if (pecas && pecas.length > 0) {
        totalLigacoes += (pecas.length - 1) + 2; 
      }
    };
    contarLigacoesDaAresta(box.plan.top?.pieces);
    contarLigacoesDaAresta(box.plan.bottom?.pieces);
    contarLigacoesDaAresta(box.plan.left?.pieces);
    contarLigacoesDaAresta(box.plan.right?.pieces);
    if (box.alt > 0) {
      contarLigacoesDaAresta(box.plan.top?.pieces);
      contarLigacoesDaAresta(box.plan.bottom?.pieces);
      contarLigacoesDaAresta(box.plan.left?.pieces);
      contarLigacoesDaAresta(box.plan.right?.pieces);
      contarLigacoesDaAresta(box.plan.pillarFL?.pieces);
      contarLigacoesDaAresta(box.plan.pillarFR?.pieces);
      contarLigacoesDaAresta(box.plan.pillarBL?.pieces);
      contarLigacoesDaAresta(box.plan.pillarBR?.pieces);
    }
  });
  return { totalConexoes: totalLigacoes, totalParafusos: totalLigacoes * parafusosPorConexao };
};

// --- COMPONENTE VISUALIZADOR 3D ---
const ThreeDViewer = ({ boxes, bounds, onClose }) => {
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(!!window.THREE);

  useEffect(() => {
    if (window.THREE) { setIsReady(true); return; }
    let script = document.getElementById('threejs-script');
    if (!script) {
      script = document.createElement('script');
      script.id = 'threejs-script';
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      document.head.appendChild(script);
    }
    const handleLoad = () => setIsReady(true);
    script.addEventListener('load', handleLoad);
    return () => script.removeEventListener('load', handleLoad);
  }, []);

  useEffect(() => {
    if (!isReady || !containerRef.current) return;
    let scene, camera, renderer, animationId;
    let isDragging = false;
    let isPanning = false;
    let previousMousePosition = { x: 0, y: 0 };
    let previousTouchDist = 0;

    const THREE = window.THREE;
    const container = containerRef.current;
    container.innerHTML = ''; 

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    const centerX = (bounds.maxX + bounds.minX) / 2;
    const centerZ = (bounds.maxY + bounds.minY) / 2;
    const maxDim = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 500);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 20000);
    camera.position.set(centerX + maxDim, maxDim, centerZ + maxDim);
    camera.lookAt(centerX, 0, centerZ);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(centerX + 1000, 2000, centerZ + 1000);
    scene.add(directionalLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(centerX - 1000, 500, centerZ - 1000);
    scene.add(fillLight);

    const trussMaterial = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 });
    const cornerMaterial = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.5 });

    const createCylinder = (p1, p2, radius, material) => {
      const distance = p1.distanceTo(p2);
      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, distance, 8), material);
      cylinder.position.copy(new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5));
      cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(p2, p1).normalize());
      return cylinder;
    };

    const trussCache = {};
    const getTrussGroup = (length, material) => {
      if (trussCache[length]) return trussCache[length].clone();
      const group = new THREE.Group();
      const rMain = 1.2; const rDiag = 0.6; const o = (CORNER_SIZE / 2) - rMain; const halfL = length / 2;
      const chords = [ [o, o], [o, -o], [-o, o], [-o, -o] ];
      chords.forEach(([y, z]) => group.add(createCylinder(new THREE.Vector3(-halfL, y, z), new THREE.Vector3(halfL, y, z), rMain, material)));

      const steps = Math.max(1, Math.floor(length / 20));
      const actualStep = length / steps;
      const addZigZag = (faceCoord, isY, c1, c2) => {
        let currentPos = -halfL; let toggle = true;
        for(let i=0; i<steps; i++) {
          const nextPos = currentPos + actualStep;
          const cv1 = toggle ? c1 : c2; const cv2 = toggle ? c2 : c1;
          group.add(createCylinder(isY ? new THREE.Vector3(currentPos, faceCoord, cv1) : new THREE.Vector3(currentPos, cv1, faceCoord), isY ? new THREE.Vector3(nextPos, faceCoord, cv2) : new THREE.Vector3(nextPos, cv2, faceCoord), rDiag, material));
          group.add(createCylinder(isY ? new THREE.Vector3(nextPos, faceCoord, c1) : new THREE.Vector3(nextPos, c1, faceCoord), isY ? new THREE.Vector3(nextPos, faceCoord, c2) : new THREE.Vector3(nextPos, c2, faceCoord), rDiag, material));
          currentPos = nextPos; toggle = !toggle;
        }
      };
      addZigZag(o, true, -o, o); addZigZag(-o, true, -o, o); addZigZag(o, false, -o, o); addZigZag(-o, false, -o, o);

      const endGeo = new THREE.BoxGeometry(0.5, CORNER_SIZE, CORNER_SIZE);
      const endMat = material.clone(); endMat.color.setHex(0xa1a1aa); 
      const end1 = new THREE.Mesh(endGeo, endMat); end1.position.set(-halfL, 0, 0);
      const end2 = new THREE.Mesh(endGeo, endMat); end2.position.set(halfL, 0, 0);
      group.add(end1); group.add(end2);
      trussCache[length] = group;
      return group.clone();
    };

    let cornerCache = null;
    const getCornerGroup = (material) => {
      if (cornerCache) return cornerCache.clone();
      const group = new THREE.Group();
      const r = 1.2; const o = (CORNER_SIZE / 2) - r;
      const pts = [[-o,-o,-o], [o,-o,-o], [o,o,-o], [-o,o,-o], [-o,-o,o], [o,-o,o], [o,o,o], [-o,o,o]];
      const edges = [[0,1],[1,2],[2,3],[3,0], [4,5],[5,6],[6,7],[7,4], [0,4],[1,5],[2,6],[3,7]];
      edges.forEach(([i1, i2]) => group.add(createCylinder(new THREE.Vector3(...pts[i1]), new THREE.Vector3(...pts[i2]), r, material)));
      group.add(new THREE.Mesh(new THREE.BoxGeometry(CORNER_SIZE - 6, CORNER_SIZE - 6, CORNER_SIZE - 6), material));
      cornerCache = group;
      return group.clone();
    };

    boxes.forEach(box => {
      const actW = (box.plan.top?.actualLength || 0) + CORNER_SIZE*2;
      const actH = (box.plan.left?.actualLength || 0) + CORNER_SIZE*2;
      const actualAlt = box.plan.pillarFL?.pieces.length > 0 ? box.plan.pillarFL.actualLength + CORNER_SIZE*2 : 0;
      if (actW <= CORNER_SIZE*2 || actH <= CORNER_SIZE*2) return;

      const drawTruss = (x, y, z, length, axis) => {
        const truss = getTrussGroup(length, trussMaterial);
        if (axis === 'z') truss.rotation.y = Math.PI / 2;
        if (axis === 'y') truss.rotation.z = Math.PI / 2; 
        truss.position.set(x, y, z);
        scene.add(truss);
      };

      const drawCorner = (x, y, z) => {
        const corner = getCornerGroup(cornerMaterial);
        corner.position.set(x, y, z);
        scene.add(corner);
      };

      const left = box.x + CORNER_SIZE/2; const right = box.x + actW - CORNER_SIZE/2;
      const topZ = box.y + CORNER_SIZE/2; const bottomZ = box.y + actH - CORNER_SIZE/2;
      const bottomY = CORNER_SIZE / 2; const topY = actualAlt > 0 ? actualAlt - CORNER_SIZE / 2 : bottomY;

      drawCorner(left, topY, topZ); drawCorner(right, topY, topZ);
      drawCorner(left, topY, bottomZ); drawCorner(right, topY, bottomZ);

      const drawEdge = (pieces, startX, startY, startZ, axis) => {
        let currentPos = axis === 'x' ? startX : (axis === 'y' ? startY : startZ);
        pieces.forEach(p => {
          let x = startX, y = startY, z = startZ;
          if (axis === 'x') x = currentPos + p/2;
          if (axis === 'y') y = currentPos + p/2;
          if (axis === 'z') z = currentPos + p/2;
          drawTruss(x, y, z, p, axis);
          currentPos += p;
        });
      };

      drawEdge(box.plan.top.pieces, left + CORNER_SIZE/2, topY, topZ, 'x');
      drawEdge(box.plan.bottom.pieces, left + CORNER_SIZE/2, topY, bottomZ, 'x');
      drawEdge(box.plan.left.pieces, left, topY, topZ + CORNER_SIZE/2, 'z');
      drawEdge(box.plan.right.pieces, right, topY, topZ + CORNER_SIZE/2, 'z');

      if (actualAlt > 0) {
        drawCorner(left, bottomY, topZ); drawCorner(right, bottomY, topZ);
        drawCorner(left, bottomY, bottomZ); drawCorner(right, bottomY, bottomZ);

        drawEdge(box.plan.top?.pieces || [], left + CORNER_SIZE/2, bottomY, topZ, 'x');
        drawEdge(box.plan.bottom?.pieces || [], left + CORNER_SIZE/2, bottomY, bottomZ, 'x');
        drawEdge(box.plan.left?.pieces || [], left, bottomY, topZ + CORNER_SIZE/2, 'z');
        drawEdge(box.plan.right?.pieces || [], right, bottomY, topZ + CORNER_SIZE/2, 'z');

        drawEdge(box.plan.pillarBL?.pieces || [], left, CORNER_SIZE, topZ, 'y');
        drawEdge(box.plan.pillarBR?.pieces || [], right, CORNER_SIZE, topZ, 'y');
        drawEdge(box.plan.pillarFL?.pieces || [], left, CORNER_SIZE, bottomZ, 'y');
        drawEdge(box.plan.pillarFR?.pieces || [], right, CORNER_SIZE, bottomZ, 'y');
      }
    });

    const handleCameraMove = (deltaX, deltaY) => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((deltaY * Math.PI) / 360, (deltaX * Math.PI) / 360, 0, 'XYZ'));
      camera.position.sub(new THREE.Vector3(centerX, 0, centerZ));
      camera.position.applyQuaternion(q);
      camera.position.add(new THREE.Vector3(centerX, 0, centerZ));
      camera.lookAt(centerX, 0, centerZ);
    };

    // --- EVENTOS DE RATO ---
    container.addEventListener('mousedown', (e) => { 
      if (e.button === 0) isDragging = true;
      if (e.button === 2) isPanning = true; 
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener('contextmenu', e => e.preventDefault());
    container.addEventListener('mousemove', (e) => {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      if (isDragging) handleCameraMove(deltaX, deltaY);
      else if (isPanning) { camera.translateX(-deltaX * 2); camera.translateY(deltaY * 2); }
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener('mouseup', () => { isDragging = false; isPanning = false; });
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      camera.translateZ(Math.sign(e.deltaY) * 50);
    }, { passive: false });

    // --- EVENTOS MOBILE (TOUCH) ---
    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        isDragging = false;
        previousTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: false });
    
    container.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;
        handleCameraMove(deltaX, deltaY);
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        camera.translateZ((previousTouchDist - dist) * 2);
        previousTouchDist = dist;
      }
    }, { passive: false });

    container.addEventListener('touchend', () => { isDragging = false; });

    const gridHelper = new THREE.GridHelper(Math.max(maxDim * 3, 2000), 50, 0x94a3b8, 0xe2e8f0);
    gridHelper.position.set(centerX, 0, centerZ);
    scene.add(gridHelper);

    const animate = () => { animationId = requestAnimationFrame(animate); renderer.render(scene, camera); };
    animate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [boxes, isReady]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-slate-800 text-white shadow-md">
        <h2 className="text-xl font-bold flex items-center gap-2"><Cuboid /> Ambiente 3D</h2>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-xs md:text-sm">
            Mover/Rodar: 1 dedo • Zoom: 2 dedos
          </span>
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-red-600 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>
      <div className="flex-1 cursor-grab active:cursor-grabbing relative" ref={containerRef}>
        {!isReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="animate-spin mb-4" size={32} />
            <p className="text-sm font-medium">A carregar motor 3D...</p>
          </div>
        )}
      </div>
    </div>
  );
};


// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [activePieces, setActivePieces] = useState(
    DEFAULT_PIECES.reduce((acc, p) => ({ ...acc, [p]: true }), {})
  );

  const [screwsPerConn, setScrewsPerConn] = useState(4);
  const [boxes, setBoxes] = useState([
    { id: 'box-' + Date.now(), name: 'Estrutura 1', w: 400, h: 200, alt: 300, x: 0, y: 0, plan: null, isManual: false }
  ]);
  const [activeBoxId, setActiveBoxId] = useState(boxes[0].id);
  const activeBox = boxes.find(b => b.id === activeBoxId) || boxes[0];

  const skipAutoCalc = useRef(false);
  const svgRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggingBoxId, setDraggingBoxId] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastTouchRef = useRef({ x: 0, y: 0, dist: 0 });
  
  const [editingPiece, setEditingPiece] = useState(null); 
  const [show3D, setShow3D] = useState(false);
  const [projects, setProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem('trussProjects')) || []; } catch { return []; }
  });
  const [newProjectName, setNewProjectName] = useState("");

  const generatePlan = (w, h, alt) => {
    const available = Object.entries(activePieces).filter(([_, v]) => v).map(([p]) => parseInt(p));
    if (available.length === 0 || w <= 0 || h <= 0) {
      return { top: { pieces: [], actualLength: 0 }, bottom: { pieces: [], actualLength: 0 }, left: { pieces: [], actualLength: 0 }, right: { pieces: [], actualLength: 0 } };
    }
    const px = solveTruss(w - CORNER_SIZE * 2, available);
    const py = solveTruss(h - CORNER_SIZE * 2, available);
    const pz = alt > 0 ? solveTruss(alt - CORNER_SIZE * 2, available) : { pieces: [], exact: true, actualLength: 0 };
    
    return {
      top: JSON.parse(JSON.stringify(px)), bottom: JSON.parse(JSON.stringify(px)),
      left: JSON.parse(JSON.stringify(py)), right: JSON.parse(JSON.stringify(py)),
      pillarFL: JSON.parse(JSON.stringify(pz)), pillarFR: JSON.parse(JSON.stringify(pz)),
      pillarBL: JSON.parse(JSON.stringify(pz)), pillarBR: JSON.parse(JSON.stringify(pz))
    };
  };

  useEffect(() => {
    if (skipAutoCalc.current) { skipAutoCalc.current = false; return; }
    setBoxes(prev => prev.map(box => {
      if (!box.isManual && box.w > 0 && box.h > 0) return { ...box, plan: generatePlan(box.w, box.h, box.alt || 0) };
      return box;
    }));
  }, [activePieces, boxes.map(b => `${b.id}-${b.w}-${b.h}-${b.alt}`).join(',')]);

  // FIX: Escutadores Globais para soltar os objetos se o dedo sair da área
  useEffect(() => {
    const handleGlobalUp = () => {
      setIsDraggingCanvas(false);
      setDraggingBoxId(null);
    };
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, []);

  const addBox = () => {
    const newBox = { id: 'box-' + Date.now(), name: `Estrutura ${boxes.length + 1}`, w: 300, h: 200, alt: 300, x: 50 * boxes.length, y: 50 * boxes.length, plan: null, isManual: false };
    setBoxes([...boxes, newBox]);
    setActiveBoxId(newBox.id);
  };

  const removeBox = (id, e) => {
    e.stopPropagation();
    const remaining = boxes.filter(b => b.id !== id);
    if (remaining.length === 0) {
      const newBox = { id: 'box-' + Date.now(), name: `Estrutura 1`, w: 0, h: 0, alt: 0, x: 0, y: 0, plan: null, isManual: false };
      setBoxes([newBox]);
      setActiveBoxId(newBox.id);
    } else {
      setBoxes(remaining);
      if (activeBoxId === id) setActiveBoxId(remaining[0].id);
    }
  };

  const updateActiveBox = (updates) => setBoxes(prev => prev.map(b => b.id === activeBoxId ? { ...b, ...updates } : b));

  const handlePieceClick = (boxId, edgeId, index, length, clientX, clientY) => {
    setActiveBoxId(boxId);
    const available = Object.entries(activePieces).filter(([_, v]) => v).map(([p]) => parseInt(p));
    const splits = getValidSplits(length, available);
    setEditingPiece({ boxId, edgeId, index, length, splits, x: clientX, y: clientY });
  };

  const applySplit = (splitArray) => {
    if (!editingPiece) return;
    const { boxId, edgeId, index } = editingPiece;
    setBoxes(prev => prev.map(box => {
      if (box.id !== boxId) return box;
      const newPlan = { ...box.plan };
      newPlan[edgeId].pieces.splice(index, 1, ...splitArray);
      return { ...box, plan: newPlan, isManual: true };
    }));
    setEditingPiece(null);
  };

  const saveProject = () => {
    if (!newProjectName.trim()) return;
    const newProj = { id: Date.now(), name: newProjectName, boxes, activePieces };
    const updated = [...projects, newProj];
    setProjects(updated);
    localStorage.setItem('trussProjects', JSON.stringify(updated));
    setNewProjectName("");
  };

  const loadProject = (proj) => {
    skipAutoCalc.current = true;
    setActivePieces(proj.activePieces);
    setBoxes(proj.boxes);
    setActiveBoxId(proj.boxes[0].id);
    setEditingPiece(null);
  };

  const deleteProject = (id) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    localStorage.setItem('trussProjects', JSON.stringify(updated));
  };

  // --- INTERAÇÕES RATO (CANVAS) ---
  const handleWheel = (e) => {
    const scaleBy = 1.1;
    const newScale = e.deltaY > 0 ? scale / scaleBy : scale * scaleBy;
    setScale(Math.min(Math.max(0.2, newScale), 5));
  };
  const handleMouseDownCanvas = (e) => {
    if (e.button !== 0 || editingPiece) return;
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleBoxMouseDown = (e, boxId) => {
    e.stopPropagation();
    if (e.button !== 0 || editingPiece) return;
    setActiveBoxId(boxId); setDraggingBoxId(boxId);
  };
  const handleMouseMove = (e) => {
    if (draggingBoxId) {
      setBoxes(prev => prev.map(b => b.id === draggingBoxId ? { ...b, x: b.x + e.movementX/scale, y: b.y + e.movementY/scale } : b));
    } else if (isDraggingCanvas) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  // --- INTERAÇÕES MOBILE TOUCH (CANVAS) ---
  const handleTouchStartCanvas = (e) => {
    if (editingPiece) return;
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (!draggingBoxId) {
        setIsDraggingCanvas(true);
        setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
      }
    } else if (e.touches.length === 2) {
      lastTouchRef.current.dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  };

  const handleBoxTouchStart = (e, boxId) => {
    e.stopPropagation();
    if (editingPiece) return;
    setActiveBoxId(boxId);
    setDraggingBoxId(boxId);
    lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMoveCanvas = (e) => {
    if (editingPiece) return;
    if (e.touches.length === 1) {
       const touch = e.touches[0];
       const dx = touch.clientX - lastTouchRef.current.x;
       const dy = touch.clientY - lastTouchRef.current.y;
       if (draggingBoxId) {
          setBoxes(prev => prev.map(b => b.id === draggingBoxId ? { ...b, x: b.x + dx/scale, y: b.y + dy/scale } : b));
       } else if (isDraggingCanvas) {
          setPan({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
       }
       lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    } else if (e.touches.length === 2) {
       const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
       const delta = dist / lastTouchRef.current.dist;
       setScale(s => Math.min(Math.max(0.2, s * delta), 5));
       lastTouchRef.current.dist = dist;
    }
  };

  const bounds = useMemo(() => {
    let minX = 0, minY = 0, maxX = 800, maxY = 600;
    if (boxes.length > 0) {
      minX = Math.min(...boxes.map(b => b.x)) - 50; minY = Math.min(...boxes.map(b => b.y)) - 50;
      maxX = Math.max(...boxes.map(b => b.x + (b.plan?.top?.actualLength || 0) + 30)) + 50;
      maxY = Math.max(...boxes.map(b => b.y + (b.plan?.left?.actualLength || 0) + 30)) + 50;
    }
    return { minX, minY, maxX, maxY };
  }, [boxes]);

  const bom = useMemo(() => {
    const list = {}; let totalCorners = 0;
    boxes.forEach(box => {
      if (!box.plan) return;
      const add = (piece) => { list[piece] = (list[piece] || 0) + 1; };
      box.plan.top?.pieces.forEach(add); box.plan.bottom?.pieces.forEach(add);
      box.plan.left?.pieces.forEach(add); box.plan.right?.pieces.forEach(add);
      if (box.alt > 0) {
        box.plan.top?.pieces.forEach(add); box.plan.bottom?.pieces.forEach(add);
        box.plan.left?.pieces.forEach(add); box.plan.right?.pieces.forEach(add);
        box.plan.pillarFL?.pieces.forEach(add); box.plan.pillarFR?.pieces.forEach(add);
        box.plan.pillarBL?.pieces.forEach(add); box.plan.pillarBR?.pieces.forEach(add);
      }
      const actW = (box.plan.top?.actualLength || 0) + CORNER_SIZE*2;
      const actH = (box.plan.left?.actualLength || 0) + CORNER_SIZE*2;
      if (actW > CORNER_SIZE * 2 || actH > CORNER_SIZE * 2) totalCorners += (box.alt > 0) ? 8 : 4;
    });
    
    const bomArray = Object.entries(list).map(([len, qty]) => ({ name: `Truss ${len}cm`, qty }))
      .sort((a, b) => parseInt(b.name.split(' ')[1]) - parseInt(a.name.split(' ')[1]));
    if (totalCorners > 0) bomArray.unshift({ name: `Cubo/Corner ${CORNER_SIZE}cm`, qty: totalCorners });
    
    const ferragens = calcularFerragens(boxes, screwsPerConn);
    if (ferragens.totalConexoes > 0) {
      bomArray.push({ name: `Uniões / Ligações`, qty: ferragens.totalConexoes });
      bomArray.push({ name: `Parafusos (Unid.)`, qty: ferragens.totalParafusos });
    }
    return bomArray;
  }, [boxes, screwsPerConn]);

  const renderTrussEdge = (boxId, pieces, startX, startY, isHorizontal, edgeId) => {
    let currentPos = isHorizontal ? startX : startY;
    return pieces.map((p, i) => {
      const id = `${boxId}-${edgeId}-${i}`;
      const rectX = isHorizontal ? currentPos : startX; const rectY = isHorizontal ? startY : currentPos;
      const rectW = isHorizontal ? p : CORNER_SIZE; const rectH = isHorizontal ? CORNER_SIZE : p;
      const textX = rectX + rectW / 2; const textY = rectY + rectH / 2;
      
      const element = (
        <g key={id} 
           onClick={(e) => { e.stopPropagation(); handlePieceClick(boxId, edgeId, i, p, e.clientX, e.clientY); }}
           onTouchEnd={(e) => { e.stopPropagation(); handlePieceClick(boxId, edgeId, i, p, e.changedTouches[0].clientX, e.changedTouches[0].clientY); }}
           className="transition-all duration-200 cursor-pointer hover:opacity-80 group">
          <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="#ffffff" stroke="#1e293b" strokeWidth={1}
            className="group-hover:fill-blue-50 group-hover:stroke-blue-500 group-hover:stroke-2" vectorEffect="non-scaling-stroke" />
          <line x1={isHorizontal ? rectX : rectX+3} y1={isHorizontal ? rectY+3 : rectY} x2={isHorizontal ? rectX+rectW : rectX+3} y2={isHorizontal ? rectY+3 : rectY+rectH} stroke="#cbd5e1" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
          <line x1={isHorizontal ? rectX : rectX+12} y1={isHorizontal ? rectY+12 : rectY} x2={isHorizontal ? rectX+rectW : rectX+12} y2={isHorizontal ? rectY+12 : rectY+rectH} stroke="#cbd5e1" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
          <text x={textX} y={textY} transform={`rotate(${isHorizontal ? 0 : -90} ${textX} ${textY})`} textAnchor="middle" dominantBaseline="central" fontSize="6" fill="#0f172a" fontWeight="600" style={{ pointerEvents: 'none' }}>{p}</text>
        </g>
      );
      currentPos += p; return element;
    });
  };

  let popoverSafeLeft = 0; let popoverSafeTop = 0;
  if (editingPiece) {
    const margin = 10;
    popoverSafeLeft = Math.max(margin, Math.min(editingPiece.x, window.innerWidth - 280 - margin));
    popoverSafeTop = Math.max(margin, Math.min(editingPiece.y + 15, window.innerHeight - 280 - margin));
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden print:bg-white" onClick={() => setEditingPiece(null)}>
      {show3D && <ThreeDViewer boxes={boxes} bounds={bounds} onClose={() => setShow3D(false)} />}
      <style>{`
        @media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 100%; height: 100vh; } .no-print { display: none !important; } }
        /* Esconder scrollbar nativa para manter design limpo no mobile */
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* HEADER */}
      <header className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center shadow-md no-print z-10 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="text-blue-400" size={20} />
          <h1 className="text-lg font-bold tracking-tight">TrussPlanner <span className="text-slate-400 font-normal hidden sm:inline">| Eventos</span></h1>
        </div>
        <div className="flex gap-2">
          {boxes.some(b => b.w > 30) && (
            <button onClick={() => setShow3D(true)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium shadow-lg">
              <Cuboid size={16} /> <span className="hidden md:inline">Ver Tudo 3D</span><span className="md:hidden">3D</span>
            </button>
          )}
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium shadow-lg">
            <Printer size={16} /> <span className="hidden md:inline">PDF</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        
        {/* SIDEBAR */}
        <aside className="w-full md:w-[340px] bg-white border-b md:border-r border-slate-200 flex flex-col shadow-sm z-10 no-print overflow-y-auto shrink-0 md:h-full max-h-[35vh] md:max-h-none">
          
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">Estruturas</h2>
              <button onClick={addBox} className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-200"><Plus size={14}/> Nova Box</button>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto pr-1 hide-scrollbar">
              {boxes.map(box => (
                <div key={box.id} onClick={() => setActiveBoxId(box.id)} 
                     className={`flex justify-between items-center p-2 rounded border cursor-pointer transition-colors ${activeBoxId === box.id ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-200'}`}>
                  <span className="text-sm font-medium truncate flex-1">{box.name}</span>
                  <button onClick={(e) => removeBox(box.id, e)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 border-b border-slate-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
              <Settings size={16} /> Dimensões: {activeBox.name}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">X (cm)</label>
                <input type="number" value={activeBox.w === 0 ? '' : activeBox.w} placeholder="0" onChange={(e) => updateActiveBox({ w: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full p-2 md:p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Y (cm)</label>
                <input type="number" value={activeBox.h === 0 ? '' : activeBox.h} placeholder="0" onChange={(e) => updateActiveBox({ h: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full p-2 md:p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Alt. Z</label>
                <input type="number" value={activeBox.alt === 0 ? '' : activeBox.alt} placeholder="0" onChange={(e) => updateActiveBox({ alt: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                  className="w-full p-2 md:p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" />
              </div>
            </div>
            {activeBox.isManual ? (
              <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded flex gap-2 text-indigo-800 text-xs">
                <MousePointerClick size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Edição Manual</p>
                  <button onClick={() => { updateActiveBox({ isManual: false }); skipAutoCalc.current = false; }} className="underline font-medium">Resetar</button>
                </div>
              </div>
            ) : (activeBox.w > 0 && activeBox.h > 0) && (
              <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded flex gap-2 text-emerald-800 text-xs items-center">
                <CheckCircle2 size={14} className="shrink-0" />
                <p><b>{(activeBox.plan?.top?.actualLength || 0) + 30}x{(activeBox.plan?.left?.actualLength || 0) + 30}</b></p>
              </div>
            )}
          </div>

          <div className="p-3 border-b border-slate-100">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
              <Split size={16} /> Stock
            </h2>
            <div className="grid grid-cols-4 md:grid-cols-3 gap-1 max-h-32 overflow-y-auto mb-2 hide-scrollbar">
              {DEFAULT_PIECES.map(p => (
                <label key={p} className="flex items-center gap-1 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={activePieces[p]} onChange={() => setActivePieces(prev => ({ ...prev, [p]: !prev[p] }))}
                    className="w-3 h-3 text-blue-600" />
                  <span className="text-xs font-medium">{p}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
               <div className="flex items-center gap-2">
                 <Wrench size={14} className="text-slate-500"/>
                 <span className="text-xs font-semibold text-slate-600">Parafusos/Face</span>
               </div>
               <input type="number" min="1" value={screwsPerConn} onChange={(e) => setScrewsPerConn(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 px-1 py-1 border border-slate-300 rounded outline-none text-xs text-center font-bold" />
            </div>
          </div>

          <div className="p-3 flex-1 bg-slate-50 hidden md:block">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
              <Save size={16} /> Guardar
            </h2>
            <div className="flex gap-2 mb-2">
              <input type="text" placeholder="Nome..." value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded outline-none" />
              <button onClick={saveProject} className="px-3 py-1 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">OK</button>
            </div>
          </div>
        </aside>

        {/* ÁREA PRINCIPAL CANVAS */}
        <main className="flex-1 flex flex-col relative print-area h-full min-h-[50vh]">
          
          {editingPiece && (
            <div className="fixed z-[60] bg-white p-3 rounded-lg shadow-2xl border border-slate-200 w-[280px] max-w-[90vw] animate-in fade-in zoom-in"
                 style={{ left: popoverSafeLeft, top: popoverSafeTop }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-800 text-sm">Dividir ({editingPiece.length}cm)</h3>
                <button onClick={() => setEditingPiece(null)} className="p-1"><X size={16} className="text-slate-400 hover:text-red-500"/></button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 hide-scrollbar">
                {editingPiece.splits.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">Não há stock compatível.</p>
                ) : (
                  editingPiece.splits.map((split, idx) => (
                    <button key={idx} onClick={() => applySplit(split)} className="w-full flex items-center justify-between p-3 text-sm bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-400 rounded-lg shadow-sm">
                      <span className="font-medium text-slate-700">{split.join(' + ')}</span><Split size={14} className="text-blue-500"/>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex-1 bg-white relative overflow-hidden" style={{
                backgroundSize: '40px 40px',
                backgroundImage: 'linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)'
              }}
            onWheel={handleWheel} 
            onMouseDown={handleMouseDownCanvas} onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStartCanvas} onTouchMove={handleTouchMoveCanvas}>
            
            <div className="absolute top-2 left-2 z-10 no-print flex items-center gap-1 bg-white/90 px-2 py-1 rounded shadow border border-slate-200 text-xs font-medium text-slate-600 pointer-events-none">
               <Move size={12} className="text-blue-500"/> Arraste
            </div>

            <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 no-print">
              <button onClick={() => setScale(s => Math.min(s * 1.2, 5))} className="p-2.5 bg-white rounded shadow border border-slate-200 text-slate-700 active:bg-slate-100"><ZoomIn size={18} /></button>
              <button onClick={() => setScale(s => Math.max(s / 1.2, 0.2))} className="p-2.5 bg-white rounded shadow border border-slate-200 text-slate-700 active:bg-slate-100"><ZoomOut size={18} /></button>
              <button onClick={() => {setScale(1); setPan({x:0,y:0})}} className="p-2.5 bg-white rounded shadow border border-slate-200 text-slate-700 active:bg-slate-100"><Maximize size={18} /></button>
            </div>

            <div className="w-full h-full flex items-center justify-center pointer-events-none">
              <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: 'center' }} className="transition-transform duration-75 ease-out pointer-events-auto">
                <svg ref={svgRef} width={Math.max(800, bounds.maxX)} height={Math.max(600, bounds.maxY)} className="drop-shadow-xl overflow-visible">
                  {boxes.map(box => {
                    if (!box.plan) return null;
                    const actW = (box.plan.top?.actualLength || 0) + CORNER_SIZE*2;
                    const actH = (box.plan.left?.actualLength || 0) + CORNER_SIZE*2;
                    const actualAlt = box.plan.pillarFL?.pieces.length > 0 ? box.plan.pillarFL.actualLength + CORNER_SIZE*2 : 0;
                    if (actW <= CORNER_SIZE*2) return null;
                    
                    const isSelected = box.id === activeBoxId;
                    const isBeingDragged = draggingBoxId === box.id;

                    return (
                      <g key={box.id} transform={`translate(${box.x}, ${box.y})`}>
                        {/* Fundo Arrastável - COM SENSAÇÃO TÁTIL */}
                        <rect x="-20" y="-20" width={actW+40} height={actH+40} 
                              fill={isSelected ? (isBeingDragged ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.05)") : "transparent"} 
                              stroke={isSelected ? "#3b82f6" : "transparent"} strokeWidth="2" strokeDasharray="5,5" rx="8"
                              onMouseDown={(e) => handleBoxMouseDown(e, box.id)}
                              onTouchStart={(e) => handleBoxTouchStart(e, box.id)} 
                              className="cursor-move" />

                        <g stroke="#94a3b8" strokeWidth="1.5" fontSize="10" fill="#64748b" textAnchor="middle" vectorEffect="non-scaling-stroke">
                          <line x1="0" y1="-15" x2={actW} y2="-15" />
                          <line x1="0" y1="-22" x2="0" y2="-8" />
                          <line x1={actW} y1="-22" x2={actW} y2="-8" />
                          <rect x={actW/2 - 20} y="-22" width="40" height="14" fill="white" />
                          <text x={actW/2} y="-11" fontWeight="bold">{actW}</text>
                          <line x1="-15" y1="0" x2="-15" y2={actH} />
                          <line x1="-22" y1="0" x2="-8" y2="0" />
                          <line x1="-22" y1={actH} x2="-8" y2={actH} />
                          <rect x="-25" y={actH/2 - 20} width="20" height="40" fill="white" />
                          <text x="-15" y={actH/2} transform={`rotate(-90 -15 ${actH/2})`} fontWeight="bold" dominantBaseline="central">{actH}</text>
                        </g>

                        <g fill="#1e293b" stroke="#0f172a" strokeWidth="1">
                          {[{x: 0, y: 0}, {x: actW - CORNER_SIZE, y: 0}, {x: 0, y: actH - CORNER_SIZE}, {x: actW - CORNER_SIZE, y: actH - CORNER_SIZE}].map((pos, i) => (
                            <g key={`corner-${i}`}><rect x={pos.x} y={pos.y} width={CORNER_SIZE} height={CORNER_SIZE} /><text x={pos.x+7.5} y={pos.y+7.5} fill="white" fontSize="8" fontWeight="bold" textAnchor="middle" dominantBaseline="central">C</text></g>
                          ))}
                        </g>

                        {renderTrussEdge(box.id, box.plan.top.pieces, CORNER_SIZE, 0, true, 'top')}
                        {renderTrussEdge(box.id, box.plan.bottom.pieces, CORNER_SIZE, actH - CORNER_SIZE, true, 'bottom')}
                        {renderTrussEdge(box.id, box.plan.left.pieces, 0, CORNER_SIZE, false, 'left')}
                        {renderTrussEdge(box.id, box.plan.right.pieces, actW - CORNER_SIZE, CORNER_SIZE, false, 'right')}
                        
                        <text x={actW/2} y={actH/2} fill="#cbd5e1" fontSize="24" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>{box.name}</text>
                        {actualAlt > 0 && <text x={actW/2} y={actH/2 + 25} fill="#94a3b8" fontSize="14" fontWeight="bold" textAnchor="middle" style={{ pointerEvents: 'none' }}>H: {actualAlt} cm</text>}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          {/* NOVA LISTA DE MATERIAIS (BoM) HORIZONTAL MOBILE-FRIENDLY */}
          <div className="bg-white border-t border-slate-200 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-20 no-print shrink-0 w-full">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Lista de Materiais</h3>
              <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded-full">Total: {bom.reduce((acc, item) => acc + item.qty, 0)}</span>
            </div>
            
            {/* Scroll Horizontal Fluido */}
            <div className="p-3 flex gap-3 overflow-x-auto hide-scrollbar snap-x touch-pan-x">
              {bom.map((item, idx) => (
                <div key={idx} className="shrink-0 flex items-center justify-between gap-3 p-2 bg-white border border-slate-200 rounded-lg shadow-sm min-w-[160px] snap-start">
                  <span className="text-xs font-medium text-slate-700">{item.name}</span>
                  <span className="text-xs font-bold bg-slate-100 text-slate-800 w-6 h-6 flex items-center justify-center rounded-full shrink-0">{item.qty}</span>
                </div>
              ))}
              {bom.length === 0 && <p className="text-xs text-slate-400 w-full text-center">Nenhuma peça em uso.</p>}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}