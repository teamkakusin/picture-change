// app.js — Canvas ベースの画像処理（ドット化・色数変更・解像度変更・VHS）
(() => {
  const fileInput = document.getElementById('fileInput');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint');

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

  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');

  let img = null; // HTMLImageElement
  let originalWidth = 0;
  let originalHeight = 0;

  // UI bind
  scaleEl.addEventListener('input', () => { scaleVal.textContent = scaleEl.value + '%'; render(); });
  pixelSizeEl.addEventListener('input', () => { pixelVal.textContent = pixelSizeEl.value; render(); });
  colorsEl.addEventListener('input', () => { colorsVal.textContent = colorsEl.value; render(); });

  vhsToggle.addEventListener('change', render);
  vhsStrength.addEventListener('input', () => { vhsStrengthVal.textContent = vhsStrength.value; render(); });
  vhsShift.addEventListener('input', () => { vhsShiftVal.textContent = vhsShift.value; render(); });
  vhsNoise.addEventListener('input', () => { vhsNoiseVal.textContent = vhsNoise.value; render(); });

  downloadBtn.addEventListener('click', downloadImage);
  resetBtn.addEventListener('click', resetControls);

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) loadFile(f);
  });

  // Drag & drop
  document.addEventListener('dragover', (e) => { e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  });

  function loadFile(file) {
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

  function resetControls() {
    scaleEl.value = 100; scaleVal.textContent = '100%';
    pixelSizeEl.value = 1; pixelVal.textContent = '1';
    colorsEl.value = 256; colorsVal.textContent = '256';
    vhsToggle.checked = false; vhsStrength.value = 0.5; vhsStrengthVal.textContent = '0.5';
    vhsShift.value = 6; vhsShiftVal.textContent = '6'; vhsNoise.value = 0.05; vhsNoiseVal.textContent = '0.05';
    render();
  }

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function render() {
    if (!img) return;

    // Compute target size based on scale
    const scale = clamp(parseInt(scaleEl.value, 10) / 100, 0.1, 3);
    let targetW = Math.max(1, Math.round(originalWidth * scale));
    let targetH = Math.max(1, Math.round(originalHeight * scale));

    // Cap to avoid extremely large canvases
    const MAX_DIM = 2048;
    if (targetW > MAX_DIM || targetH > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
      targetW = Math.round(targetW * ratio);
      targetH = Math.round(targetH * ratio);
    }

    // Offscreen processing canvas
    canvas.width = targetW;
    canvas.height = targetH;

    // Draw the original image scaled to target size first
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Get image data
    let imageData = ctx.getImageData(0,0,canvas.width,canvas.height);

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

    // Put processed data back
    ctx.putImageData(imageData, 0, 0);

    // Apply VHS filter on top if enabled
    if (vhsToggle.checked) {
      applyVHS(ctx, canvas.width, canvas.height, {
        strength: parseFloat(vhsStrength.value),
        shift: parseInt(vhsShift.value, 10),
        noise: parseFloat(vhsNoise.value)
      });
    }
  }

  // Pixelate by drawing low-res blocks and sampling their average
  function applyPixelate(imageData, block) {
    const w = imageData.width, h = imageData.height;
    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);

    for (let y = 0; y < h; y += block) {
      for (let x = 0; x < w; x += block) {
        // Average color in block
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

    // Determine bits per channel to approximate targetColors
    // bits ~ log2(targetColors) / 3
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

  // VHS filter: chroma shift, scanlines, noise, slight color bleed
  function applyVHS(ctx, w, h, opts){
    const strength = clamp(opts.strength || 0.5, 0, 1);
    const shift = Math.round(opts.shift || 6);
    const noiseAmount = clamp(opts.noise || 0.05, 0, 1);

    // Create temp canvases
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; const tctx = tmp.getContext('2d');
    tctx.drawImage(canvas, 0, 0);

    // Chromatic split: draw R, G, B channels with offsets
    const rgb = tctx.getImageData(0,0,w,h);
    const rImg = tctx.createImageData(w,h);
    const gImg = tctx.createImageData(w,h);
    const bImg = tctx.createImageData(w,h);

    for (let i=0;i<rgb.data.length;i+=4){
      rImg.data[i] = rgb.data[i]; rImg.data[i+1]=0; rImg.data[i+2]=0; rImg.data[i+3]=rgb.data[i+3];
      gImg.data[i] = 0; gImg.data[i+1]=rgb.data[i+1]; gImg.data[i+2]=0; gImg.data[i+3]=rgb.data[i+3];
      bImg.data[i] = 0; bImg.data[i+1]=0; bImg.data[i+2]=rgb.data[i+2]; bImg.data[i+3]=rgb.data[i+3];
    }

    // Draw base image slightly faded
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - 0.25*strength;
    ctx.drawImage(tmp,0,0);

    // helper to draw channel with offset
    function drawChannel(imgData, dx, dy, composite='screen'){
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

    // Slight vignette / color curves could be added; keep it performant
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function downloadImage(){
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'picture-change.png';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // Initial hint state
  hint.style.display = 'flex';
})();
