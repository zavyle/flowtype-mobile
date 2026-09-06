import { useState, useRef, useEffect, useCallback } from "react";
import { Platform, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { AudioChunk } from "@/lib/sessionStore";

export interface AudioEngineState {
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  audioLevel: number; // 0 to 1
  chunks: AudioChunk[];
  currentChunkIndex: number;
  error: string | null;
}

export function useAudioEngine(options?: {
  chunkIntervalMinutes?: number; // rolling chunk period for 30m+ sessions
  onChunkReady?: (chunkBlob: Blob | string, chunkIndex: number) => void;
}) {
  const chunkIntervalSec = (options?.chunkIntervalMinutes ?? 10) * 60;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0.3);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // References for cross-platform audio recording
  const mediaRecorderRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastRecordedBase64Ref = useRef<string | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setDurationSeconds(0);
    setCurrentChunkIndex(0);
    audioChunksRef.current = [];
    lastRecordedBase64Ref.current = null;

    if (Platform.OS !== "web") {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    if (Platform.OS === "web") {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Microphone access not supported in this browser environment");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        audioStreamRef.current = stream;

        // Setup Web Audio Analyser for realistic audio levels
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const updateAudioMeter = () => {
            if (!analyserRef.current) return;
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(1.0, Math.max(0.1, avg / 128));
            setAudioLevel(normalized);
            animFrameRef.current = requestAnimationFrame(updateAudioMeter);
          };
          updateAudioMeter();
        } catch (meterErr) {
          console.warn("Audio meter setup warning:", meterErr);
        }

        // Setup MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });

          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            lastRecordedBase64Ref.current = base64data;
          };
          reader.readAsDataURL(audioBlob);
        };

        recorder.start(1000); // 1-second chunks for stream stability
        setIsRecording(true);
        setIsPaused(false);

        // Start duration timer
        timerIntervalRef.current = setInterval(() => {
          setDurationSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err: any) {
        console.error("Failed to start recording on web:", err);
        setError(err.message || "Failed to access microphone");
        Alert.alert("Microphone Error", "Please allow microphone permissions to dictate.");
      }
    } else {
      // Native mobile mock fallback/simulator
      setIsRecording(true);
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
        setAudioLevel(0.2 + Math.random() * 0.6);
      }, 1000);
    }
  }, [chunkIntervalSec]);

  const pauseRecording = useCallback(() => {
    if (!isRecording) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsPaused(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isRecording]);

  const resumeRecording = useCallback(() => {
    if (!isRecording || !isPaused) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
    }
    timerIntervalRef.current = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
    setIsPaused(false);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isRecording, isPaused]);

  const stopRecording = useCallback(async (): Promise<{
    base64: string | null;
    duration: number;
    mimeType: string;
  }> => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const finalDuration = durationSeconds;

    return new Promise((resolve) => {
      if (Platform.OS === "web" && mediaRecorderRef.current) {
        const recorder = mediaRecorderRef.current;
        const mimeType = recorder.mimeType || "audio/webm";

        recorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            lastRecordedBase64Ref.current = base64;

            // Stop all audio stream tracks
            if (audioStreamRef.current) {
              audioStreamRef.current.getTracks().forEach((t) => t.stop());
              audioStreamRef.current = null;
            }

            setIsRecording(false);
            setIsPaused(false);
            resolve({
              base64,
              duration: finalDuration,
              mimeType,
            });
          };
          reader.readAsDataURL(audioBlob);
        };

        if (recorder.state !== "inactive") {
          recorder.stop();
        } else {
          setIsRecording(false);
          setIsPaused(false);
          resolve({
            base64: lastRecordedBase64Ref.current,
            duration: finalDuration,
            mimeType: "audio/webm",
          });
        }
      } else {
        setIsRecording(false);
        setIsPaused(false);
        resolve({
          base64: null,
          duration: finalDuration,
          mimeType: "audio/m4a",
        });
      }
    });
  }, [durationSeconds]);

  return {
    isRecording,
    isPaused,
    durationSeconds,
    audioLevel,
    currentChunkIndex,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}

export function formatTimeClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${remainingMins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
