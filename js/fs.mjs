/**
 * JNIX IndexedDB filesystem based on the UNIX
 * approach. 'Everything is a file!'
 * 
 * Provides an API for reading and writing to files,
 * for the most part IndexedDB can take care of ensuring
 * no processes may write to the same file at the same time.
 * 
 * The approach for the filesystem will mainly be based
 * on my knowledge of UNIX - which is pretty limited so
 * likely to have many differences, also in the limitations
 * and what the browser APIs are best at.
 * 
 * The DB will contain a table of inodes, which instead of
 * referencing the location data is stored, the keys themselves
 * have the data in the value.
 * 
 * Folders are nodes as any other file, which will contain an
 * array of inodes which themselves may point to other files,
 * symlinks, pipes etc.
 */

