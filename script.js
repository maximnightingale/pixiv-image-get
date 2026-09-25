const submitBtn = document.getElementById("submitBtn"),
  pixivUrlInput = document.getElementById("pixivUrl"),
  resultContainer = document.getElementById("result"),
  imageModal = document.getElementById("imageModal"),
  modalOriginalImg = document.getElementById("modalOriginalImg"),
  modalImgContainer = document.getElementById("modalImgContainer"),
  closeModal = document.getElementById("closeModal"),
  toast = document.getElementById("toast"),
  imgSizeInfo = document.getElementById("imgSizeInfo"),
  prevImgBtn = document.getElementById("prevImgBtn"),
  nextImgBtn = document.getElementById("nextImgBtn"),
  zoomInBtn = document.getElementById("zoomInBtn"),
  zoomOutBtn = document.getElementById("zoomOutBtn"),
  proxyDomains = ["https://i.muxmus.com", "https://pixiv.shojo.cn"];
let currentArtworkId = null,
  selectedProxyDomain = null,
  selectedProxyIndex = 0,
  scaleRatio = 1,
  translateX = 0,
  translateY = 0,
  isDragging = false,
  startX = 0,
  startY = 0,
  startTranslateX = 0,
  startTranslateY = 0;
const minScale = 0.5, maxScale = 3;
let currentImgIndex = 0, currentImgList = [];
function showToast(t, e = "info") {
  toast.textContent = t;
  toast.className = "";
  if (e === "success") toast.classList.add("toast-success");
  else if (e === "error") toast.classList.add("toast-error");
  toast.style.display = "block";
  requestAnimationFrame(() => toast.classList.add("toast-show"));
  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => { toast.style.display = "none"; }, 300);
  }, 3000);
}
function resetModalState() {
  scaleRatio = 1; translateX = 0; translateY = 0;
  updateImageTransform();
  imgSizeInfo.textContent = "— × —";
}
function updateImageTransform() {
  modalOriginalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleRatio})`;
}
closeModal.addEventListener("click", () => {
  imageModal.style.display = "none"; resetModalState();
});
imageModal.addEventListener("click", (t) => {
  if (t.target === imageModal) { imageModal.style.display = "none"; resetModalState(); }
});
document.addEventListener("keydown", (t) => {
  if (t.key === "Escape" && imageModal.style.display === "flex") {
    imageModal.style.display = "none"; resetModalState();
  }
});
modalImgContainer.addEventListener("mousedown", (t) => {
  if (t.button !== 0) return;
  isDragging = true;
  startX = t.clientX; startY = t.clientY;
  startTranslateX = translateX; startTranslateY = translateY;
  modalImgContainer.classList.add("grabbing");
  document.body.style.userSelect = "none";
});
document.addEventListener("mousemove", (t) => {
  if (!isDragging) return;
  t.preventDefault();
  translateX = startTranslateX + (t.clientX - startX);
  translateY = startTranslateY + (t.clientY - startY);
  updateImageTransform();
});
document.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  modalImgContainer.classList.remove("grabbing");
  document.body.style.userSelect = "";
});
document.addEventListener("mouseleave", () => {
  if (!isDragging) return;
  isDragging = false;
  modalImgContainer.classList.remove("grabbing");
  document.body.style.userSelect = "";
});
let initialDistance = 0, startScale = 0;
modalImgContainer.addEventListener("touchstart", (t) => {
  if (t.touches.length === 1) {
    const touch = t.touches[0];
    startX = touch.clientX; startY = touch.clientY;
    startTranslateX = translateX; startTranslateY = translateY;
    isDragging = true;
  } else if (t.touches.length === 2) {
    const a = t.touches[0], b = t.touches[1];
    initialDistance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    startScale = scaleRatio;
  }
}, { passive: true });
modalImgContainer.addEventListener("touchmove", (t) => {
  t.preventDefault();
  if (t.touches.length === 1 && isDragging) {
    const touch = t.touches[0];
    translateX = startTranslateX + (touch.clientX - startX);
    translateY = startTranslateY + (touch.clientY - startY);
    updateImageTransform();
  } else if (t.touches.length === 2) {
    const a = t.touches[0], b = t.touches[1];
    const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    let newScale = startScale * (dist / initialDistance);
    newScale = Math.min(maxScale, Math.max(minScale, newScale));
    const rect = modalImgContainer.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const imgRect = modalOriginalImg.getBoundingClientRect();
    const ix = imgRect.left + imgRect.width / 2;
    const iy = imgRect.top + imgRect.height / 2;
    translateX += (newScale / scaleRatio - 1) * (cx - ix);
    translateY += (newScale / scaleRatio - 1) * (cy - iy);
    scaleRatio = newScale;
    updateImageTransform();
  }
}, { passive: false });
modalImgContainer.addEventListener("touchend", () => { isDragging = false; });
function scaleImage(t) {
  t = Math.min(maxScale, Math.max(minScale, t));
  if (t === scaleRatio) return;
  const rect = modalImgContainer.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const imgRect = modalOriginalImg.getBoundingClientRect();
  const ix = imgRect.left + imgRect.width / 2;
  const iy = imgRect.top + imgRect.height / 2;
  translateX += (t / scaleRatio - 1) * (cx - ix);
  translateY += (t / scaleRatio - 1) * (cy - iy);
  scaleRatio = t;
  updateImageTransform();
}
function updateModalImage() {
  const img = currentImgList[currentImgIndex];
  modalOriginalImg.src = img.originalUrl;
  resetModalState();
  updateNavBtnState();
}
function updateNavBtnState() {
  prevImgBtn.disabled = currentImgIndex === 0;
  nextImgBtn.disabled = currentImgIndex === currentImgList.length - 1;
}
function extractArtworkId(input) {
  const val = input.trim();
  if (/^\d+$/.test(val)) return val;
  const match = val.match(/artworks\/(\d+)/);
  return match ? match[1] : null;
}
const IMG_TIMEOUT_MS = 3000;
function checkImageValidity(url) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(true), IMG_TIMEOUT_MS);
    const img = new Image();
    img.onload  = () => { clearTimeout(timeout); resolve(true); };
    img.onerror = () => { clearTimeout(timeout); resolve(false); };
    img.src = url;
  });
}
async function selectProxyDomain(pid) {
  if (selectedProxyIndex >= 0 && selectedProxyIndex < proxyDomains.length) {
    const url = `${proxyDomains[selectedProxyIndex]}/${pid}-1`;
    if (await checkImageValidity(url)) return proxyDomains[selectedProxyIndex];
    return null;
  }
  for (const domain of proxyDomains) {
    const url = `${domain}/${pid}-1`;
    if (await checkImageValidity(url)) return domain;
  }
  return null;
}
async function batchCheckImages(pid, max = 20) {
  const results = [];
  for (let i = 1; i <= max; i++) {
    const url = `${selectedProxyDomain}/${pid}-${i}`;
    if (await checkImageValidity(url)) {
      results.push({ originalUrl: url, thumbUrl: url, i: i });
    } else { break; }
  }
  return results;
}
function createImageCard(thumbUrl, originalUrl, pid, pageNum, total) {
  const card = document.createElement("div");
  card.className = "image-card";
  const top = document.createElement("div");
  top.className = "card-top";
  top.innerHTML = `<span>第 ${String(pageNum).padStart(2,'0')} 张</span><span class="num">共 ${total} 张</span>`;
  const img = document.createElement("img");
  img.className = "preview-img";
  img.src = thumbUrl;
  img.loading = "lazy";
  img.style.objectFit = "cover";
  img.alt = `预览图 ${pageNum}`;
  img.style.cursor = "zoom-in";
  img.addEventListener("click", () => {
    currentImgIndex = currentImgList.findIndex((item) => item.i === pageNum);
    modalOriginalImg.src = originalUrl;
    resetModalState();
    updateNavBtnState();
    imageModal.style.display = "flex";
  });
  const bottom = document.createElement("div");
  bottom.className = "card-bottom";
  const cardId = document.createElement("span");
  cardId.className = "card-id";
  cardId.innerHTML = `PID:<span class="pid-num">${pid}</span>`;
  cardId.addEventListener("click", () => {
    window.open(`https://www.pixiv.net/artworks/${pid}`, "_blank");
  });
  const dl = document.createElement("a");
  dl.className = "download-btn";
  dl.href = originalUrl;
  dl.target = "_blank";
  dl.rel = "noopener noreferrer";
  dl.textContent = "下载";
  bottom.appendChild(cardId);
  bottom.appendChild(dl);
  card.appendChild(top);
  card.appendChild(img);
  card.appendChild(bottom);
  return card;
}
function debounce(fn, delay = 1000) {
  let timer = null;
  return (...args) => {
    if (timer) {
      showToast("正在解析中，请稍候…", "info");
      return;
    }
    timer = setTimeout(() => { fn.apply(this, args); timer = null; }, delay);
  };
}
async function parsePixivUrl() {
  const input = pixivUrlInput.value.trim();
  resultContainer.innerHTML = "";
  currentArtworkId = null;
  selectedProxyDomain = null;
  selectedProxyIndex = 0;
  currentImgList = [];
  const pid = extractArtworkId(input);
  if (!pid) {
    resultContainer.innerHTML = '<p class="error-msg">无效输入！请输入 Pixiv 作品链接或 PID</p>';
    return;
  }
  resultContainer.innerHTML = '<p class="loading-msg">正在解析…</p>';
  try {
    selectedProxyDomain = await selectProxyDomain(pid);
    if (!selectedProxyDomain) {
      resultContainer.innerHTML = "";
      return showToast("代理不可用，请检查网络或切换代理后重试", "error");
    }
    const images = await batchCheckImages(pid);
    resultContainer.innerHTML = "";
    if (images.length === 0) {
      return showToast("未找到可用图片！可能是作品不存在或代理失效", "error");
    }
    currentArtworkId = pid;
    currentImgList = images;
    images.forEach(({ thumbUrl, originalUrl, i }) => {
      resultContainer.appendChild(createImageCard(thumbUrl, originalUrl, pid, i, images.length));
    });
    showToast(`成功解析 ${images.length} 张图片`, "success");
  } catch (err) {
    resultContainer.innerHTML = "";
    showToast(`解析失败：${err.message || '未知错误'}`, "error");
  }
}
zoomInBtn.addEventListener("click",  () => scaleImage(scaleRatio + 0.2));
zoomOutBtn.addEventListener("click", () => scaleImage(scaleRatio - 0.2));
modalOriginalImg.addEventListener("load", () => {
  imgSizeInfo.textContent = `${modalOriginalImg.naturalWidth} × ${modalOriginalImg.naturalHeight}`;
});
modalOriginalImg.addEventListener("error", () => {
  imgSizeInfo.textContent = "加载失败";
});
prevImgBtn.addEventListener("click", () => {
  if (currentImgIndex > 0) { currentImgIndex--; updateModalImage(); }
});
nextImgBtn.addEventListener("click", () => {
  if (currentImgIndex < currentImgList.length - 1) { currentImgIndex++; updateModalImage(); }
});
submitBtn.addEventListener("click", debounce(parsePixivUrl));
pixivUrlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") debounce(parsePixivUrl)();
});
document.querySelectorAll(".proxy-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".proxy-btn").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-checked", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-checked", "true");
    selectedProxyIndex = parseInt(btn.dataset.index, 10);
  });
});
