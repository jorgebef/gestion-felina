import { Image as ExpoImage } from "expo-image";
import { withUniwind } from "uniwind";

/** expo-image (caching, transitions) with `className` support. */
export const Image = withUniwind(ExpoImage);
