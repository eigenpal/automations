declare module '*.md' {
  const text: string;
  export default text;
}
declare module '*.py' {
  const text: string;
  export default text;
}
declare module '*.bin' {
  const bytes: Uint8Array;
  export default bytes;
}
declare module '*.docx' {
  const bytes: Uint8Array;
  export default bytes;
}
