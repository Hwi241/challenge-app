const {
  TextEncoder,
  TextDecoder,
} = require('text-encoding');

const root = (
  typeof globalThis !== 'undefined'
    ? globalThis
    : (
      typeof global !== 'undefined'
        ? global
        : null
    )
);

if (
  root
  && typeof root.TextEncoder
    !== 'function'
) {
  root.TextEncoder =
    TextEncoder;
}

if (
  root
  && typeof root.TextDecoder
    !== 'function'
  && typeof TextDecoder
    === 'function'
) {
  root.TextDecoder =
    TextDecoder;
}

if (
  typeof global !== 'undefined'
  && typeof global.TextEncoder
    !== 'function'
) {
  global.TextEncoder =
    root?.TextEncoder
    || TextEncoder;
}

if (
  typeof global !== 'undefined'
  && typeof global.TextDecoder
    !== 'function'
  && typeof TextDecoder
    === 'function'
) {
  global.TextDecoder =
    root?.TextDecoder
    || TextDecoder;
}
