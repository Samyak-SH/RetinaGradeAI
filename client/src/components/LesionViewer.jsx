import { useMemo, useRef, useState } from 'react';

const MAG_SIZE = 190;

/**
 * Renders the lesion image with normalised bounding boxes on top, and a circular
 * magnifier that follows the cursor so the doctor can inspect a lesion closely
 * without leaving the report.
 */
export default function LesionViewer({ src, lesions, colorFor, zoom = 3, focusedIndex, onFocusChange }) {
  const wrapRef = useRef(null);
  const [mag, setMag] = useState(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [magOn, setMagOn] = useState(true);
  const [hidden, setHidden] = useState(() => new Set());

  const labels = useMemo(() => [...new Set(lesions.map((l) => l.label))], [lesions]);

  const focusedLesion = focusedIndex == null ? null : lesions[focusedIndex];

  // A scan can carry a few hundred lesions, so classes can be switched off to
  // read a single lesion type against the fundus.
  const visible = useMemo(
    () => lesions.map((l, i) => ({ lesion: l, index: i })).filter((e) => !hidden.has(e.lesion.label)),
    [lesions, hidden]
  );

  function toggleLabel(label) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  function handleMove(e) {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMag({
      x,
      y,
      // The background is the same image scaled up; shifting it by the cursor
      // position keeps the point under the cursor centred in the lens.
      bgSize: `${rect.width * zoom}px ${rect.height * zoom}px`,
      bgPos: `${-(x * zoom - MAG_SIZE / 2)}px ${-(y * zoom - MAG_SIZE / 2)}px`,
    });

    if (!onFocusChange) return;
    const nx = x / rect.width;
    const ny = y / rect.height;

    // Boxes overlap heavily, so the smallest one under the cursor is the most
    // specific thing the doctor is pointing at.
    let best = null;
    let bestArea = Infinity;
    for (const { lesion, index } of visible) {
      const { x: bx, y: by, w, h } = lesion.bbox;
      if (nx >= bx && nx <= bx + w && ny >= by && ny <= by + h && w * h < bestArea) {
        best = index;
        bestArea = w * h;
      }
    }
    onFocusChange(best);
  }

  function handleLeave() {
    setMag(null);
    onFocusChange?.(null);
  }

  return (
    <div>
      <div className="viewer-toolbar">
        <label className="toggle">
          <input type="checkbox" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} />
          Lesion boxes
        </label>
        <label className="toggle">
          <input type="checkbox" checked={magOn} onChange={(e) => setMagOn(e.target.checked)} />
          Hover magnifier ({zoom}×)
        </label>
      </div>

      {showBoxes && labels.length > 0 && (
        <div className="viewer-toolbar">
          {labels.map((label) => (
            <button
              key={label}
              type="button"
              className={`pill toggle-pill${hidden.has(label) ? ' off' : ''}`}
              onClick={() => toggleLabel(label)}
            >
              <span className="legend-dot" style={{ background: colorFor(label) }} />
              {label}
            </button>
          ))}
        </div>
      )}

      <div
        className="viewer"
        ref={wrapRef}
        onMouseMove={magOn || onFocusChange ? handleMove : undefined}
        onMouseLeave={handleLeave}
      >
        <img src={src} alt="Lesion scan" draggable={false} />

        {showBoxes &&
          visible.map(({ lesion, index }) => {
            const focused = focusedIndex === index;
            return (
              <div
                key={index}
                className={`lesion-box${focused ? ' focused' : ''}`}
                style={{
                  left: `${lesion.bbox.x * 100}%`,
                  top: `${lesion.bbox.y * 100}%`,
                  width: `${lesion.bbox.w * 100}%`,
                  height: `${lesion.bbox.h * 100}%`,
                  ...(focused ? {} : { borderColor: colorFor(lesion.label) }),
                }}
              >
                {/* A label on every box is unreadable at a few hundred lesions,
                    so only the one under the cursor is named. */}
                {focused && (
                  <span className="tag">
                    {index + 1} · {lesion.label} · {(lesion.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            );
          })}

        {magOn && mag && (
          <div
            className="magnifier"
            style={{
              width: MAG_SIZE,
              height: MAG_SIZE,
              left: mag.x - MAG_SIZE / 2,
              top: mag.y - MAG_SIZE / 2,
              backgroundImage: `url(${src})`,
              backgroundSize: mag.bgSize,
              backgroundPosition: mag.bgPos,
            }}
          />
        )}
      </div>

      {/* The lens sits on top of the focused box, so the label is repeated here
          where it stays readable. */}
      {focusedLesion ? (
        <p className="focus-caption">
          <span className="legend-dot" style={{ background: colorFor(focusedLesion.label) }} />
          <strong>#{focusedIndex + 1} {focusedLesion.label}</strong>
          <span className="muted">
            {focusedLesion.region} · {(focusedLesion.confidence * 100).toFixed(0)}% confidence ·{' '}
            {focusedLesion.areaPx} px
          </span>
        </p>
      ) : (
        <p className="magnifier-hint">
          Move the cursor over the image for a {zoom}× view. Hovering a marked region names that lesion
          and highlights its row in the table.
        </p>
      )}
    </div>
  );
}
