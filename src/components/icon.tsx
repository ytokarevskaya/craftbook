import type { CSSProperties } from "react";
export type IconName = "home" | "document" | "layers" | "ring" | "box" | "settings" | "logout" | "menu" | "close" | "arrow";
const paths: Record<IconName, string> = {
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  document: "M14 3H5v18h14V8l-5-5v5h5M8 12h8M8 16h6",
  layers: "m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4",
  ring: "M9 3h6l-3 4-3-4ZM20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  box: "m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 5 9-5M12 12v9M8 5l9 5",
  settings: "M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2 1-4ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  logout: "M9 4H4v16h5M10 12h11m-4-4 4 4-4 4",
  menu: "M3 6h18M3 12h18M3 18h18",
  close: "m6 6 12 12M6 18 18 6",
  arrow: "M4 12h16m-6-6 6 6-6 6",
};
export function Icon({ name, style }: { name: IconName; style?: CSSProperties }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
