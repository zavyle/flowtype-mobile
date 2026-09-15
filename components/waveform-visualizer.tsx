import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

interface WaveformVisualizerProps {
  isRecording: boolean;
  isPaused?: boolean;
  decibelLevel?: number; // 0 to 1 normalized
  barCount?: number;
  accentColor?: string;
}

export function WaveformVisualizer({
  isRecording,
  isPaused = false,
  decibelLevel = 0.5,
  barCount = 28,
  accentColor = "#6366F1",
}: WaveformVisualizerProps) {
  // Keep an array of animated values for each bar
  const animatedValues = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(0.2)),
  ).current;

  useEffect(() => {
    if (!isRecording || isPaused) {
      // Return to calm idle state
      animatedValues.forEach((val) => {
        Animated.timing(val, {
          toValue: 0.15,
          duration: 250,
          useNativeDriver: false,
        }).start();
      });
      return;
    }

    // Animate bars with staggered dynamic heights mimicking live audio spectrum
    const interval = setInterval(() => {
      animatedValues.forEach((val, i) => {
        // Center bars peak higher, edges lower
        const distanceCenter = Math.abs(i - barCount / 2) / (barCount / 2);
        const bellCurve = Math.max(0.25, 1 - distanceCenter * 0.7);
        const jitter = Math.random() * 0.45;
        const targetHeight = Math.min(
          1.0,
          Math.max(0.12, (decibelLevel * 0.75 + jitter) * bellCurve),
        );

        Animated.timing(val, {
          toValue: targetHeight,
          duration: 110,
          useNativeDriver: false,
        }).start();
      });
    }, 120);

    return () => clearInterval(interval);
  }, [animatedValues, isRecording, isPaused, decibelLevel, barCount]);

  return (
    <View style={styles.container}>
      {animatedValues.map((anim, idx) => {
        const heightInterpolate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [6, 68],
        });

        // Color gradient across bars
        const isCenter = idx >= barCount * 0.35 && idx <= barCount * 0.65;
        const barColor = isPaused ? "#94A3B8" : isCenter ? "#818CF8" : accentColor;

        return (
          <Animated.View
            key={idx}
            style={[
              styles.bar,
              {
                height: heightInterpolate,
                backgroundColor: barColor,
                opacity: isPaused ? 0.4 : 0.9,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 80,
    gap: 3.5,
    paddingHorizontal: 8,
  },
  bar: {
    width: 3.5,
    borderRadius: 2,
  },
});

