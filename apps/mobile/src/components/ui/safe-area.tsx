import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

/** react-native-safe-area-context's SafeAreaView with `className` support. */
export const SafeAreaView = withUniwind(RNSafeAreaView);
