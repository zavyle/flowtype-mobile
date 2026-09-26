import { useEffect } from "react";
import { usePathname, useRouter } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";

import { selectIncomingAudioFile } from "@/lib/incomingShare";

/**
 * Ensures an Android audio share always opens the Dictate tab, even if
 * FlowType was previously left on History, Settings, or a session detail.
 */
export function IncomingAudioShareRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasShareIntent, shareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent || !selectIncomingAudioFile(shareIntent.files)) return;
    if (pathname !== "/") {
      router.replace("/");
    }
  }, [hasShareIntent, pathname, router, shareIntent.files]);

  return null;
}
