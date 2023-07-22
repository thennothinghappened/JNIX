# JNIX: the UNIX-inspired JavaScript OS nobody asked for!
Welcome to **JNIX**! I originally had a nice long typed up explanation here including goals for the project, but as of writing, a few days ago my laptop died so I lost all that work before I committed it :)

_Anyway_, to breifly explain, **JNIX** is my attempt - first and foremost of the point of learning about both the workings of *nix operating systems, and to explore JS concepts I have limited to no experience with (_such as Web Workers and IndexedDB_) - to create a sort of 'pseudo-OS' on top of JS in the browser, with the goal of basing a lot of the core concepts on the *nix way of doing things.

I _**really don't**_ expect to get anywhere with this project, but it's for fun!

## Filesystem Approach
The UNIX filesystem is a very important part of the OS, so here's my plan at the moment of how to implement it.

At the moment, I'm planning to stick close to the `inode` approach, but with some changes with how it makes sense to do things in JS:

`inodes` are keys, where the key is a positive integer. The value of the `inode` is file metadata, stored as JSON with the structure:
```json
{
    /*
    The name of the partition the file data is stored on.
    For `idb` disks (ones that exist in indexedDB), the format is `idbXpY`, where X is the unique number of the disk, and Y is the partition number.
    */
    "p": "p1",
    /*
    `serial node` of the file, AKA the key of its actual data.
    The number here MUST be the same as the number of this inode.
    */
    "sn": 25,

    // The User ID of the owner of this file.
    "uid": 0,
    // The Group ID of the owner of this file.
    "gid": 0,

    /*
    Permission information about this file.
    We store the mode here the same way you'll see it appear in chmod, and as an array as that makes things slightly less verbose to read permissions back.
    
    The numbers, in order, are the permissions for user, group, everyone.

    read    = 4
    write   = 2
    execute = 1

    4 + 2 + 1 = 7, so all permissions = 7.

    These permissions can be converted back using:
    read    = mode[index] & 0b100 >>> 2
    write   = mode[index] &  0b10 >>> 1
    execute = mode[index] &   0b1 >>> 0
    */
    "mode": [7, 7, 7]

}
```
*On IndexedDB*, each disk contains a list of partitions, and each partition has an accompanying store containing the `inodes`. A disk has the name `idbX`, where `X` is a positive number.

Disks are separate IndexedDB Databases, and their `objectStores` contain both their list of partitions, and those partitions' metadata (as `PARTITION_NAMEmeta`), which includes the list of `inodes`, their name, etc:
```json
// Top level databases
{
    "idb0": {
        "p0": {
            // ... file serial nodes
        },
        "p0meta": {
            // [Optional], display name for the partition
            "name": "JNIX Boot partition",

            // ... inodes
        }
    }
}
```

Important to note, that a filesystem driver must only expose an expected interface for a filesystem. The `IndexedDB` driver is always loaded as a Kernel module, but other drivers could exist.

_Unfortunately_ as there's no true way (especially without massively degrading the coding experience) to sandbox Web Workers, or to properly "control" their access to IndexedDB, or similar APIs. This means a level of cooperation is required between the Kernel (main thread) and Workers to keep things running properly. The intention is for a library to be imported to every Worker instance - this being our `stdlib`, which will be in charge of properly communicating intent to the Kernel. `stdlib` will control process initialisation, including receiving an `INIT` message from the Kernel which tells it required initial info, such as:
  - **Who we are**: our `uid` and `gid`. This is useful so we can avoid bothering the Kernel asking for permission for things unless needed - while I again say that permissions don't really mean anything when IndexedDB can be directly accessed, programs who choose to "play nice" will work with the permissions system. Programs which don't play nice might mess a while lot of things up, unless they implement a lot of `stdlib` themselves to properly communicate with the Kernel, it'll shut them down.
  - **Environment variables**: key-value list of env vars.
  - **Arguments**: which arguments we were launched with.
  
This info will appear as a struct in the form:
```json
{
    "uid": 0,
    "gid": 0,
    "env": {

    },
    "args": [
        "/usr/bin/this_program", "--help"
    ]
}
```
Which `stdlib` will populate automatically for the program.

## Goals

### Initial
Some of these goals are mainly just to check my own understanding of JS APIs, mainly in Web Workers, IndexedDB and Canvas (mainly `OffscreenCanvas`)
  - [x] Check multiple threads reading same file a lot works
  - [x] Check drawing multiple `OffscreenCanvas` to one Canvas, and a pseudo-compositor ( possibly planning to make a pseudo-Xorg later :) )
  - [ ] Start work on the Kernel
    - [ ] Process Scheduler
      - [ ] Handle starting multiple processes, and 2-way communication between them and the Kernel
        - [ ] Some kind of message bus? - IPC of some kind to let processes talk to eachother, like `dbus`?
      - [ ] Some kind of service system, like systemd? Unsure if this would run as apart of the Scheduler, or would be something separate.
    - [ ] "Kernel Modules", basically stuff that gets to run on the main thread. In this way they're apart of the Kernel, since they have full access to everything, and if something crashes here, the whole system crashes. These modules would probably include the `systemd` equivalent as it needs to talk directly to the Scheduler with full authority, and a "display" module which is in charge of setting up the Canvas for the terminal to draw to, or possibly any other thing that can draw. \
  <br>
  - [ ] Very basic Terminal, at the moment it makes sense to me as a two-part system: on the Kernel side setting up a Canvas and input handling, which get sent off to the Terminal thread, which sets up a shell instance (let's call it `jsh` for "JavaScript Hell", obviously!) as another process, which itself can create further child processes to execute the commands its asked to. The terminal passes `stdin` (the input we got earlier) into the shell, which itself can choose to pass that onto the running child process, while all of their `stdout`s are printed to the terminal.
  - [ ] Basic filesystem implementation: `indexedDB` disks + driver interface.