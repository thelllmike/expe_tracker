import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * SVG needs a pixel width, but the layouts are fluid. Measure the container
 * instead of assuming the design's 390px frame.
 */
export function useChartWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setWidth((prev) => (Math.abs(prev - next) > 0.5 ? next : prev));
  }, []);
  return [width, onLayout];
}
