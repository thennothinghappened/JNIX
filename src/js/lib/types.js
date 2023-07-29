/**
 * Type definitions shared between the Kernel and processes.
 */

/**
 * @template { any } T
 * @typedef Message<T> Message sent between Kernel and Threads
 * @prop { number } identifier
 * @prop { T } data
 */

/**
 * @template { any } T
 * @typedef { MessageEvent<Message<T>> } ThreadMessageEvent
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
 * Interval between heartbeat signals.
 * 
 * Used as max length in milliseconds in which a program must
 * respond to a {@link Signal.HEARTBEAT}, before the Kernel
 * will assume it to have crashed or otherwise stopped unexpectedly.
 * 
 * If a program does not respond in time, the Kernel will **KILL**
 * the process. This means:
 * - Child processes (spawned with {@link Syscall.FORK})
 *   will be assigned as children of PID `0`.
 * - File descriptors opened by the process will be closed.
 * 
 * @see {@link Syscall.HEARTBEAT}
 */
export const heartbeat_interval = 1000;

/**
 * Signals sent to processes by the Kernel
 * @readonly
 * @enum { number }
 */
export const Signal = {
    /** Sent on process initialisation */
    INIT: 0,
    /**
     * Sent to both parent and child processes on forking.
     * 
     * For parent process, the {@link KMessage.data} will be the pid of the new process.
     * 
     * For the child process, the {@link KMessage.data} will be a list of file descriptors - cloned
     * from the parent process.
     */
    FORKED: 1,
    /**
     * Sent in reply when a Syscall fails.
     * 
     * The {@link KMessage.data} for this Signal will be an {@link ErrorNumber}, corresponding to
     * the problem.
     */
    ERROR: 2,
    /**
     * Sent periodically to check that the program is still alive.
     * Unfortunately, there doesn't seem to be a specific way to tell if
     * a Web Worker is still running, so this message makes the most sense.
     * 
     * If not responded to within a
     */
    HEARTBEAT: 3,
    /**
     * Sent when the process is reassigned to a new Parent Process ID.
     */
    NEWPPID: 4,
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
     * - After receiving the {@link Syscall.INIT} syscall reply, the {@link Signal.FORKED} signal will be sent to both parent
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
    /**
     * Response to {@link Signal.HEARTBEAT}
     * @see {@link heartbeat_interval}
     */
    HEARTBEAT: 3,
    /**
     * Sent upon the process quitting regularly.
     * 
     * The `data` for this syscall contains the exit code integer.
     * 
     * This syscall will prompt the Kernel to close all associated file descriptors,
     * and any other normal cleanup behaviour, including assigning the `ppid` of 
     * all child processes to `0`.
     * 
     * This call will immediately prompt the Kernel to exit the process, so should
     * be called only after any required cleanup work is done by the process, including
     * closing any special IPC.
     * 
     * Any writes to a file descriptor should always be `await`ed, before exiting -
     * due to the multi-threaded environment, a situation in which a write is sent
     * before a process is exited leaves it indeterminate whether or not the write
     * will occur.
     */
    EXIT: 4,
};

/**
 * Enum of error numbers, associated with {@link Signal.ERROR}, explaining the particular error.
 * @readonly
 * @enum { number }
 */
export const ErrorNumber = {

};