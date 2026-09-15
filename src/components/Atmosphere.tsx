// The ambient field behind every page: soft brand-hue blooms plus a grain texture, mounted
// once by the root layout — never per page, never inside a scrolling container. Every
// glass surface in the app samples it, which is what lets a card read as glass instead of
// as a grey box on flat canvas.
//
// All of it lives in the .atmosphere rule in globals.css, tuned through the --aurora-*
// tokens. That is also where the stacking is fixed: the layer must be z-index -1, because
// a fixed element with z-index auto paints ABOVE the page's non-positioned sections.
export default function Atmosphere() {
  return <div aria-hidden="true" className="atmosphere" />;
}
