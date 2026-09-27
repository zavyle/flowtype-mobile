import { describe, expect, it } from "vitest";

const {
  MARKER,
  patchAudioRecordingServiceSource,
} = require("../plugins/withRecordingNotificationTimer");

const EXPO_AUDIO_SERVICE_FIXTURE = `package expo.modules.audio.service
import android.os.IBinder
class AudioRecordingService {
  private var notificationId = NOTIFICATION_ID
  private fun createNotificationChannelIfNeeded() {
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Audio Recording",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Shows when audio is being recorded in the background"
    }
  }
  private fun buildNotification(): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Recording audio")
      .setContentText("Tap to return to app")
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
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
    private const val CHANNEL_ID = "expo_audio_recording_channel"
    private const val NOTIFICATION_ID = 2001
  }
}`;

describe("FlowType Android recording notification patch", () => {
  it("uses Android chronometer and silent updates instead of notifying every second", () => {
    const patched = patchAudioRecordingServiceSource(EXPO_AUDIO_SERVICE_FIXTURE);

    expect(patched).toContain(MARKER);
    expect(patched).toContain(".setUsesChronometer(true)");
    expect(patched).toContain(".setOnlyAlertOnce(true)");
    expect(patched).toContain(".setSilent(true)");
    expect(patched).not.toContain("notificationManager.notify(notificationId, buildNotification())");
    expect(patched).not.toContain("NOTIFICATION_UPDATE_INTERVAL_MS");
  });

  it("creates a public compact Stop control for lock screens", () => {
    const patched = patchAudioRecordingServiceSource(EXPO_AUDIO_SERVICE_FIXTURE);

    expect(patched).toContain('private const val CHANNEL_ID = "flowtype_recording_controls_v2"');
    expect(patched).toContain("Notification.VISIBILITY_PUBLIC");
    expect(patched).toContain(".setShowActionsInCompactView(0)");
    expect(patched).toContain("androidx.media.app.NotificationCompat.MediaStyle()");
    expect(patched).toContain("setSound(null, null)");
    expect(patched).toContain("enableVibration(false)");
  });

  it("is idempotent across repeated Expo prebuild runs", () => {
    const once = patchAudioRecordingServiceSource(EXPO_AUDIO_SERVICE_FIXTURE);
    expect(patchAudioRecordingServiceSource(once)).toBe(once);
  });
});
