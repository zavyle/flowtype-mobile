import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { clampPlaybackRatio, formatPlaybackTime } from "@/lib/playbackUtils";

export function SessionAudioPlayer({ audioUrl }: { audioUrl?: string }) {
  const source = useMemo(() => audioUrl || null, [audioUrl]);
  const player = useAudioPlayer(source, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    setIsPlaying(status.playing);
  }, [status.playing]);

  if (!audioUrl) {
    return null;
  }

  const duration = status.duration || 0;
  const currentTime = status.currentTime || 0;
  const progress = clampPlaybackRatio(currentTime, duration);
  const isLoading = !status.isLoaded;

  const togglePlayback = async () => {
    if (isLoading) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      return;
    }

    if (duration > 0 && currentTime >= duration - 0.1) {
      await player.seekTo(0);
    }
    player.play();
    setIsPlaying(true);
  };

  const restartPlayback = async () => {
    if (isLoading) return;
    await player.seekTo(0);
    player.play();
    setIsPlaying(true);
  };

  return (
    <View style={styles.card} accessibilityLabel="Recording playback controls">
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <IconSymbol name="speaker.wave.2.fill" size={17} color="#A5B4FC" />
          <Text style={styles.title}>RECORDING AUDIO</Text>
        </View>
        <Text style={styles.duration}>
          {formatPlaybackTime(currentTime)} / {duration > 0 ? formatPlaybackTime(duration) : "--:--"}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          accessibilityLabel="Restart recording playback"
          style={[styles.secondaryButton, isLoading && styles.disabledButton]}
          onPress={restartPlayback}
          disabled={isLoading}
          activeOpacity={0.75}
        >
          <IconSymbol name="arrow.clockwise" size={18} color="#C7D2FE" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel={isPlaying ? "Pause recording playback" : "Play recording"}
          style={[styles.playButton, isLoading && styles.disabledButton]}
          onPress={togglePlayback}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <IconSymbol name={isPlaying ? "pause.fill" : "play.fill"} size={22} color="#FFFFFF" />
          )}
          <Text style={styles.playButtonText}>{isLoading ? "Loading" : isPlaying ? "Pause" : "Play"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#181B26",
    borderWidth: 1,
    borderColor: "#303552",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  title: {
    color: "#A5B4FC",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  duration: {
    color: "#94A3B8",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    height: 5,
    backgroundColor: "#272B3C",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#6366F1",
    borderRadius: 4,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 13,
  },
  secondaryButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#252A3C",
    borderWidth: 1,
    borderColor: "#353C58",
  },
  playButton: {
    minWidth: 116,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#6366F1",
  },
  playButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.55,
  },
});
