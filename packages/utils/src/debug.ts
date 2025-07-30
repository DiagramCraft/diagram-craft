let debug = false;

/**
 * Executes a given function with a specified debug state and ensures
 * that the debug state is reset to false after execution.
 *
 * @param fn - The function to be executed with the debug state.
 * @param [opts] - Optional configuration object.
 * @param [opts.enabled=true] - The state to set for debugging. Defaults to true.
 * @param [opts.logLabel] - Optional label for debug logging. If provided and debug is enabled, 
 *                          logs messages at the start and end of function execution.
 * @returns The result of the executed function.
 */
export const withDebug = <T>(fn: () => T, opts?: { enabled?: boolean; logLabel?: string }): T => {
  debug = opts && opts.enabled !== undefined ? opts.enabled : true;
  if (opts?.logLabel && debug) console.log(`--> DEBUG ${opts.logLabel}`);
  try {
    return fn();
  } finally {
    if (opts?.logLabel && debug) console.log(`<-- DEBUG ${opts.logLabel}`);
    debug = false;
  }
};

/**
 * Represents a function that determines if the application is running in debug mode.
 *
 * This function returns the current state of the debug flag, which can be used to
 * enable or disable additional logging or debugging behavior in the application.
 *
 * @function
 * @name isDebug
 * @returns {boolean} Returns true if the application is in debug mode; otherwise, false.
 */
export const isDebug = () => debug;
