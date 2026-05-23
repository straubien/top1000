(function() {
  var maxPhoto = 100;
  var bannerCount = 6;
  var memorySize = 30;
  var banner = document.getElementById('mosaic-banner');
  if (!banner) return;

  // Load memory of previously shown images
  var memory = [];
  try {
    memory = JSON.parse(sessionStorage.getItem('bannerMemory') || '[]');
  } catch(e) { memory = []; }

  // Build pool of all photo numbers
  var pool = [];
  for (var i = 1; i <= maxPhoto; i++) {
    pool.push(i);
  }

  // Fisher-Yates shuffle
  for (var i = pool.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }

  // Separate into preferred (not in memory) and fallback (in memory)
  var preferred = [];
  var fallback = [];
  for (var i = 0; i < pool.length; i++) {
    if (memory.indexOf(pool[i]) === -1) {
      preferred.push(pool[i]);
    } else {
      fallback.push(pool[i]);
    }
  }

  // Pick from preferred first, then fallback
  var candidates = preferred.concat(fallback);
  var used = [];
  var loaded = 0;
  var idx = 0;

  function addImage() {
    if (idx >= candidates.length) return;
    var n = candidates[idx];
    idx++;
    var img = document.createElement('img');
    var num = String(n);
    if (num.length < 2) num = '0' + num;

    // Detect path prefix: check if we're in a subdirectory
    var prefix = '';
    var scripts = document.getElementsByTagName('script');
    for (var s = 0; s < scripts.length; s++) {
      var src = scripts[s].getAttribute('src') || '';
      if (src.indexOf('banner.js') !== -1) {
        prefix = src.replace('banner.js', '');
        break;
      }
    }

    img.src = prefix + 'images/photo (' + num + ').jpg';
    img.alt = '';
    img.onload = function() {
      loaded++;
      used.push(n);
      // Update memory
      var newMemory = memory.concat(used);
      // Keep only last memorySize entries
      if (newMemory.length > memorySize) {
        newMemory = newMemory.slice(newMemory.length - memorySize);
      }
      try {
        sessionStorage.setItem('bannerMemory', JSON.stringify(newMemory));
      } catch(e) {}
    };
    img.onerror = function() {
      banner.removeChild(img);
      addImage();
    };
    banner.appendChild(img);
  }

  for (var i = 0; i < bannerCount; i++) {
    addImage();
  }
})();
