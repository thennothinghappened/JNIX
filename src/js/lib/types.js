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
 * @prop { number } ppid Parent Process ID of the process
 * @prop { number } pid Process ID of the process
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
    /**
     * Sent to both parent and child processes on forking.
     * 
     * For parent process, the data will be the pid of the new process.
     * 
     * For the child process, the data will be a list of file descriptors - cloned
     * from the parent process.
     */
    FORKED: 1,
};

/**
 * Syscalls sent to the Kernel by processes
 * @readonly
 * @enum { number }
 */
export const Syscall = {
    /** Sent in reply to INIT signal */
    INIT: 0,
    /** 
     * Fork the current running process.
     * Because of the way things work in JS, this does NOT work the
     * same way it does in an actual *NIX system.
     * 
     * Here, forking a process causes multiple things to happen:
     * - The Scheduler will queue process creation just as normal. When allocated a PID,
     *   instead of creating a new Process instance, `Process.fork(process)` will be called. This
     *   returns a new Process instance, with the same gid, uid of the process, and ppid as original.
     * 
     * - After receiving the `INIT` syscall reply, the `FORKED` signal will be sent to both parent
     *   and child processes. The parent process will receive the `pid` of the new process, and
     *   the child process will receive a clone of the parent's file descriptor table, which
     *   contains the list of open descriptors. These are NOT the same descriptors, but DO
     *   communicate with the same IO.
     */
    FORK: 1,
    /**
     * Execute a new process. This call will immediately terminate the requesting process,
     * so must be called 
     */
    EXEC: 2,
};