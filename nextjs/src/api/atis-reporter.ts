/** Stable anonymous browser identifier; neither an account nor a pilot identity. */
export function atisReporterId() {
  const key = "nordsweet.atis.reporter.v1";
  let id = localStorage.getItem(key);
  if (!id || !/^[A-Za-z0-9-]{16,100}$/.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
