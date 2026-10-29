// Node 25+ defines localStorage/sessionStorage, but as undefined without --localstorage-file.
// The suite expects no Web Storage (as on Node 22) and stubs it where a test needs it.
delete (globalThis as { localStorage?: Storage }).localStorage;
delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
