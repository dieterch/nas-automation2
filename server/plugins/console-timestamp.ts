// server/plugins/console-timestamp.ts
export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== "development") return;

  const origLog = console.log;
  const origErr = console.error;
  const origWarn = console.warn;

  //   function ts() {
  //     return new Date().toISOString()
  //   }

  function ts() {
    return new Date().toLocaleString("de-AT", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  console.log = (...args) => origLog(ts(), ...args);
  console.error = (...args) => origErr(ts(), ...args);
  console.warn = (...args) => origWarn(ts(), ...args);
});
