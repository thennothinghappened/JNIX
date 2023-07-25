/**
 * Type definitions shared between the Kernel and processes.
 */

/**
 * @typedef KMessage Message sent from the Kernel to a process
 * @prop { Signal } signal Kernel Signal enum value
 * @prop { any } [data] Associated data
 */

/**
 * @typedef KInitData Message body of Kernel INIT signal
 * @prop { number } uid User ID of the process
 * @prop { number } gid Group ID of the process
 * @prop { { [key: string]: string } } env Environment variables for the process
 * @prop { string[] } args Arguments the process was started with
 */

/**
 * @typedef PMessage Syscall sent by a process to the Kernel
 * @prop { Syscall } syscall Kernel Syscall enum value
 * @prop { any } [data] Associated data
 */

/**
 * Signals sent to processes by the Kernel
 * @readonly
 * @enum { number }
 */
export const Signal = {
    // Sent on process initialisation
    INIT: 0,

};

/**
 * Syscalls sent to the Kernel by processes
 * @readonly
 * @enum { number }
 */
export const Syscall = {
    // Sent in reply to INIT signal
    INIT: 0,
};