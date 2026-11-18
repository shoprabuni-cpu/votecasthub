'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import './LineSidebar.css';

const FALLOFF_CURVES = {
  linear: p => p,
  smooth: p => p * p * (3 - 2 * p),
  sharp: p => p * p * p
};

const DEFAULT_ITEMS = [
  'Overview',
  'Components',
  'Animations',
  'Backgrounds',
  'Showcase',
  'Playground',
  'Templates',
  'Changelog',
  'Community',
  'Resources',
  'Documentation',
  'Support'
];

export const LineSidebar = ({
  items = DEFAULT_ITEMS,
  accentColor,
  textColor,
  markerColor,
  showIndex = false,
  showMarker = true,
  proximityRadius = 100,
  maxShift = 16,
  falloff = 'smooth',
  markerLength = 36,
  markerGap = 8,
  tickScale = 0.4,
  scaleTick = true,
  itemGap = 12,
  fontSize = 0.875,
  smoothing = 90,
  defaultActive = null,
  activeId,
  onItemClick,
  className = ''
}) => {
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const targetsRef = useRef([]);
  const currentRef = useRef([]);
  const rafRef = useRef(null);
  const lastRef = useRef(0);

  const computedActiveIndex = () => {
    if (activeId !== undefined) {
      const idx = items.findIndex((it, i) => {
        if (typeof it === 'string') return it === activeId;
        return it.id === activeId || (it.href && it.href === activeId);
      });
      if (idx !== -1) return idx;
    }
    const explicitActiveIdx = items.findIndex(it => typeof it !== 'string' && it?.isActive);
    if (explicitActiveIdx !== -1) return explicitActiveIdx;
    return defaultActive;
  };

  const [activeIndex, setActiveIndex] = useState(computedActiveIndex);
  const activeRef = useRef(activeIndex);
  const smoothingRef = useRef(smoothing);

  useEffect(() => {
    const nextIdx = computedActiveIndex();
    setActiveIndex(nextIdx);
    activeRef.current = nextIdx;
  }, [activeId, defaultActive, items]);

  activeRef.current = activeIndex;
  smoothingRef.current = smoothing;

  const runFrame = useCallback(now => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const tau = Math.max(smoothingRef.current, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);

    let moving = false;
    const currentItems = itemRefs.current;
    for (let i = 0; i < currentItems.length; i++) {
      const el = currentItems[i];
      if (!el) continue;
      const isItemActive = activeRef.current === i;
      const target = Math.max(targetsRef.current[i] || 0, isItemActive ? 1 : 0);
      const cur = currentRef.current[i] || 0;
      const next = cur + (target - cur) * k;
      const settled = Math.abs(target - next) < 0.0015;
      const value = settled ? target : next;
      currentRef.current[i] = value;
      el.style.setProperty('--effect', value.toFixed(4));
      if (!settled) moving = true;
    }

    rafRef.current = moving ? requestAnimationFrame(runFrame) : null;
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const handlePointerMove = useCallback(
    e => {
      const list = listRef.current;
      if (!list) return;
      const rect = list.getBoundingClientRect();
      const pointerY = e.clientY - rect.top;
      const ease = FALLOFF_CURVES[falloff] ?? FALLOFF_CURVES.linear;
      const currentItems = itemRefs.current;
      for (let i = 0; i < currentItems.length; i++) {
        const el = currentItems[i];
        if (!el) continue;
        const center = el.offsetTop + el.offsetHeight / 2;
        const distance = Math.abs(pointerY - center);
        targetsRef.current[i] = ease(Math.max(0, 1 - distance / proximityRadius));
      }
      startLoop();
    },
    [falloff, proximityRadius, startLoop]
  );

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = targetsRef.current.map(() => 0);
    startLoop();
  }, [startLoop]);

  const handleItemSelect = useCallback(
    (index, labelStr, itemObj) => {
      setActiveIndex(index);
      if (itemObj?.onClick) {
        itemObj.onClick();
      }
      onItemClick?.(index, labelStr);
    },
    [onItemClick]
  );

  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % items.length;
      itemRefs.current[next]?.focus();
      const nextItem = items[next];
      handleItemSelect(next, typeof nextItem === 'string' ? nextItem : String(nextItem.id || next), typeof nextItem === 'string' ? undefined : nextItem);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (index - 1 + items.length) % items.length;
      itemRefs.current[prev]?.focus();
      const prevItem = items[prev];
      handleItemSelect(prev, typeof prevItem === 'string' ? prevItem : String(prevItem.id || prev), typeof prevItem === 'string' ? undefined : prevItem);
    }
  };

  useEffect(() => {
    startLoop();
  }, [activeIndex, startLoop]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    },
    []
  );

  const styleObj = {
    '--marker-length': `${markerLength}px`,
    '--marker-gap': `${markerGap}px`,
    '--tick-scale': tickScale,
    '--max-shift': `${maxShift}px`,
    '--item-gap': `${itemGap}px`,
    '--font-size': `${fontSize}rem`,
    '--smoothing': `${smoothing}ms`,
    ...(accentColor ? { '--accent-color': accentColor } : {}),
    ...(textColor ? { '--text-color': textColor } : {}),
    ...(markerColor ? { '--marker-color': markerColor } : {})
  };

  return (
    <nav
      className={`line-sidebar${showMarker ? ' line-sidebar--markers' : ''}${scaleTick ? ' line-sidebar--scale-tick' : ''}${className ? ` ${className}` : ''}`}
      style={styleObj}
    >
      <ul
        ref={listRef}
        className="line-sidebar__list"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {items.map((item, index) => {
          const isString = typeof item === 'string';
          const label = isString ? item : item.label;
          const labelStr = isString ? item : typeof item.label === 'string' ? item.label : String(item.id || index);
          const href = !isString ? item.href : undefined;
          const icon = !isString ? item.icon : undefined;
          const badge = !isString ? item.badge : undefined;
          const isItemActive = activeIndex === index;

          const content = (
            <>
              {showIndex && (
                <span className="line-sidebar__index">{String(index + 1).padStart(2, '0')}</span>
              )}
              {icon && <span className="line-sidebar__icon">{icon}</span>}
              <span className="line-sidebar__text">{label}</span>
              {badge && <span className="line-sidebar__badge">{badge}</span>}
            </>
          );

          return (
            <li
              key={isString ? `${item}-${index}` : item.id || item.href || index}
              ref={el => {
                itemRefs.current[index] = el;
              }}
              className="line-sidebar__item"
              aria-current={isItemActive ? 'page' : undefined}
              tabIndex={0}
              onKeyDown={e => handleKeyDown(e, index)}
              onClick={() => handleItemSelect(index, labelStr, isString ? undefined : item)}
            >
              {showMarker && <span className="line-sidebar__marker" aria-hidden="true" />}
              {item && typeof item === 'object' && item.render ? (
                item.render({
                  isActive: isItemActive,
                  className: 'line-sidebar__interactive',
                  children: content
                })
              ) : href ? (
                <Link
                  href={href}
                  className="line-sidebar__interactive"
                  aria-current={isItemActive ? 'page' : undefined}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  className="line-sidebar__interactive"
                  aria-current={isItemActive ? 'page' : undefined}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default LineSidebar;
