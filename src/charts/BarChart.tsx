import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { alpha, color } from '@/theme/tokens';
import { font } from '@/theme/type';
import { roundedTopRect, scaleToMax } from './geometry';
import { useChartWidth } from './useChartWidth';

export type BarDatum = { label: string; value: number };

/** Below this a bar would be too thin to read, so the chart scrolls instead. */
const MIN_BAR_WIDTH = 22;

/**
 * "NET · LAST 6 MONTHS" on the P&L screen. Bars sit on a shared baseline at 25%
 * green, with the current month filled solid and its label in ink.
 *
 * A long history does not get squeezed: once the bars would fall under
 * MIN_BAR_WIDTH the chart becomes horizontally scrollable, opening at the most
 * recent month, rather than shrinking every label to an ellipsis.
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
  const fitted = data.length ? (width - gap * (data.length - 1)) / data.length : 0;
  const scrolls = fitted > 0 && fitted < MIN_BAR_WIDTH;
  const barWidth = scrolls ? MIN_BAR_WIDTH : fitted;
  const contentWidth = data.length
    ? barWidth * data.length + gap * (data.length - 1)
    : 0;

  const chart = (
    <View style={scrolls ? { width: contentWidth } : undefined}>
      {width > 0 && barWidth > 0 ? (
        <Svg width={contentWidth} height={height}>
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
            style={[
              styles.label,
              scrolls ? { width: barWidth } : styles.labelFlex,
              i === activeIndex && styles.labelActive,
            ]}
            numberOfLines={1}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );

  return (
    <View onLayout={onLayout}>
      {scrolls ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Open on the newest month, which is the one people look for first.
          contentOffset={{ x: Math.max(0, contentWidth - width), y: 0 }}
        >
          {chart}
        </ScrollView>
      ) : (
        chart
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { marginTop: 6, flexDirection: 'row' },
  label: { textAlign: 'center', fontFamily: font.sans, fontSize: 10, color: color.muted },
  labelFlex: { flex: 1 },
  labelActive: { fontFamily: font.sansSemi, color: color.ink },
});
