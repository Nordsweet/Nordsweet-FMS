/** Saves text as a file through a temporary link. */
export function downloadText(
  fileName: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement("a"), {
    href: url,
    download: fileName,
  }).click();
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
