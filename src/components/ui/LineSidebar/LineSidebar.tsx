'use client';

import { useRef, useState, useCallback, useEffect, type CSSProperties, type ReactNode, type KeyboardEvent } from 'react';
import Link from 'next/link';
import './LineSidebar.css';

export type Falloff = 'linear' | 'smooth' | 'sharp';

export interface LineSidebarItem {
  id?: string;
  label: ReactNode;
  href?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  render?: (props: { isActive: boolean; className: string; children: ReactNode }) => ReactNode;
}

export interface LineSidebarProps {
  items?: (string | LineSidebarItem)[];
  accentColor?: string;
  textColor?: string;
  markerColor?: string;
  showIndex?: boolean;
  showMarker?: boolean;
  proximityRadius?: number;
  maxShift?: number;
  falloff?: Falloff;
  markerLength?: number;
  markerGap?: number;
  tickScale?: number;
  scaleTick?: boolean;
  itemGap?: number;
  fontSize?: number;
  smoothing?: number;
  defaultActive?: number | null;
  activeId?: string;
  onItemClick?: (index: number, label: string) => void;
  className?: string;
}

const FALLOFF_CURVES: Record<Falloff, (p: number) => number> = {
  linear: (p: number) => p,
  smooth: (p: number) => p * p * (3 - 2 * p),
  sharp: (p: number) => p * p * p
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
}: LineSidebarProps) => {
  const listRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const targetsRef = useRef<number[]>([]);
  const currentRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  // Compute active index from activeId, defaultActive, or item.isActive
  const computedActiveIndex = () => {
    if (activeId !== undefined) {
      const idx = items.findIndex((it, i) => {
        if (typeof it === 'string') return it === activeId;
        return it.id === activeId || (it.href && it.href === activeId);
      });
      if (idx !== -1) return idx;
    }
    const explicitActiveIdx = items.findIndex(it => typeof it !== 'string' && it.isActive);
    if (explicitActiveIdx !== -1) return explicitActiveIdx;
    return defaultActive;
  };

  const [activeIndex, setActiveIndex] = useState<number | null>(computedActiveIndex);
  const activeRef = useRef<number | null>(activeIndex);
  const smoothingRef = useRef(smoothing);

  useEffect(() => {
    const nextIdx = computedActiveIndex();
    setActiveIndex(nextIdx);
    activeRef.current = nextIdx;
  }, [activeId, defaultActive, items]);

  activeRef.current = activeIndex;
  smoothingRef.current = smoothing;

  // Frame-rate independent exponential smoothing
  const runFrame = useCallback((now: number) => {
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
    (e: React.PointerEvent<HTMLUListElement>) => {
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
    (index: number, labelStr: string, itemObj?: LineSidebarItem) => {
      setActiveIndex(index);
      if (itemObj?.onClick) {
        itemObj.onClick();
      }
      onItemClick?.(index, labelStr);
    },
    [onItemClick]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLLIElement>, index: number) => {
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

  const styleObj: CSSProperties = {
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
  } as CSSProperties;

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
