import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * A hook that enables drag-to-scroll functionality for a DOM element.
 * Useful for creating a "touch-like" scrolling experience on desktop.
 */
export const useDragScroll = () => {
  const ref = useRef<HTMLElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const startPos = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (!ref.current) return;
    
    // Ignore if clicking on interactive elements like buttons, inputs, links
    const target = e.target as HTMLElement;
    if (['BUTTON', 'INPUT', 'A', 'SELECT', 'TEXTAREA'].includes(target.tagName) || 
        target.closest('button') || 
        target.closest('a') ||
        target.closest('[role="button"]')) {
      return;
    }

    setHasMoved(false);
    setIsDragging(true);
    startPos.current = {
      x: e.pageX,
      y: e.pageY,
      scrollLeft: ref.current.scrollLeft,
      scrollTop: ref.current.scrollTop,
    };
    
    ref.current.style.userSelect = 'none';
  }, []);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    if (ref.current) {
      ref.current.style.cursor = 'initial';
      ref.current.style.userSelect = 'auto';
    }
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !ref.current) return;

    const x = e.pageX;
    const y = e.pageY;
    
    const dx = x - startPos.current.x;
    const dy = y - startPos.current.y;

    // Movement threshold (5px) to distinguish click from drag
    if (!hasMoved && Math.abs(dx) < 5 && Math.abs(dy) < 5) {
      return;
    }

    if (!hasMoved) {
      setHasMoved(true);
      ref.current.style.cursor = 'grabbing';
    }

    e.preventDefault();
    
    ref.current.scrollLeft = startPos.current.scrollLeft - dx * 1.5;
    ref.current.scrollTop = startPos.current.scrollTop - dy * 1.5;
  }, [isDragging, hasMoved]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [onMouseDown, onMouseUp, onMouseMove]);

  return ref;
};
