let debug = false;

/**
 * Executes a given function with a specified debug state and ensures
 * that the debug state is reset to false after execution.
 *
 * @param fn - The function to be executed with the debug state.
 * @param [state=true] - The state to set for debugging. Defaults to true.
 * @returns The result of the executed function.
 */
export const withDebug = <T>(fn: () => T, state = true): T => {
  debug = state;
  try {
    return fn();
  } finally {
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
