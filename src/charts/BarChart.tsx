import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { alpha, color } from '@/theme/tokens';
import { font } from '@/theme/type';
import { roundedTopRect, scaleToMax } from './geometry';
import { useChartWidth } from './useChartWidth';

export type BarDatum = { label: string; value: number };

/**
 * "NET · LAST 6 MONTHS" on the P&L screen. Bars sit on a shared baseline at 25%
 * green, with the current month filled solid and its label in ink.
 */
export function BarChart({
  data,
  height = 78,
  gap = 9,
  activeIndex = data.length - 1,
}: {
  data: BarDatum[];
  height?: number;
  gap?: number;
  activeIndex?: number;
}) {
  const [width, onLayout] = useChartWidth();
  const heights = scaleToMax(data.map((d) => d.value), height);
  const barWidth = data.length ? (width - gap * (data.length - 1)) / data.length : 0;

  return (
    <View onLayout={onLayout}>
      {width > 0 && barWidth > 0 ? (
        <Svg width={width} height={height}>
          {data.map((d, i) => {
            const h = heights[i];
            const x = i * (barWidth + gap);
            return (
              <Path
                key={`${d.label}-${i}`}
                d={roundedTopRect(x, height - h, barWidth, h, 6)}
                fill={i === activeIndex ? color.green : alpha.greenFill25}
              />
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}

      <View style={[styles.labels, { gap }]}>
        {data.map((d, i) => (
          <Text
            key={`${d.label}-label-${i}`}
            style={[styles.label, i === activeIndex && styles.labelActive]}
            numberOfLines={1}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { marginTop: 6, flexDirection: 'row' },
  label: { flex: 1, textAlign: 'center', fontFamily: font.sans, fontSize: 10, color: color.muted },
  labelActive: { fontFamily: font.sansSemi, color: color.ink },
});
