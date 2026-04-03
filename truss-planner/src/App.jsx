import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Settings, ZoomIn, ZoomOut, RefreshCw, CheckCircle2, 
  Layers, Maximize, Printer, Save, FolderOpen, Cuboid, 
  MousePointerClick, X, Split, Trash2, Plus, Move, Wrench,
  Undo2, Scissors, Copy, Magnet, MonitorPlay
} from 'lucide-react';

// --- CONFIGURAÇÕES E ALGORITMO ---

const CORNER_SIZE = 15;
const DEFAULT_PIECES = [20, 50, 70, 100, 120, 150, 170, 200, 220, 250, 270, 300];

// Função externa e pura para geração de IDs
const generateId = () => 'box-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

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

// Gerador de plantas movido para FORA do componente
const generatePlan = (w, h, alt, activePiecesMap) => {
  const available = Object.entries(activePiecesMap).filter(([, v]) => v).map(([p]) => parseInt(p));
  if (available.length === 0 || w <= 0 || h <= 0) {
    return { top: { pieces: [], actualLength: 0 }, bottom: { pieces: [], actualLength: 0 }, left: { pieces: [], actualLength: 0 }, right: { pieces: [], actualLength: 0 }, intermediatePillarsX: [], intermediatePillarsY: [] };
  }
  const px = solveTruss(w - CORNER_SIZE * 2, available);
  const py = solveTruss(h - CORNER_SIZE * 2, available);
  const pz = alt > 0 ? solveTruss(alt - CORNER_SIZE * 2, available) : { pieces: [], exact: true, actualLength: 0 };
  
  const intPillarsX = [];
  const intPillarsY = [];
  
  if (alt > 0 && px.actualLength > 0 && py.actualLength > 0) {
    if (px.actualLength > 600) {
      const L = px.actualLength;
      const N = Math.floor((L - 1) / 300);
      const span = (N - 1) * 300;
      const offset = (L - span) / 2;
      for (let i = 0; i < N; i++) intPillarsX.push(offset + i * 300);
    }
    if (py.actualLength > 600) {
      const L = py.actualLength;
      const N = Math.floor((L - 1) / 300);
      const span = (N - 1) * 300;
      const offset = (L - span) / 2;
      for (let i = 0; i < N; i++) intPillarsY.push(offset + i * 300);
    }
  }

  return {
    top: JSON.parse(JSON.stringify(px)), bottom: JSON.parse(JSON.stringify(px)),
    left: JSON.parse(JSON.stringify(py)), right: JSON.parse(JSON.stringify(py)),
    pillarFL: JSON.parse(JSON.stringify(pz)), pillarFR: JSON.parse(JSON.stringify(pz)),
    pillarBL: JSON.parse(JSON.stringify(pz)), pillarBR: JSON.parse(JSON.stringify(pz)),
    intermediatePillarsX: intPillarsX,
    intermediatePillarsY: intPillarsY
  };
};

const calcularFerragens = (boxes, parafusosPorConexao = 4) => {
  let totalLigacoes = 0;
  boxes.forEach(box => {
    if (!box.plan) return;
    const contarLigacoesDaAresta = (pecas) => {
      if (pecas && pecas.length > 0) totalLigacoes += (pecas.length - 1) + 2; 
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
      
      if (box.plan.intermediatePillarsX) {
        box.plan.intermediatePillarsX.forEach(() => {
          contarLigacoesDaAresta(box.plan.pillarFL?.pieces);
          contarLigacoesDaAresta(box.plan.pillarFR?.pieces);
          contarLigacoesDaAresta(box.plan.left?.pieces);
        });
      }
      if (box.plan.intermediatePillarsY) {
        box.plan.intermediatePillarsY.forEach(() => {
          contarLigacoesDaAresta(box.plan.pillarBL?.pieces);
          contarLigacoesDaAresta(box.plan.pillarBR?.pieces);
          contarLigacoesDaAresta(box.plan.top?.pieces);
        });
      }
    }
  });
  return { totalConexoes: totalLigacoes, totalParafusos: totalLigacoes * parafusosPorConexao };
};

const calculateMagneticSnap = (newX, newY, currentBoxId, boxes) => {
  const SNAP_DIST = 15; // Suavizado: Distância menor para a caixa não ficar tão "presa"
  let snappedX = newX;
  let snappedY = newY;
  
  const currentBox = boxes.find(b => b.id === currentBoxId);
  if (!currentBox || !currentBox.plan) return { x: newX, y: newY };
  
  const actW1 = (currentBox.plan.top?.actualLength || 0) + CORNER_SIZE * 2;
  const actH1 = (currentBox.plan.left?.actualLength || 0) + CORNER_SIZE * 2;

  for (let targetBox of boxes) {
    if (targetBox.id === currentBoxId || !targetBox.plan) continue;
    
    const actW2 = (targetBox.plan.top?.actualLength || 0) + CORNER_SIZE * 2;
    const actH2 = (targetBox.plan.left?.actualLength || 0) + CORNER_SIZE * 2;

    const snapPointsX = [
      targetBox.x,                          
      targetBox.x + actW2,                  
      targetBox.x - actW1,                  
      targetBox.x + actW2 - actW1           
    ];

    const snapPointsY = [
      targetBox.y,                          
      targetBox.y + actH2,                  
      targetBox.y - actH1,                  
      targetBox.y + actH2 - actH1           
    ];

    for (let ptX of snapPointsX) {
       if (Math.abs(newX - ptX) < SNAP_DIST) snappedX = ptX;
    }
    for (let ptY of snapPointsY) {
       if (Math.abs(newY - ptY) < SNAP_DIST) snappedY = ptY;
    }
  }
  
  return { x: snappedX, y: snappedY };
};

// --- COMPONENTE VISUALIZADOR 3D / SHOWCASE ---
const ThreeDViewer = ({ boxes, bounds, onClose, showcaseMode = false, projectName, totalItems }) => {
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(!!window.THREE);

  useEffect(() => {
    if (window.THREE) return; 
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
    const container = containerRef.current;
    
    let scene, camera, renderer, animationId;
    let isDragging = false;
    let isPanning = false;
    let previousMousePosition = { x: 0, y: 0 };
    let previousTouchDist = 0;

    const THREE = window.THREE;
    container.innerHTML = ''; 

    scene = new THREE.Scene();
    scene.background = new THREE.Color(showcaseMode ? 0x0f172a : 0xf1f5f9);

    const centerX = (bounds.maxX + bounds.minX) / 2;
    const centerZ = (bounds.maxY + bounds.minY) / 2;
    const maxDim = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 500);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 20000);
    const camDist = showcaseMode ? maxDim * 0.8 : maxDim;
    camera.position.set(centerX + camDist, camDist * 0.8, centerZ + camDist);
    camera.lookAt(centerX, 0, centerZ);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, showcaseMode ? 1.2 : 0.9);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(centerX + 1000, 2000, centerZ + 1000);
    scene.add(directionalLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(centerX - 1000, 500, centerZ - 1000);
    scene.add(fillLight);

    const trussMaterial = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 });
    const cornerMaterial = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.5 });

    const trussGroup = new THREE.Group();
    scene.add(trussGroup);
    trussGroup.position.set(centerX, 0, centerZ);

    const createCylinder = (p1, p2, radius, material) => {
      const distance = p1.distanceTo(p2);
      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, distance, 8), material);
      cylinder.position.copy(new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5));
      cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(p2, p1).normalize());
      return cylinder;
    };

    const createTextSprite = (message) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const fontSize = 48;
      ctx.font = `900 ${fontSize}px sans-serif`;
      const metrics = ctx.measureText(message);
      const paddingX = 40; const paddingY = 24;
      canvas.width = metrics.width + paddingX * 2; canvas.height = fontSize + paddingY * 2;

      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.textBaseline = "middle"; ctx.textAlign = "center";

      const radius = canvas.height / 2;
      ctx.fillStyle = showcaseMode ? "rgba(30, 41, 59, 0.95)" : "rgba(255, 255, 255, 0.95)";
      ctx.strokeStyle = showcaseMode ? "#475569" : "#94a3b8";
      ctx.lineWidth = 6;
      
      ctx.beginPath();
      ctx.moveTo(radius, 0); ctx.lineTo(canvas.width - radius, 0);
      ctx.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
      ctx.lineTo(canvas.width, canvas.height - radius);
      ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
      ctx.lineTo(radius, canvas.height);
      ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
      ctx.lineTo(0, radius); ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = showcaseMode ? "#f8fafc" : "#0f172a";
      ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 4);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false }); 
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(canvas.width * 0.25, canvas.height * 0.25, 1);
      sprite.renderOrder = 999;
      return sprite;
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

      const relX = box.x - centerX;
      const relZ = box.y - centerZ;

      const drawTruss = (x, y, z, length, axis) => {
        const truss = getTrussGroup(length, trussMaterial);
        if (axis === 'z') truss.rotation.y = Math.PI / 2;
        if (axis === 'y') truss.rotation.z = Math.PI / 2; 
        truss.position.set(x, y, z);
        trussGroup.add(truss);
      };

      const drawCorner = (x, y, z) => {
        const corner = getCornerGroup(cornerMaterial);
        corner.position.set(x, y, z);
        trussGroup.add(corner);
      };

      const left = relX + CORNER_SIZE/2; const right = relX + actW - CORNER_SIZE/2;
      const topZ = relZ + CORNER_SIZE/2; const bottomZ = relZ + actH - CORNER_SIZE/2;
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

      const labelX = createTextSprite(`${actW} cm`);
      labelX.position.set((left + right) / 2, bottomY - 15, bottomZ + 30);
      trussGroup.add(labelX);

      const labelZ = createTextSprite(`${actH} cm`);
      labelZ.position.set(left - 30, bottomY - 15, (topZ + bottomZ) / 2);
      trussGroup.add(labelZ);

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

        const labelY = createTextSprite(`${actualAlt + CORNER_SIZE * 2} cm`);
        labelY.position.set(left - 30, (bottomY + topY) / 2, bottomZ + 30);
        trussGroup.add(labelY);

        if (box.plan.intermediatePillarsX) {
          box.plan.intermediatePillarsX.forEach(xPos => {
            const absX = left + (CORNER_SIZE / 2) + xPos; 
            drawCorner(absX, topY, topZ); drawCorner(absX, bottomY, topZ); 
            drawEdge(box.plan.pillarBL?.pieces || [], absX, CORNER_SIZE, topZ, 'y'); 
            drawCorner(absX, topY, bottomZ); drawCorner(absX, bottomY, bottomZ); 
            drawEdge(box.plan.pillarFL?.pieces || [], absX, CORNER_SIZE, bottomZ, 'y'); 
            drawEdge(box.plan.left?.pieces || [], absX, topY, topZ + CORNER_SIZE/2, 'z');
          });
        }
        if (box.plan.intermediatePillarsY) {
          box.plan.intermediatePillarsY.forEach(yPos => {
            const absZ = topZ + (CORNER_SIZE / 2) + yPos;
            drawCorner(left, topY, absZ); drawCorner(left, bottomY, absZ); 
            drawEdge(box.plan.pillarBL?.pieces || [], left, CORNER_SIZE, absZ, 'y'); 
            drawCorner(right, topY, absZ); drawCorner(right, bottomY, absZ); 
            drawEdge(box.plan.pillarBR?.pieces || [], right, CORNER_SIZE, absZ, 'y'); 
            drawEdge(box.plan.top?.pieces || [], left + CORNER_SIZE/2, topY, absZ, 'x');
          });
        }
      } else {
        labelX.position.set((left + right) / 2, bottomY, bottomZ + 30);
        labelZ.position.set(left - 30, bottomY, (topZ + bottomZ) / 2);
      }
    });

    const handleCameraMove = (deltaX, deltaY) => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((deltaY * Math.PI) / 360, (deltaX * Math.PI) / 360, 0, 'XYZ'));
      camera.position.sub(new THREE.Vector3(centerX, 0, centerZ));
      camera.position.applyQuaternion(q);
      camera.position.add(new THREE.Vector3(centerX, 0, centerZ));
      camera.lookAt(centerX, 0, centerZ);
    };

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

    const gridColor = showcaseMode ? 0x334155 : 0x94a3b8;
    const gridBase = showcaseMode ? 0x1e293b : 0xe2e8f0;
    const gridHelper = new THREE.GridHelper(Math.max(maxDim * 3, 2000), 50, gridColor, gridBase);
    gridHelper.position.set(centerX, 0, centerZ);
    scene.add(gridHelper);

    const animate = () => { 
      animationId = requestAnimationFrame(animate); 
      
      // Auto-rotação no Modo Apresentação se o utilizador não estiver a interagir
      if (showcaseMode && !isDragging && !isPanning) {
        trussGroup.rotation.y += 0.003;
      }

      renderer.render(scene, camera); 
    };
    animate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
      if (container) container.innerHTML = '';
    };
  }, [boxes, isReady, bounds, showcaseMode]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 animate-in fade-in zoom-in-95 duration-300">
      
      {showcaseMode ? (
        // Overlay Premium para Apresentação ao Cliente
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 md:p-10">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-xl">{projectName || 'Projeto de Estrutura'}</h1>
              <p className="text-amber-400 text-lg font-medium drop-shadow-md mt-1">Apresentação 3D</p>
            </div>
            <button onClick={onClose} className="pointer-events-auto p-3 bg-white/10 hover:bg-red-500/80 backdrop-blur-md border border-white/20 rounded-full text-white transition-all shadow-xl">
              <X size={28} />
            </button>
          </div>
          <div className="flex justify-between items-end">
             <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl shadow-2xl">
               <p className="text-slate-400 text-xs md:text-sm uppercase tracking-widest font-bold mb-1">Resumo Técnico</p>
               <p className="text-2xl md:text-4xl text-white font-black">{totalItems} <span className="text-lg md:text-xl font-normal text-slate-300">peças no total</span></p>
             </div>
             <div className="hidden md:flex items-center gap-2 text-slate-400 text-sm font-medium bg-slate-900/50 backdrop-blur-md px-4 py-2 rounded-full">
               <MousePointerClick size={16} /> Arraste para visualizar ângulos
             </div>
          </div>
        </div>
      ) : (
        // Header Normal da Visão 3D
        <div className="flex justify-between items-center p-4 border-b border-slate-800 text-white shadow-md z-10">
          <h2 className="text-xl font-bold flex items-center gap-2"><Cuboid /> Ambiente 3D</h2>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-xs md:text-sm">
              Clique esq: Rodar • Botão dir: Panorâmica
            </span>
            <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-red-600 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

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
  const [pastHistory, setPastHistory] = useState([]); 
  
  const [boxes, setBoxes] = useState(() => {
    const initPieces = DEFAULT_PIECES.reduce((acc, p) => ({ ...acc, [p]: true }), {});
    const initBox = { id: generateId(), name: 'Estrutura Principal', w: 400, h: 200, alt: 300, x: 0, y: 0, plan: null, isManual: false };
    initBox.plan = generatePlan(initBox.w, initBox.h, initBox.alt, initPieces);
    return [initBox];
  });
  
  const [activeBoxId, setActiveBoxId] = useState(boxes[0].id);
  const activeBox = boxes.find(b => b.id === activeBoxId) || boxes[0];

  const svgRef = useRef(null);
  const printRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggingBoxId, setDraggingBoxId] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastTouchRef = useRef({ x: 0, y: 0, dist: 0 });
  const dragBoxStartRef = useRef({ boxX: 0, boxY: 0, mouseX: 0, mouseY: 0 }); // Novo referencial de memória absoluta para arraste suave
  
  const [editingPiece, setEditingPiece] = useState(null); 
  const [show3D, setShow3D] = useState(false);
  const [showcaseMode, setShowcaseMode] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  const [projects, setProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem('trussProjects')) || []; } catch { return []; }
  });
  const [newProjectName, setNewProjectName] = useState("");
  
  // ESTADO PARA OS PAINÉIS MOBILE
  const [mobilePanel, setMobilePanel] = useState('none'); // 'none', 'settings', 'bom'

  const boxesRef = useRef(boxes);
  const activeBoxIdRef = useRef(activeBoxId);
  const activePiecesRef = useRef(activePieces);
  
  useEffect(() => {
    boxesRef.current = boxes;
    activeBoxIdRef.current = activeBoxId;
    activePiecesRef.current = activePieces;
  }, [boxes, activeBoxId, activePieces]);

  const recordHistory = useCallback(() => {
    setPastHistory(prev => {
      const currentStateStr = JSON.stringify(boxesRef.current);
      if (prev.length > 0 && JSON.stringify(prev[prev.length - 1]) === currentStateStr) return prev;
      return [...prev, JSON.parse(currentStateStr)].slice(-20); 
    });
  }, []);

  const handleUndo = useCallback(() => {
    setPastHistory(prev => {
      if (prev.length === 0) return prev;
      const newPast = [...prev];
      const previousBoxes = newPast.pop();
      setBoxes(previousBoxes);
      if (!previousBoxes.find(b => b.id === activeBoxIdRef.current)) {
        setActiveBoxId(previousBoxes[0].id);
      }
      return newPast;
    });
  }, []);

  const cutBox = useCallback(() => {
    if (boxesRef.current.length === 0) return;
    recordHistory();
    setBoxes(prev => {
      const remaining = prev.filter(b => b.id !== activeBoxIdRef.current);
      if (remaining.length === 0) {
        const newBox = { id: generateId(), name: `Estrutura 1`, w: 400, h: 200, alt: 300, x: 0, y: 0, plan: null, isManual: false };
        newBox.plan = generatePlan(newBox.w, newBox.h, newBox.alt, activePiecesRef.current);
        setActiveBoxId(newBox.id);
        return [newBox];
      }
      setActiveBoxId(remaining[0].id);
      return remaining;
    });
  }, [recordHistory]);

  const duplicateBox = useCallback(() => {
    recordHistory();
    setBoxes(prev => {
      const currentBox = prev.find(b => b.id === activeBoxIdRef.current);
      if (!currentBox) return prev;
      const newBox = JSON.parse(JSON.stringify(currentBox));
      newBox.id = generateId();
      newBox.name = newBox.name.includes('(Cópia)') ? newBox.name : `${newBox.name} (Cópia)`;
      newBox.x += 40; 
      newBox.y += 40;
      setActiveBoxId(newBox.id);
      return [...prev, newBox];
    });
  }, [recordHistory]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') { e.preventDefault(); cutBox(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'c')) { e.preventDefault(); duplicateBox(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, cutBox, duplicateBox]);

  useEffect(() => {
    const handleGlobalUp = () => {
      setIsDraggingCanvas(false);
      setDraggingBoxId(null);
    };
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('tickend', handleGlobalUp);
    };
  }, []);

  const addBox = () => {
    recordHistory();
    const newBox = { id: generateId(), name: `Estrutura ${boxes.length + 1}`, w: 300, h: 200, alt: 300, x: 50 * boxes.length, y: 50 * boxes.length, plan: null, isManual: false };
    newBox.plan = generatePlan(newBox.w, newBox.h, newBox.alt, activePieces);
    setBoxes([...boxes, newBox]);
    setActiveBoxId(newBox.id);
  };

  const removeBox = (id, e) => {
    e.stopPropagation();
    recordHistory();
    const remaining = boxes.filter(b => b.id !== id);
    if (remaining.length === 0) {
      const newBox = { id: generateId(), name: `Estrutura 1`, w: 0, h: 0, alt: 0, x: 0, y: 0, plan: null, isManual: false };
      setBoxes([newBox]);
      setActiveBoxId(newBox.id);
    } else {
      setBoxes(remaining);
      if (activeBoxId === id) setActiveBoxId(remaining[0].id);
    }
  };

  const updateActiveBox = (updates) => {
    setBoxes(prev => prev.map(b => {
      if (b.id !== activeBoxId) return b;
      const updatedBox = { ...b, ...updates };
      if (!updatedBox.isManual && updatedBox.w > 0 && updatedBox.h > 0) {
        updatedBox.plan = generatePlan(updatedBox.w, updatedBox.h, updatedBox.alt || 0, activePieces);
      }
      return updatedBox;
    }));
  };

  const handleTogglePiece = (p) => {
    setActivePieces(prev => {
      const nextPieces = { ...prev, [p]: !prev[p] };
      setBoxes(prevBoxes => prevBoxes.map(box => {
        if (!box.isManual && box.w > 0 && box.h > 0) {
          return { ...box, plan: generatePlan(box.w, box.h, box.alt || 0, nextPieces) };
        }
        return box;
      }));
      return nextPieces;
    });
  };

  const handlePieceClick = (boxId, edgeId, index, length, clientX, clientY) => {
    setActiveBoxId(boxId);
    const available = Object.entries(activePieces).filter(([, v]) => v).map(([p]) => parseInt(p));
    const splits = getValidSplits(length, available);
    setEditingPiece({ boxId, edgeId, index, length, splits, x: clientX, y: clientY });
  };

  const applySplit = (splitArray) => {
    if (!editingPiece) return;
    recordHistory();
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
    setActivePieces(proj.activePieces);
    setBoxes(proj.boxes);
    setActiveBoxId(proj.boxes[0].id);
    setEditingPiece(null);
    setMobilePanel('none'); // Fechar o painel ao carregar no mobile
  };

  const deleteProject = (id) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    localStorage.setItem('trussProjects', JSON.stringify(updated));
  };

  // --- Função Avançada de Exportação PDF Real ---
  const handleExportPDF = () => {
    setIsExportingPDF(true);
    
    setTimeout(async () => {
      try {
        if (!window.html2pdf) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        
        const element = printRef.current;
        const opt = {
          margin:       10,
          filename:     `${newProjectName ? newProjectName.replace(/\s+/g, '_') : 'Projeto_Estrutura'}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, logging: false },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        
        await window.html2pdf().set(opt).from(element).save();
      } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        alert('Não foi possível gerar o ficheiro PDF. Tente novamente.');
      } finally {
        setIsExportingPDF(false);
      }
    }, 500);
  };

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
    recordHistory(); 
    setActiveBoxId(boxId); setDraggingBoxId(boxId);
    
    // Memoriza a posição inicial exata para o arraste não ficar preso
    const box = boxesRef.current.find(b => b.id === boxId);
    if (box) {
      dragBoxStartRef.current = { boxX: box.x, boxY: box.y, mouseX: e.clientX, mouseY: e.clientY };
    }
  };
  
  const handleMouseMove = (e) => {
    if (draggingBoxId) {
      // Movimento Suave Absoluto: ignora o bloqueio magnético
      const dx = (e.clientX - dragBoxStartRef.current.mouseX) / scale;
      const dy = (e.clientY - dragBoxStartRef.current.mouseY) / scale;
      const rawX = dragBoxStartRef.current.boxX + dx;
      const rawY = dragBoxStartRef.current.boxY + dy;
      
      setBoxes(prev => {
        const snapPos = calculateMagneticSnap(rawX, rawY, draggingBoxId, prev);
        return prev.map(b => b.id === draggingBoxId ? { ...b, x: snapPos.x, y: snapPos.y } : b);
      });
    } else if (isDraggingCanvas) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleTouchStartCanvas = (e) => {
    if (editingPiece) return;
    if (e.touches.length === 1) {
      lastTouchRef.current.x = e.touches[0].clientX;
      lastTouchRef.current.y = e.touches[0].clientY;
      if (!draggingBoxId) {
        setIsDraggingCanvas(true);
        setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
      }
    } else if (e.touches.length === 2) {
      setIsDraggingCanvas(false);
      setDraggingBoxId(null);
      lastTouchRef.current.dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  };

  const handleBoxTouchStart = (e, boxId) => {
    e.stopPropagation();
    if (editingPiece) return;
    recordHistory(); 
    setActiveBoxId(boxId);
    setDraggingBoxId(boxId);
    lastTouchRef.current.x = e.touches[0].clientX;
    lastTouchRef.current.y = e.touches[0].clientY;
    
    // Memoriza posição para touch
    const box = boxesRef.current.find(b => b.id === boxId);
    if (box) {
      dragBoxStartRef.current = { boxX: box.x, boxY: box.y, mouseX: e.touches[0].clientX, mouseY: e.touches[0].clientY };
    }
  };

  const handleTouchMoveCanvas = (e) => {
    if (editingPiece) return;
    if (e.touches.length === 1) {
       const touch = e.touches[0];
       
       if (draggingBoxId) {
          // Movimento suave para Telemóveis
          const dx = (touch.clientX - dragBoxStartRef.current.mouseX) / scale;
          const dy = (touch.clientY - dragBoxStartRef.current.mouseY) / scale;
          const rawX = dragBoxStartRef.current.boxX + dx;
          const rawY = dragBoxStartRef.current.boxY + dy;
          
          setBoxes(prev => {
            const snapPos = calculateMagneticSnap(rawX, rawY, draggingBoxId, prev);
            return prev.map(b => b.id === draggingBoxId ? { ...b, x: snapPos.x, y: snapPos.y } : b);
          });
       } else if (isDraggingCanvas) {
          setPan({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
       }
       lastTouchRef.current.x = touch.clientX;
       lastTouchRef.current.y = touch.clientY;
    } else if (e.touches.length === 2) {
       const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
       if (lastTouchRef.current.dist > 0) {
         const delta = dist / lastTouchRef.current.dist;
         setScale(s => Math.min(Math.max(0.2, s * delta), 5));
       }
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

        if (box.plan.intermediatePillarsX) {
          box.plan.intermediatePillarsX.forEach(() => {
            box.plan.pillarFL?.pieces.forEach(add); 
            box.plan.pillarFR?.pieces.forEach(add); 
            box.plan.left?.pieces.forEach(add);     
            totalCorners += 4; 
          });
        }
        if (box.plan.intermediatePillarsY) {
          box.plan.intermediatePillarsY.forEach(() => {
            box.plan.pillarBL?.pieces.forEach(add); 
            box.plan.pillarBR?.pieces.forEach(add); 
            box.plan.top?.pieces.forEach(add);      
            totalCorners += 4; 
          });
        }
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
          
          <text x={textX} y={textY} 
                transform={`rotate(${isHorizontal ? 0 : -90} ${textX} ${textY})`} 
                textAnchor="middle" 
                dominantBaseline="central" 
                fontSize="6.5" 
                fill="#0f172a" 
                fontWeight="800" 
                stroke="#ffffff" 
                strokeWidth="2.5" 
                paintOrder="stroke" 
                strokeLinejoin="round"
                style={{ pointerEvents: 'none' }}>
            {p}
          </text>
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
    <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans text-slate-900 overflow-hidden print:bg-white print:h-auto" onClick={() => setEditingPiece(null)}>
      
      {/* VISTAS 3D */}
      {(show3D || showcaseMode) && (
        <ThreeDViewer 
          boxes={boxes} 
          bounds={bounds} 
          onClose={() => { setShow3D(false); setShowcaseMode(false); }} 
          showcaseMode={showcaseMode}
          projectName={newProjectName}
          totalItems={bom.reduce((acc, item) => acc + item.qty, 0)}
        />
      )}

      {/* HEADER NORMAL */}
      {!isExportingPDF && (
        <header className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center shadow-md z-10 flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="text-blue-400" size={20} />
            <h1 className="text-lg font-bold tracking-tight">TrussPlanner <span className="text-slate-400 font-normal hidden sm:inline">| Eventos</span></h1>
          </div>
          <div className="flex gap-2">
            {boxes.some(b => b.w > 30) && (
              <>
                <button onClick={() => setShowcaseMode(true)} className="flex items-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-lg text-sm font-bold shadow-lg transition-colors">
                  <MonitorPlay size={16} /> <span className="hidden lg:inline">Apresentar</span>
                </button>
                <button onClick={() => setShow3D(true)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium shadow-lg transition-colors">
                  <Cuboid size={16} /> <span className="hidden md:inline">Ver 3D</span><span className="md:hidden">3D</span>
                </button>
              </>
            )}
            <button onClick={handleExportPDF} disabled={isExportingPDF} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium shadow-lg transition-colors disabled:opacity-50">
              {isExportingPDF ? <RefreshCw className="animate-spin" size={16} /> : <Printer size={16} />}
              <span className="hidden md:inline">{isExportingPDF ? 'A Gerar PDF...' : 'Exportar PDF'}</span>
            </button>
          </div>
        </header>
      )}

      {/* CONTAINER PRINCIPAL DO LAYOUT */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row relative">
        
        {/* SIDEBAR: Deslizante em Mobile, Estática em Desktop */}
        {!isExportingPDF && (
          <aside className={`w-full md:w-[340px] bg-white border-r border-slate-200 flex flex-col shadow-2xl md:shadow-sm z-40 overflow-hidden shrink-0 h-full absolute md:relative left-0 top-0 transition-transform duration-300 ease-in-out ${mobilePanel === 'settings' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            
            {/* Cabeçalho de Fechar no Mobile */}
            <div className="md:hidden flex justify-between items-center p-4 bg-slate-900 text-white shrink-0 shadow-md z-10 relative">
              <h2 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2"><Settings size={18} /> Ajustes da Box</h2>
              <button onClick={() => setMobilePanel('none')} className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"><X size={18}/></button>
            </div>

            {/* Conteúdo da Sidebar Rolável */}
            <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
              <div className="p-3 border-b border-slate-100 bg-slate-50 shrink-0">
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

              <div className="p-3 border-b border-slate-100 shrink-0">
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
                      <button onClick={() => updateActiveBox({ isManual: false })} className="underline font-medium">Resetar</button>
                    </div>
                  </div>
                ) : (activeBox.w > 0 && activeBox.h > 0) && (
                  <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded flex gap-2 text-emerald-800 text-xs items-center">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <p><b>{(activeBox.plan?.top?.actualLength || 0) + 30}x{(activeBox.plan?.left?.actualLength || 0) + 30}</b></p>
                  </div>
                )}
              </div>

              <div className="p-3 border-b border-slate-100 shrink-0">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
                  <Split size={16} /> Stock
                </h2>
                <div className="grid grid-cols-4 md:grid-cols-3 gap-1 max-h-32 overflow-y-auto mb-2 hide-scrollbar">
                  {DEFAULT_PIECES.map(p => (
                    <label key={p} className="flex items-center gap-1 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" checked={activePieces[p]} onChange={() => handleTogglePiece(p)}
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

              {/* Guardar Projeto no Mobile é incorporado diretamente no painel de Materiais ou na Sidebar */}
              <div className="p-3 flex-1 bg-slate-50 min-h-[150px]">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
                  <Save size={16} /> Guardar
                </h2>
                <div className="flex gap-2 mb-2">
                  <input type="text" placeholder="Nome..." value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded outline-none" />
                  <button onClick={saveProject} className="px-3 py-1 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">OK</button>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto hide-scrollbar">
                  {projects.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-2 bg-white border border-slate-200 rounded text-xs hover:border-blue-400">
                      <button onClick={() => loadProject(p)} className="flex-1 text-left font-medium text-slate-700 flex items-center gap-1 truncate">
                        <FolderOpen size={12} className="text-blue-500 shrink-0" /> <span className="truncate">{p.name}</span>
                      </button>
                      <button onClick={() => deleteProject(p.id)} className="text-red-400 hover:text-red-600 p-1 shrink-0"><Trash2 size={12}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* MAIN: CANVAS 2D + LISTA DE MATERIAIS (BOM) */}
        <main ref={printRef} className={`flex-1 flex flex-col relative ${isExportingPDF ? 'bg-white h-auto block' : 'h-full min-h-0'}`}>
          
          {/* CABEÇALHO DO PDF (SÓ VISÍVEL AO EXPORTAR) */}
          {isExportingPDF && (
            <div className="flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-6 pt-8 px-10 bg-white">
              <div>
                <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
                  <Layers className="text-blue-600" size={40} /> TrussPlanner Pro
                </h1>
                <p className="text-slate-500 text-lg font-medium mt-1">Relatório Técnico e Orçamentação</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-slate-800">{newProjectName || 'Projeto de Estrutura'}</h2>
                <p className="text-slate-500 text-lg">{new Date().toLocaleDateString('pt-PT')}</p>
              </div>
            </div>
          )}

          {!isExportingPDF && editingPiece && (
            <div className="fixed z-[60] bg-white p-3 rounded-lg shadow-2xl border border-slate-200 w-[280px] max-w-[90vw] animate-in fade-in zoom-in no-print"
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

          {/* BARRA DE ATALHOS FLUTUANTE */}
          {!isExportingPDF && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-slate-700/50">
              <button onClick={handleUndo} disabled={pastHistory.length === 0} className={`p-1.5 rounded-full transition-colors ${pastHistory.length === 0 ? 'text-slate-500 cursor-not-allowed' : 'text-slate-200 hover:text-white hover:bg-slate-700 active:bg-slate-600'}`} title="Desfazer Ação (Ctrl+Z)">
                <Undo2 size={16} />
              </button>
              <div className="w-px h-5 bg-slate-700 mx-1"></div>
              <button onClick={cutBox} className="p-1.5 text-slate-200 hover:text-white hover:bg-slate-700 active:bg-slate-600 rounded-full transition-colors" title="Recortar / Apagar Box (Ctrl+X)">
                <Scissors size={16} />
              </button>
              <button onClick={duplicateBox} className="p-1.5 text-slate-200 hover:text-white hover:bg-slate-700 active:bg-slate-600 rounded-full transition-colors" title="Duplicar Box (Ctrl+D)">
                <Copy size={16} />
              </button>
            </div>
          )}

          {/* CANVAS 2D COMPLETO */}
          <div className={`flex-1 relative touch-none select-none ${isExportingPDF ? 'bg-white overflow-visible' : 'overflow-hidden'}`} style={{
                backgroundSize: '40px 40px',
                backgroundImage: isExportingPDF ? 'none' : 'linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)'
              }}
            onWheel={isExportingPDF ? null : handleWheel} 
            onMouseDown={isExportingPDF ? null : handleMouseDownCanvas} onMouseMove={isExportingPDF ? null : handleMouseMove}
            onTouchStart={isExportingPDF ? null : handleTouchStartCanvas} onTouchMove={isExportingPDF ? null : handleTouchMoveCanvas}>
            
            {!isExportingPDF && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/90 px-2 py-1 rounded shadow border border-slate-200 text-xs font-medium text-slate-600 pointer-events-none">
                 <Magnet size={12} className="text-blue-500"/> Arraste (Encaixe)
              </div>
            )}

            {!isExportingPDF && (
              <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                <button onClick={() => setScale(s => Math.min(s * 1.2, 5))} className="p-2.5 bg-white rounded shadow border border-slate-200 text-slate-700 active:bg-slate-100"><ZoomIn size={18} /></button>
                <button onClick={() => setScale(s => Math.max(s / 1.2, 0.2))} className="p-2.5 bg-white rounded shadow border border-slate-200 text-slate-700 active:bg-slate-100"><ZoomOut size={18} /></button>
                <button onClick={() => {setScale(1); setPan({x:50,y:50})}} className="p-2.5 bg-white rounded shadow border border-slate-200 text-slate-700 active:bg-slate-100"><Maximize size={18} /></button>
              </div>
            )}

            <div className={`w-full h-full pointer-events-none relative ${isExportingPDF ? 'flex justify-center items-start py-10' : ''}`}>
              <div style={{ transform: isExportingPDF ? 'none' : `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0' }} 
                   className={isExportingPDF ? 'w-full flex justify-center' : 'pointer-events-auto absolute top-0 left-0 min-w-[5000px] min-h-[5000px]'}>
                
                <svg ref={svgRef} width={isExportingPDF ? Math.max(800, bounds.maxX + 50) : "5000px"} height={isExportingPDF ? Math.max(600, bounds.maxY + 50) : "5000px"} className={isExportingPDF ? 'overflow-visible' : 'drop-shadow-xl overflow-visible'}>
                  {boxes.map(box => {
                    if (!box.plan) return null;
                    const actW = (box.plan.top?.actualLength || 0) + CORNER_SIZE*2;
                    const actH = (box.plan.left?.actualLength || 0) + CORNER_SIZE*2;
                    const actualAlt = box.plan.pillarFL?.pieces.length > 0 ? box.plan.pillarFL.actualLength + CORNER_SIZE*2 : 0;
                    if (actW <= CORNER_SIZE*2) return null;
                    
                    const isSelected = box.id === activeBoxId && !isExportingPDF;
                    const isBeingDragged = draggingBoxId === box.id && !isExportingPDF;

                    return (
                      <g key={box.id} transform={`translate(${box.x}, ${box.y})`}>
                        <rect x="-20" y="-20" width={actW+40} height={actH+40} 
                              fill={isSelected ? (isBeingDragged ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.05)") : "transparent"} 
                              stroke={isSelected ? "#3b82f6" : "transparent"} strokeWidth="2" strokeDasharray="5,5" rx="8"
                              onMouseDown={isExportingPDF ? null : (e) => handleBoxMouseDown(e, box.id)}
                              onTouchStart={isExportingPDF ? null : (e) => handleBoxTouchStart(e, box.id)} 
                              className={isExportingPDF ? '' : 'cursor-move'} />

                        {box.alt > 0 && box.plan.intermediatePillarsX?.map((xPos, idx) => {
                          const lineX = CORNER_SIZE + xPos;
                          return (
                            <g key={`int-x-${idx}`} style={{ pointerEvents: 'none' }}>
                              <rect x={lineX - 6} y={CORNER_SIZE} width="12" height={actH - CORNER_SIZE*2} fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                              <line x1={lineX} y1={CORNER_SIZE} x2={lineX} y2={actH - CORNER_SIZE} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,4" />
                              <rect x={lineX - 22} y={actH / 2 - 10} width="44" height="20" rx="4" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
                              <text x={lineX} y={actH / 2} fill="#334155" fontSize="7" fontWeight="800" textAnchor="middle" dominantBaseline="central">SUPORTE</text>
                            </g>
                          );
                        })}

                        {box.alt > 0 && box.plan.intermediatePillarsY?.map((yPos, idx) => {
                          const lineY = CORNER_SIZE + yPos;
                          return (
                            <g key={`int-y-${idx}`} style={{ pointerEvents: 'none' }}>
                              <rect x={CORNER_SIZE} y={lineY - 6} width={actW - CORNER_SIZE*2} height="12" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                              <line x1={CORNER_SIZE} y1={lineY} x2={actW - CORNER_SIZE} y2={lineY} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,4" />
                              <rect x={actW / 2 - 22} y={lineY - 10} width="44" height="20" rx="4" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
                              <text x={actW / 2} y={lineY} fill="#334155" fontSize="7" fontWeight="800" textAnchor="middle" dominantBaseline="central">SUPORTE</text>
                            </g>
                          );
                        })}

                        <g stroke="#94a3b8" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
                          <line x1="0" y1="-24" x2={actW} y2="-24" />
                          <line x1="0" y1="-32" x2="0" y2="-16" />
                          <line x1={actW} y1="-32" x2={actW} y2="-16" />
                          <rect x={actW/2 - 28} y="-36" width="56" height="24" rx="12" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
                          <text x={actW/2} y="-24" fill="#0f172a" fontSize="14" fontWeight="900" textAnchor="middle" dominantBaseline="central" stroke="none" style={{ pointerEvents: 'none' }}>
                            {actW}
                          </text>

                          <line x1="-24" y1="0" x2="-24" y2={actH} />
                          <line x1="-32" y1="0" x2="-16" y2="0" />
                          <line x1="-32" y1={actH} x2="-16" y2={actH} />
                          <rect x="-36" y={actH/2 - 28} width="24" height="56" rx="12" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
                          <text x="-24" y={actH/2} transform={`rotate(-90 -24 ${actH/2})`} fill="#0f172a" fontSize="14" fontWeight="900" textAnchor="middle" dominantBaseline="central" stroke="none" style={{ pointerEvents: 'none' }}>
                            {actH}
                          </text>
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

          {/* PAINEL BOM: Deslizante em Mobile, Estático em Desktop */}
          {!isExportingPDF && (
            <div className={`bg-white border-t border-slate-200 shadow-[0_-15px_40px_rgba(0,0,0,0.2)] md:shadow-none z-40 w-full absolute md:relative bottom-0 left-0 transition-transform duration-300 ease-in-out flex flex-col max-h-[85vh] md:max-h-[35vh] shrink-0 ${mobilePanel === 'bom' ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}>
              
              {/* Cabeçalho Mobile */}
              <div className="md:hidden flex justify-between items-center p-4 bg-slate-900 text-white shrink-0 shadow-md z-10 relative">
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2"><Layers size={18} /> Lista de Materiais</h3>
                <button onClick={() => setMobilePanel('none')} className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"><X size={18}/></button>
              </div>

              {/* Cabeçalho Desktop */}
              <div className="hidden md:flex p-3 bg-slate-50 border-b border-slate-200 justify-between items-center shrink-0">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Lista de Materiais</h3>
                <div className="flex gap-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                    Peças: {bom.filter(i => i.name.includes('Truss') || i.name.includes('Cubo')).reduce((acc, item) => acc + item.qty, 0)}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                    Parafusos: {bom.find(i => i.name.includes('Parafusos'))?.qty || 0}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto hide-scrollbar">
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {bom.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-1 p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                      <span className="text-[10px] sm:text-xs font-medium text-slate-700 leading-tight">{item.name}</span>
                      <span className="text-[10px] sm:text-xs font-bold bg-slate-100 text-slate-800 min-w-[20px] sm:min-w-[24px] px-1.5 h-5 sm:h-6 flex items-center justify-center rounded-full shrink-0">
                        {item.qty}
                      </span>
                    </div>
                  ))}
                  {bom.length === 0 && <p className="text-xs text-slate-400 w-full text-center col-span-full">Nenhuma peça em uso.</p>}
                </div>
              </div>
            </div>
          )}

          {/* TABELA DE BOM EXCLUSIVA PARA O PDF (SÓ VISÍVEL AO EXPORTAR) */}
          {isExportingPDF && (
            <div className="p-10 pt-4 bg-white w-full max-w-5xl mx-auto">
              <h3 className="text-2xl font-bold text-slate-800 mb-4 border-b-2 border-slate-200 pb-2">Resumo e Lista de Materiais</h3>
              <table className="w-full border-collapse border border-slate-300 text-lg">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-6 py-4 text-left text-slate-700 font-bold uppercase tracking-wider">Item / Peça de Estrutura</th>
                    <th className="border border-slate-300 px-6 py-4 text-center text-slate-700 font-bold uppercase tracking-wider w-40">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="border border-slate-300 px-6 py-3 text-slate-800 font-medium">{item.name}</td>
                      <td className="border border-slate-300 px-6 py-3 text-center font-bold text-slate-900">{item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-8 text-right text-slate-500 text-sm italic">
                Documento gerado automaticamente por TrussPlanner Pro.
              </div>
            </div>
          )}

        </main>

        {/* CORTINA ESCURA (BACKDROP) QUANDO OS PAINÉIS MOBILE ESTÃO ABERTOS */}
        {!isExportingPDF && mobilePanel !== 'none' && (
          <div 
            className="md:hidden absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-30 transition-opacity" 
            onClick={() => setMobilePanel('none')} 
            style={{ pointerEvents: 'auto' }}
          />
        )}
      </div>

      {/* BARRA DE NAVEGAÇÃO INFERIOR EXCLUSIVA DO MOBILE */}
      {!isExportingPDF && (
        <div className="md:hidden flex bg-white border-t border-slate-200 z-50 shrink-0 relative shadow-[0_-5px_20px_rgba(0,0,0,0.1)] pb-4">
          <button 
            onClick={() => setMobilePanel(p => p === 'settings' ? 'none' : 'settings')} 
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${mobilePanel === 'settings' ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Settings size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Ajustes da Box</span>
          </button>
          <div className="w-px bg-slate-200 my-2"></div>
          <button 
            onClick={() => setMobilePanel(p => p === 'bom' ? 'none' : 'bom')} 
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${mobilePanel === 'bom' ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Layers size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Materiais ({bom.reduce((acc, item) => acc + item.qty, 0)})</span>
          </button>
        </div>
      )}

    </div>
  );
}