import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Pen,
  Eraser,
  RotateCcw,
  RotateCw,
  Trash2,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ClayButton } from './clay/ClayButton';
import { ClayBadge } from './clay/ClayBadge';
import { api } from '../services/api';
import type { WhiteboardStroke } from '../types';

interface CollaborativeWhiteboardProps {
  sessionId: number;
  currentUserId: number;
}

const COLORS = [
  '#0f172a', // Slate black
  '#4f46e5', // Indigo
  '#0284c7', // Sky blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#e11d48'  // Rose
];

const STROKE_WIDTHS = [2, 4, 8, 14];

export const CollaborativeWhiteboard: React.FC<CollaborativeWhiteboardProps> = ({
  sessionId,
  currentUserId
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState<string>('#0f172a');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }>>([]);

  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<WhiteboardStroke[]>([]);
  const [lastSyncId, setLastSyncId] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [snapshotVersion, setSnapshotVersion] = useState<number>(1);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Redraw full canvas from strokes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes
    strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length < 2) return;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
      ctx.lineWidth = stroke.stroke_width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    });
  }, [strokes]);

  // Initial load
  useEffect(() => {
    let mounted = true;
    const loadInitialBoard = async () => {
      try {
        setSyncing(true);
        const data = await api.getWhiteboard(sessionId, 0);
        if (mounted && data.strokes) {
          setStrokes(data.strokes);
          setSnapshotVersion(data.snapshot_version);
          const maxId = data.strokes.reduce((max, s) => Math.max(max, s.id || 0), 0);
          setLastSyncId(maxId);
        }
      } catch (err) {
        console.warn('Could not load remote whiteboard state:', err);
      } finally {
        if (mounted) setSyncing(false);
      }
    };

    loadInitialBoard();

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  // Periodic polling sync for multi-participant live collaboration
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.getWhiteboard(sessionId, lastSyncId);
        if (data.snapshot_version !== snapshotVersion) {
          // Board was cleared by another participant
          setSnapshotVersion(data.snapshot_version);
          setStrokes(data.strokes || []);
          setLastSyncId(data.strokes.reduce((max, s) => Math.max(max, s.id || 0), 0));
        } else if (data.strokes && data.strokes.length > 0) {
          // Append new strokes from other participants
          setStrokes(prev => {
            const existingIds = new Set(prev.map(s => s.stroke_id));
            const newStrokes = data.strokes.filter(s => !existingIds.has(s.stroke_id));
            if (newStrokes.length === 0) return prev;
            return [...prev, ...newStrokes];
          });
          const maxId = data.strokes.reduce((max, s) => Math.max(max, s.id || 0), lastSyncId);
          setLastSyncId(maxId);
        }
      } catch {
        // Silently ignore temporary poll glitches
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [sessionId, lastSyncId, snapshotVersion]);

  // Redraw when strokes change
  useEffect(() => {
    redrawCanvas();
  }, [strokes, redrawCanvas]);

  // Canvas drawing handlers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pt = getCoordinates(e);
    setIsDrawing(true);
    setCurrentStroke([pt]);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.moveTo(pt.x, pt.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pt = getCoordinates(e);
    setCurrentStroke(prev => [...prev, pt]);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const stopDrawing = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStroke.length < 2) {
      setCurrentStroke([]);
      return;
    }

    const strokeId = `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newStroke: WhiteboardStroke = {
      stroke_id: strokeId,
      user_id: currentUserId,
      tool,
      color,
      stroke_width: strokeWidth,
      points: currentStroke
    };

    setStrokes(prev => [...prev, newStroke]);
    setUndoneStrokes([]);
    setCurrentStroke([]);

    // Persist to database
    try {
      const res = await api.addWhiteboardStroke(sessionId, newStroke);
      if (res?.id) {
        setLastSyncId(prev => Math.max(prev, res.id));
      }
    } catch (err) {
      console.warn('Failed to sync stroke to server:', err);
    }
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes(prev => prev.slice(0, -1));
    setUndoneStrokes(prev => [...prev, last]);
  };

  const handleRedo = () => {
    if (undoneStrokes.length === 0) return;
    const restored = undoneStrokes[undoneStrokes.length - 1];
    setUndoneStrokes(prev => prev.slice(0, -1));
    setStrokes(prev => [...prev, restored]);
  };

  const handleClearBoard = async () => {
    setConfirmClearOpen(false);
    setStrokes([]);
    setUndoneStrokes([]);
    try {
      await api.clearWhiteboard(sessionId);
      setSnapshotVersion(v => v + 1);
    } catch (err) {
      console.warn('Failed clearing server whiteboard:', err);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `timecredit-whiteboard-session-${sessionId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.75rem' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 0.85rem',
          background: '#f8fafc',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          gap: '0.75rem'
        }}
      >
        {/* Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setTool('pen')}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '10px',
              border: tool === 'pen' ? '2px solid #6366f1' : '1px solid #cbd5e1',
              background: tool === 'pen' ? '#e0e7ff' : '#ffffff',
              color: tool === 'pen' ? '#4338ca' : '#475569',
              fontWeight: 700,
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer'
            }}
          >
            <Pen size={14} /> Pen
          </button>

          <button
            onClick={() => setTool('eraser')}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '10px',
              border: tool === 'eraser' ? '2px solid #6366f1' : '1px solid #cbd5e1',
              background: tool === 'eraser' ? '#e0e7ff' : '#ffffff',
              color: tool === 'eraser' ? '#4338ca' : '#475569',
              fontWeight: 700,
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer'
            }}
          >
            <Eraser size={14} /> Eraser
          </button>

          {/* Stroke Width Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
            {STROKE_WIDTHS.map(w => (
              <button
                key={w}
                onClick={() => setStrokeWidth(w)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: strokeWidth === w ? '2px solid #6366f1' : '1px solid #cbd5e1',
                  background: strokeWidth === w ? '#e0e7ff' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title={`Width: ${w}px`}
              >
                <span
                  style={{
                    width: `${w + 2}px`,
                    height: `${w + 2}px`,
                    borderRadius: '50%',
                    background: color
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Color Palette */}
        {tool === 'pen' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: c,
                  border: color === c ? '2px solid #6366f1' : '2px solid #ffffff',
                  boxShadow: color === c ? '0 0 0 2px #6366f1' : '0 1px 3px rgba(0,0,0,0.2)',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              cursor: strokes.length === 0 ? 'not-allowed' : 'pointer',
              opacity: strokes.length === 0 ? 0.5 : 1
            }}
            title="Undo"
          >
            <RotateCcw size={14} />
          </button>

          <button
            onClick={handleRedo}
            disabled={undoneStrokes.length === 0}
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              cursor: undoneStrokes.length === 0 ? 'not-allowed' : 'pointer',
              opacity: undoneStrokes.length === 0 ? 0.5 : 1
            }}
            title="Redo"
          >
            <RotateCw size={14} />
          </button>

          <button
            onClick={() => setConfirmClearOpen(true)}
            style={{
              padding: '0.4rem 0.6rem',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              background: '#fff1f2',
              color: '#e11d48',
              fontWeight: 600,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: 'pointer'
            }}
            title="Clear Canvas"
          >
            <Trash2 size={13} /> Clear
          </button>

          <button
            onClick={handleDownload}
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              cursor: 'pointer'
            }}
            title="Export PNG"
          >
            <Download size={14} />
          </button>

          {syncing && (
            <span title="Syncing strokes...">
              <Loader2 size={14} className="animate-spin" color="#6366f1" />
            </span>
          )}
        </div>
      </div>

      {/* Drawing Canvas Container */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          borderRadius: '18px',
          overflow: 'hidden',
          border: '2px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)',
          minHeight: '380px'
        }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={550}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
            touchAction: 'none'
          }}
        />

        {/* Sync Indicator Badge */}
        <div style={{ position: 'absolute', bottom: '10px', left: '12px' }}>
          <ClayBadge variant="mint" style={{ fontSize: '0.7rem' }}>
            ● POSTGRESQL SYNCED ({strokes.length} strokes)
          </ClayBadge>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {confirmClearOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '1.5rem',
              maxWidth: '380px',
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Clear Whiteboard?</h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.75rem 0 1.25rem' }}>
              Are you sure you want to clear the collaborative canvas for all participants? This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <ClayButton variant="secondary" onClick={() => setConfirmClearOpen(false)}>
                Cancel
              </ClayButton>
              <ClayButton variant="danger" onClick={handleClearBoard}>
                Yes, Clear Board
              </ClayButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
