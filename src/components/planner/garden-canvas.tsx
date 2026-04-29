"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Stage, Layer, Rect, Group, Text, Circle, Line } from "react-konva";
import { motion } from "framer-motion";
import { useAppStore } from "@/stores/app-store";
import { mockPlants } from "@/data/plants";
import { saveGardenCells, getGardenCellsForUser } from "@/lib/db";
import type { GardenCell } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { X, Move, ZoomIn, ZoomOut } from "lucide-react";

const GRID_SIZE = 60;
const COLS = 12;
const ROWS = 10;
const CANVAS_WIDTH = GRID_SIZE * COLS;
const CANVAS_HEIGHT = GRID_SIZE * ROWS;

interface PlacedPlant {
  id: string;
  x: number;
  y: number;
  plantId: string;
  name: string;
  emoji: string;
}

export default function GardenCanvas() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
  const [draggingPlant, setDraggingPlant] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<"select" | "plant">("select");
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    async function load() {
      const cells = await getGardenCellsForUser(currentUserId ?? "");
      if (cells.length > 0) {
        setPlacedPlants(
          cells
            .filter((c) => c.plantId)
            .map((c) => ({
              id: c.id,
              x: c.x,
              y: c.y,
          plantId: c.plantId!,
          name: c.plantName!,
          emoji: c.plantEmoji!,
            }))
        );
      }
    }
    load();
  }, [currentUserId]);

  const persistCells = useCallback(async (plants: PlacedPlant[]) => {
    const cells: GardenCell[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const plant = plants.find(
          (p) => p.x === col * GRID_SIZE && p.y === row * GRID_SIZE
        );
        if (plant) {
          cells.push({
            id: plant.id,
            userId: currentUserId ?? "",
            x: plant.x,
            y: plant.y,
            plantId: plant.plantId,
            plantName: plant.name,
            plantEmoji: plant.emoji,
            placedAt: new Date().toISOString(),
          });
        } else {
          cells.push({
            id: `cell-${col}-${row}`,
            userId: currentUserId ?? "",
            x: col * GRID_SIZE,
            y: row * GRID_SIZE,
            plantId: null,
            plantName: null,
            plantEmoji: null,
            placedAt: null,
          });
        }
      }
    }
    await saveGardenCells(cells, currentUserId ?? undefined);
  }, [currentUserId]);

  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  const handleDrop = (konvaEvent: any) => {
    if (tool !== "plant" || !selectedPlantId) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const x = snapToGrid(pointer.x / scale - position.x / scale);
    const y = snapToGrid(pointer.y / scale - position.y / scale);

    if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return;

    const existing = placedPlants.find(
      (p) => p.x === x && p.y === y
    );
    if (existing) return;

    const plant = mockPlants.find((p) => p.id === selectedPlantId);
    if (!plant) return;

    const newPlant: PlacedPlant = {
      id: generateId(),
      x,
      y,
      plantId: plant.id,
      name: plant.name,
      emoji: plant.emoji,
    };

    const updated = [...placedPlants, newPlant];
    setPlacedPlants(updated);
    persistCells(updated);
  };

  const handleDragEnd = (plantId: string, konvaEvent: any) => {
    const x = snapToGrid(konvaEvent.target.x());
    const y = snapToGrid(konvaEvent.target.y());

    if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) {
      // Remove if dragged outside
      const updated = placedPlants.filter((p) => p.id !== plantId);
      setPlacedPlants(updated);
      persistCells(updated);
      return;
    }

    const updated = placedPlants.map((p) =>
      p.id === plantId ? { ...p, x, y } : p
    );
    setPlacedPlants(updated);
    persistCells(updated);
  };

  const handleRemovePlant = (plantId: string) => {
    const updated = placedPlants.filter((p) => p.id !== plantId);
    setPlacedPlants(updated);
    persistCells(updated);
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const oldScale = scale;
    const pointer = stage?.getPointerPosition();
    const mousePointTo = {
      x: (pointer?.x ?? 0) / oldScale - position.x,
      y: (pointer?.y ?? 0) / oldScale - position.y,
    };

    const newScale = Math.min(
      Math.max(oldScale - e.evt.deltaY * 0.001, 0.3),
      3
    );
    const newPos = {
      x: (pointer?.x ?? 0) / newScale - mousePointTo.x,
      y: (pointer?.y ?? 0) / newScale - mousePointTo.y,
    };

    setScale(newScale);
    setPosition(newPos);
  };

  const handleStageMouseDown = () => {
    if (tool === "select") {
      isPanning.current = true;
      const stage = stageRef.current;
      if (stage) {
        lastPos.current = stage.getPointerPosition() ?? { x: 0, y: 0 };
      }
    }
  };

  const handleStageMouseMove = () => {
    if (!isPanning.current || tool !== "select") return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const dx = pos.x - lastPos.current.x;
    const dy = pos.y - lastPos.current.y;

    setPosition((prev) => ({
      x: prev.x + dx / scale,
      y: prev.y + dy / scale,
    }));
    lastPos.current = pos;
  };

  const handleStageMouseUp = () => {
    isPanning.current = false;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-outline-variant/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTool("select")}
            className={`rounded-lg p-1.5 text-xs transition-colors ${
              tool === "select"
                ? "bg-[var(--theme-primary)]/20 text-[var(--theme-primary)]"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <Move size={16} />
          </button>
          {tool === "plant" && (
            <span className="ml-1 text-[10px] font-semibold text-[var(--theme-primary)]">
              Click canvas to place
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.min(s + 0.2, 3))}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <ZoomIn size={14} />
          </button>
          <span className="text-[10px] text-on-surface-variant/60 tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.max(s - 0.2, 0.3))}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <ZoomOut size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Plant Palette Sidebar */}
        <div className="w-20 shrink-0 overflow-y-auto border-r border-outline-variant/40 p-2">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant/50">
            Plants
          </p>
          <div className="space-y-1.5">
            {mockPlants.slice(0, 20).map((plant) => (
              <button
                key={plant.id}
                onClick={() => {
                  setTool("plant");
                  setSelectedPlantId(plant.id);
                }}
                className={`flex w-full flex-col items-center rounded-xl p-1.5 text-center transition-all ${
                  selectedPlantId === plant.id
                    ? "bg-[var(--theme-primary)]/20 ring-1 ring-[var(--theme-primary)]"
                    : "hover:bg-surface-container-high"
                }`}
              >
                <span className="text-lg">{plant.emoji}</span>
                <span className="mt-0.5 truncate text-[7px] text-on-surface-variant/70 leading-tight">
                  {plant.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden" ref={containerRef}>
          <Stage
            ref={stageRef}
            width={containerRef.current?.clientWidth ?? 800}
            height={containerRef.current?.clientHeight ?? 500}
            scaleX={scale}
            scaleY={scale}
            x={position.x}
            y={position.y}
            onWheel={handleWheel}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onClick={handleDrop}
            style={{ cursor: tool === "select" ? "grab" : "crosshair" }}
          >
            <Layer>
              {/* Grid */}
              {Array.from({ length: ROWS }, (_, row) =>
                Array.from({ length: COLS }, (_, col) => (
                  <Rect
                    key={`grid-${col}-${row}`}
                    x={col * GRID_SIZE}
                    y={row * GRID_SIZE}
                    width={GRID_SIZE}
                    height={GRID_SIZE}
                    fill={
                      (row + col) % 2 === 0
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(255,255,255,0.04)"
                    }
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={0.5}
                  />
                ))
              )}

              {/* Grid Labels */}
              {Array.from({ length: COLS }, (_, col) => (
                <Text
                  key={`col-label-${col}`}
                  x={col * GRID_SIZE + 2}
                  y={2}
                  text={`${col + 1}`}
                  fontSize={8}
                  fill="rgba(255,255,255,0.15)"
                  fontFamily="Inter"
                />
              ))}
              {Array.from({ length: ROWS }, (_, row) => (
                <Text
                  key={`row-label-${row}`}
                  x={2}
                  y={row * GRID_SIZE + 2}
                  text={String.fromCharCode(65 + row)}
                  fontSize={8}
                  fill="rgba(255,255,255,0.15)"
                  fontFamily="Inter"
                />
              ))}

              {/* Placed Plants */}
              {placedPlants.map((plant) => (
                <Group
                  key={plant.id}
                  x={plant.x}
                  y={plant.y}
                  draggable
                  onDragStart={() => setDraggingPlant(plant.id)}
                  onDragEnd={(e) => handleDragEnd(plant.id, e)}
                  onDblClick={() => handleRemovePlant(plant.id)}
                >
                  <Rect
                    width={GRID_SIZE}
                    height={GRID_SIZE}
                    fill="rgba(87, 241, 219, 0.08)"
                    cornerRadius={4}
                    stroke="rgba(87, 241, 219, 0.3)"
                    strokeWidth={1}
                  />
                  <Text
                    x={GRID_SIZE / 2}
                    y={GRID_SIZE / 2 - 6}
                    text={plant.emoji}
                    fontSize={22}
                    align="center"
                    verticalAlign="middle"
                    offsetX={11}
                  />
                  <Text
                    x={2}
                    y={GRID_SIZE - 16}
                    text={plant.name.substring(0, 6)}
                    fontSize={7}
                    fill="rgba(255,255,255,0.5)"
                    fontFamily="Inter"
                    wrap="none"
                  />
                </Group>
              ))}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}
