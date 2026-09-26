export type BackgroundRecordingPolicy = {
  allowsRecording: boolean;
  playsInSilentMode: boolean;
  shouldPlayInBackground: boolean;
  allowsBackgroundRecording: boolean;
};

/**
 * Keeps recording behavior explicit and consistent across the app.
 * Expo Audio converts the Android flag into a microphone foreground service
 * with a persistent system notification and Stop action.
 */
export function createRecordingAudioMode(platform: string): BackgroundRecordingPolicy {
  return {
    allowsRecording: true,
    playsInSilentMode: true,
    // Expo Audio's Android module uses this flag to decide whether to pause
    // all recorders when the activity enters the background.
    shouldPlayInBackground: platform !== "web",
    allowsBackgroundRecording: platform !== "web",
  };
}

export type BackgroundStopDetectionInput = {
  appThinksRecording: boolean;
  appThinksPaused: boolean;
  nativeRecorderIsRecording: boolean;
  nativeRecorderUrl?: string | null;
  recordingWasStarted: boolean;
  stoppingFromInAppButton: boolean;
  completionAlreadyHandled: boolean;
};

/**
 * Determines whether Android's foreground-service Stop action ended a live
 * recording. In-app stops are handled by the original stop flow instead.
 */
export function shouldHandleBackgroundStop({
  appThinksRecording,
  appThinksPaused: _appThinksPaused,
  nativeRecorderIsRecording,
  nativeRecorderUrl,
  recordingWasStarted,
  stoppingFromInAppButton,
  completionAlreadyHandled,
}: BackgroundStopDetectionInput): boolean {
  return Boolean(
    appThinksRecording &&
      recordingWasStarted &&
      !nativeRecorderIsRecording &&
      nativeRecorderUrl &&
      !stoppingFromInAppButton &&
      !completionAlreadyHandled,
  );
}
