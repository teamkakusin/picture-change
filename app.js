// app.js — Canvas ベースの画像・動画処理（ドット化・色数変更・解像度変更・VHS・レトロポスタライズ）
(() => {
  const fileInput = document.getElementById('fileInput');
  const videoInput = document.getElementById('videoInput');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint');
  const videoEl = document.getElementById('video');

  const scaleEl = document.getElementById('scale');
  const scaleVal = document.getElementById('scaleVal');
  const pixelSizeEl = document.getElementById('pixelSize');
  const pixelVal = document.getElementById('pixelVal');
  const colorsEl = document.getElementById('colors');
  const colorsVal = document.getElementById('colorsVal');

  const vhsToggle = document.getElementById('vhsToggle');
  const vhsStrength = document.getElementById('vhsStrength');
  const vhsStrengthVal = document.getElementById('vhsStrengthVal');
  const vhsShift = document.getElementById('vhsShift');
  const vhsShiftVal = document.getElementById('vhsShiftVal');
  const vhsNoise = document.getElementById('vhsNoise');
  const vhsNoiseVal = document.getElementById('vhsNoiseVal');

  const sampleToggle = document.getElementById('sampleToggle');
  const posterLevels = document.getElementById('posterLevels');
  const posterVal = document.getElementById('posterVal');
  const borderSize = document.getElementById('borderSize');
  const borderVal = document.getElementById('borderVal');
  const glowStrength = document.getElementById('glowStrength');
  const glowVal = document.getElementById('glowVal');

  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const stopVideoBtn = document.getElementById('stopVideoBtn');

  let img = null; // HTMLImageElement for stills
  let originalWidth = 0;
  let originalHeight = 0;
  let playingVideo = false;
  let videoURL = null;

  // UI bind
  scaleEl.addEventListener('input', () => { scaleVal.textContent = scaleEl.value + '%'; renderIfStatic(); });
  pixelSizeEl.addEventListener('input', () => { pixelVal.textContent = pixelSizeEl.value; renderIfStatic(); });
  colorsEl.addEventListener('input', () => { colorsVal.textContent = colorsEl.value; renderIfStatic(); });

  vhsToggle.addEventListener('change', renderIfStatic);
  vhsStrength.addEventListener('input', () => { vhsStrengthVal.textContent = vhsStrength.value; renderIfStatic(); });
  vhsShift.addEventListener('input', () => { vhsShiftVal.textContent = vhsShift.value; renderIfStatic(); });
  vhsNoise.addEventListener('input', () => { vhsNoiseVal.textContent = vhsNoise.value; renderIfStatic(); });

  sampleToggle.addEventListener('change', renderIfStatic);
  posterLevels.addEventListener('input', () => { posterVal.textContent = posterLevels.value; renderIfStatic(); });
  borderSize.addEventListener('input', () => { borderVal.textContent = borderSize.value; renderIfStatic(); });
  glowStrength.addEventListener('input', () => { glowVal.textContent = glowStrength.value; renderIfStatic(); });

  downloadBtn.addEventListener('click', downloadImage);
  resetBtn.addEventListener('click', resetControls);
  stopVideoBtn.addEventListener('click', stopVideo);

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) loadFile(f);
  });
  videoInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) loadVideo(f);
  });

  // Drag & drop
  document.addEventListener('dragover', (e) => { e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      if (f.type.startsWith('video/')) loadVideo(f); else loadFile(f);
    }
  });

  function loadFile(file) {
    stopVideo();
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      img = image;
      originalWidth = image.width;
      originalHeight = image.height;
      hint.style.display = 'none';
      downloadBtn.disabled = false;
      render();
    };
    image.onerror = () => { alert('画像の読み込みに失敗しました'); URL.revokeObjectURL(url); };
    image.src = url;
  }

  function loadVideo(file) {
    // Stop any existing video
    stopVideo();
    const url = URL.createObjectURL(file);
    videoURL = url;
    videoEl.src = url;
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playbackRate = 1.0;
    videoEl.onloadedmetadata = () => {
      originalWidth = videoEl.videoWidth;
      originalHeight = videoEl.videoHeight;
      hint.style.display = 'none';
      downloadBtn.disabled = true; // download from video not supported; can add capture later
      stopVideoBtn.disabled = false;
      playingVideo = true;
      videoEl.play().then(() => {
        requestAnimationFrame(videoFrameLoop);
      }).catch(() => { requestAnimationFrame(videoFrameLoop); });
    };
    videoEl.onerror = () => { alert('動画の読み込みに失敗しました'); URL.revokeObjectURL(url); };
  }

  function stopVideo(){
    playingVideo = false;
    stopVideoBtn.disabled = true;
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    }
    if (videoURL) { URL.revokeObjectURL(videoURL); videoURL = null; }
  }

  function resetControls() {
    scaleEl.value = 100; scaleVal.textContent = '100%';
    pixelSizeEl.value = 1; pixelVal.textContent = '1';
    colorsEl.value = 256; colorsVal.textContent = '256';
    vhsToggle.checked = false; vhsStrength.value = 0.5; vhsStrengthVal.textContent = '0.5';
    vhsShift.value = 6; vhsShiftVal.textContent = '6'; vhsNoise.value = 0.05; vhsNoiseVal.textContent = '0.05';
    sampleToggle.checked = false; posterLevels.value = 6; posterVal.textContent = '6';
    borderSize.value = 30; borderVal.textContent = '30'; glowStrength.value = 0.6; glowVal.textContent = '0.6';
    render();
  }

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function renderIfStatic(){ if (!playingVideo) render(); }

  function render() {
    if (!img) return;

    // Compute target size based on scale
    const scale = clamp(parseInt(scaleEl.value, 10) / 100, 0.1, 3);
    let targetW = Math.max(1, Math.round(originalWidth * scale));
    let targetH = Math.max(1, Math.round(originalHeight * scale));

    const border = parseInt(borderSize.value, 10);

    // Cap to avoid extremely large canvases
    const MAX_DIM = 2048;
    if (targetW > MAX_DIM || targetH > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
      targetW = Math.round(targetW * ratio);
      targetH = Math.round(targetH * ratio);
    }

    // Expand for border
    canvas.width = targetW + border*2;
    canvas.height = targetH + border*2;

    // Fill border (black)
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Draw image into center
    ctx.drawImage(img, border, border, targetW, targetH);

    // Get image data (only inner area)
    let imageData = ctx.getImageData(border, border, targetW, targetH);

    // Apply pixelation (ドット化)
    const pixelSize = parseInt(pixelSizeEl.value, 10);
    if (pixelSize > 1) {
      imageData = applyPixelate(imageData, pixelSize);
    }

    // Apply color quantization (色数変更)
    const colors = parseInt(colorsEl.value, 10);
    if (colors < 256) {
      imageData = applyColorQuantization(imageData, colors);
    }

    // Apply sample posterize filter if enabled
    if (sampleToggle.checked) {
      imageData = applyPosterize(imageData, parseInt(posterLevels.value,10));
      applyVignette(imageData, parseFloat(glowStrength.value));
    }

    // Put processed data back
    ctx.putImageData(imageData, border, border);

    // Apply VHS filter on top if enabled
    if (vhsToggle.checked) {
      applyVHS(ctx, canvas.width, canvas.height, {
        strength: parseFloat(vhsStrength.value),
        shift: parseInt(vhsShift.value, 10),
        noise: parseFloat(vhsNoise.value)
      });
    }

    // If sample enabled, draw additional red glow/stripe near bottom (like sample)
    if (sampleToggle.checked) {
      drawSampleAccent(ctx, canvas.width, canvas.height, border, targetW, targetH, parseFloat(glowStrength.value));
    }
  }

  function videoFrameLoop(){
    if (!playingVideo) return;
    if (videoEl.readyState >= 2) {
      // Compute target size based on scale
      const scale = clamp(parseInt(scaleEl.value, 10) / 100, 0.1, 3);
      let targetW = Math.max(1, Math.round(originalWidth * scale));
      let targetH = Math.max(1, Math.round(originalHeight * scale));

      const border = parseInt(borderSize.value, 10);
      const MAX_DIM = 2048;
      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }

      canvas.width = targetW + border*2;
      canvas.height = targetH + border*2;
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight, border, border, targetW, targetH);

      let imageData = ctx.getImageData(border, border, targetW, targetH);

      const pixelSize = parseInt(pixelSizeEl.value, 10);
      if (pixelSize > 1) imageData = applyPixelate(imageData, pixelSize);
      const colors = parseInt(colorsEl.value, 10);
      if (colors < 256) imageData = applyColorQuantization(imageData, colors);
      if (sampleToggle.checked) { imageData = applyPosterize(imageData, parseInt(posterLevels.value,10)); applyVignette(imageData, parseFloat(glowStrength.value)); }
      ctx.putImageData(imageData, border, border);
      if (vhsToggle.checked) applyVHS(ctx, canvas.width, canvas.height, { strength: parseFloat(vhsStrength.value), shift: parseInt(vhsShift.value,10), noise: parseFloat(vhsNoise.value) });
      if (sampleToggle.checked) drawSampleAccent(ctx, canvas.width, canvas.height, border, targetW, targetH, parseFloat(glowStrength.value));
    }
    requestAnimationFrame(videoFrameLoop);
  }

  // Pixelate by drawing low-res blocks and sampling their average
  function applyPixelate(imageData, block) {
    const w = imageData.width, h = imageData.height;
    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);

    for (let y = 0; y < h; y += block) {
      for (let x = 0; x < w; x += block) {
        let r=0,g=0,b=0,a=0,count=0;
        for (let yy=0; yy<block && y+yy<h; yy++){
          for (let xx=0; xx<block && x+xx<w; xx++){
            const idx = ((y+yy)*w + (x+xx)) * 4;
            r += src[idx]; g += src[idx+1]; b += src[idx+2]; a += src[idx+3];
            count++;
          }
        }
        r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count); a = Math.round(a/count);
        for (let yy=0; yy<block && y+yy<h; yy++){
          for (let xx=0; xx<block && x+xx<w; xx++){
            const idx = ((y+yy)*w + (x+xx)) * 4;
            out[idx]=r; out[idx+1]=g; out[idx+2]=b; out[idx+3]=a;
          }
        }
      }
    }

    return new ImageData(out, w, h);
  }

  // Simple color quantization via per-channel reduction to approximate total colors
  function applyColorQuantization(imageData, targetColors) {
    const w = imageData.width, h = imageData.height;
    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);

    const totalBits = Math.max(1, Math.round(Math.log2(Math.max(2,targetColors))));
    const bitsPerChannel = Math.max(1, Math.round(totalBits / 3));
    const levels = Math.pow(2, bitsPerChannel);
    const step = 256 / levels;

    for (let i=0;i<src.length;i+=4){
      out[i]   = Math.floor(src[i] / step) * step + step/2;
      out[i+1] = Math.floor(src[i+1] / step) * step + step/2;
      out[i+2] = Math.floor(src[i+2] / step) * step + step/2;
      out[i+3] = src[i+3];
    }

    return new ImageData(out, w, h);
  }

  // Posterize (sample-like) by reducing channel levels
  function applyPosterize(imageData, levels) {
    const w = imageData.width, h = imageData.height;
    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);
    const step = 256 / levels;
    for (let i=0;i<src.length;i+=4){
      out[i]   = Math.floor(src[i]/step) * step + step/2;
      out[i+1] = Math.floor(src[i+1]/step) * step + step/2;
      out[i+2] = Math.floor(src[i+2]/step) * step + step/2;
      out[i+3] = src[i+3];
    }
    return new ImageData(out, w, h);
  }

  // Vignette / glow applied on pixel data (approx)
  function applyVignette(imageData, strength) {
    const w = imageData.width, h = imageData.height;
    const data = imageData.data;
    const cx = w/2, cy = h/2;
    const maxd = Math.sqrt(cx*cx + cy*cy);
    for (let y=0; y<h; y++){
      for (let x=0; x<w; x++){
        const dx = x - cx, dy = y - cy;
        const d = Math.sqrt(dx*dx + dy*dy);
        const t = d / maxd; // 0 center -> 1 corner
        const v = 1 - (t * strength * 0.9); // retain center
        const i = (y*w + x)*4;
        data[i] = clamp(Math.round(data[i] * v), 0, 255);
        data[i+1] = clamp(Math.round(data[i+1] * v), 0, 255);
        data[i+2] = clamp(Math.round(data[i+2] * v), 0, 255);
      }
    }
  }

  // VHS filter: chroma shift, scanlines, noise, slight color bleed
  function applyVHS(ctx, w, h, opts){
    const strength = clamp(opts.strength || 0.5, 0, 1);
    const shift = Math.round(opts.shift || 6);
    const noiseAmount = clamp(opts.noise || 0.05, 0, 1);

    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; const tctx = tmp.getContext('2d');
    tctx.drawImage(canvas, 0, 0);

    const rgb = tctx.getImageData(0,0,w,h);
    const rImg = tctx.createImageData(w,h);
    const gImg = tctx.createImageData(w,h);
    const bImg = tctx.createImageData(w,h);

    for (let i=0;i<rgb.data.length;i+=4){
      rImg.data[i] = rgb.data[i]; rImg.data[i+3]=rgb.data[i+3];
      gImg.data[i+1] = rgb.data[i+1]; gImg.data[i+3]=rgb.data[i+3];
      bImg.data[i+2] = rgb.data[i+2]; bImg.data[i+3]=rgb.data[i+3];
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - 0.25*strength;
    ctx.drawImage(tmp,0,0);

    function drawChannel(imgData, dx, dy, composite='lighter'){
      const c = document.createElement('canvas'); c.width = w; c.height = h; const cc = c.getContext('2d');
      cc.putImageData(imgData,0,0);
      ctx.globalCompositeOperation = composite;
      ctx.globalAlpha = 0.75*strength;
      ctx.drawImage(c, dx, dy);
    }

    drawChannel(rImg, -shift, 0, 'lighter');
    drawChannel(gImg, 0, 0, 'lighter');
    drawChannel(bImg, shift, 0, 'lighter');

    // Scanlines
    const scanline = ctx.getImageData(0,0,w,h);
    for (let y=0;y<h;y++){
      if (y % 2 === 0){
        const dark = 1 - 0.15*strength;
        for (let x=0;x<w;x++){
          const idx = (y*w + x) * 4;
          scanline.data[idx] = Math.round(scanline.data[idx] * dark);
          scanline.data[idx+1] = Math.round(scanline.data[idx+1] * dark);
          scanline.data[idx+2] = Math.round(scanline.data[idx+2] * dark);
        }
      }
    }
    ctx.putImageData(scanline,0,0);

    // Noise overlay
    const noise = ctx.getImageData(0,0,w,h);
    for (let i=0;i<noise.data.length;i+=4){
      const n = (Math.random()*2-1) * 255 * noiseAmount * strength;
      noise.data[i]   = clamp(noise.data[i] + n, 0, 255);
      noise.data[i+1] = clamp(noise.data[i+1] + n, 0, 255);
      noise.data[i+2] = clamp(noise.data[i+2] + n, 0, 255);
    }
    ctx.putImageData(noise,0,0);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Draw sample accent: bottom red glow/stripe and faint frame-like cropping
  function drawSampleAccent(ctx, canvasW, canvasH, border, targetW, targetH, glowStrength){
    // red glow near center-bottom
    const g = ctx.createRadialGradient(canvasW/2, border + targetH*0.6, 10, canvasW/2, border + targetH*0.6, Math.max(targetW, targetH));
    const gAlpha = clamp(glowStrength, 0, 1);
    g.addColorStop(0, 'rgba(180,20,20,' + (0.75*gAlpha) +')');
    g.addColorStop(0.6, 'rgba(80,10,10,' + (0.25*gAlpha) +')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvasW,canvasH);
    ctx.globalCompositeOperation = 'source-over';

    // bottom stripe (scanline-like)
    const stripeH = Math.max(2, Math.round(targetH * 0.02));
    const sy = border + targetH - stripeH - Math.round(targetH*0.01);
    ctx.fillStyle = 'rgba(200,30,30,0.20)';
    ctx.fillRect(border, sy, targetW, stripeH);

    // faint inner crop (simulating film frame)
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = Math.max(1, border*0.03);
    ctx.strokeRect(border+2, border+2, targetW-4, targetH-4);
  }

  function downloadImage(){
    // For images we enable download; for videos we disabled earlier
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'picture-change.png';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Initial hint state
  hint.style.display = 'flex';
})();
