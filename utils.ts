import { createDefine } from "fresh";

export interface State {
  // Extend when adding middleware that shares state
}

export const define = createDefine<State>();
