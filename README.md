# JNIX: the UNIX-inspired JavaScript OS nobody asked for!
Welcome to **JNIX**! I originally had a nice long typed up explanation here including goals for the project, but as of writing, a few days ago my laptop died so I lost all that work before I committed it :)

_Anyway_, to breifly explain, **JNIX** is my attempt - first and foremost of the point of learning about both the workings of *nix operating systems, and to explore JS concepts I have limited to no experience with (_such as Web Workers and IndexedDB_) - to create a sort of 'pseudo-OS' on top of JS in the browser, with the goal of basing a lot of the core concepts on the *nix way of doing things.

I _**really don't**_ expect to get anywhere with this project, but it's for fun!

The information below is being actively added to and changed, and is pretty much a summary of my current plans or ideas as they develop.

## Filesystem Approach
The UNIX filesystem is a very important part of the OS, so here's my plan at the moment of how to implement it.

At the moment, I'm planning to stick close to the `inode` approach, but with some changes with how it makes sense to do things in JS:

`inodes` are keys, where the key is a positive integer. The value of the `inode` is file metadata, stored as JSON with the structure:
```json5
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
    See https://www.kernel.org/doc/html/latest/filesystems/ext4/inodes.html?highlight=inode#i-mode
    */
    "mode": 256

}
```
*On IndexedDB*, each disk contains a list of partitions, and each partition has an accompanying store containing the `inodes`. A disk has the name `idbX`, where `X` is a positive number.

Disks are separate IndexedDB Databases, and their `objectStores` contain both their list of partitions, and those partitions' metadata (as `PARTITION_NAMEmeta`), which includes the list of `inodes`, their name, etc:
```json5
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

**Update**: an idea for approaching file handling better, which overcomes the issue of one transaction at a time for writing to files, giving control back to the Kernel over the filesystem, and hopefully reducing the likelyhood of memory leaks (a process can be automatically deregistered from a file this way if it no longer appears to be active), while also making it a lot simpler to abstract and centralise the implementation of the VFS.

The new plan is to make use of the `MessageChannel` API. Essentially, a process will send a syscall (lingo for request in this case) to the Kernel to ask to open a file for reading or writing, or both. The Kernel maintains a second process table which does not contribute to the `PID` table, which has a list of open file "handlers". Each file handler is a Worker instantiated by the Kernel for that file.

When a process asks for a handle to a file, the Kernel checks if a handler exists. If not, it creates one with init information regarding which file, and adds it to the table. Once this is done, or if a file handler already existed, it sends a message to the handler detailing the `UID`, `GID` and `PID` of the requesting process, and the mode they wish to open the file in.

The handler decides whether or not to accept this - depending on if the permissions line up correctly with the file's permissions. If the handler declines, the Kernel passes along this. If the handler accepts, it creates a new `MessageChannel` for the process. The handler sends the `port2` back to the Kernel, which forwards it to the process.

Now, the process can directly communicate with this file handler, and ask it to perform the operations allows with the requested mode. The result of this, is a first-come-first-serve system that allows multiple programs to access the same file, but in a synchronous manor, so that multiple reads and writes can be queued with order maintained.

This also removes a lot of complexity for the process, and for `stdlib` - rather than handling actual files, or requiring any information about the disk setup, or any issues regarding multiple processes writing at once, a process can simply request a handle to read or write to a file, and no matter if that file exists on `IndexedDB`, in a Virtual filesystem (such as `/proc`), or may be a device, or otherwise non-standard file, the communication method remains the same, and processes only worry about reading and writing.

## Kernel Modules
Kernel modules are going to be an important part of making this OS work - interacting with the display as a Canvas, getting keyboard and mouse, etc, even the filesystem itself need portions as modules to function.

The current plan for implementing these modules, is to make use of something a bit safer than `IndexedDB` - in terms of, the processes can't modify it. This is where `localStorage` comes in. `localStorage` is the plan for storing two things:

  1. Which partition to boot off
  2. Kernel modules to load at startup

The important part here, is the Kernel module list. Kernel modules will be referenced either by an absolute path on the server - this includes anything base included with the OS, such as the `display` driver, `keyboard`, `terminal` (which will govern the `ttyX` sessions, in terms of supplying them with keyboard input, and drawing their output to the display, unless another driver uses the display instead.)

Kernel modules are the most dangerous territory in the OS, aside from the Kernel itself! Unhandled errors here *will* crash the entire system - which to an extent is a good thing, in preventing buggy code making it here.

## Compiling and binaries!
My latest terrible idea in every way: a *compiler*!

### The problem
Somewhat concerningly late into the start of this project, I've only just found out that `ES Modules` loaded from a `Blob` object url do *not* have the same context to `import` from as ones directly loaded from the web server. This definitely is something that should've been checked out much earlier into the project, but oh well, here we are.

Additionally, a goal here includes being able to import libraries dynamically in programs at runtime - of which it becomes *very* messy trying to organise that, and requires extra communication between the process and Kernel... all in all, messy and inefficient.

### The (horrible) solution
In actual metal operating systems, file types do in fact exist, shocking as that is! Anyway, the solution I've come up with involves making use of that - no more bare `.js` files as programs (though, this may still be useful as an alternative scripting language for running in the shell). Instead, executable binaries will be a "compiled" format - using this term loosely.

Essentially, a linker program will run over JS scripts in search of `import` statements, and depending on whether they are specified as dynamically or statically linked, do one of:

**If the exectuable is statically linked**, the import statement will be converted to a function closure which should serve the same purpose - the linker will load the associated library and replace it a bit like so:
```js
import fs from '/js/lib/fs';
```
Compiles to:
```js
const fs = (function(){
async function open( fname ) {
  /// ...
} 

async function write( fd ) {
  /// ...
}

return {
  open: open,
  write: write
};
})();
```
This does enforce some requirements on libraries. Namely, libraries MUST use `export default`, with an object associating all its exports, rather than the nicer syntax of exporting individual things.

`export default {...}` is picked up on library import and converted to `return {...}`, which completes this very silly solution.

The linking process will work a bit like a 'baked' version of how modules are resolved in regular ES modules: the linker builds a dependency graph, and uses this to determine the final order that everything should be placed in the file to provide all the needed dependencies. To prevent leaking dependencies into the final scope, it looks like the final solution may involve layers of nested closure whenever dependencies are not `import`ed by the final files.

**For example:**

`main.mjs`:
```js
import examplelib from '/usr/lib/examplelib.mjs';
import libjsh from '/js/lib/libjsh.mjs';

libjsh.exec(`echo ${examplelib.hi()}`);
```

`examplelib.mjs`:
```js
import fs from '/js/lib/fs.mjs';

function hi() {
  fs.write( 0, 'hi from examplelib' );
  return 'hi :)';
}

export default {
  hi: hi
};
```

`libjsh.mjs`:
```js
import fs from '/js/lib/fs.mjs';

function exec( string ) {
  // ... (example code)
  const cmd = string.split(' ');
  if ( cmd[0] === 'echo' ) {
    fs.write( 0, cmd[1] );
  }
}

export default {
  exec: exec
};
```

**Compiles to, when statically linked:**
```js
const {examplelib,libjsh}=(function(){
const fs=(function(){
  // ... fs library
  return {
    write: write
  };
})();
return {
  examplelib:(function(){
    function hi() {
      fs.write( 0, 'hi from examplelib' );
      return 'hi :)';
    }

    return {
      hi: hi
    };
  })(),
  libjsh:(function(){
    function exec( string ) {
      // ... (example code)
      const cmd = string.split(' ');
      if ( cmd[0] === 'echo' ) {
        fs.write( 0, cmd[1] );
      }
    }

    return {
      exec: exec
    };
  })()
}
})();

libjsh.exec(`echo ${examplelib.hi()}`);
```

The linker traverses the imports and creates the graph to figure out which modules need what libraries:
```
                     ____________
                    |            |
                ____| examplelib |------.
   ______      |    |____________|   ___|____
  |      |     |                    |        |
  | main |-----|                    |   fs   |
  |______|     |     ____________   |________|
               |____|            |      |
                    |   libjsh   |------'
                    |____________|
```

With this, it knows that the entry point requires `examplelib` and `libjsh`. Both of these libraries require `fs`, so they are grouped together in the same closure, with `fs` brought in for them. This graph can go on continuously - main can import a library (`A`) which itself imports two libraries (`B` and `C`), while `C` also imports `B`.

This generates the closure structure a bit like:
```js
A -> (
  B -> (
    return B
  ),
  C = (
    ...using b,
    return C
  ),
  ...using B, C,
  return A 
)
```
This means that libraries only exist in the order and context needed and wont interfere with eachother.

---

**If the executable is dynamically linked**, the linker will mark the executable as dynamic (*TODO: decide on structure of executables and magic bytes for checking type*). At runtime, the same linking process will occur as shown in the static example.

---

**NOTE:** the `/js` directory is apart of the Virtual Filesystem, and will be handled by a Kernel Module as a wrapper for the webserver's own `/js` directory. To me this seems like an okay solution to standardise the way that libraries are loaded whether they are located locally, or on the web server itself.

There are *absolutely* more robust and efficient ways of doing this, but this solution preserves intellisense

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