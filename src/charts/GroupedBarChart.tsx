import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color } from '@/theme/tokens';
import { font } from '@/theme/type';
import { roundedTopRect, scaleToMax } from './geometry';
import { useChartWidth } from './useChartWidth';

export type GroupedSeries = { tint: string; values: number[] };

/**
 * "NET TREND" on the compare screen: one cluster per month, one bar per business,
 * 3px between bars in a cluster and 12px between clusters.
 */
export function GroupedBarChart({
  labels,
  series,
  height = 73,
  groupGap = 12,
  barGap = 3,
  activeIndex = labels.length - 1,
}: {
  labels: string[];
  series: GroupedSeries[];
  height?: number;
  groupGap?: number;
  barGap?: number;
  activeIndex?: number;
}) {
  const [width, onLayout] = useChartWidth();

  // One shared scale across every series so clusters stay comparable.
  const flat = series.flatMap((s) => s.values);
  const scaled = scaleToMax(flat, height);
  const heightAt = (seriesIndex: number, groupIndex: number) =>
    scaled[seriesIndex * labels.length + groupIndex] ?? 0;

  const groupCount = labels.length || 1;
  const groupWidth = (width - groupGap * (groupCount - 1)) / groupCount;
  const barCount = series.length || 1;
  const barWidth = (groupWidth - barGap * (barCount - 1)) / barCount;

  return (
    <View onLayout={onLayout}>
      {width > 0 && barWidth > 0 ? (
        <Svg width={width} height={height}>
          {labels.map((_, g) =>
            series.map((s, si) => {
              const h = heightAt(si, g);
              const x = g * (groupWidth + groupGap) + si * (barWidth + barGap);
              return (
                <Path
                  key={`g${g}-s${si}`}
                  d={roundedTopRect(x, height - h, barWidth, h, 4)}
                  fill={s.tint}
                />
              );
            }),
          )}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}

      <View style={[styles.labels, { gap: groupGap }]}>
        {labels.map((label, i) => (
          <Text
            key={`${label}-${i}`}
            style={[styles.label, i === activeIndex && styles.labelActive]}
            numberOfLines={1}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { marginTop: 7, flexDirection: 'row' },
  label: { flex: 1, textAlign: 'center', fontFamily: font.sans, fontSize: 10, color: color.muted },
  labelActive: { fontFamily: font.sansSemi, color: color.ink },
});
