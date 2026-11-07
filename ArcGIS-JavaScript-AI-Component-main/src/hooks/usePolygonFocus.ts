import { useSyncExternalStore } from "react";

import { getFocusState, subscribeFocus, type FocusState } from "../utils/focusStore";

export function usePolygonFocus(): FocusState {
  return useSyncExternalStore(subscribeFocus, getFocusState);
}
