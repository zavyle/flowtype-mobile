import { useState, useRef, useEffect, useCallback } from "react";
import { Platform, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingStatus,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import {
  createRecordingAudioMode,
  shouldHandleBackgroundStop,
} from "@/lib/backgroundRecording";

export interface AudioEngineState {
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  audioLevel: number;
  currentChunkIndex: number;
  error: string | null;
}

export function useAudioEngine(options?: {
  chunkIntervalMinutes?: number;
  onChunkReady?: (chunkBlob: Blob | string, chunkIndex: number) => void;
  onBackgroundStop?: (recording: {
    base64: string;
    duration: number;
    mimeType: string;
  }) => Promise<void> | void;
}) {
  const chunkIntervalSec = (options?.chunkIntervalMinutes ?? 10) * 60;
  const onBackgroundStopRef = useRef(options?.onBackgroundStop);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const durationRef = useRef(0);
  const recordingStartedAtRef = useRef<number | null>(null);
  const stoppingFromInAppButtonRef = useRef(false);
  const completionAlreadyHandledRef = useRef(false);
  const recordingWasStartedRef = useRef(false);

  const handleNativeRecordingStatus = useCallback(async (status: RecordingStatus) => {
    if (Platform.OS === "web" || !status.isFinished || !status.url) return;

    const shouldHandle = shouldHandleBackgroundStop({
      appThinksRecording: isRecordingRef.current,
      appThinksPaused: isPausedRef.current,
      nativeRecorderIsRecording: false,
      nativeRecorderUrl: status.url,
      recordingWasStarted: recordingWasStartedRef.current,
      stoppingFromInAppButton: stoppingFromInAppButtonRef.current,
      completionAlreadyHandled: completionAlreadyHandledRef.current,
    });
    if (!shouldHandle) return;

    completionAlreadyHandledRef.current = true;
    setIsRecording(false);
    setIsPaused(false);
    setAudioLevel(0.08);

    try {
      const base64 = await FileSystem.readAsStringAsync(status.url, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64) throw new Error("The background recording was empty.");

      const duration = Math.max(
        1,
        Math.floor((Date.now() - (recordingStartedAtRef.current ?? Date.now())) / 1000),
        durationRef.current,
      );
      durationRef.current = duration;
      await onBackgroundStopRef.current?.({
        base64: `data:audio/m4a;base64,${base64}`,
        duration,
        mimeType: "audio/m4a",
      });
    } catch (recordingError) {
      const message =
        recordingError instanceof Error
          ? recordingError.message
          : "The lock-screen Stop action could not save this recording.";
      setError(message);
    }
  }, []);
  const nativeRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  }, handleNativeRecordingStatus);
  const nativeRecorderState = useAudioRecorderState(nativeRecorder, 250);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0.08);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<"unknown" | "granted" | "denied" | "undetermined">("unknown");
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<"unknown" | "granted" | "denied" | "undetermined">("unknown");
  const [isStarting, setIsStarting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    onBackgroundStopRef.current = options?.onBackgroundStop;
  }, [options?.onBackgroundStop]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
    isPausedRef.current = isPaused;
    durationRef.current = durationSeconds;
  }, [durationSeconds, isPaused, isRecording]);

  useEffect(() => {
    let mounted = true;
    getRecordingPermissionsAsync()
      .then((permission) => {
        if (!mounted) return;
        setPermissionStatus(permission.granted ? "granted" : permission.status === "denied" ? "denied" : "undetermined");
      })
      .catch(() => {
        if (mounted) setPermissionStatus("unknown");
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || !isRecording) return;

    timerIntervalRef.current = setInterval(() => {
      setDurationSeconds((previous) => previous + 1);
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isRecording]);

  useEffect(() => {
    if (Platform.OS === "web" || !isRecording) return;

    const duration = Math.floor((nativeRecorderState.durationMillis || 0) / 1000);
    if (duration > 0) {
      durationRef.current = duration;
      setDurationSeconds(duration);
    }

    const meter = nativeRecorderState.metering;
    if (typeof meter === "number") {
      setAudioLevel(Math.min(1, Math.max(0.05, (meter + 60) / 60)));
    }
  }, [isRecording, nativeRecorderState.durationMillis, nativeRecorderState.metering]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  const showPermissionError = useCallback((message: string) => {
    setError(message);
    if (Platform.OS !== "web") {
      Alert.alert("Microphone Access Needed", message);
    }
  }, []);

  const requestRecordingNotificationPermission = useCallback(async () => {
    if (Platform.OS !== "android") return;
    try {
      // Creating a channel before the Android 13 permission request makes the
      // system prompt available. Expo Audio owns the actual recording channel.
      await Notifications.setNotificationChannelAsync("flowtype-recording", {
        name: "FlowType recording controls",
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [],
        sound: null,
      });
      const current = await Notifications.getPermissionsAsync();
      const next = current.granted ? current : await Notifications.requestPermissionsAsync();
      setNotificationPermissionStatus(
        next.granted ? "granted" : next.status === "denied" ? "denied" : "undetermined",
      );
    } catch {
      // A foreground service can still keep capture alive. Do not block the
      // recording just because the optional permission check failed.
      setNotificationPermissionStatus("unknown");
    }
  }, []);

  const startRecording = useCallback(async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    setError(null);
    setIsStarting(true);
    setDurationSeconds(0);
    setCurrentChunkIndex(0);
    audioChunksRef.current = [];

    try {
      const permission = await requestRecordingPermissionsAsync();
      const nextPermissionStatus = permission.granted
        ? "granted"
        : permission.status === "denied"
          ? "denied"
          : "undetermined";
      setPermissionStatus(nextPermissionStatus);
      if (!permission.granted) {
        const permissionMessage =
          "FlowType cannot record without microphone access. Enable Microphone for FlowType in your device settings, then try again.";
        showPermissionError(permissionMessage);
        return { ok: false, error: permissionMessage };
      }

      await setAudioModeAsync(createRecordingAudioMode(Platform.OS));

      if (Platform.OS !== "web") {
        await requestRecordingNotificationPermission();
        await nativeRecorder.prepareToRecordAsync();
        nativeRecorder.record();
        recordingStartedAtRef.current = Date.now();
        recordingWasStartedRef.current = true;
        stoppingFromInAppButtonRef.current = false;
        completionAlreadyHandledRef.current = false;
        setIsRecording(true);
        setIsPaused(false);
        setAudioLevel(0.16);
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
        return { ok: true };
      }

      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("This browser does not support microphone recording.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = stream;

      try {
        const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextConstructor) {
          const audioContext = new AudioContextConstructor();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          audioContextRef.current = audioContext;
          analyserRef.current = analyser;

          const updateAudioMeter = () => {
            if (!analyserRef.current) return;
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
            setAudioLevel(Math.min(1, Math.max(0.05, average / 128)));
            animFrameRef.current = requestAnimationFrame(updateAudioMeter);
          };
          updateAudioMeter();
        }
      } catch (meterError) {
        console.warn("Audio meter setup warning:", meterError);
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      return { ok: true };
    } catch (recordingError) {
      console.error("Failed to start recording:", recordingError);
      const message = recordingError instanceof Error ? recordingError.message : "Failed to access the microphone.";
      showPermissionError(message);
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
      return { ok: false, error: message };
    } finally {
      setIsStarting(false);
    }
  }, [nativeRecorder, requestRecordingNotificationPermission, showPermissionError]);

  const pauseRecording = useCallback(() => {
    if (!isRecording) return;
    if (Platform.OS !== "web") {
      nativeRecorder.pause();
    } else if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
    }
    setIsPaused(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  }, [isRecording, nativeRecorder]);

  const resumeRecording = useCallback(() => {
    if (!isRecording || !isPaused) return;
    if (Platform.OS !== "web") {
      nativeRecorder.record();
    } else if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
    }
    setIsPaused(false);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  }, [isPaused, isRecording, nativeRecorder]);

  const stopRecording = useCallback(async (): Promise<{
    base64: string | null;
    duration: number;
    mimeType: string;
  }> => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    const finalDuration = Platform.OS === "web"
      ? durationSeconds
      : Math.max(durationSeconds, Math.floor((nativeRecorderState.durationMillis || 0) / 1000));

    if (Platform.OS !== "web") {
      try {
        await nativeRecorder.stop();
        const uri = nativeRecorder.uri;
        setIsRecording(false);
        setIsPaused(false);
        if (!uri) {
          throw new Error("The microphone stopped without producing an audio file.");
        }
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!base64) throw new Error("The microphone produced an empty audio file.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        return {
          base64: `data:audio/m4a;base64,${base64}`,
          duration: finalDuration,
          mimeType: "audio/m4a",
        };
      } catch (recordingError) {
        setIsRecording(false);
        setIsPaused(false);
        const message = recordingError instanceof Error ? recordingError.message : "Recording could not be saved.";
        setError(message);
        throw new Error(message);
      }
    }

    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        setIsRecording(false);
        setIsPaused(false);
        reject(new Error("No active microphone recording was found."));
        return;
      }

      const mimeType = recorder.mimeType || "audio/webm";
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (!audioBlob.size) {
          setIsRecording(false);
          setIsPaused(false);
          reject(new Error("The microphone produced an empty audio recording."));
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          audioStreamRef.current?.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
          mediaRecorderRef.current = null;
          setIsRecording(false);
          setIsPaused(false);
          resolve({ base64: dataUrl, duration: finalDuration, mimeType });
        };
        reader.onerror = () => reject(new Error("The browser could not read the recorded audio."));
        reader.readAsDataURL(audioBlob);
      };

      if (recorder.state !== "inactive") {
        recorder.stop();
      } else {
        reject(new Error("The microphone recording was already stopped."));
      }
    });
  }, [durationSeconds, nativeRecorder, nativeRecorderState.durationMillis]);

  return {
    isRecording,
    isPaused,
    durationSeconds,
    audioLevel,
    currentChunkIndex,
    error,
    isStarting,
    permissionStatus,
    notificationPermissionStatus,
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
    return `${hours.toString().padStart(2, "0")}:${remainingMins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
