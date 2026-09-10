import { redirect } from "next/navigation";

/**
 * `/legal` is the entry point the app links to; the documents themselves live at
 * `/legal/terms` and `/legal/privacy` and are tabs of one page.
 *
 * Having a real route here means the sidebar can link to `/legal` and stay marked as
 * the current section on both tabs, rather than highlighting on Terms and going dark
 * the moment someone opens Privacy.
 *
 * A temporary redirect rather than a permanent one: 308s are cached hard by browsers,
 * and if `/legal` ever becomes an index page in its own right, everyone who visited it
 * once would keep being bounced past it.
 */
export default function LegalIndexPage() {
  redirect("/legal/terms");
}
