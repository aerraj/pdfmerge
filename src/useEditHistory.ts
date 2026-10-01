import { useReducer } from "react";

type State<T> = { items: T[]; past: T[][]; future: T[][]; gesture?: T[] };
type Action<T> =
  | { type: "update"; update: (items: T[]) => T[] }
  | { type: "preview"; update: (items: T[]) => T[] }
  | { type: "begin" | "finish" | "cancel" | "undo" | "redo" };

function sameItems<T>(a: T[], b: T[]) {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

function reduce<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case "begin":
      return { ...state, gesture: state.items };
    case "preview":
      return { ...state, items: action.update(state.items) };
    case "cancel":
      return {
        ...state,
        items: state.gesture ?? state.items,
        gesture: undefined,
      };
    case "finish": {
      const before = state.gesture;
      if (!before || sameItems(before, state.items))
        return { ...state, gesture: undefined };
      return { items: state.items, past: [...state.past, before], future: [] };
    }
    case "update": {
      const items = action.update(state.items);
      if (sameItems(items, state.items)) return state;
      return { items, past: [...state.past, state.items], future: [] };
    }
    case "undo": {
      if (state.gesture) return { ...state, items: state.gesture, gesture: undefined };
      const items = state.past[state.past.length - 1];
      if (!items) return state;
      return {
        items,
        past: state.past.slice(0, -1),
        future: [state.items, ...state.future],
      };
    }
    case "redo": {
      if (state.gesture) return { ...state, items: state.gesture, gesture: undefined };
      const items = state.future[0];
      if (!items) return state;
      return {
        items,
        past: [...state.past, state.items],
        future: state.future.slice(1),
      };
    }
  }
}

export function useEditHistory<T>() {
  const [state, dispatch] = useReducer(reduce<T>, {
    items: [],
    past: [],
    future: [],
  });
  return {
    items: state.items,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    update: (update: (items: T[]) => T[]) =>
      dispatch({ type: "update", update }),
    preview: (update: (items: T[]) => T[]) =>
      dispatch({ type: "preview", update }),
    begin: () => dispatch({ type: "begin" }),
    finish: () => dispatch({ type: "finish" }),
    cancel: () => dispatch({ type: "cancel" }),
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
  };
}
