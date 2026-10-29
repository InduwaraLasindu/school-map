(function schoolNavigatorEnhancements() {
  'use strict';

  const $ = id => document.getElementById(id);
  const validRooms = new Map(roomData.map(room => [room.id, room]));
  const FILTERS = new Set(['all', 'Primary Building', 'Main Building', 'saved']);
  const STORAGE_PREFIX = 'schoolNavigator.v2.';
  const readArray = key => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_PREFIX + key));
      return Array.isArray(value) ? value.filter(id => typeof id === 'string' && validRooms.has(id)) : [];
    } catch (_) { return []; }
  };
  const save = (key, value) => {
    try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); }
    catch (_) { /* Local storage may be disabled. The app still works. */ }
  };
  const favorites = new Set(readArray('favorites'));
  let recentlyViewed = [...new Set(readArray('recent'))].slice(0, 6);
  let currentFilter = 'all';
  let currentRoom = null;
  let toastTimeout;
  let zoomFactor = 1;
  let lastFocusedElement = null;

  const categoryIcons = {
    'Lower Nursery': '🌱', 'Nursery': '🌼', 'Pre-Grade': '🧩',
    'Grade 1': '📘', 'Grade 2': '📗', 'Grade 3': '📙',
    'Grade 4': '📕', 'Grade 5': '✏️', 'Grade 6': '📝',
    'Grade 7': '🔬', 'Grade 8': '🌍', 'Grade 9': '📐',
    'Grade 10': '🎓', 'Grade 11': '📖', 'Forms (Secondary)': '🏫',
    'Edexcel': '📚', 'Advanced Level': '🎯', 'Other': '📍'
  };
  const compact = value => String(value || '').normalize('NFKD')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  const roomSearchText = room => compact([
    room.name, room.cat, room.subCat, room.bldg, room.floor,
    room.roomNum, room.tags
  ].filter(Boolean).join(' '));

  function showToast(message) {
    const toast = $('appToast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2900);
  }

  function filteredRooms() {
    return roomData.filter(room =>
      currentFilter === 'all' ||
      (currentFilter === 'saved' ? favorites.has(room.id) : room.bldg === currentFilter)
    );
  }

  function createRoomCard(room) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'list-card';
    button.setAttribute('aria-label', `Open ${room.name}, ${room.bldg}, ${room.floor}`);

    const details = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'list-name';
    title.textContent = `${favorites.has(room.id) ? '★ ' : ''}${room.name}`;

    const meta = document.createElement('div');
    meta.className = 'list-meta';
    meta.textContent = [
      room.subCat || room.cat, room.bldg, room.floor, room.roomNum
    ].filter(Boolean).join(' · ');

    const arrow = document.createElement('span');
    arrow.className = 'list-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    details.append(title, meta);
    button.append(details, arrow);
    button.addEventListener('click', () => window.selectRoom(room.id));
    return button;
  }

  function appendRoomCards(container, rooms) {
    const fragment = document.createDocumentFragment();
    rooms.forEach(room => fragment.appendChild(createRoomCard(room)));
    container.appendChild(fragment);
  }

  function setSectionVisibility(id, isVisible) {
    $(id).hidden = !isVisible;
  }

  function renderPersonal() {
    const matched = filteredRooms();
    const matchedIds = new Set(matched.map(room => room.id));
    const savedRooms = [...favorites]
      .filter(id => matchedIds.has(id)).map(id => validRooms.get(id));
    const recentRooms = recentlyViewed
      .filter(id => matchedIds.has(id)).map(id => validRooms.get(id));

    $('favoritesCount').textContent = String(favorites.size);
    const savedContainer = $('savedRooms');
    const recentContainer = $('recentRooms');
    savedContainer.replaceChildren();
    recentContainer.replaceChildren();

    setSectionVisibility('favoritesSection', savedRooms.length > 0);
    setSectionVisibility('recentSection', recentRooms.length > 0);
    appendRoomCards(savedContainer, savedRooms.slice(0, 4));
    appendRoomCards(recentContainer, recentRooms.slice(0, 4));

    $('savedSectionCount').textContent =
      savedRooms.length > 4 ? `Showing 4 of ${savedRooms.length}` : `${savedRooms.length} saved`;
    $('recentSectionCount').textContent = `${recentRooms.length} recent`;
  }

  function renderCategories() {
    const grid = $('categoryGrid');
    grid.replaceChildren();
    const rooms = filteredRooms();
    let totalCategories = 0;

    catOrder.forEach(cat => {
      const count = rooms.filter(room => room.cat === cat).length;
      if (!count) return;
      totalCategories++;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-card';
      const icon = document.createElement('span');
      icon.className = 'cat-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = categoryIcons[cat] || '📍';
      const name = document.createElement('span');
      name.className = 'cat-name';
      name.textContent = cat === 'Advanced Level' ? 'A/L' :
        cat === 'Forms (Secondary)' ? 'Forms' : cat;
      const countLine = document.createElement('span');
      countLine.className = 'cat-count';
      countLine.textContent = `${count} ${count === 1 ? 'room' : 'rooms'}`;
      button.append(icon, name, countLine);
      button.addEventListener('click', () => window.openCategory(cat));
      grid.appendChild(button);
    });
    if (!totalCategories) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = currentFilter === 'saved'
        ? 'No saved rooms yet. Open a room and tap Save to add it.'
        : 'No rooms in this selection.';
      grid.appendChild(empty);
    }
    $('browseCount').textContent = `${rooms.length} rooms`;
    renderPersonal();
  }

  function changeFilter(filter) {
    if (!FILTERS.has(filter)) return;
    currentFilter = filter;
    document.querySelectorAll('[data-filter]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    });
    renderCategories();
    window.handleSearch();
    if (!$('homeView').classList.contains('active')) window.goHome();
  }

  function renderSearch() {
    const input = $('searchInput');
    const query = input.value.trim();
    const grid = $('categoryGrid');
    const results = $('searchResults');
    const heading = $('searchHeading');
    const terms = query.split(/\s+/).map(compact).filter(Boolean);
    $('clearSearchBtn').style.display = query ? 'flex' : 'none';
    $('homeIntro').hidden = Boolean(query);
    $('personalHome').hidden = Boolean(query);
    $('browseHeading').hidden = Boolean(query);
    $('homeFilters').hidden = Boolean(query);

    if (!terms.length) {
      grid.style.display = 'grid';
      results.style.display = 'none';
      heading.hidden = true;
      return;
    }

    grid.style.display = 'none';
    results.style.display = 'block';
    heading.hidden = false;
    const matched = filteredRooms()
      .filter(room => terms.every(term => roomSearchText(room).includes(term)))
      .sort((a, b) => {
        const nameQuery = compact(query);
        const rank = r => compact(r.name) === nameQuery ? 0 :
          compact(r.name).startsWith(nameQuery) ? 1 : 2;
        return rank(a) - rank(b) || a.name.localeCompare(b.name, undefined, { numeric: true });
      });

    $('searchCount').textContent = `${matched.length} ${matched.length === 1 ? 'result' : 'results'}`;
    results.replaceChildren();
    if (!matched.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No matching rooms. Try a classroom name, building, floor, or room number.';
      results.appendChild(empty);
    } else appendRoomCards(results, matched);
  }

  function renderCategory(catName) {
    const container = $('catListContainer');
    const rooms = filteredRooms().filter(room => room.cat === catName);
    $('catListTitle').textContent = catName;
    container.replaceChildren();
    if (catName !== 'Other') {
      appendRoomCards(container, rooms);
    } else {
      const categories = [...new Set([
        ...subCatOrder, ...rooms.map(room => room.subCat || 'Other')
      ])];
      categories.forEach(sub => {
        const groupRooms = rooms.filter(room => (room.subCat || 'Other') === sub);
        if (!groupRooms.length) return;
        const header = document.createElement('h2');
        header.className = 'sub-cat-header';
        header.textContent = sub;
        container.appendChild(header);
        appendRoomCards(container, groupRooms);
      });
    }
    window.navigate('categoryListView');
  }

  function updateFavoriteButton() {
    if (!currentRoom) return;
    const isFavorite = favorites.has(currentRoom.id);
    const button = $('favoriteRoomBtn');
    button.setAttribute('aria-pressed', String(isFavorite));
    button.textContent = isFavorite ? '★ Saved' : '☆ Save room';
    button.setAttribute('aria-label', isFavorite ? 'Remove from saved rooms' : 'Save room');
  }

  function toggleFavorite() {
    if (!currentRoom) return;
    const id = currentRoom.id;
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    save('favorites', [...favorites]);
    updateFavoriteButton();
    renderCategories();
    renderSearch();
    showToast(favorites.has(id) ? 'Room saved on this device' : 'Room removed from saved');
  }

  async function shareRoom() {
    if (!currentRoom) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', currentRoom.id);
    url.hash = '';
    const payload = { title: `${currentRoom.name} · School Navigator`, url: url.href };
    if (navigator.share) {
      try { await navigator.share(payload); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url.href);
      showToast('Room link copied');
    } catch (_) {
      const input = document.createElement('textarea');
      input.value = url.href;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) { /* fallback */ }
      input.remove();
      if (copied) showToast('Room link copied');
      else window.prompt('Copy this room link:', url.href);
    }
  }

  const originalSelectRoom = window.selectRoom;
  window.selectRoom = function selectRoomEnhanced(roomId) {
    const room = validRooms.get(roomId);
    if (!room) return;
    closeLightbox();
    currentRoom = room;
    recentlyViewed = [roomId, ...recentlyViewed.filter(id => id !== roomId)].slice(0, 6);
    save('recent', recentlyViewed);

    $('mapError').classList.remove('visible');
    $('floorImage').alt = `Highlighted floor plan for ${room.name} in ${room.bldg}, ${room.floor}`;
    originalSelectRoom(roomId);
    updateFavoriteButton();
    renderPersonal();
  };

  const originalNavigate = window.navigate;
  window.navigate = function navigateEnhanced(viewId) {
    originalNavigate(viewId);
    decorateLegacyControls();
  };

  const originalGoBack = window.goBack;
  window.goBack = function goBackEnhanced() {
    closeLightbox();
    originalGoBack();
    decorateLegacyControls();
  };

  const originalGoHome = window.goHome;
  window.goHome = function goHomeEnhanced() {
    closeLightbox();
    originalGoHome();
    decorateLegacyControls();
  };

  const originalOpenFloorSelect = window.openFloorSelect;
  window.openFloorSelect = function openFloorEnhanced(building) {
    originalOpenFloorSelect(building);
    decorateLegacyControls();
  };
  const originalOpenLevelSummary = window.openLevelSummary;
  window.openLevelSummary = function openLevelEnhanced(building, floor) {
    originalOpenLevelSummary(building, floor);
    $('summaryMapError').hidden = true;
    decorateLegacyControls();
  };

  window.renderHomeGrid = renderCategories;
  window.handleSearch = renderSearch;
  window.openCategory = renderCategory;

  function decorateLegacyControls() {
    document.querySelectorAll('.nav-back, .list-card:not(button), .category-card:not(button)')
      .forEach(element => {
        element.setAttribute('role', 'button');
        element.setAttribute('tabindex', '0');
      });
  }

  function closeLightbox() {
    const lightbox = $('imageLightbox');
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    $('zoomImage').removeAttribute('src');
    if (lastFocusedElement && document.contains(lastFocusedElement)) lastFocusedElement.focus();
  }

  function applyZoom() {
    $('zoomImage').style.width = `${zoomFactor * 100}%`;
    $('zoomValue').textContent = `${Math.round(zoomFactor * 100)}%`;
  }

  function openLightbox() {
    const img = $('floorImage');
    if (!currentRoom || !img.complete || !img.naturalWidth) {
      showToast('The floor plan is not available yet');
      return;
    }
    lastFocusedElement = document.activeElement;
    zoomFactor = 1;
    $('zoomImage').src = img.currentSrc || img.src;
    $('lightboxTitle').textContent = `${currentRoom.name} · ${currentRoom.floor}`;
    applyZoom();
    $('imageLightbox').hidden = false;
    $('zoomCloseBtn').focus();
  }

  function updateTheme() {
    let theme;
    try { theme = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'theme')); }
    catch (_) { theme = null; }
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
    $('themeToggle').textContent = theme === 'light' ? '☾' : '☀';
    $('themeToggle').setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    $('themeToggle').title = theme === 'light' ? 'Dark theme' : 'Light theme';
  }

  $('themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    save('theme', next);
    updateTheme();
  });

  document.querySelectorAll('[data-filter]').forEach(button =>
    button.addEventListener('click', () => changeFilter(button.dataset.filter))
  );
  $('favoriteRoomBtn').addEventListener('click', toggleFavorite);
  $('shareRoomBtn').addEventListener('click', shareRoom);
  $('openFloorBtn').addEventListener('click', () => {
    if (currentRoom) window.openLevelSummary(currentRoom.bldg, currentRoom.floor);
  });
  $('zoomRoomBtn').addEventListener('click', openLightbox);
  $('floorImage').addEventListener('click', openLightbox);
  $('zoomCloseBtn').addEventListener('click', closeLightbox);
  $('zoomInBtn').addEventListener('click', () => { zoomFactor = Math.min(4, zoomFactor + .4); applyZoom(); });
  $('zoomOutBtn').addEventListener('click', () => { zoomFactor = Math.max(1, zoomFactor - .4); applyZoom(); });
  $('imageLightbox').addEventListener('click', event => {
    if (event.target === $('imageLightbox')) closeLightbox();
  });

  $('floorImage').addEventListener('error', () => {
    $('mapSpinnerOverlay').style.display = 'none';
    $('mapError').classList.add('visible');
  });
  $('summaryMapImage').addEventListener('error', () => {
    $('summaryMapError').hidden = false;
  });

  document.addEventListener('keydown', event => {
    if (!event.altKey && !event.ctrlKey && !event.metaKey &&
        (event.key === 'Enter' || event.key === ' ') &&
        event.target.matches('.nav-back, .list-card:not(button), .category-card:not(button)')) {
      event.preventDefault();
      event.target.click();
      return;
    }
    if (event.key === 'Escape') {
      if (!$('imageLightbox').hidden) closeLightbox();
      else if ($('searchInput').value) window.clearSearch();
      return;
    }
    if (!$('imageLightbox').hidden) {
      if (event.key === '+' || event.key === '=') {
        zoomFactor = Math.min(4, zoomFactor + .4);
        applyZoom();
      } else if (event.key === '-') {
        zoomFactor = Math.max(1, zoomFactor - .4);
        applyZoom();
      }
      return;
    }
    const typing = event.target.matches('input, textarea, select, [contenteditable="true"]');
    if (!typing && (event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'))) {
      event.preventDefault();
      window.goHome();
      $('searchInput').focus();
    }
  });

  $('imageLightbox').addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...$('imageLightbox').querySelectorAll('button')];
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });

  const uniqueLevels = new Set(roomData.map(room => `${room.bldg}:${room.floor}`));
  $('roomCount').textContent = String(roomData.length);
  $('levelCount').textContent = String(uniqueLevels.size);
  updateTheme();
  renderCategories();
  decorateLegacyControls();

  const requestedRoom = new URL(window.location.href).searchParams.get('room');
  if (requestedRoom && validRooms.has(requestedRoom)) {
    window.selectRoom(requestedRoom);
  } else if (requestedRoom) {
    showToast('This room link is not available in the current map');
  }

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () =>
      navigator.serviceWorker.register('./service-worker.js').catch(() => {
        /* Offline mode is optional. Do not interrupt browsing on errors. */
      })
    );
  }
})();
