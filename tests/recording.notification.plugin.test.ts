import { describe, expect, it } from "vitest";

const {
  MARKER,
  patchAudioRecordingServiceSource,
} = require("../plugins/withRecordingNotificationTimer");

const EXPO_AUDIO_SERVICE_FIXTURE = `package expo.modules.audio.service
import android.os.IBinder
class AudioRecordingService {
  private var notificationId = NOTIFICATION_ID
  private fun buildNotification(): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Recording audio")
      .setContentText("Tap to return to app")
      .build()
  }
  private fun startForegroundWithNotification() {
    val notification = buildNotification()
    try {
    } catch (_: Exception) {
    }
  }

  fun registerRecorder(recorder: AudioRecorder) {}
  fun unregisterRecorder(recorder: AudioRecorder) {
    if (activeRecorders.isEmpty()) {
      stopSelf()
    }
  }
  private fun stopRecordingAndService() {
    activeRecorders.forEach {}
  }
  override fun onDestroy() {
    super.onDestroy()
  }
  companion object {
    private const val NOTIFICATION_ID = 2001
  }
}`;

describe("FlowType Android recording notification timer plugin", () => {
  it("adds an elapsed timer, periodic update, and cleanup to Expo Audio service", () => {
    const patched = patchAudioRecordingServiceSource(EXPO_AUDIO_SERVICE_FIXTURE);

    expect(patched).toContain(MARKER);
    expect(patched).toContain('setContentText("Recording · ${formatElapsedRecordingTime()}")');
    expect(patched).toContain("NOTIFICATION_UPDATE_INTERVAL_MS = 1000L");
    expect(patched).toContain("notificationManager.notify(notificationId, buildNotification())");
    expect(patched).toContain("startNotificationTicker()");
    expect(patched).toContain("stopNotificationTicker()");
  });

  it("is idempotent across repeated Expo prebuild runs", () => {
    const once = patchAudioRecordingServiceSource(EXPO_AUDIO_SERVICE_FIXTURE);
    expect(patchAudioRecordingServiceSource(once)).toBe(once);
  });
});
