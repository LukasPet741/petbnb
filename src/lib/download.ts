/** Hands the browser a file made on the page (a calendar entry, a data export) to save. */
export function downloadFile(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking straight after the click can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
