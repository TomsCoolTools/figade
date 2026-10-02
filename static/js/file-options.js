/* Pure validation and geometry; no network or file persistence. */
(() => {
  function invalid(message, field) { const error = new Error(message); error.field = field; throw error; }
  function time(value, fallback, field) {
    const text = String(value).trim();
    if (!text) return fallback;
    const parts = text.split(':');
    if (parts.length > 3 || parts.some((part, index) => !(index === parts.length - 1 ? /^\d+(?:\.\d+)?$/ : /^\d+$/).test(part))) {
      invalid('Use seconds or a time such as 1:30 for the trim range.', field);
    }
    const numbers = parts.map(Number);
    if (parts.length > 1 && numbers[numbers.length - 1] >= 60 || parts.length === 3 && numbers[1] >= 60) {
      invalid('Seconds and minutes within a clock time must be below 60.', field);
    }
    const seconds = numbers.reduce((total, part) => total * 60 + part, 0);
    if (!Number.isFinite(seconds)) invalid('Enter a finite trim time.', field);
    return seconds;
  }
  function clipRange(duration, values) {
    const start = time(values.start, 0, 'trim-start');
    let end = time(values.end, duration, 'trim-end');
    if (start >= duration) invalid('Start time must be before the end of the video.', 'trim-start');
    if (end > duration + 0.01) invalid('End time must not be beyond the video length.', 'trim-end');
    end = Math.min(end, duration);
    if (end <= start) invalid('End time must be after start time.', 'trim-end');
    return {start, end, duration: end - start, trimmed: start > 0 || end < duration};
  }
  function pixel(value, field) {
    const text = String(value).trim();
    if (!text) return null;
    const number = Number(text);
    if (!Number.isInteger(number) || number < 1 || number > 8192) invalid('Enter whole pixel dimensions between 1 and 8192.', field);
    return number;
  }
  function imageBox(sourceWidth, sourceHeight, values) {
    const requestedWidth = pixel(values.width, 'image-width');
    const requestedHeight = pixel(values.height, 'image-height');
    if (requestedWidth === null && requestedHeight === null) return {exact: false};
    const width = requestedWidth ?? Math.max(1, Math.round(sourceWidth * requestedHeight / sourceHeight));
    const height = requestedHeight ?? Math.max(1, Math.round(sourceHeight * requestedWidth / sourceWidth));
    if (width > 8192 || height > 8192 || width * height > 16e6) invalid('Use smaller dimensions: the result must be at most 16 million pixels, with neither side above 8192.', requestedWidth !== null ? 'image-width' : 'image-height');
    return {exact: true, width, height, fit: requestedWidth !== null && requestedHeight !== null ? values.fit : 'contain',
      upscaled: width > sourceWidth || height > sourceHeight};
  }
  function imageDraw(sourceWidth, sourceHeight, width, height, fit) {
    const scale = fit === 'cover' ? Math.max(width / sourceWidth, height / sourceHeight) : Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale, drawHeight = sourceHeight * scale;
    return {x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight};
  }
  const api = {time, clipRange, imageBox, imageDraw};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else window.FigadeOptions = api;
})();
