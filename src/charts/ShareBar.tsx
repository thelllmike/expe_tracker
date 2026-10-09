import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Rect, Defs, ClipPath, Path } from 'react-native-svg';
import { color } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font } from '@/theme/type';
import { useChartWidth } from './useChartWidth';

export type ShareSlice = { label: string; value: number; tint: string };

/**
 * "SHARE OF NET PROFIT" on the compare screen — a single 14px fully-rounded bar
 * split proportionally, with a square-swatch legend beneath.
 *
 * Note: the build brief called this a donut; the design export draws a stacked
 * bar, and the design is the spec here.
 */
export function ShareBar({ slices, height = 14 }: { slices: ShareSlice[]; height?: number }) {
  const [width, onLayout] = useChartWidth();
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  // Lay segments end to end, absorbing rounding into the final one so the bar
  // always fills its track exactly.
  const segments = useMemo(() => {
    const out: { x: number; width: number; tint: string }[] = [];
    let cursor = 0;
    slices.forEach((slice, i) => {
      const share = total > 0 ? Math.max(0, slice.value) / total : 1 / slices.length;
      const w = i === slices.length - 1 ? width - cursor : share * width;
      out.push({ x: cursor, width: Math.max(0, w), tint: slice.tint });
      cursor += w;
    });
    return out;
  }, [slices, total, width]);

  return (
    <View>
      <View onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <ClipPath id="shareRound">
                <Rect x={0} y={0} width={width} height={height} rx={height / 2} ry={height / 2} />
              </ClipPath>
            </Defs>
            <Path
              d={`M0 0 H${width} V${height} H0 Z`}
              fill={color.line}
              clipPath="url(#shareRound)"
            />
            {segments.map((seg, i) => (
              <Rect
                key={i}
                x={seg.x}
                y={0}
                width={seg.width}
                height={height}
                fill={seg.tint}
                clipPath="url(#shareRound)"
              />
            ))}
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>

      <View style={styles.legend}>
        {slices.map((s, i) => (
          <View key={`${s.label}-${i}`} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.tint }]} />
            <Text style={styles.legendText}>
              {total > 0 ? `${Math.round((Math.max(0, s.value) / total) * 100)}%` : '—'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  legend: { marginTop: 10, flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontFamily: font.sans, fontSize: 11.5, color: color.muted },
}));

