// @ts-check
const { test, expect } = require('@playwright/test');

// 各テスト前にlocalStorageをクリアしてクリーンな状態にする
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('taskapp_tasks');
    localStorage.removeItem('taskapp_categories');
  });
  await page.reload();
  await page.waitForSelector('[data-testid="task-list"]');
});

// ─── ヘルパー ───────────────────────────────────────────────────
async function addTask(page, { title, priority = 'medium', category = '' } = {}) {
  await page.getByTestId('btn-add-task').click();
  await page.getByTestId('task-title-input').fill(title);

  if (priority !== 'medium') {
    // ラジオボタンはCSSで非表示のため、ラベルをクリック
    await page.locator(`.priority-label.${priority}`).click();
  }

  if (category) {
    // 既存カテゴリの場合はセレクトから選択（なければ追加）
    const option = page.locator(`#task-category option[value="${category}"]`);
    const count = await option.count();
    if (count > 0) {
      await page.getByTestId('task-category-select').selectOption(category);
    } else {
      await page.getByTestId('new-category-input').fill(category);
      await page.getByTestId('btn-add-category').click();
    }
  }

  await page.getByTestId('btn-save-task').click();
}

// ─── テストケース ─────────────────────────────────────────────

test('タスクの追加ができること', async ({ page }) => {
  // 初期状態では空
  await expect(page.getByTestId('empty-state')).toBeVisible();

  // タスクを追加
  await addTask(page, { title: '買い物リストを作る', priority: 'high' });

  // タスクカードが表示される
  const card = page.getByTestId('task-card');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('task-title')).toHaveText('買い物リストを作る');
  await expect(card.getByTestId('task-priority')).toHaveText('高');
});

test('タスクの完了チェックができること', async ({ page }) => {
  await addTask(page, { title: '会議の準備' });

  const card = page.getByTestId('task-card');
  const checkbox = card.getByTestId('task-check');

  // 初期状態: 未完了
  await expect(checkbox).not.toBeChecked();
  await expect(card).not.toHaveClass(/done/);

  // チェックを入れる
  await checkbox.click();

  // 完了状態になる
  await expect(checkbox).toBeChecked();
  await expect(card).toHaveClass(/done/);

  // チェックを外す
  await checkbox.click();

  // 未完了に戻る
  await expect(checkbox).not.toBeChecked();
  await expect(card).not.toHaveClass(/done/);
});

test('タスクの削除ができること', async ({ page }) => {
  await addTask(page, { title: '削除するタスク' });

  // タスクが存在することを確認
  await expect(page.getByTestId('task-card')).toBeVisible();

  // 削除ボタンをクリック
  await page.getByTestId('btn-delete-task').click();

  // 確認ダイアログが表示される
  const confirmOverlay = page.getByTestId('confirm-overlay');
  await expect(confirmOverlay).toBeVisible();
  await expect(page.getByTestId('confirm-message')).toContainText('削除するタスク');

  // 削除を確定
  await page.getByTestId('btn-confirm-ok').click();

  // タスクが消える
  await expect(page.getByTestId('task-card')).not.toBeVisible();
  await expect(page.getByTestId('empty-state')).toBeVisible();
});

test('削除の確認ダイアログでキャンセルするとタスクが残ること', async ({ page }) => {
  await addTask(page, { title: 'キャンセルテスト用' });

  await page.getByTestId('btn-delete-task').click();
  await expect(page.getByTestId('confirm-overlay')).toBeVisible();

  // キャンセルをクリック
  await page.getByTestId('btn-confirm-cancel').click();

  // タスクが残っている
  await expect(page.getByTestId('task-card')).toBeVisible();
  await expect(page.getByTestId('confirm-overlay')).not.toBeVisible();
});

test('カテゴリでフィルターできること', async ({ page }) => {
  // 異なるカテゴリのタスクを2件追加
  await addTask(page, { title: '仕事タスク', category: '仕事' });
  await addTask(page, { title: '個人タスク', category: '個人' });

  // 2件表示されていること
  await expect(page.getByTestId('task-card')).toHaveCount(2);

  // 「仕事」でフィルター
  await page.getByTestId('filter-category').selectOption('仕事');

  // 仕事タスクだけ表示
  const cards = page.getByTestId('task-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.getByTestId('task-title')).toHaveText('仕事タスク');

  // フィルター解除（すべて）
  await page.getByTestId('filter-category').selectOption('');
  await expect(page.getByTestId('task-card')).toHaveCount(2);
});

test('優先度でフィルターできること', async ({ page }) => {
  // 異なる優先度のタスクを3件追加
  await addTask(page, { title: '高優先度タスク', priority: 'high' });
  await addTask(page, { title: '中優先度タスク', priority: 'medium' });
  await addTask(page, { title: '低優先度タスク', priority: 'low' });

  // 3件表示されていること
  await expect(page.getByTestId('task-card')).toHaveCount(3);

  // 「高」でフィルター
  await page.getByTestId('filter-priority').selectOption('high');

  const cards = page.getByTestId('task-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.getByTestId('task-title')).toHaveText('高優先度タスク');

  // 「低」でフィルター
  await page.getByTestId('filter-priority').selectOption('low');
  await expect(page.getByTestId('task-card')).toHaveCount(1);
  await expect(page.getByTestId('task-card').getByTestId('task-title')).toHaveText('低優先度タスク');

  // フィルター解除
  await page.getByTestId('filter-priority').selectOption('');
  await expect(page.getByTestId('task-card')).toHaveCount(3);
});
