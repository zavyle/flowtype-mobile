const fs = require("fs");
const path = require("path");
const { createRunOncePlugin, withDangerousMod } = require("expo/config-plugins");

const MARKER = "// FlowType silent lock-screen recording controls";
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

const MEDIA_COMPAT_VERSION = "1.7.0";

function replaceOnce(source, target, replacement) {
  if (!source.includes(target)) {
    throw new Error(`FlowType recording notification patch could not find expected Expo Audio source: ${target}`);
  }
  return source.replace(target, replacement);
}

/**
 * Expo Audio owns Android's microphone foreground service. This patch changes
 * that service's notification to use Android's own chronometer rather than
 * posting a new notification each second. The compact MediaStyle action makes
 * Stop available on lock screens which render compact notification controls.
 */
function patchAudioRecordingServiceSource(source) {
  if (source.includes(MARKER)) return source;

  let patched = source;
  patched = replaceOnce(
    patched,
    "import android.os.IBinder",
    "import android.os.IBinder\nimport android.os.SystemClock",
  );

  patched = replaceOnce(
    patched,
    "  private var notificationId = NOTIFICATION_ID",
    [
      "  private var notificationId = NOTIFICATION_ID",
      "  " + MARKER,
      "  private var recordingStartedAtMs: Long? = null",
    ].join("\n"),
  );

  patched = replaceOnce(
    patched,
    '      .setContentText("Tap to return to app")',
    '      .setContentText("Recording in progress")',
  );

  patched = replaceOnce(
    patched,
    "      .setOngoing(true)",
    [
      "      .setOngoing(true)",
      "      .setOnlyAlertOnce(true)",
      "      .setSilent(true)",
      "      .setWhen(recordingStartedAtMs ?: System.currentTimeMillis())",
      "      .setShowWhen(true)",
      "      .setUsesChronometer(true)",
    ].join("\n"),
  );

  if (patched.includes('.setCategory(NotificationCompat.CATEGORY_SERVICE)')) {
    patched = replaceOnce(
      patched,
      '      .setCategory(NotificationCompat.CATEGORY_SERVICE)',
      [
        '      .setCategory(NotificationCompat.CATEGORY_SERVICE)',
        '      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)',
        '      .setPriority(NotificationCompat.PRIORITY_LOW)',
        "      .setStyle(",
        "        androidx.media.app.NotificationCompat.MediaStyle()",
        "          .setShowActionsInCompactView(0)",
        "      )",
      ].join("\n"),
    );
  }

  if (patched.includes("NotificationManager.IMPORTANCE_LOW")) {
    const description = "description = \"Shows when audio is being recorded in the background\"";
    if (patched.includes(description)) {
      patched = patched.replace(
        description,
        [
          "description = \"Silent controls for an active FlowType recording\"",
          "setSound(null, null)",
          "enableVibration(false)",
          "setShowBadge(false)",
          "lockscreenVisibility = Notification.VISIBILITY_PUBLIC",
        ].join("\n          "),
      );
    }
  }

  patched = replaceOnce(
    patched,
    "  private fun startForegroundWithNotification() {\n    val notification = buildNotification()",
    [
      "  private fun startForegroundWithNotification() {",
      "    if (recordingStartedAtMs == null) {",
      "      recordingStartedAtMs = System.currentTimeMillis()",
      "    }",
      "    val notification = buildNotification()",
    ].join("\n"),
  );

  patched = replaceOnce(
    patched,
    "  private fun stopRecordingAndService() {\n    activeRecorders.forEach",
    "  private fun stopRecordingAndService() {\n    recordingStartedAtMs = null\n    activeRecorders.forEach",
  );

  patched = replaceOnce(
    patched,
    "  override fun onDestroy() {\n    super.onDestroy()",
    "  override fun onDestroy() {\n    recordingStartedAtMs = null\n    super.onDestroy()",
  );

  patched = replaceOnce(
    patched,
    '    private const val CHANNEL_ID = "expo_audio_recording_channel"',
    '    private const val CHANNEL_ID = "flowtype_recording_controls_v2"',
  );

  return patched;
}

function ensureMediaCompatDependency(projectRoot) {
  const gradlePath = path.join(projectRoot, "node_modules", "expo-audio", "android", "build.gradle");
  if (!fs.existsSync(gradlePath)) return;

  const source = fs.readFileSync(gradlePath, "utf8");
  const dependency = `  implementation \"androidx.media:media:${MEDIA_COMPAT_VERSION}\"`;
  if (source.includes("androidx.media:media:")) return;

  fs.writeFileSync(
    gradlePath,
    replaceOnce(source, "dependencies {", `dependencies {\n${dependency}`),
  );
}

const withRecordingNotificationTimer = (config) => {
  return withDangerousMod(config, ["android", async (modConfig) => {
    const projectRoot = path.join(modConfig.modRequest.platformProjectRoot, "..");
    const moduleConfigPath = path.join(projectRoot, "node_modules", "expo-audio", "expo-module.config.json");

    // Build the Expo Audio module from source, not its precompiled AAR, so the
    // generated APK contains the patched foreground notification service.
    if (fs.existsSync(moduleConfigPath)) {
      const moduleConfig = JSON.parse(fs.readFileSync(moduleConfigPath, "utf8"));
      if (moduleConfig.android?.publication) {
        delete moduleConfig.android.publication;
        fs.writeFileSync(moduleConfigPath, JSON.stringify(moduleConfig, null, 2));
      }
    }

    ensureMediaCompatDependency(projectRoot);

    const servicePath = path.join(projectRoot, ...SERVICE_PATH);
    if (!fs.existsSync(servicePath)) {
      throw new Error("FlowType could not locate Expo Audio's Android recording service during prebuild.");
    }

    const source = fs.readFileSync(servicePath, "utf8");
    const patched = patchAudioRecordingServiceSource(source);
    if (patched !== source) fs.writeFileSync(servicePath, patched);

    return modConfig;
  }]);
};

module.exports = createRunOncePlugin(
  withRecordingNotificationTimer,
  "with-flowtype-silent-lockscreen-recording-controls",
  "2.0.0",
);
module.exports.patchAudioRecordingServiceSource = patchAudioRecordingServiceSource;
module.exports.ensureMediaCompatDependency = ensureMediaCompatDependency;
module.exports.MARKER = MARKER;
