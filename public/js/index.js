async function loadItems() {
  try {
    const response = await fetch('/api/items');
    const items = await response.json();

    const container = document.getElementById('itemsContainer');

    if (items.length === 0) {
      container.innerHTML = '<p>No items yet. Add one above!</p>';
      container.className = 'empty-state';
      return;
    }

    container.className = '';
    container.innerHTML = items.map(item => `
      <div class="item">
        <div class="item-content">
          <div class="item-name">${escapeHtml(item.name)}</div>
          <div class="item-description">${escapeHtml(item.description || '')}</div>
          <div class="item-date">${new Date(item.created_at).toLocaleString()}</div>
        </div>
        <button class="item-delete" onclick="deleteItem(${item.id})">Delete</button>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading items:', error);
  }
}

async function addItem() {
  const name = document.getElementById('itemName').value.trim();
  const description = document.getElementById('itemDescription').value.trim();

  if (!name) {
    alert('Please enter an item name');
    return;
  }

  try {
    const response = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });

    if (response.ok) {
      document.getElementById('itemName').value = '';
      document.getElementById('itemDescription').value = '';
      loadItems();
    }
  } catch (error) {
    console.error('Error adding item:', error);
  }
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;

  try {
    const response = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (response.ok) {
      loadItems();
    }
  } catch (error) {
    console.error('Error deleting item:', error);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

loadItems();
