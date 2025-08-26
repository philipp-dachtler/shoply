const SUPABASE_URL = 'https://tkcverqfaantgpouhpis.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrY3ZlcnFmYWFudGdwb3VocGlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NTQ2NzAsImV4cCI6MjA3MTUzMDY3MH0.EaHuBXIkmNBkKw2UANlLaB3BZy9R13u6VeAVOwIC138';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginBtn = document.getElementById('loginBtn');
const familyIdInput = document.getElementById('familyId');
const loginStatus = document.getElementById('loginStatus');
const familyName = document.getElementById('familyName');
const addItemBtn = document.getElementById('addItemBtn');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const itemNameInput = document.getElementById('itemName');
const itemCategorySelect = document.getElementById('itemCategory');
const itemQuantityInput = document.getElementById('itemQuantity');
const newCategoryNameInput = document.getElementById('newCategoryName');
const categoryList = document.getElementById('categoryList');
const appStatus = document.getElementById('appStatus');
const updateTime = document.getElementById('updateTime');
const logoutBtn = document.getElementById('logoutBtn');
const connectionStatus = document.getElementById('connectionStatus');
const splashScreen = document.getElementById('splashScreen');

let currentFamilyId = null;
let currentFamilyData = null;
let categories = [];
let realtimeSubscription = null;
let periodicUpdateInterval = null;

let lastItemsUpdate = null;
let lastCategoriesUpdate = null;
let currentItemsHash = null;
let currentCategoriesHash = null;
let itemsHashByCategory = {};

let LOG_TIMEOUT = 1387;
let REFRESH_TIMEOUT = 1387 - 10;

let isSplashVisible = false;
let lastHiddenTime = 0;

loginBtn.addEventListener('click', handleLogin);
addItemBtn.addEventListener('click', addItem);
addCategoryBtn.addEventListener('click', addCategory);
logoutBtn.addEventListener('click', handleLogout);

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const authId = urlParams.get('auth_id');
    if (authId && authId.length === 64) {
        familyIdInput.value = authId;
        handleLogin();
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
            location.reload();
        }, REFRESH_TIMEOUT);
    }
});

categoryList.addEventListener('click', (e) => {
    const clickedElement = e.target;
    const checkBtn = clickedElement.closest('.btn-check');
    const deleteBtn = clickedElement.closest('.btn-delete');
    const deleteCategoryBtn = clickedElement.closest('.btn-delete-category');

    if (checkBtn) {
        e.preventDefault();
        e.stopPropagation();
        const itemElement = checkBtn.closest('.item');
        const itemId = itemElement.dataset.id;
        const isDone = itemElement.classList.contains('done');
        toggleItemDone(itemId, !isDone);
    } else if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const itemElement = deleteBtn.closest('.item');
        const itemId = itemElement.dataset.id;
        if (confirm('Möchten Sie dieses Item wirklich löschen?')) {
            deleteItem(itemId);
        }
    } else if (deleteCategoryBtn) {
        e.preventDefault();
        e.stopPropagation();
        const categoryCard = deleteCategoryBtn.closest('.category-card');
        const categoryId = categoryCard.dataset.categoryId;
        const categoryName = categoryCard.querySelector('h4').textContent;
        if (confirm(`Möchten Sie die Kategorie "${categoryName}" wirklich löschen? Alle Items in dieser Kategorie werden ebenfalls gelöscht.`)) {
            deleteCategory(categoryId);
        }
    }
});

window.addEventListener('load', () => {
    const savedFamilyId = localStorage.getItem('familyId');
    if (savedFamilyId) {
        familyIdInput.value = savedFamilyId;
        handleLogin();
    }
});

function showStatusMessage(message, type) {
    appStatus.textContent = message;
    appStatus.className = `status-message ${type}`;
    appStatus.classList.remove('isHidden');
    appStatus.classList.remove('hidden');
    
    setTimeout(() => {
        appStatus.classList.add('isHidden');
		setTimeout(() => {
        	appStatus.textContent = '';
        	appStatus.classList.add('hidden');
		}, 900);
    }, 3000);
}

function createDataHash(data) {
    return JSON.stringify(data).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0);
}

function startPeriodicUpdate() {
    if (periodicUpdateInterval) {
        clearInterval(periodicUpdateInterval);
    }

    periodicUpdateInterval = setInterval(async () => {
        if (currentFamilyId) {
            await checkForUpdates();
        }
    }, 1787);
}

function stopPeriodicUpdate() {
    if (periodicUpdateInterval) {
        clearInterval(periodicUpdateInterval);
        periodicUpdateInterval = null;
    }
}

async function checkForUpdates() {
    try {
        const {
            data: categoriesData,
            error: categoriesError
        } = await supabase
            .from('categories')
            .select('*')
            .eq('family_id', currentFamilyId)
            .order('name');

        if (!categoriesError && categoriesData) {
            const newCategoriesHash = createDataHash(categoriesData);
            if (currentCategoriesHash !== newCategoriesHash) {
                console.log('Categories have been updated');
                await handleCategoryUpdates(categoriesData);
            }
        }

        const {
            data: itemsData,
            error: itemsError
        } = await supabase
            .from('items')
            .select(`
                        *,
                        category:categories(name)
                    `)
            .eq('family_id', currentFamilyId)
            .order('created_at', {
                ascending: false
            });

        if (!itemsError && itemsData) {
            await handleItemUpdates(itemsData || []);
        }

    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}

async function handleCategoryUpdates(newCategoriesData) {
    const oldCategories = [...categories];
    const newCategoriesHash = createDataHash(newCategoriesData);

    currentCategoriesHash = newCategoriesHash;
    categories = newCategoriesData;

    updateCategoryDropdown();

    const deletedCategories = oldCategories.filter(oldCat =>
        !newCategoriesData.find(newCat => newCat.id === oldCat.id)
    );

    deletedCategories.forEach(deletedCat => {
        const categoryCard = document.querySelector(`[data-category-id="${deletedCat.id}"]`);
        if (categoryCard) {
            categoryCard.remove();
            console.log(`Removed category card for: ${deletedCat.name}`);
        }
        delete itemsHashByCategory[deletedCat.id];
    });

    const addedCategories = newCategoriesData.filter(newCat =>
        !oldCategories.find(oldCat => oldCat.id === newCat.id)
    );

    addedCategories.forEach(addedCat => {
        addEmptyCategory(addedCat);
        console.log(`Added new category: ${addedCat.name}`);
    });

    updateTime.textContent = new Date().toLocaleTimeString();
}

async function handleItemUpdates(itemsData) {
    const itemsByCategory = {};

    categories.forEach(category => {
        itemsByCategory[category.id] = [];
    });

    itemsData.forEach(item => {
        const categoryId = item.category_id || 'uncategorized';
        if (!itemsByCategory[categoryId]) {
            itemsByCategory[categoryId] = [];
        }
        itemsByCategory[categoryId].push(item);
    });

    for (const categoryId in itemsByCategory) {
        const categoryItems = itemsByCategory[categoryId];
        const newHash = createDataHash(categoryItems);
        const oldHash = itemsHashByCategory[categoryId];

        if (oldHash !== newHash) {
            console.log(`Items updated in category: ${categoryId}`);
            itemsHashByCategory[categoryId] = newHash;
            updateCategoryItems(categoryId, categoryItems);
        }
    }

    Object.keys(itemsHashByCategory).forEach(categoryId => {
        if (!itemsByCategory[categoryId] && itemsHashByCategory[categoryId]) {
            console.log(`Category ${categoryId} now empty`);
            itemsHashByCategory[categoryId] = createDataHash([]);
            updateCategoryItems(categoryId, []);
        }
    });

    updateTime.textContent = new Date().toLocaleTimeString();
}

function updateCategoryItems(categoryId, items) {
    const categoryCard = document.querySelector(`[data-category-id="${categoryId}"]`);
    if (!categoryCard) {
        const category = categories.find(cat => cat.id === categoryId);
        if (category) {
            addCategoryWithItems(category, items);
        }
        return;
    }

    const itemsList = categoryCard.querySelector('.items-list');
    if (!itemsList) return;

    itemsList.innerHTML = '';

    if (items.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'empty-category';
        emptyMessage.textContent = 'Keine Items in dieser Kategorie';
        itemsList.appendChild(emptyMessage);
    } else {
        items.forEach(item => {
            const listItem = createItemElement(item);
            itemsList.appendChild(listItem);
        });
    }

    console.log(`Updated ${items.length} items in category ${categoryId}`);
}

function createItemElement(item) {
    const listItem = document.createElement('li');
    listItem.className = `item ${item.done ? 'done' : ''}`;
    listItem.dataset.id = item.id;

    const itemText = document.createElement('span');
    itemText.textContent = item.quantity > 1 ? `${item.name} (${item.quantity}x)` : item.name;

    const itemActions = document.createElement('div');
    itemActions.className = 'item-actions';

    const checkBtn = document.createElement('button');
    checkBtn.className = 'btn-check';
    checkBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 -960 960 960" width="32" fill="#fff"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 -960 960 960" width="32" fill="#fff"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>';

    itemActions.appendChild(checkBtn);
    itemActions.appendChild(deleteBtn);
    listItem.appendChild(itemText);
    listItem.appendChild(itemActions);

    return listItem;
}

function addEmptyCategory(category) {
    addCategoryWithItems(category, []);
}

function addCategoryWithItems(category, items) {
    const categoryCard = document.createElement('div');
    categoryCard.className = 'category-card';
    categoryCard.dataset.categoryId = category.id;

    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'category-header';

    const categoryTitle = document.createElement('h4');
    categoryTitle.textContent = category.name;

    const deleteCategoryBtn = document.createElement('button');
    deleteCategoryBtn.className = 'btn-delete-category';
    deleteCategoryBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 -960 960 960" width="32" fill="#fff"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>';
    deleteCategoryBtn.title = 'Kategorie löschen';
    categoryHeader.appendChild(categoryTitle);
    categoryHeader.appendChild(deleteCategoryBtn);

    categoryCard.appendChild(categoryHeader);

    const itemsList = document.createElement('ul');
    itemsList.className = 'items-list';

    if (items.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'empty-category';
        emptyMessage.textContent = 'Keine Items in dieser Kategorie';
        itemsList.appendChild(emptyMessage);
    } else {
        items.forEach(item => {
            const listItem = createItemElement(item);
            itemsList.appendChild(listItem);
        });
    }

    categoryCard.appendChild(itemsList);
    categoryList.appendChild(categoryCard);

    setTimeout(() => {
        categoryCard.classList.add('fadeIn');
        
        setTimeout(() => {
            categoryCard.classList.remove('fadeIn');
            categoryCard.classList.add('animated');
        }, 600);
    }, 50);
    
    itemsHashByCategory[category.id] = createDataHash(items);
}

async function handleLogin() {
    const familyId = familyIdInput.value.trim();

    if (familyId.length !== 64) {
        showLoginStatus('Die Familien-ID muss genau 64 Zeichen lang sein.', 'error');
        return;
    }

    try {
        const {
            data,
            error
        } = await supabase
            .from('families')
            .select('*')
            .eq('id', familyId)
            .single();

        if (error || !data) {
            showLoginStatus('Ungültige Familien-ID. Bitte überprüfen Sie die ID.', 'error');
            return;
        }

        currentFamilyId = familyId;
        currentFamilyData = data;
        familyName.textContent = data.display_name;
        loginScreen.style.display = 'none';
        appScreen.style.display = 'block';

        localStorage.setItem('familyId', familyId);

        await loadCategories();
        await loadItems();
        setupRealtimeSubscription();

        startPeriodicUpdate();

        document.querySelector(".card-header").style.display = "block";
        document.querySelector(".user-info").style.display = "block";

    } catch (error) {
        showLoginStatus('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.', 'error');
        console.error('Login error:', error);
    }
}

function handleLogout() {
    stopPeriodicUpdate();

    currentFamilyId = null;
    currentFamilyData = null;
    categories = [];

    lastItemsUpdate = null;
    lastCategoriesUpdate = null;
    currentItemsHash = null;
    currentCategoriesHash = null;
    itemsHashByCategory = {};

    if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription);
        realtimeSubscription = null;
    }

    localStorage.removeItem('familyId');

    appScreen.style.display = 'none';
    loginScreen.style.display = 'block';
    document.querySelector(".user-info").style.display = "none";

    familyIdInput.value = '';

    connectionStatus.className = 'connection-status disconnected';
    setTimeout(() => {
        location.reload();
    }, 100);
}

function showLoginStatus(message, type) {
    loginStatus.textContent = message;
    loginStatus.className = `status-message ${type}`;
    loginStatus.style.display = 'block';
}

function setupRealtimeSubscription() {
    if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription);
    }

    connectionStatus.className = 'connection-status connected';

    realtimeSubscription = supabase
        .channel('items-changes')
        .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'items',
                filter: `family_id=eq.${currentFamilyId}`
            },
            (payload) => {
                console.log('Realtime change received!', payload);
                if (payload.eventType === 'DELETE' && payload.old?.category_id) {
                    delete itemsHashByCategory[payload.old.category_id];
                } else {
                    itemsHashByCategory = {};
                }
                checkForUpdates();
            }
        )
        .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'categories',
                filter: `family_id=eq.${currentFamilyId}`
            },
            (payload) => {
                console.log('Realtime change received!', payload);
                currentCategoriesHash = null;
                checkForUpdates();
            }
        )
        .subscribe((status) => {
            console.log('Realtime status:', status);
            if (status === 'SUBSCRIBED') {
                connectionStatus.className = 'connection-status connected';
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                connectionStatus.className = 'connection-status disconnected';
            }
        });
}

function updateCategoryDropdown() {
    itemCategorySelect.innerHTML = '<option value="">Bitte wählen...</option>';

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        itemCategorySelect.appendChild(option);
    });
}

async function loadCategories() {
    try {
        const {
            data,
            error
        } = await supabase
            .from('categories')
            .select('*')
            .eq('family_id', currentFamilyId)
            .order('name');

        if (error) {
            throw error;
        }

        categories = data || [];

        currentCategoriesHash = createDataHash(categories);

        updateCategoryDropdown();

        categories.forEach(category => {
            itemsHashByCategory[category.id] = null;
        });

    } catch (error) {
        console.error('Error loading categories:', error);
        showStatusMessage('Fehler beim Laden der Kategorien.', 'error');
    }
}

async function addCategory() {
    const name = newCategoryNameInput.value.trim();

    if (!name) {
        showStatusMessage('Bitte geben Sie einen Namen für die Kategorie ein.', 'error');
        return;
    }

    const duplicateCategory = categories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
    if (duplicateCategory) {
        showStatusMessage('Eine Kategorie mit diesem Namen existiert bereits.', 'error');
        return;
    }

    try {
        const {
            data,
            error
        } = await supabase
            .from('categories')
            .insert([{
                name: name,
                family_id: currentFamilyId
            }])
            .select();

        if (error) {
            if (error.code === '23505') {
                showStatusMessage('Eine Kategorie mit diesem Namen existiert bereits.', 'error');
            } else {
                throw error;
            }
            return;
        }

        showStatusMessage(`Kategorie "${name}" wurde hinzugefügt.`, 'success');

        newCategoryNameInput.value = '';

        await loadCategories();
        await loadItems();

    } catch (error) {
        console.error('Error adding category:', error);
        showStatusMessage('Fehler beim Hinzufügen der Kategorie.', 'error');
    }
}

function renderItems(items) {
    const itemsByCategory = {};

    categories.forEach(category => {
        itemsByCategory[category.name] = {
            items: [],
            categoryId: category.id
        };
    });

    if (items) {
        items.forEach(item => {
            const categoryName = item.category?.name || 'Unkategorisiert';
            if (!itemsByCategory[categoryName]) {
                itemsByCategory[categoryName] = {
                    items: [],
                    categoryId: null
                };
            }
            itemsByCategory[categoryName].items.push(item);
        });
    }

    categoryList.innerHTML = '<div id="emptyCatList" style="text-align: center; width: 100%"><p>Noch keine Kategorien oder Items hinzugefügt</p><p>Füge ein Item oder eine Kategorie mit "<i class="fas fa-plus"></i>" hinzu.</p></div>';

    for (const categoryName in itemsByCategory) {
        document.getElementById("emptyCatList").style.display = 'none';
        const categoryData = itemsByCategory[categoryName];
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.dataset.categoryId = categoryData.categoryId;

        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';

        const categoryTitle = document.createElement('h4');
        categoryTitle.textContent = categoryName;

        if (categoryName !== 'Unkategorisiert' && categoryData.categoryId) {
            const deleteCategoryBtn = document.createElement('button');
            deleteCategoryBtn.className = 'btn-delete-category';
            deleteCategoryBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 -960 960 960" width="32" fill="#fff"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>';
            deleteCategoryBtn.title = 'Kategorie löschen';
            categoryHeader.appendChild(categoryTitle);
            categoryHeader.appendChild(deleteCategoryBtn);
        } else {
            categoryHeader.appendChild(categoryTitle);
        }

        categoryCard.appendChild(categoryHeader);

        const itemsList = document.createElement('ul');
        itemsList.className = 'items-list';

        if (categoryData.items.length === 0) {
            const emptyMessage = document.createElement('li');
            emptyMessage.className = 'empty-category';
            emptyMessage.textContent = 'Keine Items in dieser Kategorie';
            itemsList.appendChild(emptyMessage);
        } else {
            categoryData.items.forEach(item => {
                const listItem = document.createElement('li');
                listItem.className = `item ${item.done ? 'done' : ''}`;
                listItem.dataset.id = item.id;

                const itemText = document.createElement('span');
                itemText.textContent = item.quantity > 1 ? `${item.name} (${item.quantity}x)` : item.name;

                const itemActions = document.createElement('div');
                itemActions.className = 'item-actions';

                const checkBtn = document.createElement('button');
                checkBtn.className = 'btn-check';
                checkBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 -960 960 960" width="32" fill="#fff"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>';

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn-delete';
                deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 -960 960 960" width="32" fill="#fff"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>';

                itemActions.appendChild(checkBtn);
                itemActions.appendChild(deleteBtn);
                listItem.appendChild(itemText);
                listItem.appendChild(itemActions);
                itemsList.appendChild(listItem);
            });
        }

        categoryCard.appendChild(itemsList);
        categoryList.appendChild(categoryCard);

		setTimeout(() => {
            categoryCard.classList.add('fadeIn');
            
            setTimeout(() => {
                categoryCard.classList.remove('fadeIn');
                categoryCard.classList.add('animated');
            }, 600);
        }, 50);
    }
}

async function loadItems() {
    try {
        const {
            data: items,
            error
        } = await supabase
            .from('items')
            .select(`
                        *,
                        category:categories(name)
                    `)
            .eq('family_id', currentFamilyId)
            .order('created_at', {
                ascending: false
            });

        if (error) {
            throw error;
        }

        const itemsByCategory = {};
        categories.forEach(category => {
            itemsByCategory[category.id] = [];
        });

        if (items) {
            items.forEach(item => {
                const categoryId = item.category_id || 'uncategorized';
                if (!itemsByCategory[categoryId]) {
                    itemsByCategory[categoryId] = [];
                }
                itemsByCategory[categoryId].push(item);
            });
        }

        for (const categoryId in itemsByCategory) {
            itemsHashByCategory[categoryId] = createDataHash(itemsByCategory[categoryId]);
        }

        renderItems(items);

        updateTime.textContent = new Date().toLocaleTimeString();

    } catch (error) {
        console.error('Error loading items:', error);
        showStatusMessage('Fehler beim Laden der Einkaufsliste.', 'error');
    }
}

async function addItem() {
    const name = itemNameInput.value.trim();
    const categoryId = itemCategorySelect.value;
    const quantity = parseInt(itemQuantityInput.value) || 1;

    if (!name) {
        showStatusMessage('Bitte geben Sie einen Namen für das Item ein.', 'error');
        return;
    }

    if (!categoryId) {
        showStatusMessage('Bitte wählen Sie eine Kategorie aus.', 'error');
        return;
    }

    try {
        const {
            data,
            error
        } = await supabase
            .from('items')
            .insert([{
                name: name,
                category_id: categoryId,
                family_id: currentFamilyId,
                quantity: quantity,
                done: false
            }])
            .select();

        if (error) {
            throw error;
        }

        showStatusMessage(`"${name}" wurde zur Einkaufsliste hinzugefügt.`, 'success');

        itemNameInput.value = '';
        itemQuantityInput.value = '1';

        await updateCategoryItems(categoryId);

    } catch (error) {
        console.error('Error adding item:', error);
        showStatusMessage('Fehler beim Hinzufügen des Items.', 'error');
    }
}

async function deleteItem(itemId) {
    try {
        const { data: item, error: fetchError } = await supabase
            .from('items')
            .select('category_id')
            .eq('id', itemId)
            .single();

        if (fetchError) throw fetchError;

        const categoryId = item.category_id;

        const {
            error
        } = await supabase
            .from('items')
            .delete()
            .eq('id', itemId);

        if (error) {
            throw error;
        }

        await updateCategoryItems(categoryId);

    } catch (error) {
        console.error('Error deleting item:', error);
        showStatusMessage('Fehler beim Löschen des Items.', 'error');
    }
}

async function deleteCategory(categoryId) {
    try {
        const {
            error: itemsError
        } = await supabase
            .from('items')
            .delete()
            .eq('category_id', categoryId);

        if (itemsError) {
            throw itemsError;
        }

        const {
            error: categoryError
        } = await supabase
            .from('categories')
            .delete()
            .eq('id', categoryId);

        if (categoryError) {
            throw categoryError;
        }

        showStatusMessage('Kategorie wurde erfolgreich gelöscht.', 'success');

        await loadCategories();
        await loadItems();

    } catch (error) {
        console.error('Error deleting category:', error);
        showStatusMessage('Fehler beim Löschen der Kategorie.', 'error');
    }
}

async function toggleItemDone(itemId, done) {
    try {
        const {
            error
        } = await supabase
            .from('items')
            .update({
                done: done
            })
            .eq('id', itemId);

        if (error) {
            throw error;
        }

        const itemElement = document.querySelector(`.item[data-id="${itemId}"]`);
        if (itemElement) {
            if (done) {
                itemElement.classList.add('done');
            } else {
                itemElement.classList.remove('done');
            }
        }

    } catch (error) {
        console.error('Error toggling item done status:', error);
        showStatusMessage('Fehler beim Aktualisieren des Item-Status.', 'error');
    }
}

function showSplashScreen() {
    if (isSplashVisible) return;

    isSplashVisible = true;
    splashScreen.classList.remove('isHidden');

    setTimeout(() => {
        splashScreen.classList.add('isHidden');
        isSplashVisible = false;
    }, LOG_TIMEOUT);
}

async function updateCategoryItems(categoryId) {
    try {
        const { data: items, error } = await supabase
            .from('items')
            .select(`
                *,
                category:categories(name)
            `)
            .eq('category_id', categoryId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        itemsHashByCategory[categoryId] = createDataHash(items || []);
        
        const categoryCard = document.querySelector(`[data-category-id="${categoryId}"]`);
        if (categoryCard) {
            const itemsList = categoryCard.querySelector('.items-list');
            if (itemsList) {
                itemsList.innerHTML = '';

                if (!items || items.length === 0) {
                    const emptyMessage = document.createElement('li');
                    emptyMessage.className = 'empty-category';
                    emptyMessage.textContent = 'Keine Items in dieser Kategorie';
                    itemsList.appendChild(emptyMessage);
                } else {
                    items.forEach(item => {
                        const listItem = createItemElement(item);
                        itemsList.appendChild(listItem);
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error updating category items:', error);
        showStatusMessage('Fehler beim Aktualisieren der Kategorie.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', function() {
	showSplashScreen();

	document.addEventListener('visibilitychange', function() {
		if (document.hidden) {
			lastHiddenTime = Date.now();
		} else {
			const timeAway = Date.now() - lastHiddenTime;
			if (timeAway > 1000) {
				showSplashScreen();
			}
		}
	});

	window.addEventListener('focus', function() {
		if (lastHiddenTime > 0) {
			const timeAway = Date.now() - lastHiddenTime;
			if (timeAway > 1000) {
				showSplashScreen();
			}
		}
	});
});

document.addEventListener('resume', function() {
    showSplashScreen();
});

window.addEventListener('blur', function() {
    lastHiddenTime = Date.now();
});

document.addEventListener('DOMContentLoaded', function() {
    showSplashScreen();

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            lastHiddenTime = Date.now();
        } else {
            const timeAway = Date.now() - lastHiddenTime;
            if (timeAway > 1000) {
                showSplashScreen();
            }
        }
    });

	const userAgent = navigator.userAgent;
	const isChrome = /Chrome/i.test(userAgent) && !/Edge/i.test(userAgent);
	const isEdge = /Edge/i.test(userAgent);
	const isFirefox = /Firefox/i.test(userAgent);
	const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent);
	const isAndroid = /Android/i.test(userAgent);
	const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

	if (isAndroid && isChrome) {
		document.querySelector('[data-platform="android"]').click();
	} else if (isIOS && isSafari) {
		document.querySelector('[data-platform="safari"]').click();
	} else if (isFirefox) {
		document.querySelector('[data-platform="firefox"]').click();
	} else if (isChrome || isEdge) {
		document.querySelector('[data-platform="chrome"]').click();
	}
});

platformButtons.forEach(button => {
	button.addEventListener('click', () => {
		platformButtons.forEach(btn => btn.classList.remove('active'));

		button.classList.add('active');

		tutorialSections.forEach(section => {
			section.classList.remove('active');
		});

		const platform = button.dataset.platform;
		const targetSection = document.getElementById(`${platform}-tutorial`);
		if (targetSection) {
			targetSection.classList.add('active');
		}
	});
});