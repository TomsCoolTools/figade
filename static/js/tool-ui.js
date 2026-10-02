/* Shared file selection, accessible progress, and result presentation. */
(() => {
  const byId = id => document.getElementById(id);
  const tool = document.querySelector('.tool');
  const action = byId('go').textContent;
  let busy = false, reading = false, resultUrl = null;
  const scrollOptions = () => ({block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  const size = bytes => bytes < 1e6 ? `${(bytes / 1000).toFixed(1)} KB` : `${(bytes / 1e6).toFixed(2)} MB`;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function updateControls() {
    tool.querySelectorAll('input, select, .chip, #reset').forEach(node => { node.disabled = busy || node.dataset.unavailable === 'true'; });
    byId('go').disabled = busy || reading;
    byId('go').textContent = busy ? 'Processing…' : reading ? 'Reading file…' : action;
    // Keep live status and progress available to assistive technology during a job.
    byId('out').setAttribute('aria-busy', String(busy));
    if (byId('cancel')) {
      byId('cancel').hidden = !busy;
      byId('cancel').disabled = false;
      byId('cancel').textContent = 'Cancel';
    }
  }
  function clearResult() {
    const video = byId('out').querySelector('video');
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    byId('out').replaceChildren();
    tool.classList.remove('has-result');
    byId('reset').hidden = true;
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
  }
  function progress(fraction) {
    const bar = byId('bar');
    if (!bar) return;
    const percent = Math.max(0, Math.min(100, Math.round(fraction * 100)));
    bar.hidden = false;
    bar.setAttribute('aria-valuenow', String(percent));
    bar.firstElementChild.style.width = `${percent}%`;
    byId('progress-text').hidden = false;
    byId('progress-text').textContent = percent === 100 ? 'Finishing this attempt…' : `${percent}% of this attempt`;
  }
  function resetProgress() {
    if (!byId('bar')) return;
    byId('bar').hidden = true;
    byId('bar').setAttribute('aria-valuenow', '0');
    byId('bar').firstElementChild.style.width = '0%';
    byId('progress-text').hidden = true;
  }
  function selected(f) {
    clearResult(); resetProgress();
    tool.classList.add('has-file');
    byId('file-summary').textContent = `${f.name} (${size(f.size)})`;
    byId('log').textContent = 'Nothing yet.';
    delete byId('log').dataset.on;
  }
  function renderResult({blob, name, originalSize, width, height, sound, warning, note, maxBytes, limitLabel, clipLabel}) {
    clearResult();
    const out = new File([blob], name, {type: blob.type});
    resultUrl = URL.createObjectURL(out);
    const section = element('section', 'result');
    section.setAttribute('aria-labelledby', 'result-title');
    const heading = element('h2', '', blob.type.startsWith('image/') ? 'Your JPG is ready' : 'Your MP4 is ready');
    heading.id = 'result-title'; heading.tabIndex = -1; section.append(heading);
    section.append(element('p', 'result-size', `${size(originalSize)} → ${size(blob.size)}`));
    if (maxBytes && blob.size <= maxBytes) section.append(element('p', 'result-fit', `Fits under ${limitLabel}`));
    if (warning) section.append(element('p', 'notice', warning));
    const stats = element('dl', 'result-stats');
    const reduction = (1 - blob.size / originalSize) * 100;
    const pairs = [['Original', size(originalSize)], ['Result', size(blob.size)],
      [reduction >= 0 ? 'Smaller by' : 'Larger by', `${Math.abs(reduction).toFixed(1)}%`],
      ['Dimensions', `${width} × ${height}`]];
    if (sound) pairs.push(['Sound', sound]);
    if (clipLabel) pairs.push(['Kept section', clipLabel]);
    for (const [label, value] of pairs) {
      const group = element('div'); group.append(element('dt', '', label), element('dd', '', value)); stats.append(group);
    }
    const details = element('details', 'result-details');
    details.append(element('summary', '', 'File details'), stats);
    if (note) details.append(element('p', 'control-help', note));
    const media = element(blob.type.startsWith('image/') ? 'img' : 'video');
    media.src = resultUrl; media.width = width; media.height = height;
    if (media.tagName === 'VIDEO') { media.controls = true; media.playsInline = true; media.preload = 'metadata'; }
    else media.alt = 'Preview of the compressed image';
    section.append(media);
    const acts = element('div', 'acts');
    const download = element('a', 'dl', blob.type.startsWith('image/') ? 'Download JPG' : 'Download MP4');
    download.href = resultUrl; download.download = name; acts.append(download);
    if (navigator.canShare && navigator.canShare({files: [out]})) {
      const share = element('button', 'share', 'Share file'); share.type = 'button';
      share.onclick = async () => {
        try { await navigator.share({files: [out]}); }
        catch (e) { if (e.name !== 'AbortError') { byId('st').textContent = 'Sharing failed. Use Download instead.'; byId('st').className = 'err'; } }
      };
      acts.append(share);
    }
    section.append(acts, details); byId('out').append(section); tool.classList.add('has-result'); byId('reset').hidden = false;
    heading.focus({preventScroll: true}); heading.scrollIntoView(scrollOptions());
    return out;
  }
  function chips(unit) {
    const value = Number(byId(unit).value);
    document.querySelectorAll(`[data-${unit}]`).forEach(button => {
      const pressed = Number(button.dataset[unit]) === value;
      button.classList.toggle('on', pressed); button.setAttribute('aria-pressed', String(pressed));
    });
  }
  function wireDrop(setFile, warm = () => {}) {
    let depth = 0;
    const hasFiles = event => event.dataTransfer && [...event.dataTransfer.types].includes('Files');
    addEventListener('dragenter', event => {
      if (!hasFiles(event)) return;
      event.preventDefault(); if (busy) return; warm(); depth++; document.body.classList.add('drag');
    });
    addEventListener('dragleave', event => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('drag');
    });
    addEventListener('dragover', event => { if (hasFiles(event)) event.preventDefault(); });
    addEventListener('drop', event => {
      if (!hasFiles(event)) return;
      event.preventDefault(); depth = 0; document.body.classList.remove('drag');
      if (busy) return;
      const f = event.dataTransfer.files[0]; if (!f) return;
      // Process only the first file, matching the single-file picker.
      try { const transfer = new DataTransfer(); transfer.items.add(f); byId('file').files = transfer.files; } catch (_) {}
      setFile(f); byId('file').focus({preventScroll: true}); byId('file').scrollIntoView(scrollOptions());
    });
  }
  window.FigadeTool = {
    size, selected, clearResult, renderResult, chips, wireDrop, progress, resetProgress,
    get busy() { return busy; },
    setReading(value) { reading = value; updateControls(); },
    setBusy(value) { busy = value; updateControls(); if (!value) resetProgress(); },
    reset() {
      clearResult(); resetProgress(); reading = false; tool.classList.remove('has-file');
      byId('file').value = ''; byId('est').textContent = ''; byId('st').textContent = '';
      byId('file-summary').textContent = 'No file selected.';
      byId('log').textContent = 'Nothing yet.'; delete byId('log').dataset.on;
      updateControls(); byId('file').focus();
    }
  };
  addEventListener('pagehide', clearResult);
})();
