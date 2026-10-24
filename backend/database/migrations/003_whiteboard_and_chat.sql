-- ============================================================================
-- MIGRATION 003: COLLABORATIVE WHITEBOARD & IN-MEETING CHAT
-- ============================================================================

-- 1. Meeting Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);

-- 2. Collaborative Whiteboard Drawing Strokes (Vector/Path Persistence)
CREATE TABLE IF NOT EXISTS whiteboard_strokes (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    stroke_id VARCHAR(64) NOT NULL UNIQUE,
    tool VARCHAR(20) NOT NULL DEFAULT 'pen' CHECK (tool IN ('pen', 'eraser', 'line', 'rectangle', 'text')),
    color VARCHAR(30) NOT NULL DEFAULT '#0f172a',
    stroke_width INT NOT NULL DEFAULT 3,
    points JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_whiteboard_session ON whiteboard_strokes(session_id);
CREATE INDEX IF NOT EXISTS idx_whiteboard_created ON whiteboard_strokes(created_at);

-- 3. Whiteboard Snapshots / Clears
CREATE TABLE IF NOT EXISTS whiteboard_snapshots (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    cleared_by INT DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
    snapshot_data JSONB DEFAULT NULL,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_whiteboard_snapshots ON whiteboard_snapshots(session_id);
