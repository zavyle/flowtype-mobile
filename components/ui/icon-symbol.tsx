// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "mic.fill": "mic",
  "mic": "mic-none",
  "waveform": "graphic-eq",
  "clock.fill": "history",
  "clock": "access-time",
  "book.fill": "menu-book",
  "gearshape.fill": "settings",
  "pause.fill": "pause",
  "play.fill": "play-arrow",
  "stop.fill": "stop",
  "doc.on.doc": "content-copy",
  "square.and.arrow.up": "share",
  "sparkles": "auto-awesome",
  "trash": "delete-outline",
  "checkmark": "check",
  "slider.horizontal.3": "tune",
  "plus": "add",
  "magnifyingglass": "search",
  "arrow.clockwise": "refresh",
  "speaker.wave.2.fill": "volume-up",
  "info.circle": "info",
  "lock.fill": "lock",
  "lock.open.fill": "lock-open",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
