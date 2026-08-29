// Fixed, pointer-events-none page atmosphere: two layers (gradient-mesh
// blooms + a grain texture) that sit behind every page's content, mounted
// once at the layout level per the Page Theme Lock — never per-section,
// never inside a scrolling container. Quiet materiality, not decoration:
// the blooms sit at ~6-7% opacity in the brand (pine) and slate (steel)
// hues, and the grain sits at 2.5% opacity blended with `overlay`, so the
// canvas reads as paper catching light rather than a designed backdrop.
//
// Colors are literal rgb() values (not CSS vars) matching the finalized
// tokens --brand #1f5c47 (31 92 71) and --slate #3f6472 (63 100 114), per
// the direction doc — this keeps the layer correct independent of when
// globals.css picks up those token values.
export default function Atmosphere() {
  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -2,
          pointerEvents: "none",
          background:
            "radial-gradient(760px 540px at 90% -10%, rgb(31 92 71 / 0.14), transparent 62%), radial-gradient(680px 580px at 2% 112%, rgb(63 100 114 / 0.12), transparent 62%), radial-gradient(900px 500px at 50% 40%, rgb(220 154 53 / 0.03), transparent 70%)",
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
          opacity: 0.045,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
