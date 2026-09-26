const fs = require("fs");
const path = require("path");
const { createRunOncePlugin, withDangerousMod } = require("expo/config-plugins");

const MARKER = "// FlowType live recording notification timer";
const SERVICE_PATH = [
  "node_modules",
  "expo-audio",
  "android",
  "src",
  "main",
  "java",
  "expo",
  "modules",
  "audio",
  "service",
  "AudioRecordingService.kt",
];

function replaceOnce(source, target, replacement) {
  if (!source.includes(target)) {
    throw new Error(`FlowType notification timer could not find expected Expo Audio source: ${target}`);
  }
  return source.replace(target, replacement);
}

/**
 * Expo Audio owns Android's microphone foreground service. This patch only
 * enriches its native notification: the recording and Stop action remain
 * Expo Audio's implementation while FlowType adds a one-second elapsed timer.
 */
function patchAudioRecordingServiceSource(source) {
  if (source.includes(MARKER)) return source;

  let patched = source;
  patched = replaceOnce(
    patched,
    "import android.os.IBinder",
    "import android.os.IBinder\nimport android.os.Handler\nimport android.os.Looper\nimport android.os.SystemClock",
  );

  patched = replaceOnce(
    patched,
    "  private var notificationId = NOTIFICATION_ID",
    [
      "  private var notificationId = NOTIFICATION_ID",
      "  " + MARKER,
      "  private val notificationHandler = Handler(Looper.getMainLooper())",
      "  private var recordingStartedAtMs: Long? = null",
      "  private val notificationTicker = object : Runnable {",
      "    override fun run() {",
      "      if (activeRecorders.isNotEmpty()) {",
      "        updateRecordingNotification()",
      "        notificationHandler.postDelayed(this, NOTIFICATION_UPDATE_INTERVAL_MS)",
      "      }",
      "    }",
      "  }",
    ].join("\n"),
  );

  patched = replaceOnce(
    patched,
    '      .setContentText("Tap to return to app")',
    '      .setContentText("Recording · ${formatElapsedRecordingTime()}")',
  );

  patched = replaceOnce(
    patched,
    "  private fun startForegroundWithNotification() {\n    val notification = buildNotification()",
    [
      "  private fun formatElapsedRecordingTime(): String {",
      "    val elapsedSeconds = ((SystemClock.elapsedRealtime() - (recordingStartedAtMs ?: SystemClock.elapsedRealtime())) / 1000).coerceAtLeast(0)",
      "    val minutes = elapsedSeconds / 60",
      "    val seconds = elapsedSeconds % 60",
      '    return String.format("%02d:%02d", minutes, seconds)',
      "  }",
      "",
      "  private fun updateRecordingNotification() {",
      "    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager",
      "    notificationManager.notify(notificationId, buildNotification())",
      "  }",
      "",
      "  private fun startNotificationTicker() {",
      "    notificationHandler.removeCallbacks(notificationTicker)",
      "    notificationHandler.postDelayed(notificationTicker, NOTIFICATION_UPDATE_INTERVAL_MS)",
      "  }",
      "",
      "  private fun stopNotificationTicker() {",
      "    notificationHandler.removeCallbacks(notificationTicker)",
      "    recordingStartedAtMs = null",
      "  }",
      "",
      "  private fun startForegroundWithNotification() {",
      "    if (recordingStartedAtMs == null) {",
      "      recordingStartedAtMs = SystemClock.elapsedRealtime()",
      "    }",
      "    val notification = buildNotification()",
    ].join("\n"),
  );

  patched = replaceOnce(
    patched,
    "    } catch (_: Exception) {\n    }\n  }\n\n  fun registerRecorder",
    "    } catch (_: Exception) {\n    }\n    startNotificationTicker()\n  }\n\n  fun registerRecorder",
  );

  patched = replaceOnce(
    patched,
    "    if (activeRecorders.isEmpty()) {\n      stopSelf()\n    }",
    "    if (activeRecorders.isEmpty()) {\n      stopNotificationTicker()\n      stopSelf()\n    }",
  );

  patched = replaceOnce(
    patched,
    "  private fun stopRecordingAndService() {\n    activeRecorders.forEach",
    "  private fun stopRecordingAndService() {\n    stopNotificationTicker()\n    activeRecorders.forEach",
  );

  patched = replaceOnce(
    patched,
    "  override fun onDestroy() {\n    super.onDestroy()",
    "  override fun onDestroy() {\n    stopNotificationTicker()\n    super.onDestroy()",
  );

  patched = replaceOnce(
    patched,
    "    private const val NOTIFICATION_ID = 2001",
    "    private const val NOTIFICATION_ID = 2001\n    private const val NOTIFICATION_UPDATE_INTERVAL_MS = 1000L",
  );

  return patched;
}

const withRecordingNotificationTimer = (config) => {
  return withDangerousMod(config, ["android", async (modConfig) => {
    const servicePath = path.join(modConfig.modRequest.platformProjectRoot, "..", ...SERVICE_PATH);
    if (!fs.existsSync(servicePath)) {
      throw new Error("FlowType could not locate Expo Audio's Android recording service during prebuild.");
    }
    const source = fs.readFileSync(servicePath, "utf8");
    const patched = patchAudioRecordingServiceSource(source);
    if (patched !== source) {
      fs.writeFileSync(servicePath, patched);
    }
    return modConfig;
  }]);
};

module.exports = createRunOncePlugin(
  withRecordingNotificationTimer,
  "with-flowtype-recording-notification-timer",
  "1.0.0",
);
module.exports.patchAudioRecordingServiceSource = patchAudioRecordingServiceSource;
module.exports.MARKER = MARKER;
