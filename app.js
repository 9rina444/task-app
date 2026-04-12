// ===== STATE =====
let tasks = [];
let categories = ['仕事', '個人', '買い物'];
let editingId = null;

const STORAGE_KEY = 'taskapp_tasks';
const CAT_KEY = 'taskapp_categories';

// ===== PERSISTENCE =====
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  localStorage.setItem(CAT_KEY, JSON.stringify(categories));
}

function load() {
  const t = localStorage.getItem(STORAGE_KEY);
  const c = localStorage.getItem(CAT_KEY);
  if (t) tasks = JSON.parse(t);
  if (c) categories = JSON.parse(c);
}

// ===== UTILITIES =====
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date(today());
  return Math.ceil(diff / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

function priorityOrder(p) {
  return { high: 0, medium: 1, low: 2 }[p] ?? 1;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== CONFIRM DIALOG =====
// window.confirm() の代わりにカスタムモーダルを使用（Playwright でテスト可能）
let confirmCallback = null;

function showConfirm(message, onOk) {
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-overlay').classList.remove('hidden');
  confirmCallback = onOk;
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.add('hidden');
  confirmCallback = null;
}

// ===== RENDER =====
function renderCategoryOptions(selectEl, selectedValue = '') {
  const none = '<option value="">カテゴリなし</option>';
  const opts = categories.map(c =>
    `<option value="${escapeHtml(c)}" ${c === selectedValue ? 'selected' : ''}>${escapeHtml(c)}</option>`
  ).join('');
  selectEl.innerHTML = none + opts;
}

function renderFilterCategories() {
  const sel = document.getElementById('filter-category');
  const cur = sel.value;
  sel.innerHTML = '<option value="">すべて</option>' +
    categories.map(c =>
      `<option value="${escapeHtml(c)}" ${c === cur ? 'selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');
}

function renderCategoryTags() {
  const container = document.getElementById('category-tags');
  if (!container) return;
  container.innerHTML = categories.map(c =>
    `<span class="category-tag" data-testid="category-tag" data-category="${escapeHtml(c)}">
      ${escapeHtml(c)}
      <button type="button"
        class="category-tag-delete"
        data-testid="btn-delete-category"
        data-category="${escapeHtml(c)}">×</button>
    </span>`
  ).join('');
}

function getFilteredSorted() {
  const cat    = document.getElementById('filter-category').value;
  const pri    = document.getElementById('filter-priority').value;
  const status = document.getElementById('filter-status').value;
  const sortBy = document.getElementById('sort-by').value;

  let list = tasks.filter(t => {
    if (cat && t.category !== cat) return false;
    if (pri && t.priority !== pri) return false;
    if (status === 'active' && t.done) return false;
    if (status === 'done' && !t.done) return false;
    return true;
  });

  list.sort((a, b) => {
    if (sortBy === 'dueDate') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (sortBy === 'priority') {
      return priorityOrder(a.priority) - priorityOrder(b.priority);
    }
    return b.createdAt - a.createdAt;
  });

  return list;
}

function taskCardHTML(task) {
  const days = daysUntil(task.dueDate);
  const isOverdue = !task.done && days !== null && days < 0;
  const isUrgent  = !task.done && days !== null && days >= 0 && days <= 2;

  let cardClass = 'task-card';
  if (task.done)     cardClass += ' done';
  if (isOverdue)     cardClass += ' overdue';
  else if (isUrgent) cardClass += ' urgent';

  const priLabel = { high: '高', medium: '中', low: '低' }[task.priority] || '中';
  const priClass = `badge badge-priority-${task.priority}`;

  let badges = `<span class="${priClass}" data-testid="task-priority">${priLabel}</span>`;
  if (task.category) {
    badges += ` <span class="badge badge-category" data-testid="task-category-badge">${escapeHtml(task.category)}</span>`;
  }
  if (isOverdue) {
    badges += ` <span class="badge badge-overdue" data-testid="badge-overdue">期限切れ</span>`;
  } else if (isUrgent) {
    const label = days === 0 ? '今日まで' : `あと${days}日`;
    badges += ` <span class="badge badge-urgent" data-testid="badge-urgent">${label}</span>`;
  }

  let meta = [];
  if (task.startDate) meta.push(`開始: ${formatDate(task.startDate)}`);
  if (task.dueDate)   meta.push(`期限: ${formatDate(task.dueDate)}`);
  if (!meta.length && task.createdAt) {
    meta.push(`作成: ${formatDate(new Date(task.createdAt).toISOString().split('T')[0])}`);
  }

  const memoHTML = task.memo
    ? `<div class="task-memo-preview"
          data-testid="task-memo-preview"
          data-task-id="${task.id}">
        📝 <span>${escapeHtml(task.memo)}</span>
       </div>`
    : '';

  return `
  <div class="${cardClass}" data-testid="task-card" data-task-id="${task.id}">
    <input type="checkbox" class="task-check"
      data-testid="task-check"
      data-task-id="${task.id}"
      ${task.done ? 'checked' : ''}>
    <div class="task-body">
      <div class="task-header-row">
        <span class="task-title" data-testid="task-title">${escapeHtml(task.title)}</span>
        ${badges}
      </div>
      <div class="task-meta" data-testid="task-meta">${meta.join(' &nbsp;·&nbsp; ')}</div>
      ${memoHTML}
    </div>
    <div class="task-actions">
      <button class="btn btn-icon"
        data-testid="btn-edit-task"
        data-task-id="${task.id}"
        title="編集">✏️</button>
      <button class="btn btn-danger"
        data-testid="btn-delete-task"
        data-task-id="${task.id}"
        title="削除">🗑️</button>
    </div>
  </div>`;
}

function render() {
  const list = getFilteredSorted();
  const container = document.getElementById('task-list');

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state" data-testid="empty-state">タスクがありません。「+ 新しいタスク」から追加してください。</div>';
    return;
  }

  container.innerHTML = list.map(t => taskCardHTML(t)).join('');
  renderFilterCategories();
}

// ===== ACTIONS =====
function toggleDone(id) {
  const t = tasks.find(t => t.id === id);
  if (t) { t.done = !t.done; save(); render(); }
}

function deleteTask(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  showConfirm(`「${t.title}」を削除しますか？`, () => {
    tasks = tasks.filter(t => t.id !== id);
    save(); render();
  });
}

function openMemo(id) {
  const t = tasks.find(t => t.id === id);
  if (!t || !t.memo) return;
  document.getElementById('memo-task-title').textContent = t.title;
  document.getElementById('memo-content').textContent = t.memo;
  document.getElementById('memo-overlay').classList.remove('hidden');
}

// ===== MODAL =====
function openAdd() {
  editingId = null;
  document.getElementById('modal-title').textContent = '新しいタスク';
  document.getElementById('task-form').reset();
  document.querySelector('input[name="priority"][value="medium"]').checked = true;
  updatePriorityHighlight();
  renderCategoryOptions(document.getElementById('task-category'));
  renderCategoryTags();
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('task-title').focus();
}

function openEdit(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'タスクを編集';
  document.getElementById('task-title').value = t.title;
  renderCategoryOptions(document.getElementById('task-category'), t.category || '');
  renderCategoryTags();
  document.getElementById('task-start-date').value = t.startDate || '';
  document.getElementById('task-due-date').value   = t.dueDate || '';
  const radio = document.querySelector(`input[name="priority"][value="${t.priority}"]`);
  if (radio) radio.checked = true;
  document.getElementById('task-memo').value = t.memo || '';
  updatePriorityHighlight();
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('task-title').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
}

function updatePriorityHighlight() {
  document.querySelectorAll('.priority-label').forEach(label => {
    label.classList.remove('selected-high', 'selected-medium', 'selected-low');
  });
  const checked = document.querySelector('input[name="priority"]:checked');
  if (checked) {
    checked.closest('.priority-label').classList.add(`selected-${checked.value}`);
  }
}

function handleFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('task-title').value.trim();
  if (!title) return;

  const priority = document.querySelector('input[name="priority"]:checked')?.value || 'medium';
  const data = {
    title,
    category:  document.getElementById('task-category').value,
    startDate: document.getElementById('task-start-date').value,
    dueDate:   document.getElementById('task-due-date').value,
    priority,
    memo:      document.getElementById('task-memo').value.trim(),
  };

  if (editingId) {
    const t = tasks.find(t => t.id === editingId);
    if (t) Object.assign(t, data);
  } else {
    tasks.unshift({ id: uid(), done: false, createdAt: Date.now(), ...data });
  }

  save(); render(); closeModal();
}

function handleAddCategory() {
  const input = document.getElementById('new-category');
  const name = input.value.trim();
  if (!name || categories.includes(name)) { input.value = ''; return; }
  categories.push(name);
  renderCategoryOptions(document.getElementById('task-category'), name);
  renderFilterCategories();
  renderCategoryTags();
  input.value = '';
  save();
}

function deleteCategory(name) {
  showConfirm(`カテゴリ「${name}」を削除しますか？\nこのカテゴリのタスクはカテゴリなしになります。`, () => {
    categories = categories.filter(c => c !== name);
    tasks.forEach(t => { if (t.category === name) t.category = ''; });
    const sel = document.getElementById('task-category');
    const currentVal = sel ? sel.value : '';
    renderCategoryOptions(sel, currentVal === name ? '' : currentVal);
    renderFilterCategories();
    renderCategoryTags();
    save();
    render();
  });
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
  load();
  renderFilterCategories();
  render();

  // ヘッダー
  document.getElementById('btn-add-task').addEventListener('click', openAdd);

  // タスクフォーム
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('task-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('btn-add-category').addEventListener('click', handleAddCategory);
  document.getElementById('new-category').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); }
  });

  // 優先度ハイライト
  document.querySelectorAll('input[name="priority"]').forEach(radio => {
    radio.addEventListener('change', updatePriorityHighlight);
  });

  // タスクリスト — イベント委譲
  document.getElementById('task-list').addEventListener('change', e => {
    const checkbox = e.target.closest('[data-testid="task-check"]');
    if (checkbox) toggleDone(checkbox.dataset.taskId);
  });

  document.getElementById('task-list').addEventListener('click', e => {
    const editBtn = e.target.closest('[data-testid="btn-edit-task"]');
    if (editBtn) { openEdit(editBtn.dataset.taskId); return; }

    const deleteBtn = e.target.closest('[data-testid="btn-delete-task"]');
    if (deleteBtn) { deleteTask(deleteBtn.dataset.taskId); return; }

    const memoPreview = e.target.closest('[data-testid="task-memo-preview"]');
    if (memoPreview) { openMemo(memoPreview.dataset.taskId); return; }
  });

  // カテゴリタグ — イベント委譲
  document.getElementById('category-tags').addEventListener('click', e => {
    const deleteBtn = e.target.closest('[data-testid="btn-delete-category"]');
    if (deleteBtn) deleteCategory(deleteBtn.dataset.category);
  });

  // メモモーダル
  document.getElementById('btn-close-memo').addEventListener('click', () => {
    document.getElementById('memo-overlay').classList.add('hidden');
  });

  // 確認ダイアログ
  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
  });
  document.getElementById('btn-confirm-cancel').addEventListener('click', closeConfirm);

  // オーバーレイ外クリックで閉じる
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.getElementById('memo-overlay').addEventListener('click', e => {
    if (e.target.id === 'memo-overlay') {
      document.getElementById('memo-overlay').classList.add('hidden');
    }
  });
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target.id === 'confirm-overlay') closeConfirm();
  });

  // フィルター・ソート
  ['filter-category','filter-priority','filter-status','sort-by'].forEach(id => {
    document.getElementById(id).addEventListener('change', render);
  });
});
